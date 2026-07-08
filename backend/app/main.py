from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import time
import logging
from app.database import init_db
from app.api.routes import auth, patients, consultations, pharmacie, caisse, ai, websocket, dashboard, cim10, journal, laboratoire, hospitalisation, vaccination, cpn, teleconsultation
from app.services.auth import hash_password
from sqlalchemy import select

logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await seed_data()
    yield


app = FastAPI(
    title="Centre de Santé Assurance Divine - API",
    description="Système de Gestion Intégré - MINSANTÉ Cameroun",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Journal d'activité (parcours d'utilisation) ──────────────────────────────
# Mappe un préfixe de chemin vers un libellé de module lisible.
_MODULES = {
    "patients": "Patients", "consultations": "Consultations", "pharmacie": "Pharmacie",
    "caisse": "Caisse", "dashboard": "Tableau de bord", "ai": "Assistant IA",
    "auth": "Authentification", "cim10": "CIM-10", "journal": "Journal",
    "laboratoire": "Laboratoire", "hospitalisation": "Hospitalisation",
    "vaccination": "Vaccination", "cpn": "CPN & Maternité",
    "teleconsultations": "Téléconsultation",
}
_ACTION_VERBE = {"POST": "Création", "PUT": "Modification", "PATCH": "Modification", "DELETE": "Suppression", "GET": "Consultation"}
# Chemins à ne pas tracer (bruit / haute fréquence)
_SKIP = ("/health", "/api/dashboard", "/docs", "/openapi.json", "/redoc", "/favicon")


def _module_from_path(path: str) -> str:
    parts = [p for p in path.split("/") if p]
    if len(parts) >= 2 and parts[0] == "api":
        return _MODULES.get(parts[1], parts[1].capitalize())
    return "Autre"


@app.middleware("http")
async def journaliser_activite(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    try:
        path = request.url.path
        method = request.method
        # On trace : toutes les écritures (POST/PUT/DELETE), les connexions,
        # et toute erreur (>=400). On ignore le bruit (GET de polling, santé...).
        is_error = response.status_code >= 400
        is_write = method in ("POST", "PUT", "PATCH", "DELETE")
        skip = method == "OPTIONS" or any(path.startswith(s) for s in _SKIP)
        if not skip and (is_write or is_error):
            await _ecrire_journal(request, response, method, path, start)
    except Exception as exc:  # le traçage ne doit jamais casser une requête
        logger.warning(f"[journal] échec traçage: {exc}")
    return response


async def _ecrire_journal(request, response, method, path, start):
    from app.database import AsyncSessionLocal
    from app.models.journal import JournalActivite
    from app.models.utilisateur import Utilisateur
    from app.services.auth import get_current_user

    duree_ms = int((time.perf_counter() - start) * 1000)
    matricule = nom_complet = role = None
    utilisateur_id = None

    # Identifier l'utilisateur depuis le jeton
    authz = request.headers.get("authorization", "")
    if authz.lower().startswith("bearer "):
        token = authz[7:]
        try:
            async with AsyncSessionLocal() as db:
                user = await get_current_user(db, token)
                if user:
                    utilisateur_id = user.id
                    matricule = user.matricule
                    nom_complet = f"{user.prenom} {user.nom}"
                    role = user.role.value if hasattr(user.role, "value") else str(user.role)
        except Exception:
            pass

    module = _module_from_path(path)
    succes = response.status_code < 400
    if path.endswith("/auth/login"):
        action = "Connexion" if succes else "Échec de connexion"
    elif path.endswith("/auth/register"):
        action = "Inscription d'un compte"
    else:
        action = f"{_ACTION_VERBE.get(method, method)} - {module}"

    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent", "")[:300]

    async with AsyncSessionLocal() as db:
        db.add(JournalActivite(
            utilisateur_id=utilisateur_id,
            matricule=matricule or "—",
            nom_complet=nom_complet or "Anonyme",
            role=role or "—",
            action=action,
            methode=method,
            chemin=path[:300],
            module=module,
            statut_code=response.status_code,
            succes=succes,
            message=None if succes else f"HTTP {response.status_code}",
            ip=ip,
            user_agent=ua,
            duree_ms=duree_ms,
        ))
        await db.commit()


# Routes
app.include_router(auth.router, prefix="/api")
app.include_router(patients.router, prefix="/api")
app.include_router(consultations.router, prefix="/api")
app.include_router(pharmacie.router, prefix="/api")
app.include_router(caisse.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(cim10.router, prefix="/api")
app.include_router(journal.router, prefix="/api")
app.include_router(laboratoire.router, prefix="/api")
app.include_router(hospitalisation.router, prefix="/api")
app.include_router(vaccination.router, prefix="/api")
app.include_router(cpn.router, prefix="/api")
app.include_router(teleconsultation.router, prefix="/api")
app.include_router(websocket.router)


@app.get("/")
async def root():
    return {
        "app": "Centre de Santé Assurance Divine",
        "version": "1.0.0",
        "status": "running",
        "slogan": "Votre santé, notre priorité!"
    }


@app.get("/health")
async def health():
    return {"status": "ok"}


async def seed_data():
    """Données initiales : admin + tarifs + médicaments essentiels + vaccins + lits."""
    from app.database import AsyncSessionLocal
    from app.models.utilisateur import Utilisateur, RoleUtilisateur
    from app.models.caisse import Tarif, TypeActe
    from app.models.pharmacie import Medicament, FormeMedicament
    from app.models.vaccination import Vaccin
    from app.models.hospitalisation import Lit, TypeChambre, StatutLit

    async with AsyncSessionLocal() as db:
        # Superadministrateur — accès total + journal confidentiel
        rs = await db.execute(select(Utilisateur).where(Utilisateur.matricule == "SUPER001"))
        if not rs.scalar_one_or_none():
            db.add(Utilisateur(
                matricule="SUPER001",
                nom="Superadministrateur",
                prenom="Système",
                role=RoleUtilisateur.SUPERADMIN,
                service="Direction",
                hashed_password=hash_password("Super2024!"),
                est_actif=True,
                est_valide=True,
            ))

        # Admin par défaut
        r = await db.execute(select(Utilisateur).where(Utilisateur.matricule == "ADMIN001"))
        if not r.scalar_one_or_none():
            admin = Utilisateur(
                matricule="ADMIN001",
                nom="Administrateur",
                prenom="Système",
                role=RoleUtilisateur.ADMIN,
                service="Administration",
                hashed_password=hash_password("Admin2024!"),
                est_actif=True,
                est_valide=True,
            )
            db.add(admin)

            # Personnel de démonstration
            for u in [
                {"matricule": "MED001", "nom": "Dr. Mbarga", "prenom": "Jean", "role": RoleUtilisateur.MEDECIN, "service": "Consultation Générale", "pwd": "Med2024!"},
                {"matricule": "PHM001", "nom": "Ngo", "prenom": "Marie", "role": RoleUtilisateur.PHARMACIEN, "service": "Pro-Pharmacie", "pwd": "Phm2024!"},
                {"matricule": "CAI001", "nom": "Essama", "prenom": "Paul", "role": RoleUtilisateur.CAISSIER, "service": "Caisse", "pwd": "Cai2024!"},
                {"matricule": "ACC001", "nom": "Biya", "prenom": "Rose", "role": RoleUtilisateur.ACCUEIL, "service": "Accueil", "pwd": "Acc2024!"},
                {"matricule": "INF001", "nom": "Owona", "prenom": "Sophie", "role": RoleUtilisateur.INFIRMIER, "service": "Soins", "pwd": "Inf2024!"},
            ]:
                db.add(Utilisateur(
                    matricule=u["matricule"], nom=u["nom"], prenom=u["prenom"],
                    role=u["role"], service=u["service"],
                    hashed_password=hash_password(u["pwd"]), est_actif=True,
                ))

        # Tarifs MINSANTÉ
        tarif_check = await db.execute(select(Tarif).limit(1))
        if not tarif_check.scalar_one_or_none():
            tarifs = [
                (TypeActe.CONSULTATION, "Consultation Générale", 2000),
                (TypeActe.HOSPITALISATION, "Hospitalisation (par jour)", 5000),
                (TypeActe.LABORATOIRE, "Examen de Laboratoire", 3000),
                (TypeActe.PHARMACIE, "Médicaments", 0),
                (TypeActe.ACCOUCHEMENT, "Accouchement voie basse", 30000),
                (TypeActe.PETITE_CHIRURGIE, "Petite Chirurgie", 15000),
                (TypeActe.CPN, "Consultation Prénatale (CPN)", 2000),
                (TypeActe.VACCINATION, "Vaccination", 1000),
                (TypeActe.KINESITHERAPIE, "Kinésithérapie (séance)", 5000),
                (TypeActe.ECHOGRAPHIE, "Échographie", 15000),
            ]
            for t, l, m in tarifs:
                db.add(Tarif(type_acte=t, libelle=l, montant=m))

        # Tarif Téléconsultation (idempotent — ajouté après l'introduction du type)
        tc_check = await db.execute(select(Tarif).where(Tarif.type_acte == TypeActe.TELECONSULTATION))
        if not tc_check.scalar_one_or_none():
            db.add(Tarif(type_acte=TypeActe.TELECONSULTATION, libelle="Téléconsultation", montant=2000))

        # Médicaments essentiels OMS / MINSANTÉ
        med_check = await db.execute(select(Medicament).limit(1))
        if not med_check.scalar_one_or_none():
            meds = [
                ("Artéméther-Luméfantrine 20/120mg", "Artéméther + Luméfantrine", FormeMedicament.COMPRIME, "20/120mg", 50, 300, 200),
                ("Amoxicilline 500mg", "Amoxicilline", FormeMedicament.GELULE, "500mg", 50, 200, 250),
                ("Paracétamol 500mg", "Paracétamol", FormeMedicament.COMPRIME, "500mg", 25, 500, 300),
                ("Métronidazole 250mg", "Métronidazole", FormeMedicament.COMPRIME, "250mg", 50, 300, 200),
                ("Cotrimoxazole 480mg", "Sulfaméthoxazole + Triméthoprime", FormeMedicament.COMPRIME, "480mg", 50, 400, 300),
                ("Ibuprofène 400mg", "Ibuprofène", FormeMedicament.COMPRIME, "400mg", 75, 200, 150),
                ("ORS (Sels de Réhydratation Orale)", "Sels de Réhydratation", FormeMedicament.SACHET, "—", 100, 200, 300),
                ("Fer + Acide Folique", "Sulfate ferreux + Acide folique", FormeMedicament.COMPRIME, "200/0.4mg", 50, 400, 500),
                ("Mébendazole 500mg", "Mébendazole", FormeMedicament.COMPRIME, "500mg", 200, 100, 150),
                ("Quinine Injectable 300mg/mL", "Quinine", FormeMedicament.INJECTABLE, "300mg/mL", 3000, 50, 30),
                ("Doxycycline 100mg", "Doxycycline", FormeMedicament.COMPRIME, "100mg", 75, 300, 200),
                ("Ciprofloxacine 500mg", "Ciprofloxacine", FormeMedicament.COMPRIME, "500mg", 150, 200, 150),
                ("Benzathine-Benzylpénicilline 2.4MUI", "Benzylpénicilline", FormeMedicament.INJECTABLE, "2.4 MUI", 1500, 30, 20),
                ("Diazépam 10mg/2mL", "Diazépam", FormeMedicament.INJECTABLE, "10mg/2mL", 500, 20, 10),
                ("Sérum Glucosé 5%", "Glucose", FormeMedicament.SOLUTION, "5%", 1500, 20, 15),
                ("Moustiquaire imprégnée", "—", FormeMedicament.AUTRE, "—", 2500, 30, 20),
            ]
            import datetime as dt
            for i, (nom, dci, forme, dosage, prix, stock, seuil) in enumerate(meds):
                db.add(Medicament(
                    code=f"MED2024{str(i+1).zfill(4)}",
                    nom_commercial=nom, dci=dci, forme=forme, dosage=dosage,
                    prix_unitaire=prix, stock_actuel=stock, seuil_alerte=seuil,
                ))

        # Vaccins PEV Cameroun
        vaccin_check = await db.execute(select(Vaccin).limit(1))
        if not vaccin_check.scalar_one_or_none():
            vaccins = [
                ("BCG", "Tuberculose", 1, "—", "—", 1000),
                ("Pentavalent (DTC-HepB-Hib)", "Diphtérie, Tétanos, Coqueluche, Hépatite B, Hib", 3, "4 semaines", "—", 2000),
                ("Polio oral (VPO)", "Poliomyélite", 3, "4 semaines", "—", 500),
                ("Rougeole-Rubéole (RR)", "Rougeole + Rubéole", 2, "4 semaines", "—", 2000),
                ("Fièvre jaune (VAA)", "Fièvre Jaune", 1, "—", "—", 3000),
                ("Méningite A (MenAfriVac)", "Méningite A", 1, "—", "—", 2000),
                ("Pneumocoque (PCV13)", "Pneumonies bactériennes", 3, "4 semaines", "—", 3000),
                ("Rotavirus", "Gastro-entérites à Rotavirus", 2, "4 semaines", "—", 2500),
                ("Tétanos (VAT) femme enceinte", "Tétanos néonatal", 5, "1 mois", "—", 1000),
                ("Hépatite B (adulte)", "Hépatite B", 3, "1 mois", "—", 5000),
                ("HPV (Cervarix)", "Cancer du col de l'utérus", 2, "6 mois", "—", 10000),
            ]
            for nom, maladie, doses, intervalle, rappel, prix in vaccins:
                db.add(Vaccin(nom=nom, maladie_ciblee=maladie, nombre_doses=doses,
                              intervalle_doses=intervalle, rappel=rappel, prix=prix, stock=50))

        # Lits hospitalisation
        lit_check = await db.execute(select(Lit).limit(1))
        if not lit_check.scalar_one_or_none():
            lits = [
                ("L01", "A", TypeChambre.COMMUNE, "Médecine générale", 3000),
                ("L02", "A", TypeChambre.COMMUNE, "Médecine générale", 3000),
                ("L03", "B", TypeChambre.SEMI_PRIVEE, "Médecine générale", 5000),
                ("L04", "B", TypeChambre.SEMI_PRIVEE, "Médecine générale", 5000),
                ("L05", "C", TypeChambre.PRIVEE, "VIP", 15000),
                ("M01", "MAT", TypeChambre.MATERNITE, "Maternité", 5000),
                ("M02", "MAT", TypeChambre.MATERNITE, "Maternité", 5000),
                ("M03", "MAT", TypeChambre.MATERNITE, "Maternité", 5000),
            ]
            for num, chambre, type_c, service, prix in lits:
                db.add(Lit(numero=num, chambre=chambre, type_chambre=type_c, service=service, prix_par_jour=prix))

        await db.commit()
