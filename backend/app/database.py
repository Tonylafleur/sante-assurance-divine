from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text
from app.config import settings
import logging

logger = logging.getLogger("uvicorn.error")

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    from app.models import (  # noqa
        patient, consultation, pharmacie, caisse, utilisateur,
        laboratoire, hospitalisation, vaccination, cpn, historique, journal, teleconsultation, document_tele,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Migrations additives non destructives — préservent toutes les données existantes
    await run_migrations()


# Énoncés ALTER idempotents. ADD COLUMN IF NOT EXISTS ne touche jamais les données :
# si la colonne existe déjà, l'instruction est ignorée silencieusement.
_MIGRATIONS = [
    # Comptes : validation par le superadministrateur
    "ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS est_valide BOOLEAN DEFAULT TRUE",
    # Caisse : synchronisation pharmacie / facture
    "ALTER TABLE factures ADD COLUMN IF NOT EXISTS type_source VARCHAR(30) DEFAULT 'consultation'",
    "ALTER TABLE lignes_facture ADD COLUMN IF NOT EXISTS prescription_id INTEGER",
    "ALTER TABLE lignes_facture ADD COLUMN IF NOT EXISTS reference_externe VARCHAR(100)",
    # Pharmacie : conditionnement
    "ALTER TABLE medicaments ADD COLUMN IF NOT EXISTS nb_par_conditionnement INTEGER DEFAULT 1",
    "ALTER TABLE medicaments ADD COLUMN IF NOT EXISTS volume_ml DOUBLE PRECISION",
    "ALTER TABLE medicaments ADD COLUMN IF NOT EXISTS prix_conditionnement DOUBLE PRECISION DEFAULT 0",
    "ALTER TABLE medicaments ADD COLUMN IF NOT EXISTS unite_stock VARCHAR(30) DEFAULT 'plaquette'",
    "ALTER TABLE medicaments ADD COLUMN IF NOT EXISTS fabricant VARCHAR(200)",
    "ALTER TABLE medicaments ADD COLUMN IF NOT EXISTS classe_therapeutique VARCHAR(100)",
    "ALTER TABLE medicaments ADD COLUMN IF NOT EXISTS necessite_ordonnance BOOLEAN DEFAULT TRUE",
    "ALTER TABLE medicaments ADD COLUMN IF NOT EXISTS est_actif BOOLEAN DEFAULT TRUE",
    "ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS montant_total DOUBLE PRECISION DEFAULT 0",
    # Pharmacie : disponibilité commerciale (badge indisponible)
    "ALTER TABLE medicaments ADD COLUMN IF NOT EXISTS est_disponible BOOLEAN DEFAULT TRUE",
    "ALTER TABLE medicaments ADD COLUMN IF NOT EXISTS motif_indisponibilite VARCHAR(200)",
    # Patient : glycémie de référence
    "ALTER TABLE patients ADD COLUMN IF NOT EXISTS glycemie DOUBLE PRECISION",
    "ALTER TABLE patients ADD COLUMN IF NOT EXISTS glycemie_note VARCHAR(200)",
]

# Valeurs d'enum à ajouter (doivent s'exécuter hors transaction → AUTOCOMMIT).
# SQLAlchemy stocke les enums Postgres par leur NOM de membre (ex: SUPERADMIN),
# pas par leur valeur (.value). On ajoute donc le nom du membre.
_ENUM_VALUES = [
    ("roleutilisateur", "SUPERADMIN"),
    ("typeacte", "TELECONSULTATION"),
]


async def run_migrations():
    # Colonnes : transaction normale
    async with engine.begin() as conn:
        for stmt in _MIGRATIONS:
            try:
                await conn.execute(text(stmt))
            except Exception as exc:  # une migration ratée ne doit pas bloquer le démarrage
                logger.warning(f"[migration ignorée] {stmt} -> {exc}")

    # Enums : ALTER TYPE ADD VALUE doit être en AUTOCOMMIT
    autocommit = engine.execution_options(isolation_level="AUTOCOMMIT")
    async with autocommit.connect() as conn:
        for type_name, value in _ENUM_VALUES:
            try:
                await conn.execute(
                    text(f"ALTER TYPE {type_name} ADD VALUE IF NOT EXISTS '{value}'")
                )
            except Exception as exc:
                logger.warning(f"[enum ignoré] {type_name}+={value} -> {exc}")
