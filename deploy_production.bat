@echo off
cd /d "%~dp0"
echo === Deployen naar PRODUCTIE ===
echo (main branch → afterfile.nl)
echo.

if not exist ".git" (
    echo FOUT: Geen git repo. Voer eerst push_to_github.bat uit.
    pause
    exit /b 1
)

git checkout main 2>nul

REM Tijdstempel voor commit
for /f "tokens=1-3 delims=/ " %%a in ("%date%") do set DAG=%%a&set MAAND=%%b&set JAAR=%%c
for /f "tokens=1-2 delims=:." %%a in ("%time%") do set UUR=%%a&set MIN=%%b
set UUR=%UUR: =0%

git add .
git diff --cached --quiet
if %errorlevel%==0 (
    echo Geen wijzigingen om te deployen.
) else (
    git commit -m "Productie update %JAAR%-%MAAND%-%DAG% %UUR%:%MIN%"
    git push origin main
    echo.
    echo Gedeployed naar productie!
    echo Bekijk: https://afterfile.nl
)

echo.
pause
