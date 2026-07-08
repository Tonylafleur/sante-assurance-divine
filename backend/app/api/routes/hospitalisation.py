from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date
from app.database import get_db
from app.models.hospitalisation import Lit, Hospitalisation, StatutLit, TypeChambre
from app.models.patient import Patient
from app.models.caisse import TypeActe
from app.api.routes.auth import get_current_active_user
from app.api.routes.caisse import creer_facture_acte

router = APIRouter(prefix="/hospitalisation", tags=["Hospitalisation"])


class AdmissionCreate(BaseModel):
    patient_id: int
    lit_id: int
    motif: str
    diagnostic_entree: Optional[str] = None
    traitement_en_cours: Optional[str] = None
    date_sortie_prevue: Optional[datetime] = None


class EvolutionUpdate(BaseModel):
    note: str
    traitement_en_cours: Optional[str] = None


class SortieData(BaseModel):
    compte_rendu_sortie: str


class LitCreate(BaseModel):
    numero: str
    chambre: Optional[str] = None
    type_chambre: TypeChambre = TypeChambre.COMMUNE
    service: Optional[str] = None
    prix_par_jour: float = 0.0


def _lit_dict(l: Lit) -> dict:
    return {
        "id": l.id, "numero": l.numero, "chambre": l.chambre,
        "type_chambre": l.type_chambre, "service": l.service,
        "statut": l.statut, "prix_par_jour": l.prix_par_jour,
    }


async def _admission_dict(db: AsyncSession, h: Hospitalisation) -> dict:
    patient = await db.get(Patient, h.patient_id)
    lit = await db.get(Lit, h.lit_id)
    jours = max(1, ((h.date_sortie_effective or datetime.utcnow()) - h.date_entree).days)
    age = None
    sexe = None
    if patient:
        sexe = patient.sexe.value if hasattr(patient.sexe, "value") else patient.sexe
        if patient.date_naissance:
            age = (date.today() - patient.date_naissance).days // 365
    return {
        "id": h.id,
        "patient": f"{patient.nom} {patient.prenom}" if patient else "—",
        "patient_id": h.patient_id,
        "sexe": sexe,
        "age": age,
        "lit_id": h.lit_id,
        "lit_numero": lit.numero if lit else "—",
        "chambre": lit.chambre if lit else None,
        "type_chambre": lit.type_chambre if lit else None,
        "prix_par_jour": lit.prix_par_jour if lit else 0,
        "motif": h.motif,
        "diagnostic_entree": h.diagnostic_entree,
        "traitement_en_cours": h.traitement_en_cours,
        "notes_evolution": h.notes_evolution,
        "compte_rendu_sortie": h.compte_rendu_sortie,
        "date_entree": str(h.date_entree),
        "date_sortie_prevue": str(h.date_sortie_prevue) if h.date_sortie_prevue else None,
        "date_sortie_effective": str(h.date_sortie_effective) if h.date_sortie_effective else None,
        "jours": jours,
        "active": h.date_sortie_effective is None,
    }


@router.get("/lits")
async def list_lits(db: AsyncSession = Depends(get_db), current_user=Depends(get_current_active_user)):
    result = await db.execute(select(Lit).order_by(Lit.numero))
    lits = result.scalars().all()
    stats = {"total": len(lits), "disponibles": 0, "occupes": 0, "maintenance": 0}
    for l in lits:
        if l.statut == StatutLit.DISPONIBLE: stats["disponibles"] += 1
        elif l.statut == StatutLit.OCCUPE: stats["occupes"] += 1
        else: stats["maintenance"] += 1
    return {"stats": stats, "lits": [_lit_dict(l) for l in lits]}


@router.post("/lits", status_code=201)
async def create_lit(data: LitCreate, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_active_user)):
    existing = await db.execute(select(Lit).where(Lit.numero == data.numero))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Ce numéro de lit existe déjà")
    lit = Lit(**data.model_dump(), statut=StatutLit.DISPONIBLE)
    db.add(lit)
    await db.flush()
    return {"id": lit.id, "message": "Lit ajouté"}


@router.get("/admissions")
async def list_admissions(
    active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    query = select(Hospitalisation)
    if active is True:
        query = query.where(Hospitalisation.date_sortie_effective.is_(None))
    elif active is False:
        query = query.where(Hospitalisation.date_sortie_effective.is_not(None))
    query = query.order_by(Hospitalisation.date_entree.desc())
    result = await db.execute(query)
    return {"admissions": [await _admission_dict(db, h) for h in result.scalars().all()]}


@router.post("/admissions", status_code=201)
async def admettre(data: AdmissionCreate, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_active_user)):
    patient = await db.get(Patient, data.patient_id)
    if not patient:
        raise HTTPException(404, "Patient introuvable")
    lit = await db.get(Lit, data.lit_id)
    if not lit:
        raise HTTPException(404, "Lit introuvable")
    if lit.statut == StatutLit.OCCUPE:
        raise HTTPException(400, "Ce lit est déjà occupé")
    h = Hospitalisation(
        patient_id=data.patient_id, lit_id=data.lit_id, motif=data.motif,
        diagnostic_entree=data.diagnostic_entree, traitement_en_cours=data.traitement_en_cours,
        date_sortie_prevue=data.date_sortie_prevue, medecin_responsable_id=current_user.id,
    )
    lit.statut = StatutLit.OCCUPE
    db.add(h)
    await db.flush()
    return {"id": h.id, "message": "Patient admis"}


@router.put("/admissions/{admission_id}/evolution")
async def ajouter_evolution(admission_id: int, data: EvolutionUpdate, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_active_user)):
    h = await db.get(Hospitalisation, admission_id)
    if not h:
        raise HTTPException(404, "Admission introuvable")
    if h.date_sortie_effective:
        raise HTTPException(400, "Patient déjà sorti")
    horodatage = datetime.now().strftime("%d/%m/%Y %H:%M")
    ligne = f"[{horodatage} — {current_user.prenom} {current_user.nom}] {data.note}"
    h.notes_evolution = f"{h.notes_evolution}\n{ligne}" if h.notes_evolution else ligne
    if data.traitement_en_cours is not None:
        h.traitement_en_cours = data.traitement_en_cours
    return {"message": "Note d'évolution ajoutée"}


@router.post("/admissions/{admission_id}/sortie")
async def sortie(admission_id: int, data: SortieData, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_active_user)):
    """Sortie d'hospitalisation + libération du lit + facturation des journées."""
    h = await db.get(Hospitalisation, admission_id)
    if not h:
        raise HTTPException(404, "Admission introuvable")
    if h.date_sortie_effective:
        raise HTTPException(400, "Patient déjà sorti")
    h.date_sortie_effective = datetime.utcnow()
    h.compte_rendu_sortie = data.compte_rendu_sortie
    lit = await db.get(Lit, h.lit_id)
    facture_numero = None
    if lit:
        lit.statut = StatutLit.DISPONIBLE
        jours = max(1, (h.date_sortie_effective - h.date_entree).days)
        if (lit.prix_par_jour or 0) > 0:
            facture = await creer_facture_acte(
                db, h.patient_id, TypeActe.HOSPITALISATION,
                f"Hospitalisation {jours} jour(s) — lit {lit.numero} ({lit.type_chambre})",
                jours, lit.prix_par_jour, current_user.id, type_source="hospitalisation",
            )
            facture_numero = facture.numero
    return {"message": "Sortie enregistrée", "facture_numero": facture_numero}
