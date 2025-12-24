# Architecture du Projet

## Structure Simple et Claire

```
src/
├── pages/                  # Pages de l'application (routes)
│   ├── GamePage/
│   │   ├── GamePage.tsx
│   │   ├── Game.tsx
│   │   ├── ui/
│   │   ├── question/
│   │   └── settings/
│   └── ...                 # Autres pages
│
├── components/             # Composants génériques/réutilisables
│   └── media/            # Lecteurs multimédias
│
├── lib/                   # Bibliothèque React (hooks + contexts + types React)
│   ├── game/              # Logique React liée au jeu
│   │   ├── types.ts          # GameMode, Player, GameState
│   │   ├── GameContext.tsx
│   │   ├── useGameSocket.ts
│   │   └── useGameTimer.ts
│   └── socket/            # Logique React liée aux sockets
│       └── useSocket.ts
│
├── services/              # Services et logique métier (non-React)
│   ├── types.ts          # Category, Question, MediaType, QuestionsData, CATEGORIES
│   ├── gameService.ts    # Logique de jeu (scores, progression, TIMING, QUESTION_COUNT)
│   ├── questionService.ts # Gestion des questions (storage localStorage)
│   └── settingsService.ts # Gestion des paramètres utilisateur
│
├── utils/                 # Utilitaires techniques (non-React)
│   ├── socket.ts         # Gestion Socket.io
│   ├── sounds.ts         # Gestion des sons
│   ├── youtube.ts        # Utilitaires YouTube
│   └── playerId.ts       # Gestion des IDs joueurs
│
└── styles/                # Styles CSS (tous centralisés)
    ├── index.css
    ├── design-system.css
    ├── game-layout.css
    ├── settings.css
    ├── settings-menu.css
    ├── responsive.css
    └── variants/
```

## Principes

1. **Chaque page dans son dossier** : Le fichier de page est dans son propre dossier avec ses composants
2. **Composants près de leur usage** : Chaque page contient directement ses composants spécifiques
3. **Composants génériques séparés** : Seuls les composants vraiment réutilisables sont dans `components/`
4. **Séparation React / non-React** : 
   - `lib/` = Tout ce qui est React (contexts + hooks + types React)
   - `services/` = Logique métier pure (non-React) + types métier
   - `utils/` = Utilitaires techniques (non-React)
5. **Types dans leurs domaines** :
   - Types React (GameMode, Player) → `lib/game/types.ts`
   - Types métier (Category, Question, MediaType) → `services/types.ts`
   - Pas de dossier `types/` séparé
6. **Groupement par domaine** : Dans `lib/`, contexts et hooks sont regroupés par domaine
7. **Styles centralisés** : Tous les styles dans `styles/`
8. **Pas de données statiques** : Les données viennent du backend ou localStorage

## Organisation

- **`pages/[PageName]/`** : Tous les fichiers liés à une page
- **`components/`** : Composants génériques utilisés par plusieurs pages
- **`lib/[domain]/`** : Contexts, hooks et types React organisés par domaine
- **`services/`** : Logique métier pure + types métier (pas de React)
- **`utils/`** : Utilitaires techniques (pas de React)
- **`styles/`** : Tous les fichiers CSS

## Gestion des données

- **Questions** : Stockées dans localStorage (ajoutées via l'éditeur) ou chargées depuis le backend
- **Pas de données statiques** : Le frontend ne contient pas de fichiers JSON de données
- **Backend** : Les données doivent venir d'une API REST ou Socket.io

## Constantes

- **CATEGORIES** : Dans `services/types.ts` (avec Category)
- **TIMING, QUESTION_COUNT** : Dans `services/gameService.ts` (lié à la logique de jeu)

## Imports

- Depuis `pages/[Page]/` : 
  - `../../services/types` pour Category, Question, MediaType, CATEGORIES
  - `../../lib/game/types` pour GameMode, Player
- Depuis `components/` : Même logique
- Depuis `lib/[domain]/` : `../../services/types`, etc.
- Depuis `services/` : `./types` pour les types métier
