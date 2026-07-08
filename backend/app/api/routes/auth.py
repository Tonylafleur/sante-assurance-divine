from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.database import get_db
from app.models.utilisateur import Utilisateur, RoleUtilisateur
from app.services.auth import authenticate_user, create_access_token, get_current_user, hash_password

router = APIRouter(prefix="/auth", tags=["Authentification"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# Rôles qu'un utilisateur ne peut JAMAIS s'auto-attribuer à l'inscription
ROLES_INTERDITS_AUTO = {RoleUtilisateur.SUPERADMIN}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict


class UserCreate(BaseModel):
    matricule: str
    nom: str
    prenom: str
    role: RoleUtilisateur
    service: Optional[str] = None
    telephone: Optional[str] = None
    email: Optional[str] = None
    password: str


async def get_current_active_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> Utilisateur:
    user = await get_current_user(db, token)
    if not user or not user.est_actif:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Non authentifié")
    return user


@router.post("/login", response_model=TokenResponse)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    user = await authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Matricule ou mot de passe incorrect")
    if not getattr(user, "est_valide", True):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Compte en attente de validation par le superadministrateur")
    if not user.est_actif:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Compte désactivé")
    token = create_access_token({"sub": user.matricule})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "matricule": user.matricule,
            "nom": user.nom,
            "prenom": user.prenom,
            "role": user.role,
            "service": user.service,
        }
    }


@router.get("/me")
async def me(current_user: Utilisateur = Depends(get_current_active_user)):
    return {
        "id": current_user.id,
        "matricule": current_user.matricule,
        "nom": current_user.nom,
        "prenom": current_user.prenom,
        "role": current_user.role,
        "service": current_user.service,
    }


async def require_admin(current_user: Utilisateur = Depends(get_current_active_user)) -> Utilisateur:
    if current_user.role not in (RoleUtilisateur.ADMIN, RoleUtilisateur.SUPERADMIN):
        raise HTTPException(status_code=403, detail="Accès réservé à l'administration")
    return current_user


async def require_superadmin(current_user: Utilisateur = Depends(get_current_active_user)) -> Utilisateur:
    if current_user.role != RoleUtilisateur.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Accès réservé au superadministrateur")
    return current_user


@router.post("/users", status_code=201)
async def create_user(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Utilisateur = Depends(require_admin),
):
    """Création d'un compte par l'administration — activé immédiatement."""
    if user_data.role == RoleUtilisateur.SUPERADMIN and current_user.role != RoleUtilisateur.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Seul un superadministrateur peut créer un superadministrateur")
    existing = await db.execute(select(Utilisateur).where(Utilisateur.matricule == user_data.matricule))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ce matricule existe déjà")
    user = Utilisateur(
        matricule=user_data.matricule,
        nom=user_data.nom,
        prenom=user_data.prenom,
        role=user_data.role,
        service=user_data.service,
        telephone=user_data.telephone,
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
        est_actif=True,
        est_valide=True,
    )
    db.add(user)
    await db.flush()
    return {"id": user.id, "matricule": user.matricule, "message": "Utilisateur créé avec succès"}


@router.post("/register", status_code=201)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    """
    Auto-inscription publique. L'utilisateur choisit son rôle, mais le compte
    reste EN ATTENTE de validation par le superadministrateur avant de pouvoir
    se connecter (sécurité d'accès aux dossiers cliniques).
    """
    if user_data.role in ROLES_INTERDITS_AUTO:
        raise HTTPException(status_code=400, detail="Ce rôle ne peut pas être choisi à l'inscription")
    existing = await db.execute(select(Utilisateur).where(Utilisateur.matricule == user_data.matricule))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ce matricule existe déjà")
    if user_data.email:
        mail_exist = await db.execute(select(Utilisateur).where(Utilisateur.email == user_data.email))
        if mail_exist.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
    user = Utilisateur(
        matricule=user_data.matricule,
        nom=user_data.nom,
        prenom=user_data.prenom,
        role=user_data.role,
        service=user_data.service,
        telephone=user_data.telephone,
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
        est_actif=True,
        est_valide=False,  # en attente de validation
    )
    db.add(user)
    await db.flush()
    return {
        "id": user.id,
        "matricule": user.matricule,
        "message": "Compte créé. Il sera actif après validation par le superadministrateur.",
    }


def _user_dict(u: Utilisateur) -> dict:
    return {
        "id": u.id,
        "matricule": u.matricule,
        "nom": u.nom,
        "prenom": u.prenom,
        "email": u.email,
        "telephone": u.telephone,
        "role": u.role,
        "service": u.service,
        "est_actif": u.est_actif,
        "est_valide": getattr(u, "est_valide", True),
        "created_at": u.created_at,
    }


@router.get("/personnel")
async def list_personnel(
    role: Optional[RoleUtilisateur] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_active_user),
):
    """Liste légère du personnel actif (pour sélecteurs : médecin, etc.)."""
    query = select(Utilisateur).where(Utilisateur.est_actif == True, Utilisateur.est_valide == True)  # noqa: E712
    if role:
        query = query.where(Utilisateur.role == role)
    query = query.order_by(Utilisateur.nom)
    result = await db.execute(query)
    return [
        {"id": u.id, "nom": u.nom, "prenom": u.prenom,
         "nom_complet": f"{u.prenom} {u.nom}",
         "role": u.role.value if hasattr(u.role, "value") else u.role}
        for u in result.scalars().all()
    ]


@router.get("/comptes")
async def list_comptes(
    en_attente: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: Utilisateur = Depends(require_admin),
):
    """Liste des comptes. `en_attente=true` ne renvoie que les comptes à valider."""
    query = select(Utilisateur).order_by(Utilisateur.created_at.desc())
    if en_attente:
        query = query.where(Utilisateur.est_valide == False)  # noqa: E712
    result = await db.execute(query)
    return [_user_dict(u) for u in result.scalars().all()]


@router.post("/comptes/{user_id}/valider")
async def valider_compte(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Utilisateur = Depends(require_superadmin),
):
    user = await db.get(Utilisateur, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Compte introuvable")
    user.est_valide = True
    user.est_actif = True
    await db.flush()
    return {"message": f"Compte {user.matricule} validé", "id": user.id}


@router.post("/comptes/{user_id}/revoquer")
async def revoquer_compte(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Utilisateur = Depends(require_superadmin),
):
    user = await db.get(Utilisateur, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Compte introuvable")
    if user.role == RoleUtilisateur.SUPERADMIN:
        raise HTTPException(status_code=400, detail="Impossible de révoquer un superadministrateur")
    user.est_actif = False
    await db.flush()
    return {"message": f"Compte {user.matricule} révoqué", "id": user.id}
