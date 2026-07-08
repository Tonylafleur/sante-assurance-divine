from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Enum as SAEnum, Float, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.database import Base


class ServiceConsultation(str, enum.Enum):
    GENERALE = "Consultation Générale"
    SPECIALISEE = "Consultation Spécialisée"
    GYNECOLOGIE = "Gynécologie"
    KINESITHERAPIE = "Kinésithérapie"
    PETITE_CHIRURGIE = "Petite Chirurgie"
    EDUCATION_SANITAIRE = "Éducation Sanitaire"
    URGENCE = "Urgence"


class StatutConsultation(str, enum.Enum):
    EN_ATTENTE = "en_attente"
    EN_COURS = "en_cours"
    TERMINEE = "terminee"
    ANNULEE = "annulee"


class NiveauUrgence(str, enum.Enum):
    VERT = "vert"
    JAUNE = "jaune"
    ORANGE = "orange"
    ROUGE = "rouge"


class Consultation(Base):
    __tablename__ = "consultations"

    id = Column(Integer, primary_key=True, index=True)
    numero = Column(String(20), unique=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    medecin_id = Column(Integer, ForeignKey("utilisateurs.id"), nullable=True)
    service = Column(SAEnum(ServiceConsultation), default=ServiceConsultation.GENERALE)
    niveau_urgence = Column(SAEnum(NiveauUrgence), default=NiveauUrgence.VERT)
    motif = Column(Text, nullable=False)

    # Histoire de la maladie (anamnèse structurée)
    histoire_maladie = Column(Text)              # Récit chronologique
    duree_symptomes = Column(String(100))        # ex: "3 jours", "2 semaines"
    mode_debut = Column(String(100))             # brutal / progressif / insidieux
    facteurs_declenchants = Column(Text)
    facteurs_calmants = Column(Text)
    signes_associes = Column(Text)               # autres symptômes associés

    # Antécédents pertinents pour cette consultation
    antecedents_pertinents = Column(Text)

    symptomes = Column(Text)

    # Signes vitaux
    tension_arterielle = Column(String(20))
    temperature = Column(Float)
    poids = Column(Float)
    taille = Column(Float)
    frequence_cardiaque = Column(Integer)
    saturation_o2 = Column(Float)
    frequence_respiratoire = Column(Integer)
    glycemie = Column(Float)                     # glycémie capillaire aléatoire (mmol/L)
    glycemie_jeun = Column(Float)               # glycémie à jeûn ≥ 8h (mmol/L)
    glycemie_post_prandiale = Column(Float)     # glycémie 2h après repas (mmol/L)
    perimetre_brachial = Column(Float)           # MUAC pour enfants
    perimetre_cranien = Column(Float)            # PC pour nourrissons

    # IMC calculé à la consultation
    imc = Column(Float)
    statut_imc = Column(String(50))

    # Diagnostic CIM-10
    code_cim10_principal = Column(String(10))
    libelle_cim10_principal = Column(String(500))
    codes_cim10_secondaires = Column(Text)       # JSON stringifié

    # Formulaire maladie endémique (JSON stringifié)
    maladie_endemique_type = Column(String(50))  # paludisme, tuberculose, etc.
    maladie_endemique_data = Column(Text)        # JSON avec les champs spécifiques

    # Dossier médical
    examen_clinique = Column(Text)
    diagnostic_principal = Column(String(500))
    diagnostics_secondaires = Column(Text)
    traitement = Column(Text)
    statut = Column(SAEnum(StatutConsultation), default=StatutConsultation.EN_ATTENTE)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    patient = relationship("Patient", back_populates="consultations")
    medecin = relationship("Utilisateur", back_populates="consultations")
    prescriptions = relationship("Prescription", back_populates="consultation")
    examens_labo = relationship("ExamenLaboratoire", back_populates="consultation")
    factures = relationship("Facture", back_populates="consultation")
