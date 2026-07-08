from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Float, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class SuiviCPN(Base):
    __tablename__ = "suivis_cpn"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    numero_visite = Column(Integer, default=1)
    date_visite = Column(DateTime, default=datetime.utcnow)
    sage_femme_id = Column(Integer, ForeignKey("utilisateurs.id"), nullable=True)
    # Données grossesse
    date_derniere_regle = Column(DateTime, nullable=True)
    terme_calcule = Column(String(50))
    age_gestationnel = Column(String(50))
    # Signes vitaux
    tension_arterielle = Column(String(20))
    poids = Column(Float)
    hauteur_uterine = Column(Float)
    bruit_coeur_foetal = Column(String(50))
    presentation = Column(String(50))
    oedemes = Column(Boolean, default=False)
    # Examens
    albuminurie = Column(String(50))
    glycosurie = Column(String(50))
    hemoglobine = Column(Float)
    taux_hematocrite = Column(Float)
    groupe_rhesus = Column(String(10))
    test_vih = Column(String(50))
    test_syphilis = Column(String(50))
    # Traitement prophylactique
    fer_folate = Column(Boolean, default=False)
    moustiquaire = Column(Boolean, default=False)
    prevention_paludisme = Column(Boolean, default=False)
    # Notes et plan
    observations = Column(Text)
    plan_accouchement = Column(Text)
    prochain_rdv = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="cpn_suivis")


class Accouchement(Base):
    __tablename__ = "accouchements"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    sage_femme_id = Column(Integer, ForeignKey("utilisateurs.id"), nullable=True)
    date_accouchement = Column(DateTime, default=datetime.utcnow)
    type_accouchement = Column(String(50))  # voie basse / césarienne
    duree_travail = Column(String(50))
    # Nouveau-né
    sexe_nouveau_ne = Column(String(10))
    poids_naissance = Column(Float)
    apgar_1min = Column(Integer)
    apgar_5min = Column(Integer)
    etat_nouveau_ne = Column(String(200))
    # Complications
    complications = Column(Text)
    pertes_sang = Column(Float)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
