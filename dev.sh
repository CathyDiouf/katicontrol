#!/bin/bash
# KatiControl — mode développement (rechargement automatique)
cd "$(dirname "$0")"

if [ ! -d "node_modules" ]; then
  echo "→ Installation des dépendances..."
  npm install --ignore-scripts
fi

echo "→ Démarrage en mode développement..."
echo "  API:      http://localhost:3001/api"
echo "  Frontend: http://localhost:5173"
echo ""

npm run dev
