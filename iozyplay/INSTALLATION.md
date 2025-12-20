# Guide d'installation - Node.js

Node.js a été installé avec succès sur votre système ! 🎉

## Prochaines étapes

✅ **Les dépendances sont déjà installées !** Vous pouvez maintenant lancer l'application.

### Configuration du PATH pour Git Bash

Pour que les commandes `node` et `npm` soient disponibles dans Git Bash de manière permanente :

**Option 1 : Exécuter le script de configuration (Recommandé)**
```bash
bash setup-path.sh
source ~/.bashrc
```

**Option 2 : Redémarrer le terminal**
1. Fermez complètement votre terminal Git Bash
2. Rouvrez un nouveau terminal Git Bash
3. Les commandes `node` et `npm` devraient être disponibles

**Option 3 : Utiliser PowerShell ou CMD**
Si vous préférez, vous pouvez utiliser PowerShell ou l'invite de commandes Windows (CMD) :
- Les commandes `node` et `npm` sont disponibles immédiatement
- Naviguez vers le dossier : `cd C:\Users\rchar\Documents\Projets\blindtest-webapp`

## Lancer l'application

1. **Dans Git Bash** (après avoir configuré le PATH) :
```bash
export PATH="/c/Program Files/nodejs:$PATH"  # Pour cette session uniquement
npm run dev
```

2. **Ou dans PowerShell/CMD** :
```bash
npm run dev
```
```bash
npm run dev
```

3. **Ouvrez votre navigateur** à l'adresse indiquée (généralement `http://localhost:5173`)

## Vérification de l'installation

Pour vérifier que tout fonctionne :
```bash
node --version   # Devrait afficher v24.12.0 ou similaire
npm --version    # Devrait afficher 10.x.x ou similaire
```

## Besoin d'aide ?

Si les commandes ne fonctionnent toujours pas après avoir redémarré le terminal :
- Vérifiez que Node.js est bien installé : ouvrez PowerShell et tapez `node --version`
- Si cela fonctionne dans PowerShell mais pas dans Git Bash, le PATH de Git Bash doit être rechargé
- Vous pouvez aussi ajouter manuellement Node.js au PATH de Git Bash en modifiant `~/.bashrc`

