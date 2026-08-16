# Handoff : Ma Collection, Fiche détail, Rechercher, Wishlist, Profil, Paramètres

## Overview
Refonte visuelle et de flux de 6 écrans de l'app IozyCore (web) : la collection (grille par catégorie), la fiche détail d'une entité (manga/jeu vidéo/jeu de société), la recherche (ajout via API externes), la wishlist, le profil et les paramètres. Objectif : une identité plus travaillée que l'actuel (dark + lime), une hiérarchie claire par type de contenu, et des flux d'ajout cohérents (ajout uniquement via Rechercher).

## About the design files
Le fichier `IozyCore Prototype.html` dans ce dossier est un **prototype de référence en HTML/JS**, pas du code à copier tel quel. Il sert à montrer le look et le comportement voulus (layout, états, micro-interactions). Le travail consiste à **recréer ces écrans dans la stack existante du projet** :
- Web : React 19 + Vite + TypeScript + Tailwind CSS 4 + TanStack Query + React Router 7 (`web/`), en réutilisant les composants existants (`Chip`, `CoverTile`, `StatCard`, `ErrorBanner`, `theme/tokens.ts`, `theme/gradient.ts`) et les routes déjà présentes (`routes/Shelf`, `routes/EntityDetail`, `routes/Wishlist`, `routes/Profile`, `routes/Settings`, `routes/Suggestions`).
- iOS : à adapter en SwiftUI selon les conventions déjà en place dans `ios/`, si le même changement doit y être porté.

Ne pas injecter le HTML/CSS du prototype directement dans l'app — relire les valeurs (couleurs, espacements, structure) et les recréer avec les tokens/composants du projet.

## Fidelity
**Fidélité moyenne-haute** : couleurs, typographie et structure sont volontairement précises (voir Design tokens ci-dessous), mais les contenus sont des données de démo. Le développeur doit reprendre les mêmes proportions et hiérarchie, et brancher les vraies données via les hooks `api/*` existants (`entities.ts`, `wishlist.ts`, `metadata.ts`, etc.) plutôt que les tableaux `ENTITIES`/`GRID_ITEMS`/`SEARCH_CANDIDATES` du prototype qui sont uniquement du mock.

## Screens / Views

### 1. Ma collection (`routes/Shelf`)
- **Purpose** : vue d'ensemble de tout ce que l'utilisateur possède, groupée par catégorie.
- **Layout** : une ligne par catégorie (Mangas, Jeux vidéo, Jeux de société, Livres), chacune avec :
  - un bandeau vertical de 3px à gauche coloré selon le type (voir tokens couleur)
  - un en-tête cliquable : petit point de couleur + "LABEL (count)" en majuscules + une règle horizontale fine + "Voir tout ›"
  - une rangée de vignettes en scroll horizontal (`overflow-x:auto`), chaque vignette 140px de large, ratio 2/3, coins arrondis 16px
- **Pas de filtre "Par série / Par tome"** ni de tri implicite : cliquer sur l'en-tête de section ouvre la vue catégorie complète (grille), cliquer sur une vignette d'entité suivie en détail (manga/jeu avec fiche) ouvre sa fiche.
- Vignette : dégradé de fond (à remplacer par vraie jaquette), badge "✓" rond vert en haut à droite si série complète à 100%, fine barre de progression sous la couverture (3px) colorée selon le type si l'item a un ratio (mangas suivis en tomes), titre (14px/600), sous-titre (12px, gris) = auteur/éditeur pour les jeux et livres, "X/Y tomes" pour les mangas.

### 2. Vue catégorie (`routes/EntityTypes` ou route dédiée par type)
- Même traitement de vignette que la collection, mais en grille (7 colonnes desktop pour mangas, 5 pour le reste ; 4/3 en mobile).
- Titre de la page dans la couleur du type. Lien retour "‹ Retour à ma collection".

### 3. Fiche détail (`routes/EntityDetail`)
- **Layout desktop** : grid `200px | reste`, jaquette à gauche (ratio 2/3), infos à droite. Mobile : flex column, jaquette 104px de large.
- **En-tête** : titre (26px/700), auteur/studio (14px gris), badge type coloré (fond tinté 16% opacité, texte couleur pleine).
- **Mangas** : barre "X / Y tomes possédés" + % à droite + barre de progression lime. Si plusieurs éditions : chips par édition, chacune affichant son propre décompte "X/Y tomes" (jamais un simple libellé — inspiré de Mangacollec) ; édition active en fond lime. Une seule édition → simple ligne texte "Label · N tomes" (pas d'icône crayon, fonctionnalité non implémentée).
- **Jeux vidéo** : ligne "Éditeur · Année" (pas de badge "Possédé" redondant — c'est déjà une collection d'items possédés).
- **Jeux de société** : ligne "Joueurs · Durée · Âge".
- **Grille des tomes** (mangas uniquement) : 8 colonnes desktop / 4 mobile, chaque case ratio 2/3, badge "✓" si possédé, bandeau bas "+N" si catalogué mais pas possédé, état "virtuel" (case en tirets, "Manquant" + "+") si jamais catalogué. Clic sur une case ouvre le panneau (drawer desktop / bottom sheet mobile) pour voir/ajouter l'exemplaire (état, date, prix ; CTA "Ajouter").
- Bloc "À propos" : grille de paires label/valeur (Éditeur, Statut, Tomes pour mangas ; Développeur/Éditeur/Année/Genre pour jeux vidéo ; Éditeur/Catégorie/Année pour jeux de société).

### 4. Rechercher (`routes/QuickAdd` ou route Recherche dédiée)
- **Seul point d'entrée pour ajouter un item à la collection** (la Wishlist n'ajoute plus directement).
- Champ de recherche + texte d'aide "Cherche parmi Jikan, MyAnimeList, IGDB, BoardGameGeek et Google Books."
- Comportement type recherche API réelle, pas un filtre instantané sur liste locale : champ vide → invite à taper ; saisie → debounce ~500ms puis état "Recherche en cours..." (spinner) ; ensuite résultats ou "Aucun résultat pour cette recherche."
- Chaque résultat : mini-jaquette, titre, "Auteur · via {source}", badge type, puis soit "Déjà possédé" (gris, pas de CTA), soit bouton "Ajouter", soit état "Ajouté ✓" (lime) après clic.

### 5. Wishlist (`routes/Wishlist`)
- **Consultation et suppression uniquement.** Sous-titre explicite : "Ce que tu veux ajouter à ta collection — pour l'ajouter, passe par Rechercher."
- Grille de vignettes (5 colonnes desktop / 3 mobile), pas de barre de progression. CTA unique par carte : "Retirer de la wishlist" (gris neutre, pas d'action destructive stylée en rouge).

### 6. Profil (`routes/Profile`)
- Grille de grandes cartes pleine largeur (1 colonne mobile, 2 desktop), chacune : icône dans un carré 52px (fond lime tinté 14%), titre 16px/600, description 13px grise, chevron à droite.
- Entrées : Wishlist, Statistiques, Suggestions d'achats, Prêts en cours.

### 7. Paramètres (`routes/Settings`)
- Une seule entrée pour l'instant : "Administration avancée" (types de collection, import BGG, export brut des données) — à étoffer si besoin réel identifié.

## Interactions & Behavior
- Navigation principale (desktop : barre du haut ; mobile : tab bar basse) : Ma collection / Rechercher / Wishlist / Mon profil / Paramètres. L'onglet actif est en lime (texte + soulignement desktop).
- Panneau volume (drawer desktop 400px depuis la droite / bottom sheet mobile, ratio 78% de hauteur max) : ouverture au clic sur une case de tome, fermeture par le bouton "×" ou le clic sur l'overlay (mobile).
- Recherche : debounce 500ms avant de considérer la requête "soumise" (voir logique `handleSearchInput` du prototype).
- Édition active d'un manga multi-édition : clic sur une chip change l'édition affichée et réinitialise le tome sélectionné.

## State management
- Écran actif (collection / category / detail / search / wishlist / profile / settings)
- Viewport (desktop / mobile) — dans l'app réelle, remplacé par un vrai breakpoint responsive, pas un switch manuel
- Entité sélectionnée (id) + édition active par entité (pour les mangas multi-éditions)
- Volume actif (pour le panneau)
- État du formulaire d'ajout (condition, prix)
- Recherche : saisie brute, requête debouncée, état "searching", set d'items ajoutés dans la session
- Wishlist : set d'items retirés dans la session

Dans l'app réelle, tout ça doit être branché sur les vraies mutations (`api/ownerships.ts`, `api/wishlist.ts`, `api/entities.ts`) via TanStack Query plutôt que du state local mock.

## Design tokens
- Fond principal : `#0A0A0C` ; fond des panneaux/cartes : `#1D1D21` ; fond secondaire (barres vides, inputs) : `#26262B`
- Texte principal : `#F5F4F2` ; texte secondaire : `#8C8B92`
- Accent principal (lime) : `#B8FF3C`, texte sur accent : `#0E1500`
- Couleurs par type de contenu (badges, barres de progression, bordures de section) :
  - Mangas : `#B8FF3C` (lime)
  - Jeux vidéo : `#8B7FFF` (violet)
  - Jeux de société : `#FF6FA5` (rose)
  - Livres : `#FFA43C` (orange)
  - Fond tinté des badges : la couleur du type à 16% d'opacité (`rgba(r,g,b,0.16)`)
- Typographie : titres en **Space Grotesk** (500/700), corps en **Inter** (400/500/600/700)
- Rayons : 16px (vignettes, cartes), 12px (chips, cartes profil), 8px (boutons, cases de tomes), 999px (pills, badges ronds)
- Espacements de grille : 20px desktop / 12px mobile entre vignettes

## Assets
Toutes les jaquettes du prototype sont des dégradés CSS de substitution — à remplacer par les vraies images (déjà gérées côté app via `lib/coverImage.ts`). Aucune icône SVG custom : le prototype utilise des glyphes texte simples, à remplacer par des icônes Lucide (`lucide-react`, déjà une dépendance du projet) équivalentes.

## Files
- `IozyCore Prototype.html` — le prototype interactif complet (les 6 écrans + panneau volume), à ouvrir dans un navigateur.
