@echo off
cd /d "%~dp0"
echo === Deployen naar STAGING ===
echo (develop branch → develop--afterfile.netlify.app)
echo.

if not exist ".git" (
    echo FOUT: Geen git repo. Voer eerst push_to_github.bat en setup_develop_branch.bat uit.
    pause
    exit /b 1
)

REM Naar develop branch
git checkout develop 2>nul
if %errorlevel% neq 0 (
    echo FOUT: develop branch niet gevonden. Voer eerst setup_develop_branch.bat uit.
    pause
    exit /b 1
)

REM Tijdstempel voor commit
for /f "tokens=1-3 delims=/ " %%a in ("%date%") do set DAG=%%a&set MAAND=%%b&set JAAR=%%c
for /f "tokens=1-2 delims=:." %%a in ("%time%") do set UUR=%%a&set MIN=%%b
set UUR=%UUR: =0%

git add .
git diff --cached --quiet
if %errorlevel%==0 (
    echo Geen wijzigingen om te deployen.
) else (
    git commit -m "Staging update %JAAR%-%MAAND%-%DAG% %UUR%:%MIN%"
    git push origin develop
    echo.
    echo Gedeployed naar staging!
    echo Bekijk: https://develop--afterfile.netlify.app
)

git checkout main
echo.
pause
