@echo off
echo ============================================
echo  Centre de Sante Assurance Divine - SAD
echo  Demarrage du systeme...
echo ============================================
echo.

REM Vérifier que Docker est installé
where docker >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERREUR: Docker n'est pas installe ou n'est pas dans le PATH.
    echo Installez Docker Desktop depuis: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

REM Créer le .env s'il n'existe pas
if not exist ".env" (
    echo Fichier .env non trouve. Creation depuis .env.example...
    copy .env.example .env
    echo IMPORTANT: Editez le fichier .env pour ajouter votre cle API Anthropic si vous voulez l'IA complete.
    echo.
)

echo Demarrage des services Docker...
docker compose up -d --remove-orphans

echo.
echo Attente du demarrage (30 secondes)...
timeout /t 30 /nobreak >nul

echo.
echo ============================================
echo  Systeme demarre avec succes!
echo.
echo  Interface: http://localhost:3000
echo  API:       http://localhost:8000
echo  API Docs:  http://localhost:8000/docs
echo.
echo  Comptes par defaut:
echo  - Admin:    ADMIN001 / Admin2024!
echo  - Medecin:  MED001   / Med2024!
echo  - Pharmacie: PHM001  / Phm2024!
echo  - Caisse:   CAI001   / Cai2024!
echo  - Accueil:  ACC001   / Acc2024!
echo ============================================
echo.

REM Ouvrir le navigateur
start http://localhost:3000

pause
