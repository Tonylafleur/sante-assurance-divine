from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
from app.database import get_db
from app.models.cpn import SuiviCPN, Accouchement
from app.models.patient import Patient
from app.models.caisse import TypeActe
from app.api.routes.auth import get_current_active_user
from app.api.routes.caisse import creer_facture_acte

router = APIRouter(prefix="/cpn", tags=["CPN & Maternité"])


class CPNCreate(BaseModel):
    patient_id: int
    date_derniere_regle: Optional[datetime] = None
    tension_arterielle: Optional[str] = None
    poids: Optional[float] = None
    hauteur_uterine: Optional[float] = None
    bruit_coeur_foetal: Optional[str] = None
    presentation: Optional[str] = None
    oedemes: bool = False
    albuminurie: Optional[str] = None
    glycosurie: Optional[str] = None
    hemoglobine: Optional[float] = None
    groupe_rhesus: Optional[str] = None
    test_vih: Optional[str] = None
    test_syphilis: Optional[str] = None
    fer_folate: bool = False
    moustiquaire: bool = False
    prevention_paludisme: bool = False
    observations: Optional[str] = None
    plan_accouchement: Optional[str] = None
    prochain_rdv: Optional[datetime] = None


class AccouchementCreate(BaseModel):
    patient_id: int
    type_accouchement: str = "Voie basse"
    duree_travail: Optional[str] = None
    sexe_nouveau_ne: Optional[str] = None
    poids_naissance: Optional[float] = None
    apgar_1min: Optional[int] = None
    apgar_5min: Optional[int] = None
    etat_nouveau_ne: Optional[str] = None
    complications: Optional[str] = None
    pertes_sang: Optional[float] = None
    notes: Optional[str] = None


def _calcul_terme(ddr: Optional[datetime]) -> tuple[Optional[str], Optional[str]]:
    """Terme prévu (DDR + 280j) et âge gestationnel en SA."""
    if not ddr:
        return None, None
    terme = ddr + timedelta(days=280)
    jours = (datetime.utcnow() - ddr).days
    semaines = jours // 7
    age_gest = f"{semaines} SA + {jours % 7}j"
    return terme.strftime("%d/%m/%Y"), age_gest


async def _serialize(db: AsyncSession, s: SuiviCPN) -> dict:
    patient = await db.get(Patient, s.patient_id)
    return {
        "id": s.id,
        "patient": f"{patient.nom} {patient.prenom}" if patient else "—",
        "patient_id": s.patient_id,
        "numero_visite": s.numero_visite,
        "date_visite": str(s.date_visite),
        "date_derniere_regle": str(s.date_derniere_regle) if s.date_derniere_regle else None,
        "terme_calcule": s.terme_calcule,
        "age_gestationnel": s.age_gestationnel,
        "tension_arterielle": s.tension_arterielle,
        "poids": s.poids,
        "hauteur_uterine": s.hauteur_uterine,
        "bruit_coeur_foetal": s.bruit_coeur_foetal,
        "presentation": s.presentation,
        "oedemes": s.oedemes,
        "albuminurie": s.albuminurie,
        "glycosurie": s.glycosurie,
        "hemoglobine": s.hemoglobine,
        "groupe_rhesus": s.groupe_rhesus,
        "test_vih": s.test_vih,
        "test_syphilis": s.test_syphilis,
        "fer_folate": s.fer_folate,
        "moustiquaire": s.moustiquaire,
        "prevention_paludisme": s.prevention_paludisme,
        "observations": s.observations,
        "plan_accouchement": s.plan_accouchement,
        "prochain_rdv": str(s.prochain_rdv) if s.prochain_rdv else None,
    }


@router.get("/suivis")
async def list_suivis(
    patient_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    query = select(SuiviCPN)
    if patient_id:
        query = query.where(SuiviCPN.patient_id == patient_id)
    query = query.order_by(SuiviCPN.date_visite.desc())
    result = await db.execute(query)
    return {"suivis": [await _serialize(db, s) for s in result.scalars().all()]}


@router.post("/suivis", status_code=201)
async def create_suivi(data: CPNCreate, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_active_user)):
    patient = await db.get(Patient, data.patient_id)
    if not patient:
        raise HTTPException(404, "Patiente introuvable")
    # Numéro de visite = nombre de visites existantes + 1
    count_q = await db.execute(select(func.count(SuiviCPN.id)).where(SuiviCPN.patient_id == data.patient_id))
    numero_visite = (count_q.scalar() or 0) + 1
    terme, age_gest = _calcul_terme(data.date_derniere_regle)
    s = SuiviCPN(
        **data.model_dump(), numero_visite=numero_visite,
        terme_calcule=terme, age_gestationnel=age_gest, sage_femme_id=current_user.id,
    )
    db.add(s)
    await db.flush()
    # Facturation CPN
    facture = await creer_facture_acte(
        db, data.patient_id, TypeActe.CPN,
        f"Consultation prénatale (CPN {numero_visite})", 1, 2000,
        current_user.id, type_source="cpn",
    )
    return {"id": s.id, "numero_visite": numero_visite, "terme_calcule": terme,
            "age_gestationnel": age_gest, "facture_numero": facture.numero, "message": "Visite CPN enregistrée"}


@router.get("/accouchements")
async def list_accouchements(
    patient_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    query = select(Accouchement)
    if patient_id:
        query = query.where(Accouchement.patient_id == patient_id)
    query = query.order_by(Accouchement.date_accouchement.desc())
    result = await db.execute(query)
    items = []
    for a in result.scalars().all():
        patient = await db.get(Patient, a.patient_id)
        items.append({
            "id": a.id,
            "patient": f"{patient.nom} {patient.prenom}" if patient else "—",
            "patient_id": a.patient_id,
            "date_accouchement": str(a.date_accouchement),
            "type_accouchement": a.type_accouchement,
            "duree_travail": a.duree_travail,
            "sexe_nouveau_ne": a.sexe_nouveau_ne,
            "poids_naissance": a.poids_naissance,
            "apgar_1min": a.apgar_1min,
            "apgar_5min": a.apgar_5min,
            "etat_nouveau_ne": a.etat_nouveau_ne,
            "complications": a.complications,
            "pertes_sang": a.pertes_sang,
            "notes": a.notes,
        })
    return {"accouchements": items}


@router.post("/accouchements", status_code=201)
async def create_accouchement(data: AccouchementCreate, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_active_user)):
    patient = await db.get(Patient, data.patient_id)
    if not patient:
        raise HTTPException(404, "Patiente introuvable")
    a = Accouchement(**data.model_dump(), sage_femme_id=current_user.id)
    db.add(a)
    await db.flush()
    # Facturation accouchement
    montant = 30000 if "basse" in (data.type_accouchement or "").lower() else 80000
    facture = await creer_facture_acte(
        db, data.patient_id, TypeActe.ACCOUCHEMENT,
        f"Accouchement — {data.type_accouchement}", 1, montant,
        current_user.id, type_source="accouchement",
    )
    return {"id": a.id, "facture_numero": facture.numero, "message": "Accouchement enregistré"}
