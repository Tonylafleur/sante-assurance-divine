from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Float, Enum as SAEnum, Text, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.database import Base


class FormeMedicament(str, enum.Enum):
    COMPRIME = "Comprimé"
    GELULE = "Gélule"
    SIROP = "Sirop"
    INJECTABLE = "Injectable"
    POMMADE = "Pommade"
    SUPPOSITOIRE = "Suppositoire"
    COLLYRE = "Collyre"
    SACHET = "Sachet"
    SOLUTION = "Solution"
    SUSPENSION = "Suspension buvable"
    CREME = "Crème"
    AUTRE = "Autre"


class TypeConditionnement(str, enum.Enum):
    PLAQUETTE = "plaquette"      # comprimés, gélules
    BOITE = "boîte"              # ampoules, suppositoires
    FLACON = "flacon"            # sirop, solution, collyre, suspensions
    TUBE = "tube"                # pommade, crème
    SACHET = "sachet"            # poudre, SRO
    AMPOULE = "ampoule"          # injectables unitaires
    UNITE = "unité"              # vente à l'unité (seringue, moustiquaire...)
    BIDON = "bidon"              # grandes solutions


class StatutPrescription(str, enum.Enum):
    EN_ATTENTE = "en_attente"
    VALIDEE = "validee"
    DISPENSEE = "dispensee"
    PARTIELLEMENT_DISPENSEE = "partiellement_dispensee"
    ANNULEE = "annulee"


class Medicament(Base):
    __tablename__ = "medicaments"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(30), unique=True, index=True)
    nom_commercial = Column(String(200), nullable=False)
    dci = Column(String(200))
    forme = Column(SAEnum(FormeMedicament), default=FormeMedicament.COMPRIME)
    dosage = Column(String(50))

    # ── Conditionnement ──────────────────────────────────────────────────
    type_conditionnement = Column(SAEnum(TypeConditionnement), default=TypeConditionnement.PLAQUETTE)
    nb_par_conditionnement = Column(Integer, default=1)  # ex: 10 cp/plaquette, 125ml/flacon
    volume_ml = Column(Float, nullable=True)              # pour flacons (ex: 125 ml, 500 ml)
    # Prix
    prix_unitaire = Column(Float, default=0.0)            # prix par unité (1 cp, 1 ml…)
    prix_conditionnement = Column(Float, default=0.0)     # prix par conditionnement vendu

    # ── Stock ────────────────────────────────────────────────────────────
    # Le stock est géré en CONDITIONNEMENTS (plaquettes, flacons, tubes…)
    stock_actuel = Column(Float, default=0.0)             # en nombre de conditionnements
    seuil_alerte = Column(Float, default=10.0)            # en conditionnements
    unite_stock = Column(String(30), default="plaquette") # libellé affiché

    date_expiration = Column(DateTime, nullable=True)
    fabricant = Column(String(200))
    classe_therapeutique = Column(String(100))            # ex: Antipaludéen, Antibiotique…
    necessite_ordonnance = Column(Boolean, default=True)
    est_actif = Column(Boolean, default=True)
    # Disponibilité commerciale (rupture, retrait...). Distincte du stock :
    # la pharmacie peut marquer un produit indisponible même si le stock > 0.
    est_disponible = Column(Boolean, default=True)
    motif_indisponibilite = Column(String(200), nullable=True)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    prescriptions = relationship("Prescription", back_populates="medicament")
    mouvements = relationship("MouvementStock", back_populates="medicament")


class Prescription(Base):
    __tablename__ = "prescriptions"

    id = Column(Integer, primary_key=True, index=True)
    consultation_id = Column(Integer, ForeignKey("consultations.id"), nullable=False)
    medicament_id = Column(Integer, ForeignKey("medicaments.id"), nullable=False)
    posologie = Column(String(500), nullable=False)
    # Quantité en CONDITIONNEMENTS (plaquettes, flacons…)
    quantite_prescrite = Column(Float, nullable=False)    # ex: 2 plaquettes, 1 flacon
    quantite_dispensee = Column(Float, default=0.0)
    duree_traitement = Column(String(100))
    instructions = Column(Text)
    statut = Column(SAEnum(StatutPrescription), default=StatutPrescription.EN_ATTENTE)
    dispensee_par_id = Column(Integer, ForeignKey("utilisateurs.id"), nullable=True)
    date_dispensation = Column(DateTime, nullable=True)
    montant_total = Column(Float, default=0.0)            # montant facturé
    created_at = Column(DateTime, default=datetime.utcnow)

    consultation = relationship("Consultation", back_populates="prescriptions")
    medicament = relationship("Medicament", back_populates="prescriptions")


class MouvementStock(Base):
    __tablename__ = "mouvements_stock"

    id = Column(Integer, primary_key=True, index=True)
    medicament_id = Column(Integer, ForeignKey("medicaments.id"), nullable=False)
    type_mouvement = Column(String(20))   # entree / sortie / ajustement / perte
    quantite = Column(Float, nullable=False)              # en conditionnements
    stock_avant = Column(Float)
    stock_apres = Column(Float)
    motif = Column(String(200))
    reference = Column(String(100))       # numéro prescription, bon de commande…
    utilisateur_id = Column(Integer, ForeignKey("utilisateurs.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    medicament = relationship("Medicament", back_populates="mouvements")
