from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Enum as SAEnum, Float
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.database import Base


class StatutExamen(str, enum.Enum):
    PRESCRIT = "prescrit"
    EN_COURS = "en_cours"
    RESULTAT_DISPONIBLE = "resultat_disponible"
    VALIDE = "valide"


class TypeExamen(str, enum.Enum):
    HEMATOLOGIE = "Hématologie"
    BIOCHIMIE = "Biochimie"
    MICROBIOLOGIE = "Microbiologie"
    PARASITOLOGIE = "Parasitologie"
    IMMUNOLOGIE = "Immunologie"
    UROLOGIE = "Urologie"
    AUTRE = "Autre"


class ExamenLaboratoire(Base):
    __tablename__ = "examens_laboratoire"

    id = Column(Integer, primary_key=True, index=True)
    numero = Column(String(20), unique=True, index=True)
    consultation_id = Column(Integer, ForeignKey("consultations.id"), nullable=False)
    type_examen = Column(SAEnum(TypeExamen))
    libelle = Column(String(300), nullable=False)
    valeur_normale = Column(String(200))
    resultat = Column(Text)
    unite = Column(String(50))
    statut = Column(SAEnum(StatutExamen), default=StatutExamen.PRESCRIT)
    laborantin_id = Column(Integer, ForeignKey("utilisateurs.id"), nullable=True)
    date_prelevement = Column(DateTime, nullable=True)
    date_resultat = Column(DateTime, nullable=True)
    notes = Column(Text)
    prix = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    consultation = relationship("Consultation", back_populates="examens_labo")
