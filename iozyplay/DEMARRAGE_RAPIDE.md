# 🚀 Démarrage Rapide

## Solution immédiate

### Option 1 : Utiliser le script de démarrage (Le plus simple)
```bash
bash start.sh
```

Ce script configure automatiquement le PATH et lance l'application.

### Option 2 : Configurer le PATH manuellement pour cette session
Dans votre terminal Git Bash, tapez :
```bash
export PATH="/c/Program Files/nodejs:$PATH"
npm run dev
```

### Option 3 : Redémarrer votre terminal Git Bash
1. **Fermez complètement** votre terminal Git Bash (fermez toutes les fenêtres)
2. **Rouvrez** un nouveau terminal Git Bash
3. Naviguez vers le projet : `cd /c/Users/rchar/Documents/Projets/blindtest-webapp`
4. Tapez : `npm run dev`

Le fichier `.bashrc` a été créé avec la configuration, donc après redémarrage, `npm` devrait être disponible automatiquement.

### Option 4 : Utiliser PowerShell ou CMD Windows
Si Git Bash pose problème, utilisez PowerShell ou l'invite de commandes Windows :

1. Ouvrez **PowerShell** ou **CMD**
2. Naviguez vers le projet :
   ```powershell
   cd C:\Users\rchar\Documents\Projets\blindtest-webapp
   ```
3. Lancez l'application :
   ```powershell
   npm run dev
   ```

## Vérification

Pour vérifier que npm est disponible :
```bash
npm --version
```

Si ça affiche une version (comme `11.6.2`), tout est bon ! ✅

## Si ça ne fonctionne toujours pas

1. **Vérifiez que Node.js est installé** dans PowerShell :
   ```powershell
   node --version
   ```
   Si ça fonctionne dans PowerShell mais pas dans Git Bash, c'est un problème de PATH dans Git Bash.

2. **Vérifiez le contenu de votre `.bashrc`** :
   ```bash
   cat ~/.bashrc
   ```
   Il devrait contenir : `export PATH="/c/Program Files/nodejs:$PATH"`

3. **Ajoutez manuellement au PATH** si nécessaire :
   ```bash
   echo 'export PATH="/c/Program Files/nodejs:$PATH"' >> ~/.bashrc
   source ~/.bashrc
   ```






