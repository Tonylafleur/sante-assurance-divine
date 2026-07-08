from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Vaccin(Base):
    __tablename__ = "vaccins"

    id = Column(Integer, primary_key=True, index=True)
    nom = Column(String(200), unique=True, nullable=False)
    maladie_ciblee = Column(String(200))
    nombre_doses = Column(Integer, default=1)
    intervalle_doses = Column(String(100))
    rappel = Column(String(100))
    prix = Column(Float, default=0.0)
    stock = Column(Float, default=0.0)
    est_actif = Column(Integer, default=1)

    vaccinations = relationship("Vaccination", back_populates="vaccin")


class Vaccination(Base):
    __tablename__ = "vaccinations"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    vaccin_id = Column(Integer, ForeignKey("vaccins.id"), nullable=False)
    numero_dose = Column(Integer, default=1)
    numero_lot = Column(String(50))
    site_injection = Column(String(50))
    infirmier_id = Column(Integer, ForeignKey("utilisateurs.id"), nullable=True)
    date_vaccination = Column(DateTime, default=datetime.utcnow)
    prochain_rdv = Column(DateTime, nullable=True)
    reactions = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="vaccinations")
    vaccin = relationship("Vaccin", back_populates="vaccinations")
