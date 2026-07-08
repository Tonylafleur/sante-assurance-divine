from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.database import get_db
from app.models.pharmacie import (
    Medicament, Prescription, MouvementStock,
    StatutPrescription, FormeMedicament, TypeConditionnement
)
from app.models.consultation import Consultation
from app.models.patient import Patient
from app.models.historique import HistoriqueConsultation
from app.models.caisse import LigneFacture, TypeActe
from app.api.routes.auth import get_current_active_user
from app.api.routes.caisse import get_or_create_facture_consultation, recalculate_facture
from app.services.websocket_manager import manager, CANAL_PHARMACIE, CANAL_CAISSE

router = APIRouter(prefix="/pharmacie", tags=["Pharmacie"])


# ─── Schémas Pydantic ────────────────────────────────────────────────────────

class MedicamentCreate(BaseModel):
    code: Optional[str] = None
    nom_commercial: str
    dci: Optional[str] = None
    forme: FormeMedicament = FormeMedicament.COMPRIME
    dosage: Optional[str] = None
    type_conditionnement: TypeConditionnement = TypeConditionnement.PLAQUETTE
    nb_par_conditionnement: int = 1
    volume_ml: Optional[float] = None
    prix_unitaire: float = 0.0
    prix_conditionnement: float = 0.0
    stock_actuel: float = 0.0
    seuil_alerte: float = 10.0
    unite_stock: Optional[str] = None
    fabricant: Optional[str] = None
    classe_therapeutique: Optional[str] = None
    necessite_ordonnance: bool = True
    est_disponible: bool = True
    notes: Optional[str] = None


class DisponibiliteRequest(BaseModel):
    est_disponible: bool
    motif: Optional[str] = None


class MedicamentUpdate(BaseModel):
    nom_commercial: Optional[str] = None
    dci: Optional[str] = None
    forme: Optional[FormeMedicament] = None
    dosage: Optional[str] = None
    type_conditionnement: Optional[TypeConditionnement] = None
    nb_par_conditionnement: Optional[int] = None
    volume_ml: Optional[float] = None
    prix_unitaire: Optional[float] = None
    prix_conditionnement: Optional[float] = None
    seuil_alerte: Optional[float] = None
    unite_stock: Optional[str] = None
    fabricant: Optional[str] = None
    classe_therapeutique: Optional[str] = None
    necessite_ordonnance: Optional[bool] = None
    est_actif: Optional[bool] = None
    notes: Optional[str] = None


class EntreeStockRequest(BaseModel):
    medicament_id: int
    quantite: float
    motif: str = "Approvisionnement"
    reference: Optional[str] = None


class DispenserRequest(BaseModel):
    quantite: Optional[float] = None


# ─── Helper ──────────────────────────────────────────────────────────────────

def med_to_dict(m: Medicament) -> dict:
    unite = m.unite_stock or (m.type_conditionnement.value if m.type_conditionnement else "unité")
    return {
        "id": m.id,
        "code": m.code,
        "nom_commercial": m.nom_commercial,
        "dci": m.dci,
        "forme": m.forme,
        "dosage": m.dosage,
        "type_conditionnement": m.type_conditionnement,
        "nb_par_conditionnement": m.nb_par_conditionnement,
        "volume_ml": m.volume_ml,
        "prix_unitaire": m.prix_unitaire,
        "prix_conditionnement": m.prix_conditionnement,
        "stock_actuel": m.stock_actuel,
        "seuil_alerte": m.seuil_alerte,
        "unite_stock": unite,
        "stock_alerte": m.stock_actuel <= m.seuil_alerte,
        "fabricant": m.fabricant,
        "classe_therapeutique": m.classe_therapeutique,
        "necessite_ordonnance": m.necessite_ordonnance,
        "est_actif": m.est_actif,
        "est_disponible": getattr(m, "est_disponible", True),
        "motif_indisponibilite": getattr(m, "motif_indisponibilite", None),
        "notes": m.notes,
        "description_stock": (
            f"{m.stock_actuel} {unite}(s)"
            + (f" × {m.nb_par_conditionnement} unités" if m.nb_par_conditionnement and m.nb_par_conditionnement > 1 else "")
        ),
    }


async def _log_historique(db, consultation_id, patient_id, action, description, utilisateur=None):
    h = HistoriqueConsultation(
        consultation_id=consultation_id,
        patient_id=patient_id,
        action=action,
        description=description,
        utilisateur_id=utilisateur.id if utilisateur else None,
        utilisateur_nom=f"{utilisateur.prenom} {utilisateur.nom}" if utilisateur else "Système",
    )
    db.add(h)


# ─── CRUD Médicaments ─────────────────────────────────────────────────────────

@router.post("/medicaments", status_code=201)
async def create_medicament(
    data: MedicamentCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    if not data.code:
        result = await db.execute(select(func.count(Medicament.id)))
        count = result.scalar() or 0
        data.code = f"MED{str(count + 1).zfill(4)}"

    unite = data.unite_stock or data.type_conditionnement.value
    payload = data.model_dump(exclude={"unite_stock"})
    med = Medicament(**payload, unite_stock=unite)
    db.add(med)
    await db.flush()
    return {"id": med.id, "code": med.code, "message": "Médicament créé"}


@router.get("/medicaments")
async def list_medicaments(
    search: Optional[str] = None,
    forme: Optional[str] = None,
    alerte_stock: Optional[bool] = None,
    actif: bool = True,
    page: int = Query(1, ge=1),
    per_page: int = Query(50),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    from sqlalchemy import or_
    query = select(Medicament).where(Medicament.est_actif == actif)
    if search:
        s = f"%{search}%"
        query = query.where(or_(
            Medicament.nom_commercial.ilike(s),
            Medicament.dci.ilike(s),
            Medicament.code.ilike(s),
            Medicament.classe_therapeutique.ilike(s),
        ))
    if forme:
        query = query.where(Medicament.forme == forme)
    if alerte_stock is True:
        query = query.where(Medicament.stock_actuel <= Medicament.seuil_alerte)

    total_q = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_q.scalar()
    query = query.order_by(Medicament.nom_commercial).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    meds = result.scalars().all()
    return {"total": total, "medicaments": [med_to_dict(m) for m in meds]}


@router.get("/medicaments/{medicament_id}")
async def get_medicament(
    medicament_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    m = await db.get(Medicament, medicament_id)
    if not m:
        raise HTTPException(404, "Médicament introuvable")
    return med_to_dict(m)


@router.put("/medicaments/{medicament_id}")
async def update_medicament(
    medicament_id: int,
    data: MedicamentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    m = await db.get(Medicament, medicament_id)
    if not m:
        raise HTTPException(404, "Médicament introuvable")
    updates = data.model_dump(exclude_none=True)
    if "type_conditionnement" in updates and "unite_stock" not in updates:
        updates["unite_stock"] = updates["type_conditionnement"].value
    for key, val in updates.items():
        setattr(m, key, val)
    m.updated_at = datetime.utcnow()
    return {"message": "Médicament mis à jour", **med_to_dict(m)}


@router.delete("/medicaments/{medicament_id}")
async def delete_medicament(
    medicament_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    m = await db.get(Medicament, medicament_id)
    if not m:
        raise HTTPException(404, "Médicament introuvable")
    m.est_actif = False
    m.updated_at = datetime.utcnow()
    return {"message": "Médicament désactivé"}


@router.post("/medicaments/{medicament_id}/disponibilite")
async def set_disponibilite(
    medicament_id: int,
    data: DisponibiliteRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """Marquer un médicament disponible / indisponible (badge visible par le prescripteur)."""
    m = await db.get(Medicament, medicament_id)
    if not m:
        raise HTTPException(404, "Médicament introuvable")
    m.est_disponible = data.est_disponible
    m.motif_indisponibilite = (data.motif or "").strip() or None if not data.est_disponible else None
    m.updated_at = datetime.utcnow()
    return {
        "message": "Disponibilité mise à jour",
        "est_disponible": m.est_disponible,
        "motif_indisponibilite": m.motif_indisponibilite,
    }


# ─── Stock ────────────────────────────────────────────────────────────────────

@router.post("/stock/entree")
async def entree_stock(
    data: EntreeStockRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    m = await db.get(Medicament, data.medicament_id)
    if not m:
        raise HTTPException(404, "Médicament introuvable")
    stock_avant = m.stock_actuel
    m.stock_actuel += data.quantite
    m.updated_at = datetime.utcnow()
    mouvement = MouvementStock(
        medicament_id=m.id,
        type_mouvement="entree",
        quantite=data.quantite,
        stock_avant=stock_avant,
        stock_apres=m.stock_actuel,
        motif=data.motif,
        reference=data.reference,
        utilisateur_id=current_user.id,
    )
    db.add(mouvement)
    return {
        "message": f"Entrée de {data.quantite} {m.unite_stock}(s) enregistrée",
        "stock_avant": stock_avant,
        "stock_apres": m.stock_actuel,
    }


@router.get("/stock/mouvements")
async def list_mouvements(
    medicament_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(30),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    query = select(MouvementStock)
    if medicament_id:
        query = query.where(MouvementStock.medicament_id == medicament_id)
    total_q = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_q.scalar()
    query = query.order_by(MouvementStock.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    mvts = result.scalars().all()
    items = []
    for mv in mvts:
        med = await db.get(Medicament, mv.medicament_id)
        items.append({
            "id": mv.id,
            "medicament": med.nom_commercial if med else "—",
            "type_mouvement": mv.type_mouvement,
            "quantite": mv.quantite,
            "unite": med.unite_stock if med else "",
            "stock_avant": mv.stock_avant,
            "stock_apres": mv.stock_apres,
            "motif": mv.motif,
            "reference": mv.reference,
            "created_at": str(mv.created_at),
        })
    return {"total": total, "mouvements": items}


# ─── Prescriptions ────────────────────────────────────────────────────────────

@router.get("/prescriptions")
async def list_prescriptions(
    statut: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(30),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    query = select(Prescription)
    if statut:
        query = query.where(Prescription.statut == statut)
    total_q = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_q.scalar()
    query = query.order_by(Prescription.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    prescriptions = result.scalars().all()
    items = []
    for p in prescriptions:
        med = await db.get(Medicament, p.medicament_id)
        consult = await db.get(Consultation, p.consultation_id)
        patient = await db.get(Patient, consult.patient_id) if consult else None
        items.append({
            "id": p.id,
            "consultation_id": p.consultation_id,
            "consultation_numero": consult.numero if consult else "—",
            "patient": f"{patient.nom} {patient.prenom}" if patient else "—",
            "medicament_id": p.medicament_id,
            "medicament": med.nom_commercial if med else "—",
            "dci": med.dci if med else "",
            "forme": med.forme if med else "",
            "dosage": med.dosage if med else "",
            "type_conditionnement": med.type_conditionnement if med else "",
            "nb_par_conditionnement": med.nb_par_conditionnement if med else 1,
            "unite_stock": med.unite_stock if med else "",
            "est_disponible": getattr(med, "est_disponible", True) if med else True,
            "stock_actuel": med.stock_actuel if med else 0,
            "posologie": p.posologie,
            "quantite_prescrite": p.quantite_prescrite,
            "quantite_dispensee": p.quantite_dispensee,
            "duree_traitement": p.duree_traitement,
            "instructions": p.instructions,
            "statut": p.statut,
            "montant_total": p.montant_total,
            "created_at": str(p.created_at),
        })
    return {"total": total, "prescriptions": items}


@router.post("/prescriptions/{prescription_id}/dispenser")
async def dispenser_prescription(
    prescription_id: int,
    body: Optional[DispenserRequest] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    p = await db.get(Prescription, prescription_id)
    if not p:
        raise HTTPException(404, "Prescription introuvable")
    if p.statut == StatutPrescription.DISPENSEE:
        raise HTTPException(400, "Prescription déjà dispensée")
    if p.statut == StatutPrescription.ANNULEE:
        raise HTTPException(400, "Prescription annulée")

    med = await db.get(Medicament, p.medicament_id)
    if not med:
        raise HTTPException(404, "Médicament introuvable")

    qte_a_dispenser = (body.quantite if body and body.quantite else None) or (p.quantite_prescrite - p.quantite_dispensee)
    if qte_a_dispenser <= 0:
        raise HTTPException(400, "Quantité invalide")
    if med.stock_actuel < qte_a_dispenser:
        raise HTTPException(400, f"Stock insuffisant: {med.stock_actuel} {med.unite_stock}(s) disponible(s), {qte_a_dispenser} demandée(s)")

    stock_avant = med.stock_actuel
    med.stock_actuel -= qte_a_dispenser
    med.updated_at = datetime.utcnow()

    mouvement = MouvementStock(
        medicament_id=med.id,
        type_mouvement="sortie",
        quantite=qte_a_dispenser,
        stock_avant=stock_avant,
        stock_apres=med.stock_actuel,
        motif="Dispensation ordonnance",
        reference=f"RX-{prescription_id}",
        utilisateur_id=current_user.id,
    )
    db.add(mouvement)

    p.quantite_dispensee += qte_a_dispenser
    p.dispensee_par_id = current_user.id
    p.date_dispensation = datetime.utcnow()
    montant = qte_a_dispenser * (med.prix_conditionnement or med.prix_unitaire * (med.nb_par_conditionnement or 1))
    p.montant_total = montant
    reste = p.quantite_prescrite - p.quantite_dispensee
    p.statut = StatutPrescription.DISPENSEE if reste <= 0 else StatutPrescription.PARTIELLEMENT_DISPENSEE

    # Historique
    consult = await db.get(Consultation, p.consultation_id)
    if consult:
        await _log_historique(
            db,
            consultation_id=p.consultation_id,
            patient_id=consult.patient_id,
            action="dispensation",
            description=(
                f"Dispensé {qte_a_dispenser} {med.unite_stock}(s) de {med.nom_commercial} "
                f"({med.nb_par_conditionnement} unités/{med.unite_stock}) — "
                f"Stock: {stock_avant} → {med.stock_actuel}"
            ),
            utilisateur=current_user,
        )

    patient = await db.get(Patient, consult.patient_id) if consult else None

    # ── Synchronisation caisse : ajouter ligne sur la facture de la consultation ──
    facture_id = None
    facture_numero = None
    if consult:
        facture = await get_or_create_facture_consultation(
            db, consult.id, consult.patient_id, current_user.id
        )
        ligne_desc = (
            f"{med.nom_commercial}"
            + (f" {med.dosage}" if med.dosage else "")
            + f" × {qte_a_dispenser} {med.unite_stock}"
            + (f" ({int(qte_a_dispenser * med.nb_par_conditionnement)} unités)" if med.nb_par_conditionnement and med.nb_par_conditionnement > 1 else "")
        )
        ligne = LigneFacture(
            facture_id=facture.id,
            type_acte=TypeActe.PHARMACIE,
            description=ligne_desc,
            quantite=qte_a_dispenser,
            prix_unitaire=med.prix_conditionnement or 0,
            montant=montant,
            prescription_id=p.id,
            reference_externe=f"RX-{p.id}",
        )
        db.add(ligne)
        await db.flush()
        await recalculate_facture(db, facture)
        facture_id = facture.id
        facture_numero = facture.numero

    await manager.broadcast(CANAL_CAISSE, {
        "type": "medicament_dispense",
        "prescription_id": prescription_id,
        "facture_id": facture_id,
        "facture_numero": facture_numero,
        "patient": f"{patient.nom} {patient.prenom}" if patient else "—",
        "medicament": med.nom_commercial,
        "quantite": qte_a_dispenser,
        "unite": med.unite_stock,
        "montant": montant,
    })

    return {
        "message": f"{qte_a_dispenser} {med.unite_stock}(s) dispensée(s)",
        "stock_restant": med.stock_actuel,
        "montant": montant,
        "statut_prescription": p.statut,
        "facture_id": facture_id,
        "facture_numero": facture_numero,
        "alerte_stock": f"⚠ Stock bas: {med.stock_actuel} {med.unite_stock}(s)" if med.stock_actuel <= med.seuil_alerte else None,
    }


@router.post("/prescriptions/{prescription_id}/annuler")
async def annuler_prescription(
    prescription_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    p = await db.get(Prescription, prescription_id)
    if not p:
        raise HTTPException(404, "Prescription introuvable")
    if p.statut == StatutPrescription.DISPENSEE:
        raise HTTPException(400, "Impossible d'annuler une prescription déjà dispensée")
    p.statut = StatutPrescription.ANNULEE
    consult = await db.get(Consultation, p.consultation_id)
    if consult:
        med = await db.get(Medicament, p.medicament_id)
        await _log_historique(
            db,
            consultation_id=p.consultation_id,
            patient_id=consult.patient_id,
            action="annulation",
            description=f"Prescription de {med.nom_commercial if med else '—'} annulée",
            utilisateur=current_user,
        )
    return {"message": "Prescription annulée"}
