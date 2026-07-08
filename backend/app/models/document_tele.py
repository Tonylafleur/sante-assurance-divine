from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, LargeBinary
from datetime import datetime
from app.database import Base


class DocumentTele(Base):
    """Document partagé pendant une téléconsultation (ordonnance, résultat, photo…).
    Stocké en base pour être sauvegardé avec le reste des données du centre."""
    __tablename__ = "documents_tele"

    id = Column(Integer, primary_key=True, index=True)
    rdv_id = Column(Integer, ForeignKey("rendez_vous.id"), nullable=False, index=True)
    nom_fichier = Column(String(255), nullable=False)
    type_mime = Column(String(120))
    taille = Column(Integer, default=0)
    contenu = Column(LargeBinary, nullable=False)
    source = Column(String(20), default="staff")   # staff | patient
    depose_par = Column(String(200))                # nom de l'auteur
    created_at = Column(DateTime, default=datetime.utcnow)
