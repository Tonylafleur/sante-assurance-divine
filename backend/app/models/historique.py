from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from datetime import datetime
from app.database import Base


class HistoriqueConsultation(Base):
    __tablename__ = "historique_consultations"

    id = Column(Integer, primary_key=True, index=True)
    consultation_id = Column(Integer, ForeignKey("consultations.id"), nullable=False)
    patient_id = Column(Integer, nullable=False)
    action = Column(String(50), nullable=False)   # creation / mise_a_jour / prescription / examen / dispensation / statut
    description = Column(Text)                    # résumé lisible de la modification
    donnees_avant = Column(Text)                  # JSON snapshot avant (optionnel)
    donnees_apres = Column(Text)                  # JSON snapshot après (optionnel)
    utilisateur_id = Column(Integer, ForeignKey("utilisateurs.id"), nullable=True)
    utilisateur_nom = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
