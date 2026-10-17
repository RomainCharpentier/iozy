# Charte graphique de la famille Iozy

Deux apps, une identité : **IozyCore** (le catalogue de collection) et **IozyPlay** (le blindtest multijoueur). Même palette, mêmes polices, même construction de logo, mêmes gestes. Cette page dit ce qu'on fait et pourquoi ; les valeurs sont dans `tokens.json`, vérifiées par `npm run check:contrast`.

## Le nom

« Iozy » + un rôle, en un mot, deux majuscules : Iozy**Core**, Iozy**Play**. Le mot-marque s'écrit en Space Grotesk 600/700, « Iozy » en encre du thème et le suffixe en accent, jamais en dégradé, jamais dans un bloc coloré.

## Palette : terracotta, un seul accent

Un accent chaud, des fonds bruns (jamais de gris froid), deux thèmes de plein droit. Toutes les paires texte/fond tiennent AA (4,5:1), encres comprises.

| Rôle | Token | Sombre | Clair |
|---|---|---|---|
| Fond de page | `--iozy-bg` | `#16120f` | `#faf6f2` |
| Surface (cartes) | `--iozy-surface` | `#231e19` | `#fffdfb` |
| Surface 2 (champs) | `--iozy-surface2` | `#2c261f` | `#f4ece5` |
| Texte | `--iozy-text` | `#f4eee7` | `#231e1a` |
| Texte secondaire | `--iozy-text-dim` | `#c2b5a9` | `#544a43` |
| Texte discret | `--iozy-text-faint` | `#9e9288` | `#6c625c` |
| **Accent** (aplats) | `--iozy-accent` | `#d9694a` | `#bc583b` |
| Accent **comme texte** | `--iozy-accent-text` | `#ef9070` | `#a2452c` |
| Encre **sur** l'accent | `--iozy-accent-ink` | `#16120f` | `#ffffff` |
| Succès | `--iozy-ok` | `#6cbd9d` | `#356b56` |
| Avertissement | `--iozy-warn` | `#d9b64a` | `#7a5c10` |
| Erreur | `--iozy-danger` | `#e8654a` | `#9c3324` |
| Lignes | `--iozy-line` | encre à 10 % | encre à 10 % |

Deux distinctions à respecter, elles étaient la source des contrastes illisibles d'avant :

- **`-ink` ≠ `-text`.** L'encre va *sur* un aplat (bouton primaire, badge plein) ; le `-text` est la couleur *écrite* sur un fond neutre. Sur fond sombre, l'encre est sombre (5,4:1) là où du blanc ne tient pas (3,5:1).
- **Les teintes** (`-tint`) sont les seuls fonds « colorés légers » autorisés. Pas de `rgba(…)` d'accent ni de voile blanc `rgba(255,255,255,…)` écrit à la main : un voile se fait en `color-mix(in srgb, var(--iozy-text) N%, transparent)`, qui s'inverse avec le thème.

Un seul accent : pas de second ton, pas de dégradé bicolore. Un aplat suffit.

## Typographie

- **Space Grotesk** (500, 700) pour les titres et le mot-marque : `--iozy-font-display`.
- **Inter** (400 → 700) pour tout le reste : `--iozy-font-body`.
- Monospace système (`--iozy-font-mono`) pour les codes et compteurs.

Chargées par `@fontsource` dans chaque app (auto-hébergées, pas d'appel à Google Fonts) ; les graisses à charger sont dans `tokens.json › fonts.packages`.

## Formes et interactions

- **Rayons** : 12 px contrôles (boutons, champs, chips), 16 px cartes, 20 px grandes cartes, 24 px panneaux et feuilles.
- **Hauteur des contrôles** : 44 px. Boutons : 16 px de côté, 14 px semi-gras.
- **Survol** : la luminosité change (`brightness`, éclaircit en sombre, assombrit en clair), jamais l'opacité.
- **Pression** : la surface se rétracte de 2 %.
- **Désactivé** : surface 2 + texte discret, sans ombre — jamais l'accent à 50 % d'opacité (blanc sur rose pâle en clair).
- **Focus clavier** : 2 px d'accent décalés de 2 px, sur `:focus-visible` seulement.
- **Ombres** : noires sur fond sombre, teintées d'encre sur fond clair ; l'ombre d'accent remplace tout halo.
- **Mouvement** : respecte `prefers-reduced-motion`.

## La structure des écrans

C'est elle qui fait la ressemblance, autant que la couleur.

- **La coquille** : en-tête collant « verre » (surface à 85 %, flou, une ligne) avec le mot-marque en texte ; les destinations en **pastilles** de 46 px, la courante surélevée (surface 2 + ligne + ombre) ; à droite, les raccourcis qui ne sont pas des destinations (thème, profil ou réglages). Sous 768 px : en-tête compact + **barre au pouce** fixe en bas (icône + libellé court, l'active en teinte d'accent). Jamais les deux à la fois, bascule 100 % CSS.
- **La grille de page** : trois colonnes `1fr | min(100% − 3rem, N) | 1fr`, chaque enfant dans la colonne du milieu, `N` nommé par écran. Pas de `vw`.
- **Le pied de page** : la version, petite, sous tout.
- **L'en-tête d'écran** : titre serré en Space Grotesk (un `h1` par écran), la phrase qui dit ce qu'on regarde — **vraie et calculée**, jamais un slogan — et l'action principale à droite, alignée sur la ligne de base du titre.
- **Le lien retour** nomme la destination (« ← Ma collection », « ← Jouer »), jamais « Retour » seul ; 44 px de haut.
- **Les cartes** : surface, ligne, ombre douce, 24 px de respiration ; une carte n'est pas un bouton, l'action est dedans.
- **Les icônes** : Lucide, en ligne, sur `currentColor`. **Jamais d'emoji dans le chrome** de l'interface (un emoji de contenu, lui, reste).
- **Les chips** : capsules ; active = accent plein + encre, sinon surface + ligne. Les choix exclusifs sont de vrais `radiogroup`.
- **Les états vides** : une icône dans une pastille teintée, un titre, la phrase qui donne la sortie, l'action. **Les squelettes** prennent la place exacte de ce qui va venir.
- **La zone de danger** : ni ombre ni ligne, un fond teinté `danger-tint`.
- **La porte d'entrée** (connexion, choix du nom) : hors coquille, colonne étroite, halo d'accent en haut, le nom en grand, une carte-formulaire.

## Le logo

Voir `brand/README.md` : une tuile à l'accent, un objet en encre, posé sur l'**étagère** qui est le trait de famille.
