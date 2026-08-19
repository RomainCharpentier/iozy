# Migration Design V1.2 — matrice de travail

Handoff Design autonome (Claude Design), reçu le 2026-08-19. Sources de vérité,
par priorité décroissante en cas de contradiction :

1. `IozyCore v1.2.dc.html` (UX/UI — nav, pages, comportements)
2. `IozyCore DS v1.1.dc.html` (Design System — palette, typo, composants)
3. Screenshots V1.2
4. Anciens prototypes (`v1.1`, explorations, `Prototype.dc.html`...) — historiques, jamais source de comportement final. Le dossier `design_handoff_ma_collection/` (README + `IozyCore Prototype.html`) est l'un de ces anciens prototypes : nav à 5 destinations (avec Wishlist en pair), palette lime différente de la DS v1.1 — **non suivi**, contredit par v1.2/DS v1.1.

Décision utilisateur actée (2026-08-19) : adopter la palette terracotta complète
de la DS v1.1 (accent `#c05a3c` clair / `#d9694a` sombre), avec vrai support
clair+sombre. iOS restera visuellement désynchronisé (Theme.swift non touché
dans ce lot) jusqu'à un travail dédié ultérieur — accepté explicitement.

## Matrice KEEP / ADAPT / REFACTOR / CREATE / REMOVE / BLOCKED_BY_DATA

| Élément V1.2 | Implémentation actuelle | Écart | Action |
|---|---|---|---|
| Palette terracotta clair+sombre, 4 niveaux texte (ink/dim/muted/faint), accentTint/dangerTint/okTint, 3 ombres | `index.css` : lime sur sombre forcé, 2 niveaux texte (textPrimary/textDim) | Total | **REFACTOR** (Lot 1) |
| Focus ring 2px accent, offset 2px | Déjà `focus:ring-2` par endroits, pas systématique | Partiel | **ADAPT** (Lot 1) |
| Boutons 5 états (primaire/secondaire/ghost), tailles précises | Boutons ad hoc par composant, pas de primitive partagée | Partiel | **CREATE** primitive `Button` (Lot 1) |
| Icônes Lucide cohérentes | Déjà Lucide partout (confirmé) | Aligné | **KEEP**, vérifier mapping exact par écran au fil des lots |
| Nav 3 destinations (Collection/Rechercher/Découvrir) + Heart + Profil avatar, source unique `navItems` desktop+mobile | `DesktopHeader.tsx` : Collection/Rechercher/**Wishlist**/Profil/Paramètres (5, 2 clusters). `TabBar.tsx` : Collection/Rechercher/Profil/Paramètres (4) | Wishlist et Paramètres sont pairs, doivent devenir Heart/sous-Profil ; Découvrir n'existe pas | **REFACTOR** (Lot 2) |
| Bottom bar mobile avec FAB Scan intégré (séparé par une bordure, sans aria-current) | Pas de FAB, Scan est une route `/scan` liée depuis Profil | Écart mineur, additif | **ADAPT** (Lot 2) |
| Ma collection : rails horizontaux par catégorie (halo teinté, "Tout voir") | `ShelfPage.tsx` : grille unique multi-type avec filtres/tri (voir Lots précédents de cette session) | Structurel | **REFACTOR** (Lot 3) — à confirmer : le filtre actuel (Tout/Manga/JV/JDS + Par série/Par tome) reste-t-il en plus des rails, ou les rails remplacent le filtre de type ? Rails = groupement, pas un remplacement des filtres état (Incomplètes/Complètes/Sortie annoncée) déjà prévus §21 |
| Card : image + titre/méta **hors** de l'image | `CoverTile.tsx` **déjà** image/texte séparés (refonte antérieure de cette session) | **Aligné**, mais raison différente du mock (le mock overlay le titre sur l'image avec dégradé) | **KEEP** avec différence documentée (§100 : vraie jaquette backend imprévisible en contraste, contrairement à un dégradé démo choisi pour son contraste garanti) |
| Fiche : Hero (cover+titre+auteur+éditions+progression) → Mes tomes → Mes classements → À propos | `EntityDetailPage.tsx` : Hero → Mes tomes (+ panneau interaction, déjà refait) → À propos (pas de "Mes classements" — Tier Lists n'existe pas) | "Mes classements" bloqué par l'absence de Tier Lists backend | **ADAPT** hero/tomes (Lot 4), **BLOCKED_BY_DATA** "Mes classements" tant que Lot 7 (Tier Lists) n'existe pas |
| Tome : drawer/sheet contenu canonique, manquant = état+prix seul, possédé = "Ma copie" + Modifier inline + "..." (Marquer vendu/Supprimer) | `VolumeInteractionPanel.tsx`/`AddOwnershipForm.tsx`/`OwnershipDetails.tsx` — **déjà construit ce lot-ci de session**, comportement quasi identique (drawer desktop 420px vs 392px maquette, bottom-sheet 85dvh vs 88% maquette, édition inline déjà en place) | Mineur (mesures, pas de prêt à retirer - déjà fait) | **KEEP**, ajustements de mesure seulement si Lot 9 QA le juge nécessaire |
| Recherche : 1 point d'entrée, état personnel avant métadonnées, 4 actions (scan/annonce/lot/photo) | `QuickAddPage.tsx` — recherche existante, à vérifier précisément | À auditer en détail | **ADAPT** (Lot 5) |
| Découvrir (Tier Lists / Opportunités / Sorties), layout desktop 60/40 + pleine largeur | N'existe pas | Total | **CREATE** (Lot 6, structure) |
| Opportunités | `SuggestionsPage.tsx` (suggestions d'achat quasi-complètes) couvre une partie du concept | Partiel | **ADAPT** vers Découvrir (Lot 6), reste **BLOCKED_BY_DATA** pour toute donnée de marché non observée (cohérent avec le moteur Purchase Analysis existant : jamais de prix inventé) |
| Prochaines sorties | Pas de concept "sorties suivies" identifié dans le repo actuel (à confirmer en Lot 6) | À auditer | **CREATE** ou **BLOCKED_BY_DATA** selon ce que révèle l'audit Lot 6 |
| Tier Lists (hub, board drag&drop, quick rank, picker, création) | N'existe pas — aucun backend | Total, nouveau domaine | **CREATE** (Lot 7) — nouveau domaine backend (ranking S–F par item/univers) + frontend. Le plus gros morceau du handoff. |
| Envies (Wishlist) | `WishlistPage.tsx` existe, fonctionnel (consultation/suppression) | Accès à déplacer sous Heart, contenu OK | **KEEP** contenu, **ADAPT** point d'entrée (Lot 2 nav + Lot 8) |
| Valeur | `StatsPage.tsx`/`CollectionValueSection.tsx` existent | À vérifier vs états fiable/partiel/indisponible §55 | **ADAPT** (Lot 8) |
| Import | `ImportBggPage.tsx` existe (BGG uniquement) | Le mock ne doit promettre que les sources réellement supportées | **KEEP**, vérifier le wording (Lot 8) |
| Profil | `ProfilePage.tsx` existe | Structure à comparer à la maquette (cartes pleine largeur) | **ADAPT** (Lot 8) |
| Paramètres | `SettingsPage.tsx` existe | Doit inclure l'entrée Administration, pas de faux écrans | **ADAPT** (Lot 8) |
| Administration | `AdministrationPage.tsx`, `EntityTypesPage`, `ImportBggPage`, export existent | Séparée de l'usage quotidien — déjà le cas | **KEEP** (Lot 8) |
| Prêts (`LoansPage`, `/loans`) | Existe, fonctionnel, **hors périmètre V1.2** (§88, ne pas réintroduire) | La route existe mais n'est plus dans le nouveau flux nav | **KEEP** le code (ne pas supprimer une feature qui marche sans mandat explicite de suppression), **REMOVE** tout lien d'entrée vers `/loans` depuis les nouvelles surfaces (déjà le cas pour le drawer Tome depuis le lot précédent) — à vérifier en Lot 8 si Profil y renvoie encore |
| Vue étagère | Mentionnée §23/§932 (`VUE ÉTAGÈRE`) comme direction conceptuelle | Aucune trace dans le repo actuel | **BLOCKED_BY_DATA** — non prioritaire (§23 : "si purement expérimentale... ne la priorise pas avant les parcours principaux") |
| Accessibilité (dialog pattern, aria-current, focus trap/restauration) | Panneau Tome a déjà Escape + fermeture overlay ; drawer/sheet existants n'ont pas de vrai focus trap | Partiel | **ADAPT** transversal (Lot 9) |

## Lots (ordre d'exécution, un commit séparé par lot)

0. Audit + matrice (ce document) — **fait**
1. Foundations : tokens (palette terracotta clair+sombre, 4 niveaux texte, ombres), primitive `Button`, focus ring
2. Shell : nav 3 destinations + Heart + Profil avatar, desktop + mobile, route `Découvrir` (squelette)
3. Ma Collection : rails par catégorie, cards, filtres état
4. Fiche Manga : hero, éditions, tomes (mesures), "Mes classements" (placeholder tant que Lot 7 n'existe pas)
5. Recherche : audit + alignement 4 actions, hiérarchie résultats
6. Découvrir : layout desktop 60/40, Opportunités (adapté de Suggestions), Sorties (à créer/bloquer selon audit)
7. Tier Lists : nouveau domaine backend + frontend (le plus gros lot)
8. Pages secondaires : Wishlist, Valeur, Import, Profil, Paramètres, Admin
9. Accessibilité transversale
10. Responsive + QA visuelle finale vs maquettes, rapport final

## Notes de calibrage (pour éviter de refaire ce travail de lecture)

- `navItems` (mock, ligne ~2893) : source unique desktop rail + bottom bar mobile, exactement 3 entrées (Collection/Rechercher/Découvrir), jamais Wishlist/Profil/Paramètres/Scan en pair.
- Bottom bar mobile (ligne ~1707-1728) : 3 nav items + FAB Scan séparé par une bordure verticale, `order` CSS pour le placer à droite. Le FAB Scan n'a pas `aria-current` — ce n'est pas une 4e destination, juste un raccourci. Réconcilie §12 ("ne pas mettre Scan dans la bottom-nav") : Scan n'est pas un onglet pair, juste un raccourci visuel dans la même barre.
- Drawer Tome (ligne ~1809) : 392px desktop / bottom-sheet 88% mobile. Déjà très proche de `VolumeInteractionPanel.tsx` (420px/85dvh) construit plus tôt cette session — écart mineur, pas de refonte nécessaire.
- Fiche (ligne ~238) : édition cards affichent chacune sa propre barre de progression (déjà fait), "Mes classements" est une section à part entière AVANT "À propos", pas fusionnée avec les tomes.
- Découvrir (ligne ~958) : desktop affiche les 3 panneaux simultanément dans une grille (`discoverGrid`), mobile swipe un seul panneau à la fois — même markup, juste le conteneur qui change (identique au pattern déjà utilisé pour la Fiche : `ficheSwipe`/`fichePanels`).
- DS tokens complets extraits de `IozyCore DS v1.1.dc.html` lignes 432-467 (LIGHT/DARK) — voir Lot 1 pour les valeurs exactes utilisées.
