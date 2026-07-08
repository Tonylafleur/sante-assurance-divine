from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Enum as SAEnum, Float
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.database import Base


class TypeChambre(str, enum.Enum):
    COMMUNE = "Commune"
    SEMI_PRIVEE = "Semi-privée"
    PRIVEE = "Privée"
    SOINS_INTENSIFS = "Soins Intensifs"
    MATERNITE = "Maternité"


class StatutLit(str, enum.Enum):
    DISPONIBLE = "disponible"
    OCCUPE = "occupe"
    MAINTENANCE = "maintenance"


class Lit(Base):
    __tablename__ = "lits"

    id = Column(Integer, primary_key=True, index=True)
    numero = Column(String(10), unique=True, nullable=False)
    chambre = Column(String(20))
    type_chambre = Column(SAEnum(TypeChambre))
    service = Column(String(100))
    statut = Column(SAEnum(StatutLit), default=StatutLit.DISPONIBLE)
    prix_par_jour = Column(Float, default=0.0)

    hospitalisations = relationship("Hospitalisation", back_populates="lit")


class Hospitalisation(Base):
    __tablename__ = "hospitalisations"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    lit_id = Column(Integer, ForeignKey("lits.id"), nullable=False)
    motif = Column(Text, nullable=False)
    diagnostic_entree = Column(String(500))
    traitement_en_cours = Column(Text)
    medecin_responsable_id = Column(Integer, ForeignKey("utilisateurs.id"), nullable=True)
    date_entree = Column(DateTime, default=datetime.utcnow)
    date_sortie_prevue = Column(DateTime, nullable=True)
    date_sortie_effective = Column(DateTime, nullable=True)
    compte_rendu_sortie = Column(Text)
    notes_evolution = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="hospitalisations")
    lit = relationship("Lit", back_populates="hospitalisations")
