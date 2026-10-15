# Charte graphique — ce qui est propre à IozyPlay

La charte de la famille Iozy (palette, polices, formes, interactions, structure des écrans, logo) vit dans **IozyKit** (`../IozyKit`, son propre dépôt) : lire `IozyKit/CHARTE.md` d'abord. Cette page ne dit que ce qui est spécifique à IozyPlay et où la charte se branche dans le code.

## Le nom

**IozyPlay** (un seul mot, I et P majuscules, comme IozyCore). « Iozy » rattache l'app à la famille ; « Play » dit le jeu et le bouton lecture de l'extrait. « Blindtest » reste le nom du *genre* dans les textes (« le blindtest multijoueur »), jamais celui de l'app.

Ce qui ne change pas de nom : les clés `localStorage` (`blindtest-settings`, `blindtest-player-id`, `blindtest-session-token:*`) — les renommer réinitialiserait profils et réglages de tous les joueurs — et les identifiants d'hébergement (`render.yaml`, URL Railway).

## Où la charte se branche

- `vendor/iozykit/` : copie du kit (`css/tokens.css` généré, `base.css`, `components.css`, `tokens.json`, `VERSION` = commit copié). **Ne jamais y toucher à la main** : `npm run kit:sync` recopie depuis `../IozyKit` (ou `IOZYKIT_PATH`).
- `src/main.tsx` charge les polices (`@fontsource`, graisses listées dans `tokens.json`) puis les trois CSS du kit, avant les styles de l'app.
- `src/styles/design-tokens.scss` : les noms historiques de l'app (`--accent-primary`, `--bg-secondary`, `--text-secondary`, `--radius-md`…) sont des **alias** des `--iozy-*`. Ne jamais y écrire une couleur de la charte ; seuls quelques dérivés par thème (accent foncé, teintes denses, ombres extrêmes) y restent.
- `src/styles/shared/DesignSystem.module.scss` (importé sous `ds`) : `ds.btn`, `ds.btnPrimary`, `ds.input`, `ds.card`, `ds.chip`… **composent** les classes du kit (`composes: iozy-btn from global`). L'API des composants ne change pas, la forme vient du kit.
- Thèmes : le kit pose le clair sur `:root` et le sombre sur `.dark-theme` ; `settingsService` pose `.dark-theme` / `.light-theme` sur `<html>`, `index.html` part en `dark-theme` (le défaut de l'app).
- Pour changer une couleur : `IozyKit/tokens.json` → `npm test` dans le kit (contraste AA) → commit → `npm run kit:sync` ici.

## Les pièces propres à l'app

- **La coquille** (`components/layout/AppShell.tsx`, `navItems.ts`) : deux destinations (Jouer, Éditeur), raccourcis thème et réglages, largeurs `wide` (éditeur) / `medium` (jeu) / `narrow` (réglages). Hors coquille : `/game` (plein écran, son propre bandeau) et `/username` (la porte d'entrée).
- **Les primitives** (`components/common/`) : `SectionHeader`, `BackLink`, `IconPill`, `EmptyState`, `PlayerList`. Icônes `lucide-react` ; les emojis des thèmes sont du contenu et restent.
- **Le logo** : triangle « lecture » sur l'étagère de la famille. Trois exemplaires du même dessin, à retoucher ensemble : `components/common/Logo.tsx` (SVG en ligne, suit le thème de l'app), `public/favicon.svg` (suit le système), `public/logo.svg` (installation et partage). Copie de référence dans `IozyKit/brand/iozyplay.svg`.
- **Le bandeau de jeu** (`App.tsx`, `--game-banner-height`) : le nom de l'app en accent-texte, Space Grotesk.

## Ce qui reste à faire

- Brancher IozyCore sur le kit de la même façon (copie + `@theme` en alias) : à faire dans le dépôt IozyCore.
- L'intérieur de l'éditeur (liste, formulaire, gestionnaire de catégories) et l'écran de jeu gardent leurs emojis et leur mise en page : à passer sur les primitives dans un lot dédié.
- Une icône iOS en PNG (`apple-touch-icon`) : Safari ignore les SVG pour l'écran d'accueil. IozyCore la génère par `web/scripts/make-icons.mjs` ; reprendre le procédé quand l'installation sur iPhone sera un besoin réel.
- `styles/index.scss` (3 800 lignes, aucune classe référencée par un composant) : à supprimer dans un lot de nettoyage.
