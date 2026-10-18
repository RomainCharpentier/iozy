# Web (React 19 + TypeScript + Vite 8 + TanStack Query + Tailwind v4)

Le client vivant. Il appelle toujours `/api/...` en URL **relative** (proxy Vite en dev, nginx en prod), jamais une URL absolue vers le backend.

## Commandes

Toutes depuis `web/`. Le backend doit tourner pour le dev (`cd ../backend && docker compose up --build`).

```bash
npm run dev              # :5173, proxy /api vers :8080
npm test                 # Vitest, ~2 s : à lancer en premier, puis à chaque itération
npm run typecheck        # tsc -b --noEmit : LE contrôle de types
npm run lint             # oxlint : doit n'afficher RIEN (zéro avertissement)
npm run check:contrast   # tous les couples de couleurs des deux thèmes >= 4.5:1 (WCAG AA)
npm run check:frontieres # règles d'import entre pages et common
npm run build            # tsc -b && vite build
npm run test:e2e         # Playwright, sa propre pile Docker (API :8090), ~45 s
npm run check:pwa        # manifeste et icônes tiennent leurs promesses
npm run check:deploiement http://localhost:8081   # GET contre une app servie
```

**`npx tsc --noEmit` ne vérifie rien.** Le `tsconfig.json` racine est `files: []` plus des références, donc il sort toujours 0. Utilise `npm run typecheck`. Pour lire un code de sortie, ne passe pas par un pipe.

Avant un commit : `npm test`, `typecheck`, `lint`, et `check:contrast` si tu as touché une couleur. Lance `check:deploiement` après toute modification de nginx ou du Dockerfile.

## Rangement (`src/`)

- `app/` : routeur, providers, coquille (`App.tsx`).
- `pages/` : **une page = un dossier**, nommé comme son URL. Les sous-pages sont des sous-dossiers. Dedans : la page, ses composants, ses hooks, ses tests.
- `common/` : ce que **plusieurs pages** partagent, rien d'autre : `components/` (design system : `Carte`, `Chip`, `Jaquette`, `GrilleVolumes`… et `layout/`), `hooks/`, `lib/`, `api/`, `types/`, `theme/`.
- `test/` : setup Vitest et `fixtures.ts`.

Règles : un module utilisé par **une seule page** vit dans cette page. Dès qu'une **seconde page** en a besoin, il monte dans `common`. Une page compose, elle ne calcule pas : données dans des hooks, affichage dans des composants. Imports par l'alias `@/` (`@/common/api/entities`), jamais `../../..`.

## Comment faire

- **Appel API** : dans `common/api/<domaine>.ts` (crée le module si le domaine est nouveau), jamais dans un composant. Les types de requête et de réponse vont dans `common/types/api.ts`, avec les mêmes noms camelCase que les DTO Java.
- **Écran** : un nouveau dossier sous `pages/` et une route dans `app/App.tsx`. Réutilise `common/components/` et les classes Tailwind issues de `src/index.css` (`bg-surface`, `text-textDim`, `text-accent`, `font-display`…). Pas de couleurs ni de tailles en dur.
- **Couleur** : les deux thèmes viennent de la charte IozyKit, le dossier voisin `../iozykit` lié par `package.json` (`"iozykit": "file:../iozykit"`, un lien dans `node_modules`). `src/index.css` relie les noms de l'app aux variables `--iozy-*` (`@theme inline`) et ne garde en propre que les rôles que le kit n'a pas (univers, rangs, voiles). Une couleur de la charte se change dans `iozykit/tokens.json`, puis `npm test` dans `iozykit/` (régénère le CSS, vérifie le contraste) : l'app la voit aussitôt, dev comme build. Le kit pose le clair sur `:root` et le sombre sur `[data-theme='dark']`, la convention de `lib/theme.ts` ; `index.html` part avec l'attribut pour ne pas voir le clair avant le premier script.
- **Adresse** : l'app vit à la racine en dev et dans la pile e2e, sous `/core/` dans l'image Docker (`IOZYCORE_BASE_PATH`, ARG du Dockerfile), où `/` est la page de la famille (`famille/`, seconde entrée Vite) et `/play` IozyPlay. Tout ce qui écrit une adresse de l'app passe par `import.meta.env.BASE_URL` (routeur, service worker, manifeste, lien de partage) ; `/api` reste à la racine. Sous Git Bash, `IOZYCORE_BASE_PATH=/core npm run build` demande `MSYS_NO_PATHCONV=1`, sinon le shell transforme `/core` en chemin Windows.
- **Cache** : clés dans `common/lib/queryKeys`, invalidations dans `common/lib` aussi. Un formulaire branché sur la mauvaise route, ou un cache qu'on oublie d'invalider, ne casse aucune règle : l'écran reste simplement sur l'état d'avant. C'est ce que les parcours e2e attrapent.
- **Langue** : le code et les commentaires s'écrivent en anglais ; tout texte que lit l'utilisateur (JSX, libellés, `aria-label`, messages) reste en français.

## Tests

- Vitest + Testing Library. Pose les `*.test.ts(x)` **à côté du module testé** (pas de dossier `__tests__`). Pas de `globals: true` : importe `describe`/`it`/`expect`.
- `src/test/fixtures.ts` construit les objets du serveur (`oeuvre`, `tome`, `possession`, `edition`, `tag`). Un test ne nomme que ce qui le concerne.
- Un test vaut la peine s'il garde une **règle qui se casse en silence** (un total inconnu qu'on ne doit pas deviner, un seul signal par carte, une phrase qui promet quelque chose). Vérifie le **texte lu à l'écran**, jamais une classe CSS ni un `data-testid`.
- Un test est utile s'il tombe quand on casse sa règle. Pour le vérifier : `node scripts/mutation.mjs <fichier> "<texte>" "<remplacement>"`. Il mute toutes les occurrences, lance la suite, restaure le fichier, et sort en erreur si rien n'échoue.
- **E2E** (`e2e/*.spec.ts`) : ils partent connectés (`compte.setup.ts` ouvre la session une fois). La pile de test n'a **aucune clé de fournisseur**. Les parcours passent par un type de collection créé pour l'occasion (saisie libre), jamais par Jikan ou Google Books. Un second compte se crée à l'écran avec `CODE_INVITATION` (`e2e/compte.ts`). Pour garder la pile après un échec : `IOZYCORE_E2E_GARDER_LA_PILE=1 npm run test:e2e`.

## Vérifier l'interface dans le navigateur de l'app

Le navigateur intégré **ne compose aucune image** : `requestAnimationFrame`, `ResizeObserver` et les captures d'écran n'y font rien. Vérifie par la mesure (`getBoundingClientRect`, `read_page`, texte) plutôt que par capture. Pour voir un **écran connecté avec des données** : garde la pile e2e + utilise `web-e2e` (`.claude/launch.json`, :5174 → API :8090) + rejoue la session Playwright dans un script. Ne touche pas à la vraie collection.

Pour juger un écran, sors des captures **mobile (390×844) et bureau (1280×900), thèmes sombre et clair**. L'app est mobile-first, et ce qu'un écran montre avec des données ne se lit pas dans le code. Les parcours e2e ne créent que des séries sans jaquette : sème une collection crédible (recherche de métadonnées AniList puis `quick-add`, clé de jaquette `coverImageUrl`). Sur mobile, une page qui déborde élargit la fenêtre de rendu : c'est le signe d'un débordement.

## Accessibilité et design

- Contraste AA dans les deux thèmes (le script le vérifie). Cibles tactiles, noms accessibles et ordre du focus font partie du travail, pas d'une passe finale.
- Les maquettes de référence sont dans `../design_handoff_v2/`. S'il y a plusieurs planches du même écran, demande au propriétaire **avant** de coder.
- Le journal des lots d'interface est `../../docs/DESIGN_MIGRATION_V1.2.md`. Ajoute-y une section par lot.

## PWA et déploiement

La PWA est installable en **production seulement** (`sw.js` est enregistré depuis `main.tsx` ; un cache d'app shell gênerait le rechargement à chaud). Le service worker met en cache la coquille, **jamais `/api`** : des données servies depuis un cache seraient une collection périmée présentée comme la vraie. Pièges nginx déjà corrigés dans `nginx.conf` : `.webmanifest` n'a pas de type MIME par défaut, et `sw.js` doit sortir en `Cache-Control: no-cache`. Un conteneur nginx périmé sur :8081 se règle par `docker compose build web` puis `up -d --force-recreate web`.

Le scan par caméra (`/scan`) utilise `BarcodeDetector` (Chrome/Edge, Android). Safari et Firefox retombent sur la saisie de l'ISBN.
