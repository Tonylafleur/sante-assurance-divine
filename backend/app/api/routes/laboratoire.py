from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.database import get_db
from app.models.laboratoire import ExamenLaboratoire, StatutExamen, TypeExamen
from app.models.consultation import Consultation
from app.models.patient import Patient
from app.models.caisse import TypeActe
from app.api.routes.auth import get_current_active_user
from app.api.routes.caisse import creer_facture_acte

router = APIRouter(prefix="/laboratoire", tags=["Laboratoire"])


class ExamenCreate(BaseModel):
    consultation_id: int
    type_examen: TypeExamen = TypeExamen.HEMATOLOGIE
    libelle: str
    valeur_normale: Optional[str] = None
    unite: Optional[str] = None
    prix: float = 0.0


class ResultatUpdate(BaseModel):
    resultat: str
    valeur_normale: Optional[str] = None
    unite: Optional[str] = None
    notes: Optional[str] = None


# Catalogue d'examens courants (référentiel OMS / MINSANTÉ).
# Les examens « panels » contiennent une liste de paramètres avec valeurs de référence.
CATALOGUE = [
    {"type_examen": "Hématologie", "libelle": "Hémogramme complet (NFS)", "valeur_normale": "Voir paramètres", "unite": "", "prix": 3000, "parametres": [
        {"nom": "Hémoglobine", "unite": "g/dL", "valeur_normale": "H: 13-17 / F: 12-16"},
        {"nom": "Hématocrite", "unite": "%", "valeur_normale": "H: 40-54 / F: 37-47"},
        {"nom": "Globules rouges", "unite": "10⁶/µL", "valeur_normale": "4.2 - 5.9"},
        {"nom": "VGM", "unite": "fL", "valeur_normale": "80 - 100"},
        {"nom": "TCMH", "unite": "pg", "valeur_normale": "27 - 32"},
        {"nom": "CCMH", "unite": "g/dL", "valeur_normale": "32 - 36"},
        {"nom": "Globules blancs", "unite": "/mm³", "valeur_normale": "4 000 - 10 000"},
        {"nom": "Neutrophiles", "unite": "%", "valeur_normale": "40 - 70"},
        {"nom": "Lymphocytes", "unite": "%", "valeur_normale": "20 - 40"},
        {"nom": "Monocytes", "unite": "%", "valeur_normale": "2 - 10"},
        {"nom": "Éosinophiles", "unite": "%", "valeur_normale": "1 - 6"},
        {"nom": "Basophiles", "unite": "%", "valeur_normale": "0 - 2"},
        {"nom": "Plaquettes", "unite": "/mm³", "valeur_normale": "150 000 - 400 000"},
    ]},
    {"type_examen": "Hématologie", "libelle": "Groupe sanguin + Rhésus", "valeur_normale": "—", "unite": "", "prix": 2000},
    {"type_examen": "Hématologie", "libelle": "Vitesse de sédimentation (VS)", "valeur_normale": "< 20 mm/h", "unite": "mm/h", "prix": 1500},
    {"type_examen": "Parasitologie", "libelle": "Goutte épaisse / TDR Paludisme", "valeur_normale": "Négatif", "unite": "", "prix": 1500},
    {"type_examen": "Parasitologie", "libelle": "Examen de selles (KAOP)", "valeur_normale": "Absence de parasites", "unite": "", "prix": 2000},
    {"type_examen": "Biochimie", "libelle": "Glycémie à jeûn", "valeur_normale": "0.7 - 1.1 g/L", "unite": "g/L", "prix": 2000},
    {"type_examen": "Biochimie", "libelle": "Ionogramme sanguin", "valeur_normale": "Voir paramètres", "unite": "", "prix": 5000, "parametres": [
        {"nom": "Sodium (Na+)", "unite": "mmol/L", "valeur_normale": "135 - 145"},
        {"nom": "Potassium (K+)", "unite": "mmol/L", "valeur_normale": "3.5 - 5.1"},
        {"nom": "Chlore (Cl-)", "unite": "mmol/L", "valeur_normale": "98 - 107"},
        {"nom": "Bicarbonates (HCO3-)", "unite": "mmol/L", "valeur_normale": "22 - 29"},
    ]},
    {"type_examen": "Biochimie", "libelle": "Bilan rénal", "valeur_normale": "Voir paramètres", "unite": "", "prix": 5000, "parametres": [
        {"nom": "Urée", "unite": "g/L", "valeur_normale": "0.15 - 0.45"},
        {"nom": "Créatininémie", "unite": "mg/L", "valeur_normale": "H: 7-13 / F: 6-11"},
        {"nom": "Clairance créatinine", "unite": "mL/min", "valeur_normale": "> 90"},
    ]},
    {"type_examen": "Biochimie", "libelle": "Bilan hépatique", "valeur_normale": "Voir paramètres", "unite": "", "prix": 6000, "parametres": [
        {"nom": "ASAT (TGO)", "unite": "UI/L", "valeur_normale": "< 40"},
        {"nom": "ALAT (TGP)", "unite": "UI/L", "valeur_normale": "< 40"},
        {"nom": "Gamma-GT", "unite": "UI/L", "valeur_normale": "H: < 55 / F: < 38"},
        {"nom": "Phosphatases alcalines", "unite": "UI/L", "valeur_normale": "40 - 130"},
        {"nom": "Bilirubine totale", "unite": "mg/L", "valeur_normale": "< 12"},
        {"nom": "Bilirubine conjuguée", "unite": "mg/L", "valeur_normale": "< 3"},
    ]},
    {"type_examen": "Biochimie", "libelle": "Bilan lipidique", "valeur_normale": "Voir paramètres", "unite": "", "prix": 5000, "parametres": [
        {"nom": "Cholestérol total", "unite": "g/L", "valeur_normale": "< 2.0"},
        {"nom": "HDL-Cholestérol", "unite": "g/L", "valeur_normale": "> 0.40"},
        {"nom": "LDL-Cholestérol", "unite": "g/L", "valeur_normale": "< 1.60"},
        {"nom": "Triglycérides", "unite": "g/L", "valeur_normale": "< 1.50"},
    ]},
    {"type_examen": "Biochimie", "libelle": "Transaminases (ASAT/ALAT)", "valeur_normale": "< 40 UI/L", "unite": "UI/L", "prix": 4000},
    {"type_examen": "Microbiologie", "libelle": "ECBU", "valeur_normale": "Voir paramètres", "unite": "", "prix": 3500, "parametres": [
        {"nom": "Aspect", "unite": "", "valeur_normale": "Clair"},
        {"nom": "Leucocytes", "unite": "/mL", "valeur_normale": "< 10 000"},
        {"nom": "Hématies", "unite": "/mL", "valeur_normale": "< 10 000"},
        {"nom": "Nitrites", "unite": "", "valeur_normale": "Négatif"},
        {"nom": "Germe identifié", "unite": "", "valeur_normale": "Absence"},
        {"nom": "Culture (UFC/mL)", "unite": "UFC/mL", "valeur_normale": "< 1 000"},
        {"nom": "Antibiogramme", "unite": "", "valeur_normale": "—"},
    ]},
    {"type_examen": "Immunologie", "libelle": "Sérologie VIH (dépistage)", "valeur_normale": "Négatif", "unite": "", "prix": 2000},
    {"type_examen": "Immunologie", "libelle": "Widal & Félix (typhoïde)", "valeur_normale": "< 1/80", "unite": "", "prix": 3000},
    {"type_examen": "Immunologie", "libelle": "Antigène HBs (Hépatite B)", "valeur_normale": "Négatif", "unite": "", "prix": 2500},
    {"type_examen": "Immunologie", "libelle": "CRP (Protéine C-réactive)", "valeur_normale": "< 6 mg/L", "unite": "mg/L", "prix": 3000},
    {"type_examen": "Urologie", "libelle": "Test de grossesse (β-HCG urinaire)", "valeur_normale": "Négatif", "unite": "", "prix": 1500},
]


async def _serialize(db: AsyncSession, e: ExamenLaboratoire) -> dict:
    consult = await db.get(Consultation, e.consultation_id) if e.consultation_id else None
    patient = await db.get(Patient, consult.patient_id) if consult else None
    return {
        "id": e.id,
        "numero": e.numero,
        "consultation_id": e.consultation_id,
        "consultation_numero": consult.numero if consult else "—",
        "patient": f"{patient.nom} {patient.prenom}" if patient else "—",
        "patient_id": patient.id if patient else None,
        "type_examen": e.type_examen,
        "libelle": e.libelle,
        "valeur_normale": e.valeur_normale,
        "resultat": e.resultat,
        "unite": e.unite,
        "statut": e.statut,
        "prix": e.prix,
        "date_prelevement": str(e.date_prelevement) if e.date_prelevement else None,
        "date_resultat": str(e.date_resultat) if e.date_resultat else None,
        "notes": e.notes,
        "created_at": str(e.created_at),
    }


async def _generate_numero(db: AsyncSession) -> str:
    today = datetime.now()
    prefix = f"LAB{today.strftime('%Y%m%d')}"
    res = await db.execute(select(func.count(ExamenLaboratoire.id)).where(ExamenLaboratoire.numero.like(f"{prefix}%")))
    return f"{prefix}{str((res.scalar() or 0) + 1).zfill(3)}"


@router.get("/catalogue")
async def get_catalogue(current_user=Depends(get_current_active_user)):
    return CATALOGUE


@router.get("/examens")
async def list_examens(
    statut: Optional[StatutExamen] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    query = select(ExamenLaboratoire)
    if statut:
        query = query.where(ExamenLaboratoire.statut == statut)
    total_q = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_q.scalar()
    query = query.order_by(ExamenLaboratoire.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    examens = result.scalars().all()
    return {"total": total, "examens": [await _serialize(db, e) for e in examens]}


@router.post("/examens", status_code=201)
async def create_examen(
    data: ExamenCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    consult = await db.get(Consultation, data.consultation_id)
    if not consult:
        raise HTTPException(404, "Consultation introuvable")
    numero = await _generate_numero(db)
    examen = ExamenLaboratoire(
        numero=numero, consultation_id=data.consultation_id,
        type_examen=data.type_examen, libelle=data.libelle,
        valeur_normale=data.valeur_normale, unite=data.unite,
        prix=data.prix, statut=StatutExamen.PRESCRIT,
    )
    db.add(examen)
    await db.flush()
    return {"id": examen.id, "numero": numero, "message": "Examen prescrit"}


@router.post("/examens/{examen_id}/prelevement")
async def marquer_prelevement(
    examen_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    e = await db.get(ExamenLaboratoire, examen_id)
    if not e:
        raise HTTPException(404, "Examen introuvable")
    e.statut = StatutExamen.EN_COURS
    e.date_prelevement = datetime.utcnow()
    e.laborantin_id = current_user.id
    return {"message": "Prélèvement enregistré", "statut": e.statut}


@router.put("/examens/{examen_id}/resultat")
async def saisir_resultat(
    examen_id: int,
    data: ResultatUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    e = await db.get(ExamenLaboratoire, examen_id)
    if not e:
        raise HTTPException(404, "Examen introuvable")
    e.resultat = data.resultat
    if data.valeur_normale is not None:
        e.valeur_normale = data.valeur_normale
    if data.unite is not None:
        e.unite = data.unite
    if data.notes is not None:
        e.notes = data.notes
    e.statut = StatutExamen.RESULTAT_DISPONIBLE
    e.date_resultat = datetime.utcnow()
    e.laborantin_id = current_user.id
    return {"message": "Résultat enregistré", "statut": e.statut}


@router.post("/examens/{examen_id}/valider")
async def valider_examen(
    examen_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Validation du résultat + facturation automatique."""
    e = await db.get(ExamenLaboratoire, examen_id)
    if not e:
        raise HTTPException(404, "Examen introuvable")
    if not e.resultat:
        raise HTTPException(400, "Aucun résultat à valider")
    e.statut = StatutExamen.VALIDE
    facture_numero = None
    consult = await db.get(Consultation, e.consultation_id) if e.consultation_id else None
    if consult and (e.prix or 0) > 0:
        facture = await creer_facture_acte(
            db, consult.patient_id, TypeActe.LABORATOIRE,
            f"Examen labo: {e.libelle} ({e.numero})", 1, e.prix,
            current_user.id, consultation_id=e.consultation_id, type_source="laboratoire",
        )
        facture_numero = facture.numero
    return {"message": "Examen validé", "statut": e.statut, "facture_numero": facture_numero}
