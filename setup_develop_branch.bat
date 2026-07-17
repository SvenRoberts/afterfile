@echo off
cd /d "%~dp0"
echo === Develop branch aanmaken ===
echo.

REM Check of .git bestaat
if not exist ".git" (
    echo FOUT: Geen git repo gevonden. Voer eerst push_to_github.bat uit.
    pause
    exit /b 1
)

REM Haal laatste stand op
git fetch origin

REM Check of develop al bestaat op remote
git ls-remote --heads origin develop | findstr /C:"develop" >nul 2>&1
if %errorlevel%==0 (
    echo Develop branch bestaat al op GitHub.
    git checkout develop 2>nul || git checkout -b develop --track origin/develop
) else (
    echo Develop branch aanmaken vanaf main...
    git checkout main
    git pull origin main
    git checkout -b develop
    git push -u origin develop
    echo.
    echo Develop branch aangemaakt op GitHub!
)

git checkout main
echo.
echo Klaar! Je hebt nu:
echo   - main   → productie (afterfile.nl)
echo   - develop → staging (develop--afterfile.netlify.app)
echo.
echo Volgende stap: koppel Netlify aan GitHub via het dashboard.
pause
