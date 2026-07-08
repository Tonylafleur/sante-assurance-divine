from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.database import get_db
from app.models.consultation import Consultation, ServiceConsultation, StatutConsultation, NiveauUrgence
from app.models.pharmacie import Prescription, Medicament, StatutPrescription
from app.models.laboratoire import ExamenLaboratoire
from app.models.patient import Patient
from app.api.routes.auth import get_current_active_user
from app.services.websocket_manager import manager, CANAL_PHARMACIE, CANAL_LABORATOIRE, CANAL_ACCUEIL
from app.models.historique import HistoriqueConsultation

router = APIRouter(prefix="/consultations", tags=["Consultations"])


class ConsultationCreate(BaseModel):
    patient_id: int
    service: ServiceConsultation = ServiceConsultation.GENERALE
    niveau_urgence: NiveauUrgence = NiveauUrgence.VERT
    motif: str
    symptomes: Optional[str] = None
    # Histoire de la maladie
    histoire_maladie: Optional[str] = None
    duree_symptomes: Optional[str] = None
    mode_debut: Optional[str] = None
    facteurs_declenchants: Optional[str] = None
    facteurs_calmants: Optional[str] = None
    signes_associes: Optional[str] = None
    antecedents_pertinents: Optional[str] = None
    # Signes vitaux
    tension_arterielle: Optional[str] = None
    temperature: Optional[float] = None
    poids: Optional[float] = None
    taille: Optional[float] = None
    frequence_cardiaque: Optional[int] = None
    saturation_o2: Optional[float] = None
    frequence_respiratoire: Optional[int] = None
    glycemie: Optional[float] = None
    glycemie_jeun: Optional[float] = None
    glycemie_post_prandiale: Optional[float] = None
    perimetre_brachial: Optional[float] = None
    perimetre_cranien: Optional[float] = None


class ConsultationUpdate(BaseModel):
    examen_clinique: Optional[str] = None
    diagnostic_principal: Optional[str] = None
    diagnostics_secondaires: Optional[str] = None
    traitement: Optional[str] = None
    statut: Optional[StatutConsultation] = None
    notes: Optional[str] = None
    # Histoire maladie
    histoire_maladie: Optional[str] = None
    duree_symptomes: Optional[str] = None
    mode_debut: Optional[str] = None
    facteurs_declenchants: Optional[str] = None
    facteurs_calmants: Optional[str] = None
    signes_associes: Optional[str] = None
    antecedents_pertinents: Optional[str] = None
    # CIM-10
    code_cim10_principal: Optional[str] = None
    libelle_cim10_principal: Optional[str] = None
    codes_cim10_secondaires: Optional[str] = None
    # Maladie endémique
    maladie_endemique_type: Optional[str] = None
    maladie_endemique_data: Optional[str] = None
    # Signes vitaux complémentaires
    frequence_respiratoire: Optional[int] = None
    glycemie: Optional[float] = None
    glycemie_jeun: Optional[float] = None
    glycemie_post_prandiale: Optional[float] = None
    perimetre_brachial: Optional[float] = None
    perimetre_cranien: Optional[float] = None
    imc: Optional[float] = None
    statut_imc: Optional[str] = None


class PrescriptionItem(BaseModel):
    medicament_id: int
    posologie: str
    quantite_prescrite: float
    duree_traitement: Optional[str] = None
    instructions: Optional[str] = None


class ExamenItem(BaseModel):
    libelle: str
    type_examen: Optional[str] = None
    prix: Optional[float] = 0.0


async def generate_numero_consultation(db: AsyncSession) -> str:
    today = datetime.now()
    prefix = f"C{today.strftime('%Y%m%d')}"
    result = await db.execute(
        select(func.count(Consultation.id)).where(Consultation.numero.like(f"{prefix}%"))
    )
    count = result.scalar() or 0
    return f"{prefix}{str(count + 1).zfill(3)}"


@router.post("/", status_code=201)
async def create_consultation(
    data: ConsultationCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    patient = await db.get(Patient, data.patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient introuvable")
    numero = await generate_numero_consultation(db)
    consultation = Consultation(numero=numero, **data.model_dump())
    db.add(consultation)
    await db.flush()
    # Historique création
    h = HistoriqueConsultation(
        consultation_id=consultation.id,
        patient_id=data.patient_id,
        action="creation",
        description=f"Consultation créée — Motif: {data.motif} — Service: {data.service}",
        utilisateur_id=current_user.id,
        utilisateur_nom=f"{current_user.prenom} {current_user.nom}",
    )
    db.add(h)
    # Notifier l'accueil
    await manager.broadcast(CANAL_ACCUEIL, {
        "type": "nouvelle_consultation",
        "consultation_id": consultation.id,
        "patient": f"{patient.nom} {patient.prenom}",
        "numero": numero,
        "service": data.service,
        "urgence": data.niveau_urgence,
    })
    return {"id": consultation.id, "numero": numero}


@router.get("/")
async def list_consultations(
    statut: Optional[StatutConsultation] = None,
    date_debut: Optional[str] = None,
    patient_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    query = select(Consultation)
    if statut:
        query = query.where(Consultation.statut == statut)
    if patient_id:
        query = query.where(Consultation.patient_id == patient_id)
    if date_debut:
        query = query.where(Consultation.created_at >= date_debut)

    total_q = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_q.scalar()
    query = query.order_by(Consultation.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    consultations = result.scalars().all()
    items = []
    for c in consultations:
        patient = await db.get(Patient, c.patient_id)
        items.append({
            "id": c.id,
            "numero": c.numero,
            "patient_id": c.patient_id,
            "patient_nom": f"{patient.nom} {patient.prenom}" if patient else "—",
            "service": c.service,
            "motif": c.motif,
            "niveau_urgence": c.niveau_urgence,
            "statut": c.statut,
            "diagnostic_principal": c.diagnostic_principal,
            "created_at": str(c.created_at),
        })
    return {"total": total, "consultations": items}


@router.get("/{consultation_id}")
async def get_consultation(
    consultation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    c = await db.get(Consultation, consultation_id)
    if not c:
        raise HTTPException(404, "Consultation introuvable")
    patient = await db.get(Patient, c.patient_id)

    # Prescriptions
    pres_result = await db.execute(
        select(Prescription).where(Prescription.consultation_id == consultation_id)
    )
    prescriptions = pres_result.scalars().all()

    # Examens labo
    labo_result = await db.execute(
        select(ExamenLaboratoire).where(ExamenLaboratoire.consultation_id == consultation_id)
    )
    examens = labo_result.scalars().all()

    pres_list = []
    for p in prescriptions:
        med = await db.get(Medicament, p.medicament_id)
        pres_list.append({
            "id": p.id,
            "medicament": med.nom_commercial if med else "—",
            "dci": med.dci if med else "",
            "posologie": p.posologie,
            "quantite_prescrite": p.quantite_prescrite,
            "quantite_dispensee": p.quantite_dispensee,
            "duree_traitement": p.duree_traitement,
            "statut": p.statut,
        })

    # IMC calculé
    imc_val = c.imc
    if not imc_val and c.poids and c.taille:
        from app.api.routes.patients import calculer_imc_adulte
        imc_val, _ = calculer_imc_adulte(c.poids, c.taille)

    return {
        "id": c.id,
        "numero": c.numero,
        "patient": {
            "id": patient.id, "nom": patient.nom, "prenom": patient.prenom,
            "numero_dossier": patient.numero_dossier,
            "sexe": patient.sexe,
            "allergies": patient.allergies,
            "antecedents_medicaux": patient.antecedents_medicaux,
            "antecedents_chirurgicaux": patient.antecedents_chirurgicaux,
            "antecedents_familiaux": patient.antecedents_familiaux,
            "antecedents_obstetricaux": patient.antecedents_obstetricaux,
            "groupe_sanguin": patient.groupe_sanguin,
        } if patient else None,
        "service": c.service,
        "motif": c.motif,
        "symptomes": c.symptomes,
        "niveau_urgence": c.niveau_urgence,
        "statut": c.statut,
        # Histoire de la maladie
        "histoire_maladie": c.histoire_maladie,
        "duree_symptomes": c.duree_symptomes,
        "mode_debut": c.mode_debut,
        "facteurs_declenchants": c.facteurs_declenchants,
        "facteurs_calmants": c.facteurs_calmants,
        "signes_associes": c.signes_associes,
        "antecedents_pertinents": c.antecedents_pertinents,
        # Signes vitaux
        "tension_arterielle": c.tension_arterielle,
        "temperature": c.temperature,
        "poids": c.poids,
        "taille": c.taille,
        "frequence_cardiaque": c.frequence_cardiaque,
        "saturation_o2": c.saturation_o2,
        "frequence_respiratoire": c.frequence_respiratoire,
        "glycemie": c.glycemie,
        "glycemie_jeun": c.glycemie_jeun,
        "glycemie_post_prandiale": c.glycemie_post_prandiale,
        "perimetre_brachial": c.perimetre_brachial,
        "perimetre_cranien": c.perimetre_cranien,
        "imc": imc_val,
        "statut_imc": c.statut_imc,
        # Diagnostic
        "examen_clinique": c.examen_clinique,
        "diagnostic_principal": c.diagnostic_principal,
        "diagnostics_secondaires": c.diagnostics_secondaires,
        "code_cim10_principal": c.code_cim10_principal,
        "libelle_cim10_principal": c.libelle_cim10_principal,
        "codes_cim10_secondaires": c.codes_cim10_secondaires,
        # Maladie endémique
        "maladie_endemique_type": c.maladie_endemique_type,
        "maladie_endemique_data": c.maladie_endemique_data,
        "traitement": c.traitement,
        "notes": c.notes,
        "prescriptions": pres_list,
        "examens_labo": [{
            "id": e.id, "numero": e.numero, "libelle": e.libelle,
            "type_examen": e.type_examen, "statut": e.statut, "resultat": e.resultat,
            "valeur_normale": e.valeur_normale, "unite": e.unite, "prix": e.prix,
            "date_resultat": str(e.date_resultat) if e.date_resultat else None,
        } for e in examens],
        "created_at": str(c.created_at),
    }


@router.put("/{consultation_id}")
async def update_consultation(
    consultation_id: int,
    data: ConsultationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    c = await db.get(Consultation, consultation_id)
    if not c:
        raise HTTPException(404, "Consultation introuvable")
    changes = data.model_dump(exclude_none=True)
    for key, val in changes.items():
        setattr(c, key, val)
    # Enregistrement historique
    description = ", ".join(f"{k}={v}" for k, v in list(changes.items())[:5])
    h = HistoriqueConsultation(
        consultation_id=consultation_id,
        patient_id=c.patient_id,
        action="mise_a_jour",
        description=f"Mise à jour: {description}",
        utilisateur_id=current_user.id,
        utilisateur_nom=f"{current_user.prenom} {current_user.nom}",
    )
    db.add(h)
    return {"message": "Consultation mise à jour"}


@router.post("/{consultation_id}/prescriptions")
async def add_prescriptions(
    consultation_id: int,
    items: List[PrescriptionItem],
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    c = await db.get(Consultation, consultation_id)
    if not c:
        raise HTTPException(404, "Consultation introuvable")
    patient = await db.get(Patient, c.patient_id)
    created = []
    meds_info = []
    for item in items:
        med = await db.get(Medicament, item.medicament_id)
        if not med:
            continue
        p = Prescription(consultation_id=consultation_id, **item.model_dump())
        db.add(p)
        await db.flush()
        created.append(p.id)
        meds_info.append({"nom": med.nom_commercial, "posologie": item.posologie, "quantite": item.quantite_prescrite})

    # Notifier la pharmacie en temps réel
    if meds_info and patient:
        await manager.broadcast(CANAL_PHARMACIE, {
            "type": "nouvelle_prescription",
            "consultation_id": consultation_id,
            "consultation_numero": c.numero,
            "patient": f"{patient.nom} {patient.prenom}",
            "medicaments": meds_info,
            "timestamp": str(datetime.utcnow()),
        })

    return {"created": len(created), "ids": created}


@router.post("/{consultation_id}/examens")
async def add_examens(
    consultation_id: int,
    items: List[ExamenItem],
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    c = await db.get(Consultation, consultation_id)
    if not c:
        raise HTTPException(404, "Consultation introuvable")
    patient = await db.get(Patient, c.patient_id)
    created = []
    today = datetime.now()
    prefix = f"LAB{today.strftime('%Y%m%d')}"
    count_q = await db.execute(select(func.count(ExamenLaboratoire.id)).where(ExamenLaboratoire.numero.like(f"{prefix}%")))
    base = count_q.scalar() or 0
    for item in items:
        base += 1
        num = f"{prefix}{str(base).zfill(3)}"
        e = ExamenLaboratoire(
            numero=num,
            consultation_id=consultation_id,
            libelle=item.libelle,
            type_examen=item.type_examen,
            prix=item.prix,
        )
        db.add(e)
        await db.flush()
        created.append(e.id)

    if created and patient:
        await manager.broadcast(CANAL_LABORATOIRE, {
            "type": "nouveaux_examens",
            "consultation_id": consultation_id,
            "patient": f"{patient.nom} {patient.prenom}",
            "examens": [i.libelle for i in items],
        })

    return {"created": len(created)}


@router.get("/{consultation_id}/historique")
async def get_historique_consultation(
    consultation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    c = await db.get(Consultation, consultation_id)
    if not c:
        raise HTTPException(404, "Consultation introuvable")
    result = await db.execute(
        select(HistoriqueConsultation)
        .where(HistoriqueConsultation.consultation_id == consultation_id)
        .order_by(HistoriqueConsultation.created_at.desc())
    )
    items = result.scalars().all()
    return {
        "consultation_id": consultation_id,
        "historique": [
            {
                "id": h.id,
                "action": h.action,
                "description": h.description,
                "utilisateur": h.utilisateur_nom,
                "date": str(h.created_at),
            }
            for h in items
        ]
    }
