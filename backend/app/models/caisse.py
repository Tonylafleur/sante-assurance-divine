from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Float, Enum as SAEnum, Text
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.database import Base


class StatutFacture(str, enum.Enum):
    EN_ATTENTE = "en_attente"
    PARTIELLEMENT_PAYEE = "partiellement_payee"
    PAYEE = "payee"
    ANNULEE = "annulee"


class ModePaiement(str, enum.Enum):
    ESPECES = "Espèces"
    MOBILE_MONEY = "Mobile Money"
    CARTE = "Carte bancaire"
    CHEQUE = "Chèque"
    ASSURANCE = "Assurance"


class TypeActe(str, enum.Enum):
    CONSULTATION = "Consultation"
    TELECONSULTATION = "Téléconsultation"
    HOSPITALISATION = "Hospitalisation"
    LABORATOIRE = "Laboratoire"
    PHARMACIE = "Pharmacie"
    ACCOUCHEMENT = "Accouchement"
    PETITE_CHIRURGIE = "Petite Chirurgie"
    CPN = "CPN"
    VACCINATION = "Vaccination"
    KINESITHERAPIE = "Kinésithérapie"
    ECHOGRAPHIE = "Échographie"
    AUTRE = "Autre"


class Facture(Base):
    __tablename__ = "factures"

    id = Column(Integer, primary_key=True, index=True)
    numero = Column(String(20), unique=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    consultation_id = Column(Integer, ForeignKey("consultations.id"), nullable=True)
    montant_total = Column(Float, default=0.0)
    montant_remise = Column(Float, default=0.0)
    montant_net = Column(Float, default=0.0)
    montant_paye = Column(Float, default=0.0)
    montant_restant = Column(Float, default=0.0)
    statut = Column(SAEnum(StatutFacture), default=StatutFacture.EN_ATTENTE)
    notes = Column(Text)
    type_source = Column(String(30), default="consultation")  # consultation / pharmacie / mixte
    caissier_id = Column(Integer, ForeignKey("utilisateurs.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    patient = relationship("Patient", back_populates="factures")
    consultation = relationship("Consultation", back_populates="factures")
    lignes = relationship("LigneFacture", back_populates="facture")
    paiements = relationship("Paiement", back_populates="facture")


class LigneFacture(Base):
    __tablename__ = "lignes_facture"

    id = Column(Integer, primary_key=True, index=True)
    facture_id = Column(Integer, ForeignKey("factures.id"), nullable=False)
    type_acte = Column(SAEnum(TypeActe))
    description = Column(String(500), nullable=False)
    quantite = Column(Float, default=1.0)
    prix_unitaire = Column(Float, nullable=False)
    montant = Column(Float, nullable=False)
    prescription_id = Column(Integer, ForeignKey("prescriptions.id"), nullable=True)
    reference_externe = Column(String(100), nullable=True)

    facture = relationship("Facture", back_populates="lignes")


class Paiement(Base):
    __tablename__ = "paiements"

    id = Column(Integer, primary_key=True, index=True)
    facture_id = Column(Integer, ForeignKey("factures.id"), nullable=False)
    montant = Column(Float, nullable=False)
    mode_paiement = Column(SAEnum(ModePaiement), default=ModePaiement.ESPECES)
    reference_transaction = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)

    facture = relationship("Facture", back_populates="paiements")


class Tarif(Base):
    __tablename__ = "tarifs"

    id = Column(Integer, primary_key=True, index=True)
    type_acte = Column(SAEnum(TypeActe), unique=True)
    libelle = Column(String(200), nullable=False)
    montant = Column(Float, nullable=False)
    est_actif = Column(Integer, default=1)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
