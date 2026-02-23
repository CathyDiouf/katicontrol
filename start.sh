#!/bin/bash
# KatiControl — démarrage complet (prod)
set -e

echo ""
echo "╔═══════════════════════════════════════╗"
echo "║         KatiControl v1.0              ║"
echo "║    Dakar · Sénégal · FCFA             ║"
echo "╚═══════════════════════════════════════╝"
echo ""

cd "$(dirname "$0")"

# Install deps if needed
if [ ! -d "node_modules" ]; then
  echo "→ Installation des dépendances..."
  npm install --ignore-scripts
fi

# Build frontend if needed
if [ ! -d "dist" ]; then
  echo "→ Build du frontend..."
  npm run build
fi

echo "→ Démarrage du serveur..."
echo ""
echo "  L'application est disponible sur:"
echo "  http://localhost:3001"
echo ""
echo "  Pour l'arrêter: Ctrl+C"
echo ""

NODE_ENV=production npx tsx --no-warnings server/index.ts
