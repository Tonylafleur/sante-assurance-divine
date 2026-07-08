@echo off
setlocal enabledelayedexpansion
echo ============================================
echo  SAD - Mise a jour automatique
echo ============================================
echo.

set "DIR=%~dp0"
set "PS=%DIR%check_changes.ps1"

REM Mode force (--no-cache uniquement dans ce cas)
set NOCACHE=
if /i "%~1"=="force" (
    echo Mode force: rebuild complet sans cache.
    echo.
    set BUILD_FRONT=1
    set BUILD_BACK=1
    set NOCACHE=--no-cache
    goto :do_build
)

REM Detection automatique des changements
REM Code retour: 0=rien, 1=front, 2=back, 3=les deux
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS%"
set DETECT=%ERRORLEVEL%

set BUILD_FRONT=0
set BUILD_BACK=0

if %DETECT%==0 (
    echo Aucun changement detecte depuis le dernier build.
    echo Pour forcer: maj.bat force
    echo.
    goto :open_browser
)
if %DETECT%==1 set BUILD_FRONT=1
if %DETECT%==2 set BUILD_BACK=1
if %DETECT%==3 (
    set BUILD_FRONT=1
    set BUILD_BACK=1
)

:do_build
if %BUILD_FRONT%==1 echo [detecte] Modifications dans frontend/
if %BUILD_BACK%==1  echo [detecte] Modifications dans backend/
echo.

if %BUILD_FRONT%==1 if %BUILD_BACK%==1 (
    echo [1/2] Build frontend + backend...
    docker compose build %NOCACHE% frontend backend
    if !ERRORLEVEL! NEQ 0 goto :error
    echo.> "%DIR%.last_build_frontend"
    echo.> "%DIR%.last_build_backend"
    echo [2/2] Deploiement...
    docker compose up -d frontend backend
    if !ERRORLEVEL! NEQ 0 goto :error
    goto :success
)

if %BUILD_FRONT%==1 (
    echo [1/2] Build frontend...
    docker compose build %NOCACHE% frontend
    if !ERRORLEVEL! NEQ 0 goto :error
    echo.> "%DIR%.last_build_frontend"
    echo [2/2] Deploiement frontend...
    docker compose up -d frontend
    if !ERRORLEVEL! NEQ 0 goto :error
    goto :success
)

if %BUILD_BACK%==1 (
    echo [1/2] Build backend...
    docker compose build %NOCACHE% backend
    if !ERRORLEVEL! NEQ 0 goto :error
    echo.> "%DIR%.last_build_backend"
    echo [2/2] Deploiement backend...
    docker compose up -d backend
    if !ERRORLEVEL! NEQ 0 goto :error
    goto :success
)

:success
echo.
echo ============================================
echo  Mise a jour terminee avec succes!
echo ============================================
echo.

:open_browser
timeout /t 2 /nobreak >nul
start http://localhost:3000
pause
exit /b 0

:error
echo.
echo ============================================
echo  ERREUR lors du build. Verifiez ci-dessus.
echo ============================================
echo.
pause
exit /b 1
