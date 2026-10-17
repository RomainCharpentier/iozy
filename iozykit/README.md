# IozyKit

La charte graphique de la famille Iozy — **IozyCore** (le catalogue de collection) et **IozyPlay** (le blindtest) — en un seul endroit : les couleurs des deux thèmes, les polices, les rayons, les règles d'interaction, les composants de base, la construction du logo, et le contrôle de contraste qui garantit que tout reste lisible.

Ce dépôt est la **source de vérité**. Les apps n'y pointent pas à l'exécution : chacune l'installe comme **dépendance git épinglée sur un commit** (voir « Consommer »). Le dépôt est public, leurs déploiements (Vercel, Docker sur NAS) le téléchargent comme n'importe quel paquet.

## Contenu

```
tokens.json              la source : couleurs des deux thèmes, polices, rayons, hauteur des contrôles
css/tokens.css           GÉNÉRÉ depuis tokens.json : une propriété --iozy-<rôle> par valeur
css/base.css             règles globales : titres, curseur, survol, focus, sélection, squelette, sr-only
css/components.css       .iozy-btn (+ --primary/--secondary/--ghost/--danger/--lg), .iozy-field,
                         .iozy-card (+ --lg/--danger), .iozy-chip (+ --active), .iozy-glass
brand/                   les marques (tuile + étagère) et leurs règles
scripts/build-css.mjs    génère css/tokens.css
scripts/check-contrast.mjs  vérifie AA (4,5:1) sur toutes les paires qui comptent, dans les deux thèmes
CHARTE.md                la charte écrite : ce qu'on fait, ce qu'on ne fait pas, et pourquoi
```

## Commandes

```bash
npm run build            # régénère css/tokens.css après une modification de tokens.json
npm run check:contrast   # échoue si une paire texte/fond ou encre/aplat passe sous 4,5:1
npm test                 # les deux
```

Toute modification de `tokens.json` passe par `npm test` avant le commit : une couleur « à l'œil » est illisible dans un thème sur deux, le script le dit avant les utilisateurs.

## Consommer

Les deux apps déclarent le kit dans leur `package.json`, épinglé sur un commit :

```json
"iozykit": "github:RomainCharpentier/IozyKit#<sha complet du commit>"
```

`npm install` (et `npm ci` au déploiement) télécharge l'archive GitHub de ce commit : rien du kit n'est copié dans le dépôt de l'app, et `package-lock.json` note le commit installé. Le paquet livre ce que `files` de `package.json` liste : `css/`, `brand/`, `tokens.json`, `CHARTE.md`. Mettre une app à jour : avancer le sha dans son `package.json`, puis `npm install`.

### Depuis IozyPlay (React + Vite + SCSS modules)

`src/main.tsx` importe `iozykit/css/tokens.css`, `base.css` et `components.css` (Vite les résout dans `node_modules`) ; `src/styles/design-tokens.scss` fait correspondre les noms historiques de l'app (`--accent-primary`, `--bg-secondary`…) aux `--iozy-*` ; `DesignSystem.module.scss` compose les classes du kit (`composes: iozy-btn from global`). Le thème se bascule par les classes `.dark-theme` / `.light-theme` sur `<html>`, que le CSS généré reconnaît.

### Depuis IozyCore (React + Vite + Tailwind v4)

`web/src/index.css` importe les trois CSS du kit dans les couches Tailwind (`layer(theme|base|components)`) et relie les noms de l'app aux variables du kit par un bloc `@theme inline` (`--color-accent: var(--iozy-accent)`) ; seuls les rôles que le kit n'a pas (univers, rangs, voiles) y gardent leurs deux thèmes. Les noms Tailwind (`bg-surface`, `text-textDim`…) ne changent pas. Le thème sombre vient de `[data-theme='dark']`, posé dans `index.html` ; `check:contrast` lit `node_modules/iozykit/tokens.json`.

### Les deux conventions de thème

Le CSS généré pose le thème clair sur `:root`, `.light-theme` et `[data-theme='light']`, le sombre sur `.dark-theme` et `[data-theme='dark']`. Une app à défaut sombre met la classe (ou l'attribut) dans son `index.html` pour ne pas voir le clair avant le premier script.

## Nommage des rôles

`bg` / `surface` / `surface2` (les trois fonds), `text` / `text-dim` / `text-muted` / `text-faint` (quatre niveaux, tous AA sur les trois fonds), `accent` / `accent-text` / `accent-press` / `accent-ink` / `accent-tint`, et pour chaque état (`ok`, `warn`, `danger`) l'aplat, son encre (`-ink`) et sa teinte (`-tint`) ; `danger-text` en plus, car l'erreur s'écrit souvent. Puis `line` / `line-strong` / `field-border` / `hover-surface` / `scrim`, les ombres `shadow-sm/md/lg/accent`, et `hover-brightness`.

Deux distinctions à ne jamais confondre :

- **`-ink` ≠ `-text`** : l'encre va *sur* un aplat (bouton primaire), le `-text` est la couleur *écrite* sur un fond neutre.
- **`-tint`** est le seul fond « coloré léger » autorisé ; jamais un `rgba(…)` d'accent écrit à la main.

## Versionner

Un commit par changement de charte, message en français conventionnel (`feat: …`, `fix: …`). Le `package-lock.json` de chaque app note le commit qu'elle a installé : on sait toujours qui est en retard.
