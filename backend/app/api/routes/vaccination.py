from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.database import get_db
from app.models.vaccination import Vaccin, Vaccination
from app.models.patient import Patient
from app.models.caisse import TypeActe
from app.api.routes.auth import get_current_active_user
from app.api.routes.caisse import creer_facture_acte

router = APIRouter(prefix="/vaccination", tags=["Vaccination"])


class VaccinCreate(BaseModel):
    nom: str
    maladie_ciblee: Optional[str] = None
    nombre_doses: int = 1
    intervalle_doses: Optional[str] = None
    rappel: Optional[str] = None
    prix: float = 0.0
    stock: float = 0.0


class VaccinUpdate(BaseModel):
    nom: Optional[str] = None
    maladie_ciblee: Optional[str] = None
    nombre_doses: Optional[int] = None
    intervalle_doses: Optional[str] = None
    rappel: Optional[str] = None
    prix: Optional[float] = None
    stock: Optional[float] = None


class VaccinationCreate(BaseModel):
    patient_id: int
    vaccin_id: int
    numero_dose: int = 1
    numero_lot: Optional[str] = None
    site_injection: Optional[str] = None
    prochain_rdv: Optional[datetime] = None
    reactions: Optional[str] = None


def _vaccin_dict(v: Vaccin) -> dict:
    return {
        "id": v.id, "nom": v.nom, "maladie_ciblee": v.maladie_ciblee,
        "nombre_doses": v.nombre_doses, "intervalle_doses": v.intervalle_doses,
        "rappel": v.rappel, "prix": v.prix, "stock": v.stock,
        "stock_bas": (v.stock or 0) <= 10,
    }


@router.get("/vaccins")
async def list_vaccins(db: AsyncSession = Depends(get_db), current_user=Depends(get_current_active_user)):
    result = await db.execute(select(Vaccin).where(Vaccin.est_actif == 1).order_by(Vaccin.nom))
    return {"vaccins": [_vaccin_dict(v) for v in result.scalars().all()]}


@router.post("/vaccins", status_code=201)
async def create_vaccin(data: VaccinCreate, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_active_user)):
    existing = await db.execute(select(Vaccin).where(Vaccin.nom == data.nom))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Ce vaccin existe déjà")
    v = Vaccin(**data.model_dump())
    db.add(v)
    await db.flush()
    return {"id": v.id, "message": "Vaccin ajouté"}


@router.put("/vaccins/{vaccin_id}")
async def update_vaccin(vaccin_id: int, data: VaccinUpdate, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_active_user)):
    v = await db.get(Vaccin, vaccin_id)
    if not v:
        raise HTTPException(404, "Vaccin introuvable")
    updates = data.model_dump(exclude_none=True)
    if "nom" in updates and updates["nom"] != v.nom:
        dup = await db.execute(select(Vaccin).where(Vaccin.nom == updates["nom"], Vaccin.id != vaccin_id))
        if dup.scalar_one_or_none():
            raise HTTPException(400, "Ce nom de vaccin existe déjà")
    for key, val in updates.items():
        setattr(v, key, val)
    await db.flush()
    return {"message": "Vaccin mis à jour", **_vaccin_dict(v)}


@router.delete("/vaccins/{vaccin_id}")
async def delete_vaccin(vaccin_id: int, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_active_user)):
    v = await db.get(Vaccin, vaccin_id)
    if not v:
        raise HTTPException(404, "Vaccin introuvable")
    v.est_actif = 0
    await db.flush()
    return {"message": "Vaccin désactivé"}


@router.post("/vaccins/{vaccin_id}/stock")
async def entree_stock_vaccin(vaccin_id: int, quantite: float, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_active_user)):
    v = await db.get(Vaccin, vaccin_id)
    if not v:
        raise HTTPException(404, "Vaccin introuvable")
    v.stock = (v.stock or 0) + quantite
    return {"message": f"Stock mis à jour: {v.stock}", "stock": v.stock}


@router.get("/vaccinations")
async def list_vaccinations(
    patient_id: Optional[int] = None,
    a_venir: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    query = select(Vaccination)
    if patient_id:
        query = query.where(Vaccination.patient_id == patient_id)
    if a_venir is True:
        query = query.where(Vaccination.prochain_rdv.is_not(None), Vaccination.prochain_rdv >= datetime.utcnow())
    query = query.order_by(Vaccination.date_vaccination.desc())
    result = await db.execute(query)
    items = []
    for vac in result.scalars().all():
        patient = await db.get(Patient, vac.patient_id)
        vaccin = await db.get(Vaccin, vac.vaccin_id)
        items.append({
            "id": vac.id,
            "patient": f"{patient.nom} {patient.prenom}" if patient else "—",
            "patient_id": vac.patient_id,
            "vaccin": vaccin.nom if vaccin else "—",
            "maladie_ciblee": vaccin.maladie_ciblee if vaccin else None,
            "numero_dose": vac.numero_dose,
            "nombre_doses": vaccin.nombre_doses if vaccin else 1,
            "numero_lot": vac.numero_lot,
            "site_injection": vac.site_injection,
            "date_vaccination": str(vac.date_vaccination),
            "prochain_rdv": str(vac.prochain_rdv) if vac.prochain_rdv else None,
            "reactions": vac.reactions,
        })
    return {"vaccinations": items}


@router.post("/vaccinations", status_code=201)
async def administrer(data: VaccinationCreate, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_active_user)):
    patient = await db.get(Patient, data.patient_id)
    if not patient:
        raise HTTPException(404, "Patient introuvable")
    vaccin = await db.get(Vaccin, data.vaccin_id)
    if not vaccin:
        raise HTTPException(404, "Vaccin introuvable")
    if (vaccin.stock or 0) < 1:
        raise HTTPException(400, f"Stock épuisé pour {vaccin.nom}")
    vac = Vaccination(
        patient_id=data.patient_id, vaccin_id=data.vaccin_id, numero_dose=data.numero_dose,
        numero_lot=data.numero_lot, site_injection=data.site_injection,
        prochain_rdv=data.prochain_rdv, reactions=data.reactions, infirmier_id=current_user.id,
    )
    vaccin.stock = (vaccin.stock or 0) - 1
    db.add(vac)
    await db.flush()
    facture_numero = None
    if (vaccin.prix or 0) > 0:
        facture = await creer_facture_acte(
            db, data.patient_id, TypeActe.VACCINATION,
            f"Vaccination {vaccin.nom} — dose {data.numero_dose}", 1, vaccin.prix,
            current_user.id, type_source="vaccination",
        )
        facture_numero = facture.numero
    return {"id": vac.id, "message": "Vaccination enregistrée", "facture_numero": facture_numero, "stock_restant": vaccin.stock}
