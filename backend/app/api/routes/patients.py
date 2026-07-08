from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
from app.database import get_db
from app.models.patient import Patient, Sexe, GroupeSanguin
from app.models.consultation import Consultation
from app.api.routes.auth import get_current_active_user

router = APIRouter(prefix="/patients", tags=["Patients"])


# ─── Calcul IMC selon l'âge (OMS / MINSANTÉ) ────────────────────────────────

def calculer_imc_adulte(poids_kg: float, taille_cm: float) -> tuple[float, str]:
    """IMC adulte (≥18 ans) — Classification OMS."""
    imc = poids_kg / ((taille_cm / 100) ** 2)
    if imc < 16.0:
        statut = "Maigreur sévère (Grade III)"
    elif imc < 17.0:
        statut = "Maigreur modérée (Grade II)"
    elif imc < 18.5:
        statut = "Maigreur légère (Grade I)"
    elif imc < 25.0:
        statut = "Poids normal"
    elif imc < 30.0:
        statut = "Surpoids (Pré-obésité)"
    elif imc < 35.0:
        statut = "Obésité modérée (Grade I)"
    elif imc < 40.0:
        statut = "Obésité sévère (Grade II)"
    else:
        statut = "Obésité morbide (Grade III)"
    return round(imc, 2), statut


def calculer_imc_enfant(poids_kg: float, taille_cm: float, age_mois: int) -> tuple[float, str]:
    """
    IMC enfant (5–18 ans) — Percentiles OMS simplifiés.
    Pour <5 ans : utiliser périmètre brachial (MUAC).
    """
    imc = poids_kg / ((taille_cm / 100) ** 2)
    # Percentiles OMS simplifiés pour enfants 5-18 ans
    # Seuils approximatifs — en pratique utiliser les courbes OMS
    if imc < 14.0:
        statut = "Émaciation sévère (< -3 SD)"
    elif imc < 16.0:
        statut = "Émaciation modérée (< -2 SD)"
    elif imc < 17.0:
        statut = "Risque d'émaciation (< -1 SD)"
    elif imc < 22.0:
        statut = "Corpulence normale"
    elif imc < 25.0:
        statut = "Risque de surpoids (> +1 SD)"
    elif imc < 28.0:
        statut = "Surpoids (> +2 SD)"
    else:
        statut = "Obésité (> +3 SD)"
    return round(imc, 2), statut


def evaluer_muac(muac_cm: float, age_mois: int) -> str:
    """
    Évaluation périmètre brachial (MUAC) pour enfants 6–59 mois.
    Critères OMS / UNICEF.
    """
    if age_mois < 6 or age_mois > 59:
        return "MUAC non applicable (hors 6-59 mois)"
    if muac_cm < 11.5:
        return "Malnutrition Aigüe Sévère (SAM) — URGENCE"
    elif muac_cm < 12.5:
        return "Malnutrition Aigüe Modérée (MAM)"
    elif muac_cm < 13.5:
        return "Risque de malnutrition"
    else:
        return "État nutritionnel satisfaisant"


def calculer_imc_complet(poids_kg: float, taille_cm: float, date_naissance: date, sexe: str) -> dict:
    """Calcul complet de l'IMC selon le profil du patient."""
    today = date.today()
    age_jours = (today - date_naissance).days
    age_mois = age_jours // 30
    age_ans = age_jours // 365

    if age_ans >= 18:
        imc, statut = calculer_imc_adulte(poids_kg, taille_cm)
        categorie = "adulte"
    elif age_ans >= 5:
        imc, statut = calculer_imc_enfant(poids_kg, taille_cm, age_mois)
        categorie = "enfant"
    else:
        imc = round(poids_kg / ((taille_cm / 100) ** 2), 2)
        statut = "Voir courbes OMS poids/taille"
        categorie = "nourrisson"

    return {
        "imc": imc,
        "statut_imc": statut,
        "categorie": categorie,
        "age_ans": age_ans,
        "age_mois": age_mois,
    }


# ─── Schémas Pydantic ─────────────────────────────────────────────────────────

class PatientCreate(BaseModel):
    nom: str
    prenom: str
    sexe: Sexe
    date_naissance: Optional[date] = None
    telephone: Optional[str] = None
    telephone_urgence: Optional[str] = None
    contact_urgence: Optional[str] = None
    adresse: Optional[str] = None
    quartier: Optional[str] = None
    ville: Optional[str] = "Yaoundé"
    profession: Optional[str] = None
    groupe_sanguin: Optional[GroupeSanguin] = GroupeSanguin.INCONNU
    # Mesures anthropométriques
    poids_kg: Optional[float] = None
    taille_cm: Optional[float] = None
    perimetre_brachial_cm: Optional[float] = None
    perimetre_cranien_cm: Optional[float] = None
    glycemie: Optional[float] = None
    glycemie_note: Optional[str] = None
    # Antécédents structurés
    allergies: Optional[str] = None
    antecedents_medicaux: Optional[str] = None
    antecedents_chirurgicaux: Optional[str] = None
    antecedents_familiaux: Optional[str] = None
    antecedents_obstetricaux: Optional[str] = None
    mode_de_vie: Optional[str] = None


class IMCCalculRequest(BaseModel):
    poids_kg: float
    taille_cm: float
    date_naissance: date
    sexe: str


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def generate_numero_dossier(db: AsyncSession) -> str:
    today = datetime.now()
    prefix = f"PAT{today.strftime('%Y%m')}"
    result = await db.execute(
        select(func.count(Patient.id)).where(Patient.numero_dossier.like(f"{prefix}%"))
    )
    count = result.scalar() or 0
    return f"{prefix}{str(count + 1).zfill(4)}"


def _compute_imc_for_patient(p: Patient) -> dict:
    if p.poids_kg and p.taille_cm and p.date_naissance:
        return calculer_imc_complet(p.poids_kg, p.taille_cm, p.date_naissance, p.sexe)
    return {"imc": None, "statut_imc": None, "categorie": None}


def _serialize(p: Patient, full: bool = False) -> dict:
    today = date.today()
    age = None
    age_mois = None
    if p.date_naissance:
        delta = today - p.date_naissance
        age = delta.days // 365
        age_mois = delta.days // 30

    imc_data = _compute_imc_for_patient(p)

    # Évaluation MUAC si disponible
    muac_statut = None
    if p.perimetre_brachial_cm and age_mois is not None and age_mois <= 59:
        muac_statut = evaluer_muac(p.perimetre_brachial_cm, age_mois)

    data = {
        "id": p.id,
        "numero_dossier": p.numero_dossier,
        "nom": p.nom,
        "prenom": p.prenom,
        "nom_complet": f"{p.nom} {p.prenom}",
        "sexe": p.sexe,
        "date_naissance": str(p.date_naissance) if p.date_naissance else None,
        "age": age,
        "age_mois": age_mois,
        "telephone": p.telephone,
        "groupe_sanguin": p.groupe_sanguin,
        "poids_kg": p.poids_kg,
        "taille_cm": p.taille_cm,
        "perimetre_brachial_cm": p.perimetre_brachial_cm,
        "imc": imc_data.get("imc"),
        "statut_imc": imc_data.get("statut_imc"),
        "muac_statut": muac_statut,
        "created_at": str(p.created_at),
    }
    if full:
        data.update({
            "telephone_urgence": p.telephone_urgence,
            "contact_urgence": p.contact_urgence,
            "adresse": p.adresse,
            "quartier": p.quartier,
            "ville": p.ville,
            "profession": p.profession,
            "allergies": p.allergies,
            "antecedents_medicaux": p.antecedents_medicaux,
            "antecedents_chirurgicaux": p.antecedents_chirurgicaux,
            "antecedents_familiaux": p.antecedents_familiaux,
            "antecedents_obstetricaux": p.antecedents_obstetricaux,
            "mode_de_vie": p.mode_de_vie,
            "perimetre_cranien_cm": p.perimetre_cranien_cm,
            "glycemie": p.glycemie,
            "glycemie_note": p.glycemie_note,
            "muac_statut": muac_statut,
        })
    return data


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/imc/calculer")
async def calculer_imc(data: IMCCalculRequest):
    """Calcul IMC en temps réel — sans authentification requise pour l'interface."""
    if data.poids_kg <= 0 or data.taille_cm <= 0:
        raise HTTPException(400, "Poids et taille doivent être positifs")
    result = calculer_imc_complet(data.poids_kg, data.taille_cm, data.date_naissance, data.sexe)

    # Ajout des seuils de couleur pour l'interface
    imc = result["imc"]
    if result["categorie"] == "adulte":
        if imc < 18.5:
            result["couleur"] = "blue"
        elif imc < 25.0:
            result["couleur"] = "green"
        elif imc < 30.0:
            result["couleur"] = "yellow"
        elif imc < 35.0:
            result["couleur"] = "orange"
        else:
            result["couleur"] = "red"
    else:
        result["couleur"] = "purple"
    return result


@router.post("/", status_code=201)
async def create_patient(
    data: PatientCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    numero = await generate_numero_dossier(db)
    patient = Patient(numero_dossier=numero, **data.model_dump())
    db.add(patient)
    await db.flush()
    return {"id": patient.id, "numero_dossier": patient.numero_dossier, "message": "Patient enregistré"}


@router.get("/")
async def list_patients(
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    query = select(Patient).where(Patient.est_actif == 1)
    if search:
        term = f"%{search}%"
        query = query.where(or_(
            Patient.nom.ilike(term),
            Patient.prenom.ilike(term),
            Patient.numero_dossier.ilike(term),
            Patient.telephone.ilike(term),
        ))
    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar()
    query = query.order_by(Patient.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    patients = result.scalars().all()
    return {"total": total, "page": page, "per_page": per_page, "patients": [_serialize(p) for p in patients]}


@router.get("/{patient_id}")
async def get_patient(
    patient_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient introuvable")
    return _serialize(patient, full=True)


@router.put("/{patient_id}")
async def update_patient(
    patient_id: int,
    data: PatientCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient introuvable")
    for key, val in data.model_dump(exclude_none=True).items():
        setattr(patient, key, val)
    return {"message": "Patient mis à jour"}


@router.get("/{patient_id}/consultations")
async def get_patient_consultations(
    patient_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(20),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    patient = await db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(404, "Patient introuvable")

    query = select(Consultation).where(Consultation.patient_id == patient_id)
    total_q = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_q.scalar()
    query = query.order_by(Consultation.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    consultations = result.scalars().all()

    items = []
    for c in consultations:
        items.append({
            "id": c.id,
            "numero": c.numero,
            "date": str(c.created_at),
            "service": c.service,
            "motif": c.motif,
            "niveau_urgence": c.niveau_urgence,
            "statut": c.statut,
            "diagnostic_principal": c.diagnostic_principal,
            "code_cim10_principal": c.code_cim10_principal,
            "libelle_cim10_principal": c.libelle_cim10_principal,
            "maladie_endemique_type": c.maladie_endemique_type,
            "tension_arterielle": c.tension_arterielle,
            "temperature": c.temperature,
            "poids": c.poids,
            "imc": c.imc,
            "statut_imc": c.statut_imc,
        })

    return {
        "patient": {
            "id": patient.id,
            "nom_complet": f"{patient.nom} {patient.prenom}",
            "numero_dossier": patient.numero_dossier,
            "date_naissance": str(patient.date_naissance) if patient.date_naissance else None,
            "sexe": patient.sexe,
            "groupe_sanguin": patient.groupe_sanguin,
            "allergies": patient.allergies,
            "antecedents_medicaux": patient.antecedents_medicaux,
            "antecedents_chirurgicaux": patient.antecedents_chirurgicaux,
            "antecedents_familiaux": patient.antecedents_familiaux,
            "antecedents_obstetricaux": patient.antecedents_obstetricaux,
        },
        "total": total,
        "consultations": items,
    }

