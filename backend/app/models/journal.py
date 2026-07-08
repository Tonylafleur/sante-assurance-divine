from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from datetime import datetime
from app.database import Base


class JournalActivite(Base):
    """
    Journal d'activité confidentiel — parcours d'utilisation de chaque utilisateur.

    Alimenté automatiquement par le middleware HTTP : chaque requête API
    (connexion, navigation, création, paiement, dispensation...) y est tracée,
    avec une attention particulière aux erreurs (statut >= 400) afin de repérer
    facilement les erreurs d'utilisation.

    CONFIDENTIEL : consultable uniquement par le superadministrateur.
    """
    __tablename__ = "journal_activite"

    id = Column(Integer, primary_key=True, index=True)
    utilisateur_id = Column(Integer, index=True, nullable=True)
    matricule = Column(String(20), index=True)        # instantané (snapshot)
    nom_complet = Column(String(200))
    role = Column(String(40), index=True)

    action = Column(String(120))                       # libellé lisible : "Création - Patients"
    methode = Column(String(10))                       # GET / POST / PUT / DELETE
    chemin = Column(String(300))                       # /api/patients/12
    module = Column(String(50), index=True)            # Patients, Caisse, Pharmacie...

    statut_code = Column(Integer, index=True)          # code HTTP de la réponse
    succes = Column(Boolean, default=True, index=True) # statut < 400
    message = Column(Text, nullable=True)              # détail / message d'erreur

    ip = Column(String(60))
    user_agent = Column(String(300))
    duree_ms = Column(Integer)                          # temps de traitement

    created_at = Column(DateTime, default=datetime.utcnow, index=True)
