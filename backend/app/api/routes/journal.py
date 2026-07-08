from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import Optional
from datetime import datetime, timedelta
from app.database import get_db
from app.models.journal import JournalActivite
from app.models.utilisateur import Utilisateur
from app.api.routes.auth import require_superadmin

router = APIRouter(prefix="/journal", tags=["Journal confidentiel"])


@router.get("")
async def list_journal(
    utilisateur_id: Optional[int] = None,
    module: Optional[str] = None,
    succes: Optional[bool] = None,
    recherche: Optional[str] = None,
    limit: int = 300,
    db: AsyncSession = Depends(get_db),
    _: Utilisateur = Depends(require_superadmin),
):
    """Journal d'activité — réservé au superadministrateur."""
    query = select(JournalActivite).order_by(desc(JournalActivite.created_at))
    if utilisateur_id is not None:
        query = query.where(JournalActivite.utilisateur_id == utilisateur_id)
    if module:
        query = query.where(JournalActivite.module == module)
    if succes is not None:
        query = query.where(JournalActivite.succes == succes)
    if recherche:
        like = f"%{recherche}%"
        query = query.where(
            (JournalActivite.matricule.ilike(like))
            | (JournalActivite.nom_complet.ilike(like))
            | (JournalActivite.action.ilike(like))
            | (JournalActivite.chemin.ilike(like))
        )
    query = query.limit(min(limit, 1000))
    result = await db.execute(query)
    rows = result.scalars().all()
    return [
        {
            "id": r.id,
            "utilisateur_id": r.utilisateur_id,
            "matricule": r.matricule,
            "nom_complet": r.nom_complet,
            "role": r.role,
            "action": r.action,
            "methode": r.methode,
            "chemin": r.chemin,
            "module": r.module,
            "statut_code": r.statut_code,
            "succes": r.succes,
            "message": r.message,
            "ip": r.ip,
            "user_agent": r.user_agent,
            "duree_ms": r.duree_ms,
            "created_at": r.created_at,
        }
        for r in rows
    ]


@router.get("/stats")
async def stats_journal(
    db: AsyncSession = Depends(get_db),
    _: Utilisateur = Depends(require_superadmin),
):
    """Statistiques de synthèse pour repérer les erreurs d'utilisation."""
    depuis = datetime.utcnow() - timedelta(days=7)

    total = await db.scalar(select(func.count(JournalActivite.id)))
    erreurs = await db.scalar(
        select(func.count(JournalActivite.id)).where(JournalActivite.succes == False)  # noqa: E712
    )
    erreurs_7j = await db.scalar(
        select(func.count(JournalActivite.id)).where(
            (JournalActivite.succes == False) & (JournalActivite.created_at >= depuis)  # noqa: E712
        )
    )

    # Top utilisateurs par nombre d'erreurs (repérage des difficultés d'usage)
    top_q = await db.execute(
        select(
            JournalActivite.matricule,
            JournalActivite.nom_complet,
            JournalActivite.role,
            func.count(JournalActivite.id).label("nb"),
        )
        .where(JournalActivite.succes == False)  # noqa: E712
        .group_by(JournalActivite.matricule, JournalActivite.nom_complet, JournalActivite.role)
        .order_by(desc("nb"))
        .limit(10)
    )
    top_erreurs = [
        {"matricule": m, "nom_complet": n, "role": r, "nb_erreurs": nb}
        for m, n, r, nb in top_q.all()
    ]

    return {
        "total_evenements": total or 0,
        "total_erreurs": erreurs or 0,
        "erreurs_7_jours": erreurs_7j or 0,
        "top_utilisateurs_erreurs": top_erreurs,
    }
