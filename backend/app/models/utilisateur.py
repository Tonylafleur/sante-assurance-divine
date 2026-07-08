from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum as SAEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.database import Base


class RoleUtilisateur(str, enum.Enum):
    SUPERADMIN = "superadmin"
    ADMIN = "admin"
    MEDECIN = "medecin"
    INFIRMIER = "infirmier"
    SAGE_FEMME = "sage_femme"
    LABORANTIN = "laborantin"
    PHARMACIEN = "pharmacien"
    CAISSIER = "caissier"
    ACCUEIL = "accueil"
    KINESITHERAPEUTE = "kinesitherapeute"


class Utilisateur(Base):
    __tablename__ = "utilisateurs"

    id = Column(Integer, primary_key=True, index=True)
    matricule = Column(String(20), unique=True, index=True)
    nom = Column(String(100), nullable=False)
    prenom = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=True)
    telephone = Column(String(20))
    role = Column(SAEnum(RoleUtilisateur), nullable=False)
    service = Column(String(100))
    hashed_password = Column(String(255), nullable=False)
    est_actif = Column(Boolean, default=True)
    # Compte validé par le superadministrateur. Les comptes auto-inscrits
    # démarrent à False (en attente de validation) ; les comptes amorcés (seed) à True.
    est_valide = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    consultations = relationship("Consultation", back_populates="medecin")
