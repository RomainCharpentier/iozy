# IozyPlay

Jeu de blindtest multijoueur (deviner séries, animes, chansons, films, jeux à partir d'un média audio/vidéo/image/YouTube). Membre de la famille Iozy (IozyCore = le catalogue de collection, IozyPlay = le jeu). La charte graphique partagée vit dans le dépôt **IozyKit**, installé comme paquet `iozykit` épinglé sur un commit dans `package.json` (rien n'est copié dans ce dépôt) ; ce qui est propre à l'app : [docs/CHARTE.md](docs/CHARTE.md).
Front React 19 + Vite 7 + TypeScript (`src/`) ; back Node ≥22 Express + Socket.IO en JS ESM (`server/`).
Détails par zone : [src/CLAUDE.md](src/CLAUDE.md) et [server/CLAUDE.md](server/CLAUDE.md). Dette connue : [docs/REVIEW.md](docs/REVIEW.md).

## Commandes

```bash
npm run dev:all        # front :5173 + back :3001 (à utiliser par défaut)
npm test               # tests back (node:test, server/*/*.test.mjs)
npm run test:unit      # tests front (vitest + jsdom, src/**/*.test.ts[x])
npm run typecheck      # tsc --noEmit — le seul check TS fiable
npm run lint           # eslint src (ne bloque jamais : --max-warnings 999)
npm run format         # prettier sur src/
```

Avant de considérer une tâche finie : `npm run typecheck && npm run lint && npm test && npm run test:unit`.
⚠️ `npm run build` fait `tsc ... || true` : il **ignore les erreurs TS**, ne pas s'en servir comme vérification. La CI GitHub (`.github/workflows/deploy.yml`) ignore aussi les échecs (`|| true`).

## Architecture en bref

- Le serveur est la **source de vérité** du déroulement d'une partie online (timers, validation des réponses, scores). Le client réagit aux événements `game:*`.
- Les questions d'une partie sont envoyées par **le client hôte** dans `game:start` (le serveur ne lit pas `data/` pour jouer).
- Rooms en mémoire (perdues au redémarrage) ; questions/catégories/profils dans `data/*.json` via l'API REST `/api/*`.
- Identité joueur = `playerId` UUID stocké en localStorage (partagé entre onglets → tester le multi avec des profils navigateur différents). Le `socketId` change à chaque reconnexion.
- Le parcours actuel est toujours « online » (Home → `/categories` → `/room/create` → `/game`) ; le mode solo existe dans le code mais n'est plus atteignable.

## Tester dans le navigateur

- Couper le son pendant les tests (médias en sourdine / Chromium `--mute-audio`) : l'utilisateur entend les lectures sinon.
- Le panneau navigateur de l'app desktop, quand il est masqué, met les vidéos YouTube en pause : pour vérifier la lecture, utiliser un Chromium headless (Playwright) avec `--autoplay-policy=no-user-gesture-required --mute-audio`.
- Multijoueur : un second joueur peut être simulé par un client `socket.io-client` (le `playerId` est partagé entre onglets du même navigateur).

## Conventions

- Langue : commentaires, messages d'erreur et textes UI en **français** ; identifiants en anglais.
- Commits : Conventional Commits (`feat(scope): …`, `fix(room): …`, `refactor(game): …`).
- Front : Prettier (sans `;`, single quotes, largeur 100, trailingComma es5), imports via l'alias `@/`.
- Back : ESM avec extension `.js` explicite dans les imports, points-virgules.

## Déploiement

- Front : Vercel (`vercel.json`) — Netlify/Render configs présentes mais secondaires. Requiert `VITE_SOCKET_URL` (et `VITE_API_URL`) en prod, sinon l'app **throw au chargement**.
- Back : Railway (`railway.json`, `node server/index.js`). Env : `PORT` (3001), `NODE_ENV`, `FRONTEND_URL` (CORS). Système de fichiers éphémère → les écritures dans `data/` sont perdues au redéploiement.

## Fichiers à ignorer

`dist/` (build, gitignoré), `~/.bash_profile`, `start.sh`, `setup-path.sh`, `configure-path.ps1` : reliquats d'un ancien setup Windows/Git Bash, sans rapport avec le projet.
