from sqlalchemy import Column, Integer, String, Date, DateTime, Enum as SAEnum, Text, Float
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.database import Base


class Sexe(str, enum.Enum):
    M = "M"
    F = "F"


class GroupeSanguin(str, enum.Enum):
    A_POS = "A+"
    A_NEG = "A-"
    B_POS = "B+"
    B_NEG = "B-"
    AB_POS = "AB+"
    AB_NEG = "AB-"
    O_POS = "O+"
    O_NEG = "O-"
    INCONNU = "Inconnu"


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    numero_dossier = Column(String(20), unique=True, index=True, nullable=False)
    nom = Column(String(100), nullable=False)
    prenom = Column(String(100), nullable=False)
    date_naissance = Column(Date, nullable=True)
    sexe = Column(SAEnum(Sexe), nullable=False)
    telephone = Column(String(20))
    telephone_urgence = Column(String(20))
    contact_urgence = Column(String(100))
    adresse = Column(String(255))
    quartier = Column(String(100))
    ville = Column(String(100), default="Yaoundé")
    profession = Column(String(100))
    groupe_sanguin = Column(SAEnum(GroupeSanguin), default=GroupeSanguin.INCONNU)

    # Mesures anthropométriques (valeurs de référence du patient)
    poids_kg = Column(Float, nullable=True)
    taille_cm = Column(Float, nullable=True)
    perimetre_brachial_cm = Column(Float, nullable=True)   # MUAC — enfants <5 ans
    perimetre_cranien_cm = Column(Float, nullable=True)    # Nourrissons <2 ans
    glycemie = Column(Float, nullable=True)                # Glycémie de référence (mmol/L)
    glycemie_note = Column(String(200), nullable=True)     # À jeûn / non à jeûn + précisions

    # Antécédents structurés
    allergies = Column(Text)
    antecedents_medicaux = Column(Text)         # ex-"antecedents"
    antecedents_chirurgicaux = Column(Text)
    antecedents_familiaux = Column(Text)
    antecedents_obstetricaux = Column(Text)     # pour les femmes
    mode_de_vie = Column(Text)                  # tabac, alcool, activité physique

    est_actif = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    consultations = relationship("Consultation", back_populates="patient")
    hospitalisations = relationship("Hospitalisation", back_populates="patient")
    vaccinations = relationship("Vaccination", back_populates="patient")
    cpn_suivis = relationship("SuiviCPN", back_populates="patient")
    factures = relationship("Facture", back_populates="patient")
