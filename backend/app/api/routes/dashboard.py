from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, date
from app.database import get_db
from app.models.patient import Patient
from app.models.consultation import Consultation, StatutConsultation
from app.models.pharmacie import Medicament
from app.models.caisse import Facture
from app.models.hospitalisation import Lit, StatutLit
from app.api.routes.auth import get_current_active_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    today_start = datetime.now().replace(hour=0, minute=0, second=0)

    # Patients du jour
    r1 = await db.execute(select(func.count(Patient.id)).where(Patient.created_at >= today_start))
    patients_jour = r1.scalar()

    # Consultations du jour
    r2 = await db.execute(select(func.count(Consultation.id)).where(Consultation.created_at >= today_start))
    consultations_jour = r2.scalar()

    # Consultations en attente
    r3 = await db.execute(select(func.count(Consultation.id)).where(Consultation.statut == StatutConsultation.EN_ATTENTE))
    en_attente = r3.scalar()

    # Médicaments en alerte stock
    r4 = await db.execute(select(func.count(Medicament.id)).where(
        Medicament.stock_actuel <= Medicament.seuil_alerte,
        Medicament.est_actif == True
    ))
    alertes_stock = r4.scalar()

    # Recette du jour
    r5 = await db.execute(
        select(func.coalesce(func.sum(Facture.montant_paye), 0)).where(Facture.created_at >= today_start)
    )
    recette_jour = r5.scalar()

    # Lits disponibles
    r6 = await db.execute(select(func.count(Lit.id)).where(Lit.statut == StatutLit.DISPONIBLE))
    lits_disponibles = r6.scalar()

    # Total patients
    r7 = await db.execute(select(func.count(Patient.id)))
    total_patients = r7.scalar()

    return {
        "date": str(date.today()),
        "patients_jour": patients_jour,
        "consultations_jour": consultations_jour,
        "consultations_en_attente": en_attente,
        "alertes_stock_medicaments": alertes_stock,
        "recette_jour_fcfa": round(recette_jour, 0),
        "lits_disponibles": lits_disponibles,
        "total_patients": total_patients,
    }


@router.get("/consultations/par-service")
async def consultations_par_service(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    today_start = datetime.now().replace(hour=0, minute=0, second=0)
    result = await db.execute(
        select(Consultation.service, func.count(Consultation.id))
        .where(Consultation.created_at >= today_start)
        .group_by(Consultation.service)
    )
    rows = result.all()
    return [{"service": r[0], "count": r[1]} for r in rows]
