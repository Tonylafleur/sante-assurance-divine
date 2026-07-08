from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
from app.database import get_db
from app.models.caisse import Facture, LigneFacture, Paiement, Tarif, StatutFacture, ModePaiement, TypeActe
from app.models.patient import Patient
from app.models.consultation import Consultation
from app.models.pharmacie import Prescription, Medicament
from app.models.utilisateur import Utilisateur, RoleUtilisateur
from app.api.routes.auth import get_current_active_user

router = APIRouter(prefix="/caisse", tags=["Caisse"])

# Rôles autorisés à des opérations sensibles (anti-falsification des montants)
ROLES_ADMIN = {RoleUtilisateur.ADMIN, RoleUtilisateur.SUPERADMIN}


def est_admin(user) -> bool:
    return user.role in ROLES_ADMIN


class LigneFactureItem(BaseModel):
    type_acte: TypeActe
    description: str
    quantite: float = 1.0
    prix_unitaire: Optional[float] = None   # ignoré pour les actes au catalogue (verrouillé serveur)
    prescription_id: Optional[int] = None


class FactureCreate(BaseModel):
    patient_id: int
    consultation_id: Optional[int] = None
    lignes: List[LigneFactureItem]
    montant_remise: float = 0.0
    notes: Optional[str] = None


class FactureUpdate(BaseModel):
    lignes: List[LigneFactureItem]
    montant_remise: float = 0.0
    notes: Optional[str] = None


class AnnulationData(BaseModel):
    motif: str


class PaiementCreate(BaseModel):
    facture_id: int
    montant: float
    mode_paiement: ModePaiement = ModePaiement.ESPECES
    reference_transaction: Optional[str] = None


async def generate_numero_facture(db: AsyncSession) -> str:
    today = datetime.now()
    prefix = f"FAC{today.strftime('%Y%m%d')}"
    result = await db.execute(select(func.count(Facture.id)).where(Facture.numero.like(f"{prefix}%")))
    count = result.scalar() or 0
    return f"{prefix}{str(count + 1).zfill(3)}"


async def get_or_create_facture_consultation(db: AsyncSession, consultation_id: int, patient_id: int, caissier_id: int) -> Facture:
    """Trouve la facture ouverte de cette consultation, ou en crée une vide."""
    result = await db.execute(
        select(Facture).where(
            Facture.consultation_id == consultation_id,
            Facture.statut != StatutFacture.ANNULEE,
        )
    )
    facture = result.scalar_one_or_none()
    if facture:
        return facture
    numero = await generate_numero_facture(db)
    facture = Facture(
        numero=numero,
        patient_id=patient_id,
        consultation_id=consultation_id,
        montant_total=0.0,
        montant_remise=0.0,
        montant_net=0.0,
        montant_restant=0.0,
        type_source="mixte",
        caissier_id=caissier_id,
    )
    db.add(facture)
    await db.flush()
    return facture


async def creer_facture_acte(
    db: AsyncSession, patient_id: int, type_acte: TypeActe, description: str,
    quantite: float, prix_unitaire: float, caissier_id: int,
    consultation_id: Optional[int] = None, type_source: str = "consultation",
) -> Facture:
    """Crée une facture pour un acte unique (labo, vaccination, hospitalisation...)."""
    numero = await generate_numero_facture(db)
    montant = quantite * prix_unitaire
    facture = Facture(
        numero=numero, patient_id=patient_id, consultation_id=consultation_id,
        montant_total=montant, montant_remise=0.0, montant_net=montant,
        montant_restant=montant, type_source=type_source, caissier_id=caissier_id,
    )
    db.add(facture)
    await db.flush()
    db.add(LigneFacture(
        facture_id=facture.id, type_acte=type_acte, description=description,
        quantite=quantite, prix_unitaire=prix_unitaire, montant=montant,
    ))
    await db.flush()
    return facture


async def prix_verrouille(db: AsyncSession, ligne: LigneFactureItem, user) -> float:
    """
    Détermine le prix unitaire OFFICIEL d'une ligne — le caissier ne peut pas le falsifier.
    Priorité : prix médicament (via prescription) > tarif officiel du type d'acte > saisie libre (admin/acte « Autre »).
    """
    # 1) Pharmacie : prix réel du médicament rattaché à la prescription
    if ligne.prescription_id:
        presc = await db.get(Prescription, ligne.prescription_id)
        if presc:
            med = await db.get(Medicament, presc.medicament_id)
            if med:
                return float(med.prix_conditionnement or med.prix_unitaire or 0.0)
    # 2) Tarif officiel du catalogue (verrouillé)
    res = await db.execute(select(Tarif).where(Tarif.type_acte == ligne.type_acte, Tarif.est_actif == 1))
    tarif = res.scalar_one_or_none()
    if tarif and (tarif.montant or 0) > 0:
        return float(tarif.montant)
    # 3) Aucun tarif officiel (ex: acte « Autre ») : prix libre autorisé,
    #    mais tracé via le journal et l'émetteur de la facture.
    return float(ligne.prix_unitaire or 0.0)


async def recalculate_facture(db: AsyncSession, facture: Facture):
    """Recalcule les totaux d'une facture après ajout/suppression de lignes."""
    result = await db.execute(select(func.sum(LigneFacture.montant)).where(LigneFacture.facture_id == facture.id))
    total = result.scalar() or 0.0
    facture.montant_total = total
    facture.montant_net = total - (facture.montant_remise or 0.0)
    facture.montant_restant = facture.montant_net - (facture.montant_paye or 0.0)
    if facture.montant_restant <= 0 and facture.montant_net > 0:
        facture.statut = StatutFacture.PAYEE
    elif facture.montant_paye > 0:
        facture.statut = StatutFacture.PARTIELLEMENT_PAYEE
    else:
        facture.statut = StatutFacture.EN_ATTENTE


@router.post("/factures", status_code=201)
async def create_facture(
    data: FactureCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    patient = await db.get(Patient, data.patient_id)
    if not patient:
        raise HTTPException(404, "Patient introuvable")

    # Remise réservée à l'administration (anti-falsification)
    remise = data.montant_remise or 0.0
    if remise > 0 and not est_admin(current_user):
        raise HTTPException(403, "Seule l'administration peut appliquer une remise")

    numero = await generate_numero_facture(db)
    facture = Facture(
        numero=numero,
        patient_id=data.patient_id,
        consultation_id=data.consultation_id,
        montant_remise=remise,
        caissier_id=current_user.id,
        notes=data.notes,
    )
    db.add(facture)
    await db.flush()

    montant_total = 0.0
    for ligne in data.lignes:
        prix = await prix_verrouille(db, ligne, current_user)
        montant = ligne.quantite * prix
        montant_total += montant
        db.add(LigneFacture(
            facture_id=facture.id,
            type_acte=ligne.type_acte,
            description=ligne.description,
            quantite=ligne.quantite,
            prix_unitaire=prix,
            montant=montant,
            prescription_id=ligne.prescription_id,
        ))

    facture.montant_total = montant_total
    facture.montant_net = montant_total - remise
    facture.montant_restant = facture.montant_net
    return {"id": facture.id, "numero": numero, "montant_net": facture.montant_net}


@router.put("/factures/{facture_id}")
async def update_facture(
    facture_id: int,
    data: FactureUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Modification d'une facture — prix verrouillés, remise admin, facture payée non modifiable."""
    facture = await db.get(Facture, facture_id)
    if not facture:
        raise HTTPException(404, "Facture introuvable")
    if facture.statut == StatutFacture.ANNULEE:
        raise HTTPException(400, "Facture annulée — modification impossible")
    if facture.statut == StatutFacture.PAYEE and not est_admin(current_user):
        raise HTTPException(403, "Facture soldée — verrouillée (réservé à l'administration)")
    if (facture.montant_paye or 0) > 0 and not est_admin(current_user):
        raise HTTPException(403, "Un paiement existe déjà — modification réservée à l'administration")

    remise = data.montant_remise or 0.0
    if remise != (facture.montant_remise or 0.0) and remise > 0 and not est_admin(current_user):
        raise HTTPException(403, "Seule l'administration peut appliquer une remise")

    # Remplacer les lignes
    await db.execute(LigneFacture.__table__.delete().where(LigneFacture.facture_id == facture_id))
    for ligne in data.lignes:
        prix = await prix_verrouille(db, ligne, current_user)
        db.add(LigneFacture(
            facture_id=facture.id,
            type_acte=ligne.type_acte,
            description=ligne.description,
            quantite=ligne.quantite,
            prix_unitaire=prix,
            montant=ligne.quantite * prix,
            prescription_id=ligne.prescription_id,
        ))
    facture.montant_remise = remise
    facture.notes = data.notes
    await db.flush()
    await recalculate_facture(db, facture)
    return {"id": facture.id, "numero": facture.numero, "montant_net": facture.montant_net}


@router.post("/factures/{facture_id}/annuler")
async def annuler_facture(
    facture_id: int,
    data: AnnulationData,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Annulation tracée (motif obligatoire). Le caissier ne peut pas annuler une facture déjà encaissée."""
    if not data.motif or not data.motif.strip():
        raise HTTPException(400, "Le motif d'annulation est obligatoire")
    facture = await db.get(Facture, facture_id)
    if not facture:
        raise HTTPException(404, "Facture introuvable")
    if facture.statut == StatutFacture.ANNULEE:
        raise HTTPException(400, "Facture déjà annulée")
    if (facture.montant_paye or 0) > 0 and not est_admin(current_user):
        raise HTTPException(403, "Facture déjà encaissée — annulation réservée à l'administration")

    horodatage = datetime.now().strftime("%d/%m/%Y %H:%M")
    trace = f"[ANNULÉE le {horodatage} par {current_user.prenom} {current_user.nom}] Motif: {data.motif.strip()}"
    facture.notes = f"{facture.notes}\n{trace}" if facture.notes else trace
    facture.statut = StatutFacture.ANNULEE
    return {"id": facture.id, "statut": facture.statut, "message": "Facture annulée"}


@router.delete("/factures/{facture_id}")
async def supprimer_facture(
    facture_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Suppression définitive — réservée à l'administration."""
    if not est_admin(current_user):
        raise HTTPException(403, "Suppression réservée à l'administration. Utilisez l'annulation.")
    facture = await db.get(Facture, facture_id)
    if not facture:
        raise HTTPException(404, "Facture introuvable")
    await db.execute(Paiement.__table__.delete().where(Paiement.facture_id == facture_id))
    await db.execute(LigneFacture.__table__.delete().where(LigneFacture.facture_id == facture_id))
    await db.execute(Facture.__table__.delete().where(Facture.id == facture_id))
    return {"message": "Facture supprimée"}


@router.post("/paiements")
async def enregistrer_paiement(
    data: PaiementCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    facture = await db.get(Facture, data.facture_id)
    if not facture:
        raise HTTPException(404, "Facture introuvable")
    if data.montant > facture.montant_restant + 0.01:
        raise HTTPException(400, f"Montant dépasse le restant dû: {facture.montant_restant} FCFA")

    paiement = Paiement(
        facture_id=data.facture_id,
        montant=data.montant,
        mode_paiement=data.mode_paiement,
        reference_transaction=data.reference_transaction,
    )
    db.add(paiement)

    facture.montant_paye = (facture.montant_paye or 0) + data.montant
    facture.montant_restant = facture.montant_net - facture.montant_paye
    if facture.montant_restant <= 0.01:
        facture.statut = StatutFacture.PAYEE
        facture.montant_restant = 0
    elif facture.montant_paye > 0:
        facture.statut = StatutFacture.PARTIELLEMENT_PAYEE

    return {
        "message": "Paiement enregistré",
        "montant_paye": facture.montant_paye,
        "montant_restant": facture.montant_restant,
        "statut": facture.statut,
    }


@router.get("/factures")
async def list_factures(
    date_debut: Optional[str] = None,
    statut: Optional[StatutFacture] = None,
    patient_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    query = select(Facture).order_by(Facture.created_at.desc())
    if statut:
        query = query.where(Facture.statut == statut)
    if date_debut:
        query = query.where(Facture.created_at >= date_debut)
    if patient_id:
        query = query.where(Facture.patient_id == patient_id)
    result = await db.execute(query.limit(200))
    factures = result.scalars().all()
    items = []
    cache_emetteurs: dict = {}
    for f in factures:
        patient = await db.get(Patient, f.patient_id)
        emetteur = None
        if f.caissier_id:
            if f.caissier_id not in cache_emetteurs:
                u = await db.get(Utilisateur, f.caissier_id)
                cache_emetteurs[f.caissier_id] = f"{u.prenom} {u.nom}" if u else None
            emetteur = cache_emetteurs[f.caissier_id]
        items.append({
            "id": f.id,
            "numero": f.numero,
            "patient_id": f.patient_id,
            "patient": f"{patient.nom} {patient.prenom}" if patient else "—",
            "consultation_id": f.consultation_id,
            "montant_total": f.montant_total,
            "montant_net": f.montant_net,
            "montant_paye": f.montant_paye,
            "montant_restant": f.montant_restant,
            "statut": f.statut,
            "type_source": f.type_source,
            "emis_par": emetteur,
            "created_at": str(f.created_at),
        })
    return items


@router.get("/factures/{facture_id}/ticket")
async def get_ticket(
    facture_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """Retourne toutes les données nécessaires pour imprimer le ticket de caisse."""
    facture = await db.get(Facture, facture_id)
    if not facture:
        raise HTTPException(404, "Facture introuvable")

    patient = await db.get(Patient, facture.patient_id)
    consultation = await db.get(Consultation, facture.consultation_id) if facture.consultation_id else None
    emetteur = await db.get(Utilisateur, facture.caissier_id) if facture.caissier_id else None

    lignes_result = await db.execute(select(LigneFacture).where(LigneFacture.facture_id == facture_id))
    lignes = lignes_result.scalars().all()

    paiements_result = await db.execute(select(Paiement).where(Paiement.facture_id == facture_id))
    paiements = paiements_result.scalars().all()

    return {
        "facture": {
            "id": facture.id,
            "numero": facture.numero,
            "statut": facture.statut,
            "montant_total": facture.montant_total,
            "montant_remise": facture.montant_remise,
            "montant_net": facture.montant_net,
            "montant_paye": facture.montant_paye,
            "montant_restant": facture.montant_restant,
            "notes": facture.notes,
            "emis_par": f"{emetteur.prenom} {emetteur.nom}" if emetteur else None,
            "emetteur_role": (emetteur.role.value if hasattr(emetteur.role, "value") else str(emetteur.role)) if emetteur else None,
            "created_at": str(facture.created_at),
        },
        "patient": {
            "id": patient.id,
            "nom": patient.nom,
            "prenom": patient.prenom,
            "numero_dossier": patient.numero_dossier,
            "telephone": patient.telephone,
            "age": None,
        } if patient else None,
        "consultation": {
            "numero": consultation.numero,
            "service": consultation.service,
            "motif": consultation.motif,
            "diagnostic_principal": consultation.diagnostic_principal,
        } if consultation else None,
        "lignes": [
            {
                "id": l.id,
                "type_acte": l.type_acte,
                "description": l.description,
                "quantite": l.quantite,
                "prix_unitaire": l.prix_unitaire,
                "montant": l.montant,
                "prescription_id": l.prescription_id,
            }
            for l in lignes
        ],
        "paiements": [
            {
                "montant": p.montant,
                "mode_paiement": p.mode_paiement,
                "reference_transaction": p.reference_transaction,
                "date": str(p.created_at),
            }
            for p in paiements
        ],
    }


@router.get("/stats/journalier")
async def stats_journalier(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    today_start = datetime.now().replace(hour=0, minute=0, second=0)
    result = await db.execute(
        select(
            func.count(Facture.id),
            func.coalesce(func.sum(Facture.montant_paye), 0),
            func.coalesce(func.sum(Facture.montant_net), 0),
        ).where(Facture.created_at >= today_start)
    )
    count, total_encaisse, total_facture = result.one()
    return {
        "date": str(date.today()),
        "nombre_factures": count,
        "total_facture_fcfa": round(total_facture, 0),
        "total_encaisse_fcfa": round(total_encaisse, 0),
        "taux_recouvrement": round((total_encaisse / total_facture * 100) if total_facture > 0 else 0, 1),
    }


_SERVICE_LABELS = {
    "consultation": "Consultations", "pharmacie": "Pharmacie", "laboratoire": "Laboratoire",
    "hospitalisation": "Hospitalisation", "vaccination": "Vaccination", "cpn": "CPN",
    "accouchement": "Accouchements", "mixte": "Mixte (consultation + actes)",
}


@router.get("/stats/par-service")
async def stats_par_service(
    jour: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user)
):
    """Facturation agrégée par service / source d'acte."""
    query = select(
        Facture.type_source,
        func.count(Facture.id),
        func.coalesce(func.sum(Facture.montant_net), 0),
        func.coalesce(func.sum(Facture.montant_paye), 0),
    ).where(Facture.statut != StatutFacture.ANNULEE).group_by(Facture.type_source)
    if jour:
        today_start = datetime.now().replace(hour=0, minute=0, second=0)
        query = query.where(Facture.created_at >= today_start)
    result = await db.execute(query)
    services = []
    total_net = total_paye = 0.0
    for source, nb, net, paye in result.all():
        key = source or "consultation"
        total_net += net or 0
        total_paye += paye or 0
        services.append({
            "service": key,
            "libelle": _SERVICE_LABELS.get(key, key.capitalize()),
            "nombre": nb,
            "total_net": round(net or 0, 0),
            "total_paye": round(paye or 0, 0),
            "restant": round((net or 0) - (paye or 0), 0),
        })
    services.sort(key=lambda s: s["total_net"], reverse=True)
    return {"services": services, "total_net": round(total_net, 0), "total_paye": round(total_paye, 0)}


@router.get("/tarifs")
async def get_tarifs(db: AsyncSession = Depends(get_db), current_user=Depends(get_current_active_user)):
    result = await db.execute(select(Tarif).where(Tarif.est_actif == 1))
    tarifs = result.scalars().all()
    return [{"type_acte": t.type_acte, "libelle": t.libelle, "montant": t.montant} for t in tarifs]
