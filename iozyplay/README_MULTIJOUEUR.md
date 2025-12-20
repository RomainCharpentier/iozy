# 🌐 Multijoueur en ligne - Guide

## 🚀 Démarrage

### Option 1 : Démarrer tout en même temps (Recommandé)
```bash
npm run dev:all
```
Cela démarre à la fois le serveur backend (port 3001) et le frontend Vite (port 5173).

### Option 2 : Démarrer séparément

**Terminal 1 - Backend :**
```bash
npm run dev:server
```

**Terminal 2 - Frontend :**
```bash
npm run dev
```

## 🎮 Comment jouer en ligne

### Créer un salon
1. Sélectionnez le mode **"🌐 En ligne"**
2. Entrez votre nom
3. Sélectionnez les catégories
4. Cliquez sur **"Créer un salon"**
5. Un code de salon sera généré (ex: `ABC123`)
6. **Partagez le lien** avec vos amis (bouton "Copier")

### Rejoindre un salon
1. Cliquez sur le lien partagé par l'hôte
2. Ou entrez manuellement le code dans l'URL : `http://localhost:5173?room=ABC123`
3. Entrez votre nom
4. Cliquez sur **"Rejoindre"**
5. Attendez que l'hôte démarre la partie

### Démarrer la partie
- Seul l'**hôte** peut démarrer la partie
- Cliquez sur **"Démarrer la partie"** une fois que tous les joueurs ont rejoint

## 🔧 Configuration

Le serveur Socket.io écoute sur le port **3001** par défaut.

Pour changer le port du serveur, modifiez la variable d'environnement :
```bash
PORT=3002 npm run dev:server
```

Pour changer l'URL du serveur Socket.io côté client, créez un fichier `.env` :
```
VITE_SOCKET_URL=http://localhost:3001
```

## 📡 Événements Socket.io

### Client → Serveur
- `create-room` : Créer un salon
- `join-room` : Rejoindre un salon
- `start-game` : Démarrer la partie (hôte uniquement)
- `player-answer` : Envoyer une réponse
- `time-up` : Temps écoulé
- `next-question` : Passer à la question suivante

### Serveur → Client
- `room-created` : Salon créé avec succès
- `room-joined` : Salon rejoint avec succès
- `player-joined` : Un joueur a rejoint
- `player-left` : Un joueur a quitté
- `game-started` : La partie a démarré
- `correct-answer` : Bonne réponse d'un joueur
- `incorrect-answer` : Mauvaise réponse
- `next-question` : Question suivante
- `game-ended` : Fin de la partie
- `room-error` : Erreur (salon introuvable, etc.)

## 🐛 Dépannage

### Le serveur ne démarre pas
- Vérifiez que le port 3001 n'est pas déjà utilisé
- Vérifiez que Node.js est bien installé : `node --version`

### Les joueurs ne se connectent pas
- Vérifiez que le serveur backend est bien démarré
- Vérifiez l'URL Socket.io dans `.env` ou `src/utils/socket.ts`
- Vérifiez les logs du serveur pour les erreurs

### Le lien de partage ne fonctionne pas
- Assurez-vous d'utiliser l'URL complète avec le code du salon
- Format : `http://localhost:5173?room=ABC123`

