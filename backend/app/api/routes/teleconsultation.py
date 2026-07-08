from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid
from app.database import get_db
from app.models.teleconsultation import RendezVous, TypeRDV, StatutRDV
from app.models.document_tele import DocumentTele
from app.models.patient import Patient
from app.models.utilisateur import Utilisateur
from app.models.consultation import Consultation, ServiceConsultation, StatutConsultation, NiveauUrgence
from app.models.caisse import Tarif, TypeActe
from app.api.routes.auth import get_current_active_user
from app.api.routes.caisse import creer_facture_acte, generate_numero_facture  # noqa
from app.api.routes.consultations import generate_numero_consultation

router = APIRouter(prefix="/teleconsultations", tags=["Téléconsultation"])


class RDVCreate(BaseModel):
    patient_id: int
    medecin_id: Optional[int] = None
    date_heure: datetime
    type_rdv: TypeRDV = TypeRDV.TELECONSULTATION
    motif: Optional[str] = None


class RDVUpdate(BaseModel):
    date_heure: Optional[datetime] = None
    medecin_id: Optional[int] = None
    motif: Optional[str] = None
    notes: Optional[str] = None


async def _serialize(db: AsyncSession, r: RendezVous) -> dict:
    patient = await db.get(Patient, r.patient_id)
    medecin = await db.get(Utilisateur, r.medecin_id) if r.medecin_id else None
    return {
        "id": r.id,
        "patient": f"{patient.nom} {patient.prenom}" if patient else "—",
        "patient_id": r.patient_id,
        "medecin": f"{medecin.prenom} {medecin.nom}" if medecin else None,
        "medecin_id": r.medecin_id,
        "date_heure": str(r.date_heure),
        "type_rdv": r.type_rdv.value if hasattr(r.type_rdv, "value") else r.type_rdv,
        "statut": r.statut.value if hasattr(r.statut, "value") else r.statut,
        "motif": r.motif,
        "notes": r.notes,
        "room_id": r.room_id,
        "token_patient": r.token_patient,
        "consultation_id": r.consultation_id,
        "created_at": str(r.created_at),
    }


@router.get("")
async def list_rdv(
    statut: Optional[StatutRDV] = None,
    patient_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    query = select(RendezVous)
    if statut:
        query = query.where(RendezVous.statut == statut)
    if patient_id:
        query = query.where(RendezVous.patient_id == patient_id)
    query = query.order_by(RendezVous.date_heure.desc())
    result = await db.execute(query)
    return {"rendez_vous": [await _serialize(db, r) for r in result.scalars().all()]}


@router.get("/{rdv_id}")
async def get_rdv(rdv_id: int, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_active_user)):
    r = await db.get(RendezVous, rdv_id)
    if not r:
        raise HTTPException(404, "Rendez-vous introuvable")
    return await _serialize(db, r)


@router.post("", status_code=201)
async def create_rdv(data: RDVCreate, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_active_user)):
    patient = await db.get(Patient, data.patient_id)
    if not patient:
        raise HTTPException(404, "Patient introuvable")
    r = RendezVous(
        patient_id=data.patient_id, medecin_id=data.medecin_id, date_heure=data.date_heure,
        type_rdv=data.type_rdv, motif=data.motif, statut=StatutRDV.PLANIFIE, created_by=current_user.id,
    )
    if data.type_rdv == TypeRDV.TELECONSULTATION:
        r.room_id = f"sad-{uuid.uuid4().hex[:12]}"
        r.token_patient = uuid.uuid4().hex
    db.add(r)
    await db.flush()
    return await _serialize(db, r)


@router.put("/{rdv_id}")
async def update_rdv(rdv_id: int, data: RDVUpdate, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_active_user)):
    r = await db.get(RendezVous, rdv_id)
    if not r:
        raise HTTPException(404, "Rendez-vous introuvable")
    if r.statut in (StatutRDV.TERMINE, StatutRDV.ANNULE):
        raise HTTPException(400, "Rendez-vous clôturé — modification impossible")
    for key, val in data.model_dump(exclude_none=True).items():
        setattr(r, key, val)
    await db.flush()
    return await _serialize(db, r)


@router.post("/{rdv_id}/annuler")
async def annuler_rdv(rdv_id: int, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_active_user)):
    r = await db.get(RendezVous, rdv_id)
    if not r:
        raise HTTPException(404, "Rendez-vous introuvable")
    if r.statut == StatutRDV.TERMINE:
        raise HTTPException(400, "Séance déjà terminée")
    r.statut = StatutRDV.ANNULE
    return {"message": "Rendez-vous annulé", "statut": r.statut}


@router.post("/{rdv_id}/demarrer")
async def demarrer_rdv(rdv_id: int, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_active_user)):
    """Démarre la séance : crée/relie une consultation et passe en cours."""
    r = await db.get(RendezVous, rdv_id)
    if not r:
        raise HTTPException(404, "Rendez-vous introuvable")
    if r.statut == StatutRDV.ANNULE:
        raise HTTPException(400, "Rendez-vous annulé")
    if not r.consultation_id:
        numero = await generate_numero_consultation(db)
        consult = Consultation(
            numero=numero, patient_id=r.patient_id, medecin_id=r.medecin_id,
            service=ServiceConsultation.GENERALE,
            motif=r.motif or ("Téléconsultation" if r.type_rdv == TypeRDV.TELECONSULTATION else "Consultation"),
            niveau_urgence=NiveauUrgence.VERT, statut=StatutConsultation.EN_COURS,
        )
        db.add(consult)
        await db.flush()
        r.consultation_id = consult.id
    r.statut = StatutRDV.EN_COURS
    return {"message": "Séance démarrée", "consultation_id": r.consultation_id, "room_id": r.room_id, "statut": r.statut}


@router.post("/{rdv_id}/terminer")
async def terminer_rdv(rdv_id: int, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_active_user)):
    """Termine la séance + facturation (tarif Téléconsultation)."""
    r = await db.get(RendezVous, rdv_id)
    if not r:
        raise HTTPException(404, "Rendez-vous introuvable")
    if r.statut == StatutRDV.TERMINE:
        raise HTTPException(400, "Séance déjà terminée")
    r.statut = StatutRDV.TERMINE
    # Tarif
    res = await db.execute(select(Tarif).where(Tarif.type_acte == TypeActe.TELECONSULTATION, Tarif.est_actif == 1))
    tarif = res.scalar_one_or_none()
    montant = tarif.montant if tarif else 2000
    facture = await creer_facture_acte(
        db, r.patient_id, TypeActe.TELECONSULTATION,
        "Téléconsultation" + (f" — {r.motif}" if r.motif else ""), 1, montant,
        current_user.id, consultation_id=r.consultation_id, type_source="teleconsultation",
    )
    return {"message": "Séance terminée", "facture_numero": facture.numero, "consultation_id": r.consultation_id}


@router.get("/salle/{token}")
async def get_salle(token: str, db: AsyncSession = Depends(get_db)):
    """Accès patient à la salle via jeton public (sans authentification)."""
    res = await db.execute(select(RendezVous).where(RendezVous.token_patient == token))
    r = res.scalar_one_or_none()
    if not r:
        raise HTTPException(404, "Salle introuvable ou lien expiré")
    patient = await db.get(Patient, r.patient_id)
    medecin = await db.get(Utilisateur, r.medecin_id) if r.medecin_id else None
    return {
        "room_id": r.room_id,
        "statut": r.statut.value if hasattr(r.statut, "value") else r.statut,
        "date_heure": str(r.date_heure),
        "patient": f"{patient.nom} {patient.prenom}" if patient else "—",
        "medecin": f"{medecin.prenom} {medecin.nom}" if medecin else None,
        "motif": r.motif,
    }


# ─── Documents partagés ──────────────────────────────────────────────────────
MAX_DOC_SIZE = 8 * 1024 * 1024  # 8 Mo


def _doc_dict(d: DocumentTele) -> dict:
    return {
        "id": d.id, "nom_fichier": d.nom_fichier, "type_mime": d.type_mime,
        "taille": d.taille, "source": d.source, "depose_par": d.depose_par,
        "created_at": str(d.created_at),
    }


async def _rdv_by_token(db: AsyncSession, token: str) -> RendezVous:
    res = await db.execute(select(RendezVous).where(RendezVous.token_patient == token))
    r = res.scalar_one_or_none()
    if not r:
        raise HTTPException(404, "Salle introuvable ou lien expiré")
    return r


async def _list_documents(db: AsyncSession, rdv_id: int) -> list:
    res = await db.execute(select(DocumentTele).where(DocumentTele.rdv_id == rdv_id).order_by(DocumentTele.created_at.desc()))
    return [_doc_dict(d) for d in res.scalars().all()]


async def _save_document(db: AsyncSession, rdv_id: int, file: UploadFile, source: str, auteur: str) -> dict:
    contenu = await file.read()
    if len(contenu) > MAX_DOC_SIZE:
        raise HTTPException(400, "Fichier trop volumineux (max 8 Mo)")
    doc = DocumentTele(
        rdv_id=rdv_id, nom_fichier=file.filename or "document", type_mime=file.content_type,
        taille=len(contenu), contenu=contenu, source=source, depose_par=auteur,
    )
    db.add(doc)
    await db.flush()
    return _doc_dict(doc)


def _download_response(d: DocumentTele) -> Response:
    return Response(
        content=d.contenu,
        media_type=d.type_mime or "application/octet-stream",
        headers={"Content-Disposition": f'inline; filename="{d.nom_fichier}"'},
    )


# Côté personnel (authentifié)
@router.get("/{rdv_id}/documents")
async def list_documents(rdv_id: int, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_active_user)):
    return {"documents": await _list_documents(db, rdv_id)}


@router.post("/{rdv_id}/documents", status_code=201)
async def upload_document(rdv_id: int, file: UploadFile = File(...), db: AsyncSession = Depends(get_db), current_user=Depends(get_current_active_user)):
    r = await db.get(RendezVous, rdv_id)
    if not r:
        raise HTTPException(404, "Rendez-vous introuvable")
    return await _save_document(db, rdv_id, file, "staff", f"{current_user.prenom} {current_user.nom}")


@router.get("/{rdv_id}/documents/{doc_id}")
async def download_document(rdv_id: int, doc_id: int, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_active_user)):
    d = await db.get(DocumentTele, doc_id)
    if not d or d.rdv_id != rdv_id:
        raise HTTPException(404, "Document introuvable")
    return _download_response(d)


# Côté patient (jeton public)
@router.get("/salle/{token}/documents")
async def list_documents_patient(token: str, db: AsyncSession = Depends(get_db)):
    r = await _rdv_by_token(db, token)
    return {"documents": await _list_documents(db, r.id)}


@router.post("/salle/{token}/documents", status_code=201)
async def upload_document_patient(token: str, file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    r = await _rdv_by_token(db, token)
    return await _save_document(db, r.id, file, "patient", "Patient")


@router.get("/salle/{token}/documents/{doc_id}")
async def download_document_patient(token: str, doc_id: int, db: AsyncSession = Depends(get_db)):
    r = await _rdv_by_token(db, token)
    d = await db.get(DocumentTele, doc_id)
    if not d or d.rdv_id != r.id:
        raise HTTPException(404, "Document introuvable")
    return _download_response(d)
