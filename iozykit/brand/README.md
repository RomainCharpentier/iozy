# La marque Iozy

Une **tuile** à l'accent (coins arrondis : 7,5 sur une grille de 32), un dessin en **encre** dessus, et une **étagère** qui dépasse de part et d'autre (de 3 à 29 sur 32, épaisseur 2,2). L'étagère est le trait de famille : c'est elle qui dit « Iozy ». Chaque app y pose son objet.

| App | Objet sur l'étagère | Fichier |
|---|---|---|
| IozyCore | trois tranches, la troisième penchée (une collection) | `iozycore.svg` |
| IozyPlay | un triangle « lecture » (le jeu, l'extrait) | `iozyplay.svg` |

Règles pour un nouveau membre :

- Formes épaisses, lisibles à 16 px : un écart entre deux formes vaut au moins 4 unités (2 px à la taille d'un onglet), pas de détail fin.
- Les couleurs sont celles des tokens : tuile `accent`, encre `accent-ink`, dans les deux thèmes. Un favicon suit la préférence du **système** (`prefers-color-scheme`), car il vit dans le chrome du navigateur ; un logo dans une page suit le thème de l'**app** (SVG en ligne branché sur les variables).
- Le mot-marque s'écrit en Space Grotesk 600/700, « Iozy » en encre du thème et le suffixe en accent (`Iozy<span>core</span>`, `Iozy<span>Play</span>`), jamais en dégradé, jamais dans un bloc coloré.

Les SVG de ce dossier sont des copies de référence ; chaque app garde les siens (favicon, icône d'installation, composant logo) et les retouche ensemble.
