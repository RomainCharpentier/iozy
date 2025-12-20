# 🎵 Blindtest WebApp

Une application web de blindtest moderne où vous pouvez deviner des séries TV, animes, chansons, films et jeux vidéo !

## 🚀 Fonctionnalités

- **Vrai blindtest** : Écoutez des extraits audio ou regardez des images/vidéos pour deviner
- **Multi-catégories** : Séries TV, Animes, Chansons, Films, Jeux vidéo
- **Lecteur média intégré** : Contrôles play/pause pour audio et vidéo
- **Sélection personnalisée** : Choisissez les catégories que vous souhaitez jouer
- **Système de score** : Suivez votre progression en temps réel
- **Interface moderne** : Design épuré et responsive
- **Feedback immédiat** : Voir la bonne réponse après chaque question

## 📦 Installation

1. Installez les dépendances :
```bash
npm install
```

2. Lancez le serveur de développement :
```bash
npm run dev
```

3. Ouvrez votre navigateur à l'adresse indiquée (généralement `http://localhost:5173`)

## 🏗️ Build pour production

```bash
npm run build
```

Les fichiers seront générés dans le dossier `dist/`.

## 📁 Structure du projet

```
blindtest-webapp/
├── src/
│   ├── components/       # Composants React
│   │   ├── CategorySelector.tsx
│   │   ├── Game.tsx
│   │   ├── QuestionCard.tsx
│   │   └── Score.tsx
│   ├── data/
│   │   └── questions.json  # Base de données des questions
│   ├── types.ts           # Types TypeScript
│   ├── App.tsx            # Composant principal
│   ├── main.tsx           # Point d'entrée
│   └── index.css          # Styles globaux
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 🎮 Comment jouer

1. Sélectionnez une ou plusieurs catégories
2. Cliquez sur "Commencer le jeu"
3. **Écoutez l'audio** ou **regardez l'image/vidéo** pour deviner
4. Utilisez les contrôles pour jouer/pause les médias
5. Répondez en sélectionnant la bonne réponse parmi les options
6. Consultez votre score à la fin de la partie
7. Rejouez ou retournez au menu principal

## ➕ Ajouter des questions et médias

### Ajouter des médias

1. **Placez vos fichiers multimédias** dans le dossier `public/media/` :
   - Pour les chansons : fichiers audio (`.mp3`, `.wav`, etc.)
   - Pour les séries/animes/films/jeux : images (`.jpg`, `.png`, etc.) ou vidéos (`.mp4`, etc.)

2. **Modifiez le fichier** `src/data/questions.json` pour ajouter vos questions :

```json
{
  "id": "unique-id",
  "category": "chansons",
  "type": "audio",
  "mediaUrl": "/media/chansons/mon-fichier.mp3",
  "answer": "Nom de la chanson",
  "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
  "hint": "Indice optionnel"
}
```

### Types de médias supportés

- **`audio`** : Pour les chansons (fichiers `.mp3`, `.wav`, `.ogg`)
- **`image`** : Pour les séries, animes, films, jeux (fichiers `.jpg`, `.png`, `.gif`, `.webp`)
- **`video`** : Pour les extraits vidéo (fichiers `.mp4`, `.webm`, `.ogg`)

### URLs externes

Vous pouvez aussi utiliser des URLs externes :

```json
{
  "mediaUrl": "https://example.com/mon-audio.mp3"
}
```

### Support YouTube

L'application supporte les vidéos YouTube ! Vous pouvez utiliser une URL YouTube et basculer entre le mode vidéo et le mode audio uniquement :

```json
{
  "id": "c7",
  "category": "chansons",
  "type": "video",
  "mediaUrl": "https://www.youtube.com/watch?v=VIDEO_ID",
  "answer": "Nom de la chanson",
  "options": ["Option 1", "Option 2", "Option 3", "Option 4"]
}
```

**Fonctionnalités YouTube** :
- ✅ Lecture avec vidéo ou audio uniquement
- ✅ Bouton pour basculer entre les modes
- ✅ Contrôles play/pause
- ✅ Support des URLs YouTube (youtube.com/watch, youtu.be, etc.)

Pour utiliser le mode audio uniquement, cliquez sur le bouton "👁️ Vidéo" pour masquer la vidéo et garder uniquement le son.

### Structure recommandée

```
public/media/
├── chansons/
│   └── vos-chansons.mp3
├── series/
│   └── vos-images.jpg
├── animes/
│   └── vos-images.jpg
├── films/
│   └── vos-images.jpg
└── jeux/
    └── vos-images.jpg
```

## 🛠️ Technologies utilisées

- **React 18** - Bibliothèque UI
- **TypeScript** - Typage statique
- **Vite** - Build tool et dev server
- **CSS3** - Styles modernes avec variables CSS

## 📝 Licence

Ce projet est libre d'utilisation pour des fins personnelles et éducatives.


