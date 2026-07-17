#!/bin/bash
# deploy.sh — altijd dit uitvoeren i.p.v. handmatig kopiëren
# Gebruik: bash deploy.sh
set -e
cd "$(dirname "$0")"

echo "🔍 Check app.js..."
node check.js

echo "📋 Kopieer naar netlify/..."
cp app.js netlify/app.js
cp styles.css netlify/styles.css

DATE=$(date +%Y-%m-%d)
mkdir -p backups/$DATE
cp app.js backups/$DATE/app.js
cp styles.css backups/$DATE/styles.css
echo "💾 Backup opgeslagen in backups/$DATE/"

echo "✅ Deploy klaar — commit netlify/ map in Netlify of Drag-and-drop."
