#!/bin/bash
# Script pour ajouter Node.js au PATH dans Git Bash

# Ajouter Node.js au PATH pour cette session
export PATH="/c/Program Files/nodejs:$PATH"

# Ajouter au fichier .bashrc pour les sessions futures
if [ -f ~/.bashrc ]; then
    if ! grep -q "Program Files/nodejs" ~/.bashrc; then
        echo '' >> ~/.bashrc
        echo '# Ajouter Node.js au PATH' >> ~/.bashrc
        echo 'export PATH="/c/Program Files/nodejs:$PATH"' >> ~/.bashrc
        echo "✅ Node.js a été ajouté à votre fichier ~/.bashrc"
    else
        echo "✅ Node.js est déjà dans votre fichier ~/.bashrc"
    fi
else
    echo 'export PATH="/c/Program Files/nodejs:$PATH"' > ~/.bashrc
    echo "✅ Fichier ~/.bashrc créé avec Node.js dans le PATH"
fi

echo "✅ Configuration terminée !"
echo "Pour cette session, rechargez avec : source ~/.bashrc"
echo "Ou redémarrez simplement votre terminal Git Bash"







