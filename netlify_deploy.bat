@echo off
cd /d "%~dp0"
echo === Netlify Deploy ===
echo.

netlify --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Netlify CLI installeren...
    npm install -g netlify-cli
    if %errorlevel% neq 0 (
        echo FOUT: npm niet gevonden. Installeer Node.js via https://nodejs.org
        pause
        exit /b 1
    )
)

echo Deployen naar afterfile.nl...
netlify deploy --prod --dir netlify --site f8165b63-cfda-4009-ba34-2971445b4f6b
echo.
pause
