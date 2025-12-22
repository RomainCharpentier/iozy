#!/bin/bash
# Script de démarrage rapide pour le blindtest

# Ajouter Node.js au PATH si nécessaire
export PATH="/c/Program Files/nodejs:$PATH"

# Vérifier que Node.js est disponible
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas trouvé dans le PATH"
    echo "Essayez de redémarrer votre terminal Git Bash"
    exit 1
fi

# Afficher les versions
echo "✅ Node.js $(node --version)"
echo "✅ npm $(npm --version)"
echo ""
echo "🚀 Démarrage de l'application..."
echo ""

# Lancer l'application
npm run dev






