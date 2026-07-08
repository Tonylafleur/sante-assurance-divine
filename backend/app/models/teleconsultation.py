from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Enum as SAEnum
from datetime import datetime
import enum
from app.database import Base


class TypeRDV(str, enum.Enum):
    PRESENTIEL = "presentiel"
    TELECONSULTATION = "teleconsultation"


class StatutRDV(str, enum.Enum):
    PLANIFIE = "planifie"
    EN_COURS = "en_cours"
    TERMINE = "termine"
    ANNULE = "annule"


class RendezVous(Base):
    """Rendez-vous / Téléconsultation — planification d'une séance reliée à une consultation."""
    __tablename__ = "rendez_vous"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    medecin_id = Column(Integer, ForeignKey("utilisateurs.id"), nullable=True)
    date_heure = Column(DateTime, nullable=False)
    type_rdv = Column(SAEnum(TypeRDV), default=TypeRDV.TELECONSULTATION)
    statut = Column(SAEnum(StatutRDV), default=StatutRDV.PLANIFIE)
    motif = Column(String(500))
    notes = Column(Text)
    # Téléconsultation : salle vidéo + jeton d'accès patient (lien public)
    room_id = Column(String(64), nullable=True)
    token_patient = Column(String(64), nullable=True, index=True)
    # Rattachement clinique une fois la séance démarrée
    consultation_id = Column(Integer, ForeignKey("consultations.id"), nullable=True)
    created_by = Column(Integer, ForeignKey("utilisateurs.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
