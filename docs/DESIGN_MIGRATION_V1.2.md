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
| Fiche : Hero (cover+titre+auteur+éditions+progression) → Mes tomes → Mes classements → À propos | `EntityDetailPage.tsx` : Hero → Mes tomes → **Mes classements (réel)** → À propos | Aligné | **ADAPT** hero/tomes (Lot 4), **fait** "Mes classements" (Lot 7b `9ecb6c4`, copie/lien alignés Lot 6) — rang général dominant ("{type} — général", "Ton jugement, pas une note publique."), lien "Toutes mes Tier Lists" vers `/tier-lists`, chips Tier Lists perso, `getEntityTierSummary`. Écart mineur documenté : "Assistant" (Q&A contextuelle "Que me manque-t-il ?"/"Qu'est-ce qui ressemble à mes S ?") vu dans la maquette au même endroit mais **pas construit** — voir nouvelle ligne dédiée plus bas |
| Tome : drawer/sheet contenu canonique, manquant = état+prix seul, possédé = "Ma copie" + Modifier inline + "..." (Marquer vendu/Supprimer) | `VolumeInteractionPanel.tsx`/`AddOwnershipForm.tsx`/`OwnershipDetails.tsx` — **déjà construit ce lot-ci de session**, comportement quasi identique (drawer desktop 420px vs 392px maquette, bottom-sheet 85dvh vs 88% maquette, édition inline déjà en place) | Mineur (mesures, pas de prêt à retirer - déjà fait) | **KEEP**, ajustements de mesure seulement si Lot 9 QA le juge nécessaire |
| Recherche : 1 point d'entrée, état personnel avant métadonnées, 4 actions (scan/annonce/lot/photo) | `SearchPage.tsx` → `AddDraftPage.tsx` — 2 écrans (liste résultats groupés → sélection tomes), `QuickAddPage.tsx` supprimé | Aligné avec le modèle de la maquette | **REFACTOR fait** (Lot 5 suite, `f8d626f`) — voir note Lot 5 mise à jour ci-dessous |
| Découvrir (Tier Lists / Opportunités / Sorties), layout desktop 60/40 + pleine largeur | `DiscoverPage.tsx` : sous 1100px, 3 sous-onglets réels (un panneau visible) ; dès 1100px, composition éditoriale réelle (grille `1.65fr 1fr` mesurée, Tier Lists à gauche, Opportunités à droite avec bordure, Sorties pleine largeur dessous avec bordure haute, onglets masqués) - même markup, bascule 100% CSS (`hidden`/`min-[1100px]:flex`) | Aligné | **CREATE fait** (Lot 2/6 `16ffc9c`) - les 3 panneaux sont des aperçus compacts (`DiscoverTierPreview`/`DiscoverOpportunitiesPreview`/`DiscoverReleasesPanel`), pas les écrans complets |
| Opportunités | `DiscoverOpportunitiesPreview.tsx` (aperçu, 3 max) + `SuggestionsPage.tsx` existant (liste complète, lien "Tout voir") - adapté de `PurchaseAnalysisService.findNearCompleteSuggestions`, jaquettes croisées depuis `searchEntities({})` (la suggestion ne porte pas `coverImageUrl`) | Aligné | **ADAPT fait** (Lot 6 `16ffc9c`) - reste **BLOCKED_BY_DATA** pour toute donnée de marché non observée (cohérent avec le moteur Purchase Analysis existant : jamais de prix inventé) |
| Prochaines sorties | Aucune des deux données requises n'existe : ni date de prochaine sortie par tome (aucun fournisseur branché - Jikan/MyAnimeList/Google Books n'exposent pas de calendrier de parution fiable par tome, vérifié par grep sur tout `backend/src/main/java` : zéro occurrence de `releaseDate`/`nextRelease`/`publicationDate`/`upcoming`), ni concept "suivre une série" distinct de la Wishlist (zéro occurrence de `follow`/`suivre` pertinente) | Total | **BLOCKED_BY_DATA confirmé** (Lot 6) - `DiscoverReleasesPanel.tsx` affiche un état honnête expliquant l'absence de source, jamais une date approximative. Se débloque le jour où une vraie source de calendrier de sorties est intégrée |
| Tier Lists (hub, board, quick rank, picker, création) | `TierListsScreen.tsx` (`/tier-lists`, écran dédié "deuxième grande expérience" - aperçu par univers avec rangs réels + Tier Lists perso + création), `DiscoverTierPreview.tsx` (aperçu compact dans Découvrir, 2 univers max + 3 listes perso max + CTA "Classer mes éléments"), `GeneralTierBoardPage`/`CustomTierBoardPage` (boards), `TierPicker` (raccourcis clavier S-F + Échap), `CreateTierListModal`, `AddTierListItemsPanel` — backend `domain/tierlist` complet (`EntityRank` = classement général implicite, `TierList`/`TierListItem` = listes perso explicites) | Aligné, 3 écarts documentés ci-dessous | **CREATE fait** (Lot 7a `909f6d0`, Lot 7b `9ecb6c4`, écran dédié + aperçu Découvrir Lot 6 `16ffc9c`), **3 écarts comblés au Lot 14** : glisser-déposer (en PLUS du clic, jamais à la place - voir DS v1.1 §47), flux "Classer rapidement" séquentiel (`useQuickRank`), et Tier List transverse "toutes catégories" (`scope: 'all'`, migration additive V13 rendant `TierList.entityTypeId` nullable) |
| Assistant contextuel sur la fiche ("Que me manque-t-il dans cette série ?" / "Qu'est-ce qui ressemble à mes S ?") | N'existe pas | Total, nouvelle fonctionnalité | **CREATE fait** (Lot 13, `AssistantSection.tsx`) - découvert en Lot 6 en lisant la section "Mes classements" du mock, construit dans son propre lot comme prévu. Deux boutons à question FIXE, réponse calculée, jamais de saisie libre ni d'appel à un modèle de langage (commentaire source : "Assistant : contextuel, pas un chatbot"). Placé entre "Mes classements" et "À propos", l'emplacement du mock. Question 1 "Que me manque-t-il dans cette série ?" : répondue par le moteur de complétude existant (nombre et numéros manquants en plages lisibles, distinction catalogué/purement virtuel, coût estimé avec sa base de prix affichée) ; question 2 de la maquette "Qu'est-ce qui ressemble à mes S ?" **BLOCKED_BY_DATA confirmé** (aucun champ genre/thème stocké - même raison que l'absence de ligne "Genre" dans "À propos", §101), **remplacée** par "Où en suis-je dans mes lectures ?" (choix utilisateur du 2026-08-20), répondue par les Experiences réelles |
| Envies (Wishlist) | `WishlistPage.tsx` existe, fonctionnel (consultation/suppression) | Accès à déplacer sous Heart, contenu OK | **KEEP** contenu, **ADAPT fait** point d'entrée (Lot 2 nav : Heart ; Lot 8 : ligne "Wishlist" retirée de `ProfilePage.tsx`, redondante avec Heart - même destination exacte, zéro différenciation) |
| Profil : hero "Valeur estimée" cliquable (montant + confiance + aperçu titres/tomes/complètes), "Mes Tier Lists" (aperçu + Tout voir), 5 lignes (Importer/Statistiques/Valeur/Suivi & notifications/Paramètres) | `ProfileValueHero.tsx` (montant + badge fiable/partiel/indisponible + titres/tomes possédés, absent si 0 possession active), `ProfileTierListsSection.tsx` (une ligne par univers classé + jaquettes, une ligne par Tier List perso, absente si rien de classé nulle part), 4 lignes réelles (Évaluer un achat/Envies d'amélioration/Bilan annuel/Paramètres) | Aligné, écarts documentés | **ADAPT fait** (Lot 8) - "séries complètes" du hero non repris (aucun champ backend, recalcul complet côté client non justifié pour un teaser) ; "Suivi & notifications" **BLOCKED_BY_DATA** non construit (même cause que Sorties, Lot 6) ; "Importer"/"Statistiques" non répétés en ligne séparée (déjà couverts par le hero Valeur -> `/stats`, et Administration -> import BGG - une ligne strictement redondante sur le MÊME écran, pas juste une autre page) ; "Wishlist"/"Suggestions d'achats" retirées (redondantes avec Heart et Découvrir > Opportunités, le mock lui-même ne les liste pas sur Profil) ; "Prêts en cours" retiré (§88) |
| Profil : "Partager ma collection" (visibilité + switch "partager aussi mes Tier Lists" + lien) | N'existe pas - le partage actuel (`WishlistShareSettings`, Lot "wishlist share" d'une session antérieure) ne couvre QUE la Wishlist, pas la collection entière ni les Tier Lists | Total, nouvelle fonctionnalité | **CREATE fait** (Lot 15) - domaine `collectionshare` distinct du partage Wishlist, migration V14, page publique `/public/collection/:token`. Décision produit tranchée le 2026-08-20 : la vue publique montre titre + jaquette + édition(s) possédée(s) + progression X/Y, et les Tier Lists ne sortent que via un interrupteur dédié, désactivé par défaut |
| Valeur | `StatsPage.tsx`/`CollectionValueSection.tsx` existent, messages fiable ("Sur les X possessions actuelles")/partiel ("Prix connu sur X/Y - valeur réelle probablement plus élevée") déjà conformes à §55 | Aligné | **KEEP confirmé** (Lot 8, relecture) - aucun changement nécessaire |
| Import | `ImportBggPage.tsx` existe (BGG uniquement), wording de `AdministrationPage.tsx` déjà honnête ("Récupérer tes jeux de société depuis BoardGameGeek", jamais "importer ta collection" en général) | Structurel (le mock place Import en ligne Profil visible ; notre import réel est BGG-only, une action rare/technique) | **KEEP confirmé** (Lot 8, relecture) - délibérément PAS promu en ligne Profil comme le mock : promouvoir une action BGG-only (jeux de société, aucun rapport avec la majorité manga de l'app) au même rang que Statistiques/Valeur donnerait une fausse impression de capacité d'import généraliste. Reste sous Administration avancée, cohérent avec une décision déjà prise lors d'un lot antérieur de cette session |
| Paramètres : Apparence (thème), Importer/Administration (lignes séparées dans le mock), Export des données ("Bientôt" **dans le mock**), Reconnaissance intelligente (switch traitement local) | `SettingsPage.tsx` : Apparence (thème, déjà conforme) + "Titre des mangas" (réglage réel propre à cette app, absent du mock) + une seule ligne "Administration avancée" (regroupe types/import BGG/export) | Structurel dans la forme, aligné dans l'intention | **KEEP confirmé** (Lot 8, relecture) - le mock lui-même titre cette section "deux entrées réelles valent mieux que quatre décoratives" : notre regroupement (une entrée réelle plutôt que import+administration+export séparés) sert ce même principe, décision déjà prise lors d'un lot antérieur. Point notable : l'export JSON/CSV complet est déjà réellement livré (liens de téléchargement fonctionnels dans `AdministrationPage.tsx`) alors que le mock lui-même l'affiche encore "Bientôt" - notre app est en avance sur le mock ici. "Reconnaissance intelligente" (traitement local device) **BLOCKED_BY_DATA/non applicable** - aucune notion de traitement on-device dans ce backend, le scan passe par de vraies API externes, non construit |
| Administration | `AdministrationPage.tsx`, `EntityTypesPage`, `ImportBggPage`, export existent | Séparée de l'usage quotidien — déjà le cas | **KEEP confirmé** (Lot 8, relecture) - badge "3" du mock (contributions communautaires à valider) non applicable, aucun concept de contribution multi-utilisateur dans cette app personnelle mono-utilisateur |
| Prêts (`LoansPage`, `/loans`) | Existe, fonctionnel, **hors périmètre V1.2** (§88, ne pas réintroduire) | La route existe mais n'est plus dans le nouveau flux nav | **KEEP** le code (ne pas supprimer une feature qui marche sans mandat explicite de suppression), **REMOVE fait** (Lot 8) - le seul lien d'entrée restant (`ProfilePage.tsx`) a été retiré ; vérifié par grep sur tout `web/src` : plus aucune surface de l'app ne lie vers `/loans`, route accessible seulement par URL directe |
| Vue étagère | Mentionnée §23/§932 (`VUE ÉTAGÈRE`) comme direction conceptuelle | Aucune trace dans le repo actuel | **BLOCKED_BY_DATA** — non prioritaire (§23 : "si purement expérimentale... ne la priorise pas avant les parcours principaux") |
| Accessibilité (dialog pattern, aria-current, focus trap/restauration) | `useModalA11y` (nouveau hook partagé) appliqué aux 7 surfaces `role="dialog"` de l'app (VolumeInteractionPanel, TierPicker, CollectionFilters, CreateTierListModal, AddTierListItemsPanel, ShelfPage hub menu, CustomTierBoardPage "..." menu) : Escape ferme + rend le focus au déclencheur, Tab reste piégé dans la surface, focus initial move vers `[data-modal-initial-focus]` si posé sinon le premier élément. `aria-current` déjà correct depuis Lot 2. Un `<h1>` par écran confirmé (grep sur toutes les routes, aucun doublon) | Aligné | **ADAPT fait** transversal (Lot 9, `91c22c5`) — 2 bugs réels trouvés et corrigés au passage : `AddTierListItemsPanel`/`CreateTierListModal` n'avaient même pas Escape avant ; le prop React `autoFocus` (CreateTierListModal, champ Nom) entre en course avec la logique de focus initial du hook sous React StrictMode (dev) - remplacé par un attribut `data-modal-initial-focus` explicite, un seul mécanisme qui pose le focus initial. Écart mineur documenté : si l'action de fermeture déplace elle-même l'élément déclencheur dans le DOM (ex: classer une œuvre la fait changer de ligne dans le board), le focus retombe sur `<body>` plutôt que sur un nœud DOM détaché - comportement sûr, pas un focus perdu de façon incorrecte |

## Lots (ordre d'exécution, un commit séparé par lot)

0. Audit + matrice (ce document) — **fait**
1. Foundations : tokens (palette terracotta clair+sombre, 4 niveaux texte, ombres), focus ring, `lib/theme.ts` — **fait** (`0a3b237`)
2. Shell : nav 3 destinations + Heart + Profil avatar, desktop + mobile, route `Découvrir` (squelette) — **fait** (`87cf993`)
3. Ma Collection : rails par catégorie, cards, filtres état — **fait** (`49129e8` + `fadd9ae`)
4. Fiche Manga : "Mes classements" (placeholder), "Évaluer une annonce" — **fait** (`17e33b5`)
5. Recherche : titre + points d'entrée réels, puis restructuration complète en 2 écrans — **fait** (`0d6c015` portée réduite, puis `f8d626f` restructuration complète — décision utilisateur "Restructurer complètement") — voir note ci-dessous
6. Découvrir : layout desktop 60/40, Opportunités (adapté de Suggestions), Sorties (à créer/bloquer selon audit) — **fait** (`16ffc9c`) — Sorties confirmé BLOCKED_BY_DATA après audit (grep backend, aucune donnée de calendrier/suivi)
7. Tier Lists : nouveau domaine backend + frontend — **fait** (7a backend `909f6d0`, 7b frontend `9ecb6c4`) — décision utilisateur "Continuer en autonomie"
8. Pages secondaires : Wishlist, Valeur, Import, Profil, Paramètres, Admin — **fait** (`f45154c`) — décision utilisateur "Continue en autonomie sur Lot 8" ; "Partager ma collection" (toute la collection + Tier Lists) explicitement non construit, décision produit à trancher séparément
9. Accessibilité transversale — **fait** (`91c22c5`) — hook `useModalA11y` partagé (focus trap + Escape + restauration) appliqué aux 7 surfaces `role="dialog"` de l'app, 2 bugs réels corrigés au passage (Escape manquant sur 2 composants, course autoFocus/StrictMode)
10. Responsive + QA visuelle finale vs maquettes, rapport final — **fait** (`c73d4c2`) — un vrai débordement horizontal mobile trouvé et corrigé (Évaluer un achat), rapport final livré à l'utilisateur

11. Titre français résolu vers la mauvaise œuvre — **fait** — voir ci-dessous
12. Contraste et lisibilité de tous les textes — **fait** — voir ci-dessous
13. Assistant contextuel sur la fiche — **fait** — voir ci-dessous
14. Écarts Tier Lists (drag & drop, classement rapide, liste transverse) — **fait** — voir ci-dessous
15. Partager ma collection — **fait** — voir ci-dessous
16. Progression X/Y de Ma collection alignée sur le total d'ÉDITION — **fait** — voir ci-dessous
17. Types de collection personnalisés (sans API) : friction levée — **fait** — voir ci-dessous
18. "Informations" : attributs de l'œuvre affichés et modifiables, tous types — **fait** — voir ci-dessous
19. Administration des éditions de référence — **fait** — voir ci-dessous
20. Fiche : un seul bloc "L'œuvre", possession et métadonnées enfin distinctes — **fait** — voir ci-dessous
21. Numéro d'un tome corrigeable — **fait** — voir ci-dessous
22. Couleur et icône d'un type de collection — **fait** — voir ci-dessous
23. Format de jaquette d'un type de collection — **fait** — voir ci-dessous
24. Audit transversal (erreurs, débordements, contraste, a11y, cohérence) — **fait** — voir ci-dessous
25. Fiche d'une œuvre restructurée d'après la maquette v4, et en-têtes de tous les écrans harmonisés — **fait** — voir ci-dessous

### Lot 25 — la fiche d'après la maquette v4, et l'en-tête de tous les écrans

Nouvelle maquette reçue le 2026-08-26 (`Restructuration de page web.zip`,
cinq artboards Claude Design). Celle qui fait foi est `Fiche série -
IozyCore v4.dc.html` : c'est la dernière itération, et les quatre autres
(`collection éditoriale`, `collection éditoriale v2`, `Naruto
(multi-éditions)`, `Menu de la fiche - variantes`) sont les explorations qui
y mènent — `Menu de la fiche - variantes` compare six systèmes de navigation
de fiche, dont celui que v4 retient.

Toutes les couleurs de la maquette (`#faf6f2`, `#fffdfb`, `#f4ece5`,
`#231e1a`, `#544a43`, `#6c625c`, `#bc583b`, `#a2452c`) sont **exactement**
les tokens déjà en place depuis le Lot 1 : aucune valeur nouvelle n'a été
ajoutée à `index.css`, tout est repris en `var(--color-*)`, donc réactif au
thème sombre que la maquette (clair seulement) ne montre pas.

#### Le changement de fond : une section à la fois, à toutes les largeurs

La fiche montrait « Mes tomes » en pleine largeur puis deux colonnes côte à
côte, et ne repliait en onglets qu'en dessous de 900px (Lots 20 et suivants).
La v4 tranche l'inverse : trois sections numérotées — **01 Mes tomes**,
**02 Mon suivi**, **03 L'œuvre** — dont une seule est visible, du téléphone
au grand écran.

Ce n'est pas un choix de mise en page mais de lecture. Ces trois sections
sont les trois axes du modèle (Possession ≠ Expérience ≠ Catalogue) et ce
sont trois questions qu'on ne se pose pas en même temps. Les afficher
ensemble obligeait à trier soi-même à chaque coup d'œil, et produisait deux
colonnes dont l'une finissait systématiquement plus courte que l'autre —
le défaut que les Lots 20/24 avaient déjà tenté de rattraper deux fois
(`8746f2d` « remplir la colonne de droite au lieu de la laisser vide »,
`aa1571f` « que chaque rangée ait un occupant à droite »).

Conséquence a11y : `BarreSectionsFiche.tsx` remplace `OngletsFiche.tsx` et
passe enfin à un vrai `role="tablist"`. L'ancien s'en tenait à
`aria-pressed` **pour une bonne raison** (les panneaux coexistaient en
grand, `role="tab"` aurait été faux la moitié du temps) ; ils s'excluent
maintenant partout, donc le motif ARIA décrit exactement ce qui se passe —
avec ce qu'il exige : `tabindex` mobile (un seul onglet atteignable au Tab)
et navigation aux flèches / Home / End, plus `role="tabpanel"` +
`aria-labelledby` sur chaque panneau.

#### Ce que le hero absorbe, et ce qui disparaît

`FicheHero.tsx` répond aux trois questions immédiates sans qu'aucune section
ne soit ouverte : l'anneau de progression (dégradé conique), les trois
relevés **Mon rang / Ma note / Édition suivie**, et les actions.

`EditionProgressSection.tsx` est **supprimée**, dissoute plutôt que
déplacée : sa barre de progression est devenue l'anneau, sa ligne d'édition
un relevé, ses pastilles de choix d'édition ont rejoint « Mes tomes » (une
édition ne commande que la grille — la choisir à côté des tomes qu'elle
réordonne, plutôt qu'en haut de page à côté du titre, c'est montrer ce
qu'elle fait), et ses deux avertissements (« épuisée », « nouvelle édition
annoncée ») sont restés en haut, juste au-dessus de
`EditionUpgradeWishToggle` — là où se forme l'envie de changer d'édition.
C'est ce dernier qui tient le « Chercher une meilleure édition → » de la
maquette : le lien existe, branché sur la fonctionnalité réelle.

L'Assistant quitte lui aussi sa section (il vivait dans la colonne droite de
« Mes tomes » depuis le Lot 24) pour la droite de la barre, comme dans la
maquette : ses deux questions portent sur la série entière, pas sur une
section. `AssistantSection.tsx` se scinde en `BoutonsAssistant` (les
pastilles, dans la barre) et `ReponseAssistant` (la réponse, sous la barre —
une barre collante qui grandirait repousserait le contenu qu'on lit).

Trois queries partagent leur clé de cache entre le hero, la barre, la grille
et l'Assistant (complétude, fiche d'édition, résumé Tier List) : vérifié en
direct dans l'onglet réseau, **un seul appel réel par clé** pour toute la
page.

#### Écarts assumés vis-à-vis de la maquette

- **Pas de bande pleine largeur** pour le hero : un panneau arrondi. Sortir
  du conteneur centré (voir `AppShell`) demanderait un `100vw`, qui compte la
  barre de défilement et rouvre exactement la classe de débordement
  horizontal corrigée au Lot 10. Le dégradé et les deux halos radiaux sont
  conservés, en tokens.
- **« 2003 → 2006 » s'affiche dès que l'année de fin existe.** Aucun
  fournisseur branché ne l'écrit aujourd'hui (grep sur tout
  `backend/src/main/java` : seul `startYear` est produit, par Jikan et
  MyAnimeList) — mais `endYear` est saisissable à la main depuis « L'œuvre »
  (il a désormais son libellé), et la pastille lit la plage dès qu'il est là.
  Sans lui : `Depuis 2003` si la série est en cours, `2003` sinon. On ne
  l'invente jamais, on sait juste le lire.
- **Le titre plafonne à `clamp(1.75rem, 4.6vw, 2.85rem)`** et non aux 46-68px
  de la maquette, qui n'affiche que « Death Note » ; cette application a déjà
  eu à encaisser des titres de plus de soixante caractères (`859e88a`).
- **« Je l'ai » est un `span`, pas un bouton** : la tuile entière EST déjà le
  bouton (imbriquer deux boutons est invalide), et le clic ouvre le panneau
  du tome, qui fait « je l'ai » **et** tout le reste (état, prix,
  renumérotation). L'affordance de la maquette est gardée, le doublon de
  parcours non.
- **« Mes tomes » disparaît** quand la notion de tome n'existe pas (jeu
  vidéo, type personnalisé, série seulement en envies) et la numérotation
  suit la liste réelle (01 Mon suivi / 02 L'œuvre) : un onglet vide serait
  pire qu'un onglet absent. Vérifié en direct sur Breath of the Wild.

#### Ce que la maquette apporte aux tuiles de tomes

Chaque tuile porte désormais sa légende **sous** la jaquette (numéro + état
en toutes lettres), extraite dans `TuileTome.tsx` et partagée par le tome
catalogué et le tome purement virtuel — c'est ce qui garantit qu'une rangée
reste alignée quel que soit ce que le catalogue connaît. Avant, le numéro
n'apparaissait que faute de jaquette et l'état se devinait à une pastille :
une grille de soixante-douze tuiles ne se lisait qu'en survolant. La grille
passe de `minmax(96px,1fr)` à `minmax(110px,1fr)` et de 4 à 3 colonnes sur
téléphone — mesuré à 375px : tuiles de 106px, « Dans ma collection » tient
sans troncature.

#### Harmonisation des autres écrans

Deux primitives partagées, tirées de la maquette :

- `components/EnTeteSection.tsx` — titre, sous-titre, action alignée sur le
  bas du bloc de titre. Les **vingt-huit** écrans écrivaient chacun leur
  en-tête à la main ; tous y passent (`niveau={1}` pour le titre d'écran,
  `niveau={2}` pour une section), et les sous-titres/actions qui existaient
  déjà y sont rentrés. Trois en-têtes sur mesure gardent leur forme (pastille
  de couleur d'univers : `CategoryPage`, `GeneralTierBoardPage` ; kicker :
  `SharedSpacePage`) et n'alignent que la typographie.
- `components/Carte.tsx` — `CLASSE_CARTE` et `<Carte>`, coins à 20px,
  respiration de 24px. Le dépôt comptait seize écritures différentes de « une
  carte » (`p-2` à `p-6`, avec ou sans ombre). La bordure `surface2`, absente
  de la maquette, est **gardée** : la maquette n'existe qu'en clair, où
  l'ombre suffit ; en sombre l'ombre est du noir sur du presque-noir et une
  carte posée sur une autre disparaîtrait.

`WishlistToggle` en variante `default` reçoit enfin une surface
(`bg-softBtn`) : posé nu à côté d'un bouton plein, il ne se lisait plus comme
un bouton mais comme du texte gris. La variante `inline` (lignes de liste)
est inchangée.


#### Seconde lecture de la maquette (même lot)

Une première passe avait pris la structure et laissé passer du contenu. Relu
ligne à ligne, voici ce qui manquait — tout est repris :

| Ce que la maquette dit | Ce qu'il y avait |
|---|---|
| La marque s'écrit `Iozy` en encre + `core` en accent | « IozyCore » d'un seul ton, dans les deux en-têtes |
| La destination courante est une pastille **surélevée** (surface + ombre) | Aplat `accentTint` **plus** un trait accroché sous l'en-tête — deux signaux pour la même chose, dont un qui débordait |
| « Mon rang » = la pastille **et** l'univers (« B  Manga ») | La pastille seule — or « B » ne veut rien dire tant qu'on ne sait pas « B en quoi » |
| « Ma note » = ★ + 7/10 | 7/10 sans l'étoile |
| Une phrase explique « Évaluer une annonce » (« Un lot d'occasion repéré sur Vinted ou Leboncoin ?… ») | Supprimée avec l'ancien hero |
| « Chercher une meilleure édition → » | Le même bouton, libellé « Je cherche une meilleure édition », en gris souligné plutôt qu'en lien d'accent |
| « Modifier » dans l'en-tête de la section « L'œuvre » | Dans la carte |
| L'édition liste « Éditeur » **et** « Tomes de l'édition » | Ni l'un sous ce nom, ni l'autre du tout |
| Champs techniques : « Statut brut », « Nombre de tomes (source) » | « Statut de la série », « Nombre de tomes » — ce dernier étant précisément celui qu'on confond avec les tomes de l'édition (12 chez MyAnimeList, 6 en Black Édition) |
| Le cœur et l'avatar ont une surface | Deux icônes nues |

Sur « Modifier » : le bouton vit maintenant dans l'en-tête de section
(`EnTeteSection.action`) et le brouillon de chaque champ reste dans
`EntityInfoSection`, seul endroit qui connaisse la liste réelle des champs
(union des champs déclarés par le TYPE et des attributs réellement présents).
Le lien est un booléen `ouvrirEdition` que le composant **consomme
aussitôt** (`onEditionOuverte` le rabaisse) : sans ça, fermer le formulaire
le rouvrirait au rendu suivant. Vérifié en direct : ouvre le formulaire
pré-rempli, « Annuler » le referme et il ne se rouvre pas.

Sur « Éditeur » : le libellé long « Éditeur de cette édition » (Lot 20)
existait parce que les deux sous-groupes se suivaient sans titre fort, et que
le `publisher` de la SÉRIE ne veut pas dire la même chose (pour un candidat
Jikan, c'est la revue de prépublication japonaise, pas l'éditeur français —
voir `pickCandidate`). Ces lignes vivent désormais sous un titre qui nomme
l'édition ; c'est lui qui lève l'ambiguïté, le libellé peut redevenir court.

#### Un bug d'accessibilité trouvé au passage

En mesurant l'en-tête refait, `aria-current` s'est révélé **absent sur la
fiche d'une œuvre** alors que « Ma collection » y était bien peinte en
destination courante. Cause : `NavLink` recalcule `aria-current` à partir de
SA propre correspondance de route — exacte pour `to="/"`, donc fausse sur
`/entity/:id` — et écrase celui qu'on lui passe. Le commentaire de
`DesktopHeader` disait pourtant depuis le Lot 2 que `NavLink` « ne sait
comparer qu'un préfixe de route », d'où `activeWhen` : la couleur suivait,
l'annonce non. Même silence sur `/scan` et `/purchase-analysis` sous
« Rechercher ». Corrigé dans `DesktopHeader` **et** `TabBar` en passant à
`Link` : `active` est déjà calculé par nous, il ne restait qu'à ne pas
laisser `NavLink` le contredire. Vérifié en direct, `aria-current="page"` sur
`/` comme sur `/entity/:id`.

#### Les cartes des autres écrans

Neuf panneaux de contenu passent sur `CLASSE_CARTE` (Découvrir ×3, Profil,
Évaluer un achat ×2, Ma collection, page de catégorie, Tier Lists) : rayon
20px et respiration de 24px partout, au lieu de `p-4`/`p-5`/`p-6` selon
l'écran. Les **rangées et tuiles cliquables** gardent leur rayon de 16px —
ce ne sont pas des cartes au sens de la maquette, et les aligner sur 20px
effacerait la hiérarchie entre un panneau et une ligne de liste. `StatCard`
descend à 15px, le rayon des rangées de la maquette, et gagne la bordure qui
lui permet d'exister en thème sombre.

#### Vérifications

`npm run typecheck` / `lint` / `check:contrast` (116 combinaisons, deux
thèmes) / `build` : tous verts. En direct sur données réelles, thème sombre :
les trois sections, l'assistant (les deux questions), le dépliage des champs
techniques, le « Modifier » de l'en-tête (ouverture, pré-remplissage,
annulation sans réouverture), une fiche non-manga, et les huit écrans
principaux (`/`, `/discover`, `/add`, `/profile`, `/tier-lists`,
`/purchase-analysis`, `/wishlist`, `/settings`) — chacun avec son `<h1>` et
sans débordement. Balayage de débordement horizontal à
1265px et à 375px (méthode du Lot 10 : `clientWidth` vs `scrollWidth`, plus
`getBoundingClientRect().right` par élément en ignorant les descendants d'un
`overflow-x` scrollable) : **aucun débordement**. Barre collante mesurée à
`top: 64px` en desktop et `56px` en mobile — exactement la hauteur de
`DesktopHeader`/`MobileHeader`, `z-index` 9 contre leur 10, donc elle glisse
dessous et jamais par-dessus.


### Lot 11 — "Vagabond" se pré-remplissait en "Slam Dunk"

Reproduit en direct avant correction (`GET /api/metadata/french-title?query=Vagabond&author=Takehiko Inoue`
→ `{"frenchTitle":"Slam Dunk"}`). Cause : le dernier recours "auteur seul"
des deux fournisseurs de titre français (Open Library, Google Books) cherche
le seul nom de l'auteur quand rien du titre cherché n'a matché — il ramenait
donc l'œuvre la mieux référencée de cet auteur, sans que rien ne la rattache
à la série demandée. Ce recours a pourtant de vraies réussites ("Forget Me
Not" → "Fragments d'elles", "Zom 100" → "Bucket List of the Dead") : il ne
fallait ni le supprimer, ni lui faire confiance aveuglément.

Trois garde-fous, tous vérifiés en direct :

- **Valeur de preuve du résultat** (`FrenchTitleMatch.Confidence`) : une
  correspondance sur la série cherchée l'emporte désormais sur une trouvaille
  "auteur seul", quel que soit l'ordre des fournisseurs — avant, la
  supposition d'Open Library (essayé en premier) court-circuitait Google
  Books. Effet de bord constaté : "Witch Hat Atelier", qui répondait 404,
  résout maintenant "L'Atelier des Sorciers".
- **Numéro de tome obligatoire** à cette étape seulement : sans lui, le
  résultat est presque toujours un artbook/guide/one-shot du même auteur
  (vérifié sur `inauthor:"Ryoko Kui"`, où "Les Sept Rejetons du dragon" et
  "Gloutons et Dragons : guide officiel" précèdent le vrai "Gloutons et
  Dragons (Tome 12)").
- **Confrontation au catalogue** (`MetadataSearchService.namesAnotherKnownWork`) :
  un titre "auteur seul" est écarté s'il est LUI-MÊME le titre catalogué
  d'une autre œuvre (MyAnimeList/Jikan). Une traduction française n'y existe
  pas ; "Slam Dunk" si (malId 51 ≠ 656). Comparaison par égalité EXACTE,
  jamais par inclusion — sinon "Bucket List of the Dead" serait écarté à
  tort à cause de "Zom 100: Bucket List of the Dead". Ne consulte que les
  fournisseurs qui cataloguent sous le titre d'origine (nouveau
  `MetadataProvider.catalogsOriginalTitles()`) : inclure celui qui cherche
  PAR titre français inverserait complètement le raisonnement. Vérification
  impossible (panne/quota) = titre écarté : un 404 honnête vaut mieux qu'un
  titre de série faux, que la recherche de tomes propagerait ensuite en
  jaquettes fausses.

351 tests backend verts. Vérifié en direct après reconstruction :
Vagabond → 404 (correct, son titre français EST "Vagabond", le client garde
donc le titre déjà affiché), Attack on Titan → "L'Attaque des Titans",
My Hero Academia → inchangé, Witch Hat Atelier → "L'Atelier des Sorciers".

### Lot 12 — contraste et lisibilité

Audit automatisé (calcul WCAG du ratio réel texte/fond composé, en parcourant
tous les nœuds de texte rendus) sur 18 routes × 2 thèmes, en 1280px et 375px,
plus les surfaces `role="dialog"` ouvertes une à une. Cinq défauts réels,
tous corrigés :

- **`bg-accent` + `text-accentText`** (~40 fichiers, 43 occurrences) : le
  token de l'accent EN TEXTE était posé SUR un remplissage accent — 1.47:1
  en sombre, 1.39:1 en clair, soit tous les boutons primaires, chips
  sélectionnées et badges illisibles. Nouveau token `--color-accentInk`
  (blanc en clair, encre foncée en sombre, comme la maquette qui écrit bien
  `color:#fff` sur ses boutons primaires) → 4.57:1 / 5.38:1.
- **`text-accent` utilisé comme couleur de texte** (25 occurrences) →
  `text-accentText` (4.25:1 → 5.70:1 en clair).
- **Couleurs d'univers** (`lib/entityTypeVisuals.ts`) : valeurs en dur
  calibrées pour un fond clair, utilisées aussi en texte ("Tout voir", titre
  de page catégorie) — 4.23:1 (manga) et 3.06:1 (jeu vidéo) sur fond sombre.
  Déléguées à des tokens CSS thème-réactifs ; teinte conservée, luminosité
  adaptée. Renverse la note "identité de catégorie stable" du Lot 3, à
  dessein.
- **Pastilles de rang** : encre blanche en thème clair sur `rank-a` (4.40) et
  `rank-b` (3.42, l'ambre) — les deux fonds assombris au strict nécessaire.
- **`--color-faint`** : 4.41 sur le fond clair, 4.06 sur surface2 — recalibré
  dans les deux thèmes pour tenir 4.5:1 sur les TROIS fonds, pas seulement le
  plus contrasté.

Également corrigé au passage : `CoverTile` posait `text-accent-text`, une
classe qui n'existe pas (le token génère `text-accentText`) — l'icône
héritait donc simplement de la couleur du parent.

Note de méthode (pour ne pas refaire l'erreur) : dans ce navigateur, quand
l'onglet ne compose pas de frames, les transitions CSS restent FIGÉES à leur
valeur de départ — `getComputedStyle().color` renvoie alors l'ancienne
couleur après une bascule de thème, alors que les variables CSS, elles, sont
à jour. Un premier balayage a ainsi produit des dizaines de faux positifs
"texte sombre sur fond clair" dans l'en-tête (les seuls éléments ayant une
transition sur `color`). Toujours injecter
`*{transition:none !important}` avant d'auditer, et ne jamais basculer de
thème en cours de balayage.

### Lot 12 bis — "Évaluer une annonce" sur la fiche

Signalé par l'utilisateur : le bouton, posé au milieu d'une fiche de série
possédée, ne disait ni de quelle annonce il s'agissait ni ce que la série
venait y faire — et pour cause, il ouvrait un formulaire d'analyse VIDE (le
pré-remplissage était noté "possible plus tard" au Lot 4). Corrigé des deux
côtés : libellé "Évaluer une annonce de cette série" + une ligne qui dit à
quoi ça sert (comparer un lot d'occasion à sa collection), et la série +
l'édition affichée sont réellement emportées jusqu'au formulaire via
`location.state` (même mécanisme que SearchPage → AddDraftPage). Valeurs
initiales seulement, jamais des champs verrouillés : un lot contient souvent
d'autres séries.

### Lot 13 — Assistant contextuel sur la fiche

Deux questions fixes, réponses calculées à partir des données que la fiche
charge DÉJÀ (complétude via la même clé de cache React Query que
EditionProgressSection/TomesGridSection, expériences déjà chargées par
EntityDetailPage) : zéro appel réseau supplémentaire, zéro changement
backend.

- **"Que me manque-t-il dans cette série ?"** — nombre et numéros manquants
  en plages lisibles ("2 à 17, 19 à 29, 31 à 72" plutôt que 69 numéros),
  distinction manquant-mais-catalogué / purement virtuel (elle existe dans
  la réponse backend et change ce que l'utilisateur doit faire), coût estimé
  avec sa base de prix nommée, puis un lien vers "Évaluer une annonce de
  cette série" déjà pré-rempli (Lot 12 bis).
- **"Où en suis-je dans mes lectures ?"** — remplace la seconde question de
  la maquette, définitivement infaisable (aucun genre/thème stocké : "ce qui
  ressemble à mes S" n'a rien à comparer). Tomes lus de l'édition, dernière
  lecture datée, tomes possédés sans lecture, note moyenne, et les lectures
  sans tome précisé comptées À PART (les fondre dans le compteur mentirait
  sur l'avancement). Volontairement pas de ratio "lus sur possédés" : un tome
  lu puis revendu afficherait "3 tomes sur les 1 que tu possèdes".

Tous les cas d'absence de donnée disent pourquoi plutôt que d'afficher un
zéro trompeur : édition non précisée (la complétude est toujours calculée PAR
édition), nombre total de tomes inconnu, aucune lecture enregistrée. Vérifié
en direct sur les 5 séries réelles de la collection, qui couvrent justement
ces trois cas.

### Lot 14 — les trois écarts Tier Lists

**1. Glisser-déposer** (`TierBoard`) — ajouté EN PLUS du clic, jamais à la
place : l'API HTML5 de drag & drop ignore le tactile, et le §47 exige
justement qu'il ne soit jamais la seule façon de classer. Clic et clavier
(Tab + Entrée sur une jaquette, puis S-F dans le sélecteur) restent intacts.
La zone "À classer" est elle aussi une cible de dépôt - sans elle, le geste
ne serait pas réversible au glisser. Déposer une œuvre sur son propre rang
n'envoie rien (même résultat, requête inutile).

**2. "Classer rapidement"** (`useQuickRank`) — enchaîne les œuvres non
classées une par une dans le MÊME `TierPicker` que le board (promesse du
§50), avec compteur de progression et bouton "Passer cette œuvre" (distinct
de Fermer, qui abandonne toute la file). La file est un instantané pris au
démarrage, jamais la liste vivante : chaque classement invalide la requête du
board, donc `unranked` rétrécit sous les pieds - s'y fier ferait sauter un
élément sur deux. Le CTA "Classer mes éléments" de Découvrir démarre
maintenant réellement ce flux (`state.quickRank`) au lieu d'ouvrir un board
qu'il fallait ensuite parcourir à la main.

**3. Tier List transverse "toutes catégories"** (`scope: 'all'`) — migration
**V13** strictement additive : `tier_list.entity_type_id` devient nullable,
NULL = toutes catégories. Aucune ligne existante touchée, aucune Tier List
déjà créée ne change de sens. `GET /tier-lists` sans `entityTypeId` renvoie
désormais les listes transverses (et elles seules, jamais tout confondu) :
elles n'appartiennent à aucun univers, les afficher sous chacun les
répéterait autant de fois qu'il y a de types - d'où leur famille dédiée en
fin d'écran Tier Lists. Les candidats d'une telle liste sont cherchés sans
filtre de type. Effet de bord assumé : la règle de domaine "une Tier List
appartient à exactement un univers" disparaît, et le test qui l'affirmait est
remplacé par deux tests qui décrivent la nouvelle règle (univers absent =
choix explicite, pas un oubli). Au passage, l'univers devient un VRAI choix
dans "Nouvelle Tier List" (chips, §51) au lieu d'une pastille imposée par le
bouton d'où l'on venait.

Vérifié en direct sur la vraie collection, état d'origine restauré après
chaque test d'écriture : classement rapide au clavier (S) puis "Passer",
glisser-déposer d'un rang vers "À classer" et l'inverse, création d'une liste
transverse + ajout d'œuvres + classement + suppression. La collection ne
contenant aujourd'hui que des mangas, le MÉLANGE d'univers dans une liste
transverse n'a pas pu être observé sur des données réelles - seule la requête
de candidats sans filtre de type l'a été (`/api/entities/search` sans
`entityTypeId`).

### Lot 15 — "Partager ma collection"

Décision produit tranchée par l'utilisateur le 2026-08-20, après avoir été
laissée de côté au Lot 8 : la vue publique montre **titre + jaquette +
édition(s) possédée(s) + progression X/Y**, et les **Tier Lists via un
interrupteur dédié, désactivé par défaut**.

Ce qui n'en sort JAMAIS (voir `CollectionShareDtos`, qui en porte la liste) :
aucun identifiant ni lien profond vers l'app, aucun prix d'achat, aucune
valeur estimée, aucune date, aucune wishlist (elle garde son propre lien).
Le contrôleur public existant portait déjà l'avertissement "à ne jamais
faire évoluer au-delà de ça sans revalider le même raisonnement" - c'est
précisément ce qui a été fait ici, plutôt que d'étendre le partage existant.

Choix de conception notables :

- **Domaine et table séparés** (`collection_share_settings`, V14), jamais
  une colonne de plus sur `wishlist_share_settings` : les deux liens doivent
  pouvoir être révoqués indépendamment. Partager ce qu'on cherche et
  partager ce qu'on possède sont deux décisions différentes.
- **L'interrupteur Tier Lists ne touche pas au jeton** : un lien déjà envoyé
  reste valable, seul son contenu change. En revanche **régénérer** un lien
  repart toujours sans les classements (choix le plus fermé), et un drapeau
  resté à vrai sur une ligne sans jeton n'expose rien (`sharesTierLists()`
  exige d'abord `hasLink()`).
- **Ne montre que ce qui est réellement possédé** (Ownership active), jamais
  le catalogue : une fiche créée puis revendue n'a plus à apparaître.
- **Le total de tomes vient EXCLUSIVEMENT de `MangaEdition`**, jamais de
  l'attribut `totalVolumes` de la Série. Premier jet fait, puis retiré après
  comparaison sur données réelles : le repli sur l'attribut de série faisait
  afficher "3/6" sur la page publique là où la fiche du propriétaire dit, à
  raison, que le total de cette édition est inconnu - la complétude se
  calcule toujours PAR ÉDITION dans cette app.

Bug attrapé uniquement grâce à la vérification sur données réelles :
`Ownership.variantId()` renvoie un `Optional<UUID>`, et `Map.get(Object)`
accepte cet `Optional` comme clé **sans erreur de compilation**, en renvoyant
null pour tout le monde - la vue publique annonçait donc "0 tome possédé"
pour toutes les séries. Corrigé par `flatMap(Optional::stream)`.

Vérifié en direct de bout en bout : génération du lien, contenu public
identique à ce qu'annoncent les fiches, interrupteur Tier Lists dans les deux
sens, absence de barre d'onglets privée et **zéro lien sortant** sur la page
publique, révocation (404 immédiat côté API, message neutre après
rechargement), contraste clair/sombre. Aucun lien de partage n'a été laissé
actif après les tests.

### Lot 16 — Ma collection alignée sur le total d'édition

Incohérence révélée en ajoutant un jeu vidéo à la collection de test : deux
écrans calculaient "X/Y tomes" avec deux règles différentes.

- **Ma collection** (`shelfTiles.ts`) lisait l'attribut `totalVolumes` de la
  **Série**, fourni par MyAnimeList.
- **La fiche, l'assistant et la page publique** lisent le total de
  l'**Édition** (`MangaEdition`).

Sur des données réelles, elles se contredisaient dans les deux sens : *Death
Note* affichait "Black Édition · 1 tome" en collection contre "1/6" sur la
fiche ; *Jujutsu Kaisen* affichait "Ki-oon · 1/30" en collection alors que le
total de l'édition Ki-oon n'est justement pas renseigné.

Alignement demandé par l'utilisateur : Ma collection suit désormais la règle
générale de l'app (la complétude se calcule TOUJOURS par édition, deux
éditions n'ayant pas le même nombre de tomes - voir `CollectionStatus`).
Nouveau `GET /purchase-analysis/editions/all` : une seule requête pour tout
l'écran (le référentiel d'éditions est petit par nature), indexée en
`(entityId + édition) -> total` côté client, plutôt qu'un appel par tuile.

Conséquences assumées, visibles immédiatement : une série dont l'édition n'a
pas de fiche de référence perd son "X/Y" et son signal "Plus que N tomes",
et affiche simplement "N tomes" ; elle sort aussi des filtres
Complètes/Incomplètes (une complétude inconnue n'a jamais correspondu à ces
filtres, voir `matchesCompletionFilter`). C'est le prix de l'honnêteté :
"1/30" pour une édition dont on ne connaît pas le nombre de tomes était une
information inventée. Renseigner l'édition depuis la fiche restaure aussitôt
l'affichage complet.

Piège au passage : `mvn compile` ne compile que les sources principales -
ajouter `findAll()` au port `MangaEditionRepository` casse en réalité les 4
faux dépôts en mémoire des tests, ce que seul `mvn test`/`package` révèle
(la construction de l'image Docker, elle, a bien échoué).

### Lot 17 — types de collection personnalisés, sans source externe

Demande utilisateur : "pouvoir ajouter n'importe quel autre type de
collection (sans API) et l'administrer". Vérification faite d'abord :
**la capacité existait déjà de bout en bout** - création du type depuis
Administration > Types de collection, saisie libre dans Rechercher (voir
`DraftLocationState.candidate: null`), rail dans Ma collection avec le visuel
de repli, classement général dans Tier Lists, fiche fonctionnelle,
suppression du type refusée tant qu'une entité l'utilise (409 explicite).
Testé en créant un type "Vinyles" + un élément, puis en supprimant les deux.

Deux frictions réelles la faisaient passer pour impossible, corrigées :

- **Rechercher lançait une recherche vouée à l'échec.** Pour un type sans
  fournisseur, l'écran interrogeait quand même les sources externes, puis
  affichait "Aucun résultat pour ce titre" et proposait "Scanner un
  code-barres / ISBN" - un échec annoncé là où il n'y a simplement rien à
  chercher, et un scan qui passe par ces mêmes sources. Désormais : aucune
  requête, aucun scan, et une phrase avant la saisie ("Ce type n'a pas de
  source externe : saisis le titre, il sera ajouté tel quel").
- **Le code du type devait être inventé à la main** (VINYLE, BOARD_GAME...)
  alors que l'aide sous le champ promettait "normalisé automatiquement". Il
  est maintenant déduit du label ("Jeux de société rétro" ->
  "JEUX_DE_SOCIETE_RETRO"), et reste modifiable tant qu'on ne l'a pas édité
  soi-même. Le libellé d'aide dit ce qui se passe réellement.

Non-régression vérifiée : un type AVEC fournisseur cherche et scanne comme
avant.

Accès raccourci dans la foulée, sur retour utilisateur ("pas logique de
passer par le profil") : **Ma collection > "Plus d'outils" > "Types de
collection"**, à côté de "Retrouver les jaquettes manquantes". Un type
STRUCTURE cet écran (un rail par type), c'est donc là qu'on se rend compte
qu'il en manque un. L'écran reste atteignable depuis Administration - un
second chemin, pas un déplacement. Le bouton "Plus d'outils" a gagné un
`aria-label` au passage : il n'avait qu'un `title`, jamais annoncé au
toucher.

Reste en friction, non traité : un type personnalisé n'a pas de couleur ni
d'icône propre - il prend le visuel de repli (voir `getEntityTypeVisual`,
FALLBACK), alors que les 4 univers connus ont chacun les leurs.

### Lot 18 — "Informations" : ce qui vient d'une API devient une donnée à soi

Principe posé par l'utilisateur : "quand on insère depuis l'API recherche on
copie en base puis on pourra éditer (ou ajouter directement si pas d'API)".
Jusqu'ici seuls le titre, la jaquette et l'édition étaient rattrapables - le
reste (mangaka, éditeur, plateforme, studio, champs personnalisés du type)
restait figé tel que le fournisseur l'avait renvoyé, et une œuvre d'un type
non-manga n'affichait **aucune** information ("À propos" est propre aux
mangas et vit dans TomesGridSection).

Nouvelle section `EntityInfoSection`, sur la fiche de TOUS les types :
lecture + édition des attributs. Les champs proposés sont l'union des champs
personnalisés DÉCLARÉS par le type (`EntityType.customFieldKeys`, même quand
la valeur est vide - c'est ce qui rend un type sans API réellement
utilisable) et des attributs réellement présents. Aucune clé libre n'est
créée ici : inventer un champ, c'est modifier le TYPE, pas une de ses œuvres.

Trois pièges traités, tous constatés sur des données réelles :

- **Vider un champ ne pouvait pas fonctionner.** La javadoc de
  `Entity.mergeAttributes` interdit explicitement la valeur vide comme moyen
  d'effacer (elle serait stockée telle quelle et ressemblerait ensuite à une
  donnée renseignée). D'où `Entity.removeAttribute` + `DELETE
  /entities/{id}/attributes/{key}`, opération à part entière.
- **Le formulaire écrivait tout en texte.** `totalVolumes` est lu avec un
  `typeof === 'number'` strict (voir `lib/seriesInfo`) : enregistrer "48"
  aurait fait disparaître la progression X/Y sans le moindre message. Le
  type de la valeur existante est désormais conservé - vérifié :
  `averageDurationHours` enregistré en nombre, `igdbId` resté une chaîne
  (plusieurs lecteurs testent `typeof === 'string'` dessus).
- **`seriesStatus` n'est pas du texte libre** : seuls
  `finished`/`publishing`/`currently_publishing` sont compris. Y écrire
  "Terminée" ferait disparaître la ligne "Statut" de "À propos". Rangé avec
  les champs techniques (identifiants externes, titres alternatifs, type de
  média) - repliés par défaut, modifiables quand même : ce sont des rouages,
  pas le visage de la fiche.

Non traité : le numéro d'un tome reste non modifiable (sa jaquette et son
édition le sont déjà, voir VolumeInteractionPanel).

### Lot 19 — administration des éditions de référence

Les fiches `MangaEdition` se créaient uniquement en contexte (fiche Série >
"Modifier l'édition", ou "Évaluer un achat") et n'étaient visibles **nulle
part** ensuite : une édition mal nommée, créée par erreur ou par un test,
restait en base sans moyen de la voir ni de l'enlever - tout en continuant à
compter, puisque c'est ce référentiel qui fournit le total de tomes affiché
par Ma collection et la fiche (Lot 16).

Nouvel écran `/editions` (Administration > "Éditions de référence") :
lecture groupée par série + suppression. Volontairement PAS un formulaire de
création/correction de plus - renseigner reste là où l'information manque
concrètement, sur la fiche de la série. Nouveau `DELETE
/purchase-analysis/editions/{id}`, **refusé (409) tant qu'un tome y est
rattaché** (`Variant.mangaEditionId`), jamais un déliage silencieux - même
parti pris que la suppression d'un EntityType.

Utilité immédiate confirmée : l'écran a révélé une ligne fantôme
("Death Note Test AI 1786613083134 / Edition Inconnue Test"), résidu des
tests de la Phase 2 IA, invisible jusque-là. Supprimée. Une seconde ligne de
test ("Raw Hero / Perfect Edition (test)") a été laissée à l'utilisateur -
elle est rattachée à une vraie série, à lui de trancher.

**Défaut de contraste attrapé au passage, plus large que cet écran** : les
CINQ usages de `bg-danger` de l'app portaient une encre fautive dans au
moins un thème - `text-white` (3.29:1 en sombre) ou `text-textPrimary`
(2.29:1 en clair). Le balayage du Lot 12 les avait manqués parce que ces
états ne sont jamais rendus au repos : confirmations de suppression et badge
"À éviter" d'un verdict d'achat. Nouveau token `--color-dangerInk` (blanc en
clair, encre foncée en sombre), appliqué aux cinq - 7.21:1 et 5.67:1
mesurés. À retenir pour tout futur audit : balayer aussi les états qui
demandent un clic pour exister.

### Lot 20 — "L'œuvre" : séparer ce qu'on possède de ce que la chose EST

Retour utilisateur : "compliqué de faire la différence entre notre possession
et les metadatas du truc". Constat sur la fiche de Death Note : **deux blocs
de métadonnées** qui ne disaient pas d'où ils venaient - "À propos" (données
de l'ÉDITION, source MangaEdition, qui vivait dans TomesGridSection) et
"Informations" (données de la SÉRIE, source entity.attributes, ajouté au Lot
18 sans fusionner). Le nombre de tomes y apparaissait une troisième fois, le
hero l'affichant déjà deux fois.

Un seul bloc **"L'œuvre"**, deux sous-groupes explicitement nommés :

- **SÉRIE** - ce qui reste vrai quelle que soit l'édition possédée : statut
  (forme lisible "Terminée", la valeur brute restant modifiable parmi les
  champs techniques), mangaka, année, champs personnalisés du type.
- **ÉDITION « X »** - ce qui ne vaut que pour l'édition affichée : "Éditeur
  de cette édition", épuisement, meilleure édition annoncée. Nommé avec
  l'édition elle-même, sinon "Éditeur : Kana" ressemble à une propriété de la
  série alors qu'une autre édition a un autre éditeur - et le libellé est
  qualifié parce qu'un attribut `publisher` de SÉRIE existe aussi, avec un
  autre sens (revue de prépublication japonaise pour un candidat Jikan).

Tout le reste de la fiche est désormais, sans ambiguïté, ce que l'utilisateur
POSSÈDE : progression, "Mes tomes", "Mes classements", l'état de chaque
exemplaire dans le tiroir d'un tome.

Le nombre de tomes ne figure plus dans le bloc (le hero l'annonce deux fois),
et l'édition ne gagne PAS un second bouton de correction : celui du hero,
accroché au nom de l'édition, reste l'unique entrée vers ce formulaire.

Piège rencontré : le `useQuery` ajouté pour lire la fiche d'édition avait
d'abord été posé APRÈS les retours anticipés de la page - violation des
règles des Hooks, visible seulement à l'exécution ("Rendered fewer hooks than
expected"), jamais au typecheck. Tout ce dont il dépend est calculable avant,
au prix d'un `entity` qui tolère null jusqu'à la garde.

### Lot 21 — corriger le numéro d'un tome

Dernier attribut de la collection qui restait figé : la jaquette et l'édition
d'un tome étaient rattrapables, pas son numéro - pourtant la donnée la plus
facile à se tromper (tome ajouté à la main, ou numéro déduit par regex du
titre d'un scan, voir ScanPage).

**Pas** une simple fusion d'attributs : `QuickAddService` déduplique les tomes
par LIBELLÉ exact ("Tome 3 — Black Édition", voir `findVariantByLabel`).
Changer `volumeNumber` sans le libellé aurait fait re-créer un doublon au
prochain ajout du même tome, et le libellé aurait menti entre-temps. D'où :

- `Entity.renumberVariant(variantId, n)` - change le numéro ET le libellé d'un
  seul geste, refuse un numéro déjà pris **dans la même édition** (deux
  éditions ont chacune leur tome 4, ce n'est pas un conflit) et un numéro
  inférieur à 1.
- Convention de libellé extraite dans `VariantLabels`, partagée avec
  QuickAddService : deux endroits qui la calculeraient finiraient par diverger.
- `PATCH /entities/{id}/variants/{variantId}/volume-number`, 409 sur conflit.
- `VariantNumberEditor` dans le tiroir du tome, à côté de la correction de
  jaquette. Le tiroir SUIT le tome renuméroté (il change de place dans la
  grille) plutôt que de rester ouvert sur un numéro qui n'existe plus.

Effet de bord découvert en testant : la grille ne dessinait que 1..total de
l'édition, donc un tome renuméroté au-delà (7 dans une édition de 6)
disparaissait de l'écran - donnée invisible ET irrécupérable. `buildTiles`
affiche désormais à la suite les tomes réellement catalogués/possédés
au-delà du total. Le cas existait déjà sans le renumérotage (ajout manuel
avec un numéro trop grand), et un total d'édition peut lui-même être faux :
mieux vaut montrer la contradiction que la cacher.

### Lot 22 — couleur et icône d'un type de collection

Un type créé par l'utilisateur prenait le visuel de repli (terracotta + icône
bibliothèque) alors que les 4 univers livrés ont chacun le leur. Migration
**V15** additive : `entity_type` gagne `color_key` et `icon_key`, NULL =
visuel par défaut.

**Des CLÉS, jamais des valeurs de rendu** ("violet"/"disc", jamais
"#a48fd1") : seul le client sait traduire une clé, et lui seul sait l'adapter
au thème. Stocker un code couleur en base figerait une teinte calibrée pour
un seul des deux thèmes. Le backend ne valide donc que la FORME (un slug
court) et laisse le client retomber sur son défaut pour une clé inconnue -
il n'a aucune raison de connaître le jeu d'icônes d'un client.

**Palette fermée de 8 teintes, pas un sélecteur libre** : une couleur
d'univers sert aussi de TEXTE ("Tout voir" d'une ligne de Ma collection,
titre de la page catégorie). Chaque teinte est calibrée comme les 4
existantes - au moins 4.5:1 sur les TROIS fonds de son thème - et les 4
premières clés réutilisent exactement les tokens des univers livrés plutôt
que d'introduire un second terracotta légèrement différent. Une teinte
choisie à l'œil serait illisible dans un thème sur deux : c'est précisément
ce que le Lot 12 a eu à corriger. Même logique pour les icônes : 12 choix,
fermés parce qu'une icône est un composant importé, pas une chaîne.

`EntityType` gagne deux composants de record - avec un **constructeur
auxiliaire** à l'ancienne signature, si bien qu'aucun appelant existant
(tests compris) n'a eu à changer.

Vérifié en direct : type "Vinyles" créé en violet + icône disque, titre de sa
page catégorie rendu en `#a48fd1` (la variante SOMBRE du violet, donc
thème-réactive), puis type supprimé - collection revenue à ses 3 types.

### Lot 23 — format de jaquette d'un type

Troisième attribut visuel après la couleur et l'icône (Lot 22), même patron :
migration **V16** additive (`entity_type.aspect_key`, NULL = format par
défaut), une CLÉ en base ("carre") et jamais une valeur de rendu
("aspect-square") - le vocabulaire de classes d'un client n'a rien à faire
dans le domaine.

Quatre formats : Portrait (2/3, livres/mangas), Boîtier (3/4, jeux vidéo),
Carré (1/1, vinyles/jeux de société), Paysage (16/9). Fermé pour une raison
technique en plus des raisons d'usage : une classe Tailwind construite
dynamiquement (`aspect-[${ratio}]`) n'existerait tout simplement pas dans le
CSS produit, seul un littéral écrit dans le source est extrait. Le sélecteur
montre la FORME réelle plutôt que le nom seul - "3/4" ne dit rien tant qu'on
ne l'a pas vu à côté d'un carré.

`EntityType` gagne un troisième composant, avec un constructeur auxiliaire de
plus (celui d'avant le format) : là encore aucun appelant existant n'a bougé.

Vérifié en direct : type "Vinyles" en violet/disque/carré, un élément ajouté,
tuile rendue en `aspect-square` dans Ma collection quand celle d'un manga
reste en `aspect-[2/3]` - puis élément et type supprimés.

Piège de séance à noter : le fichier de migration V16 avait d'abord été créé
dans une commande chaînée après un script qui a échoué (`&&`), donc jamais
écrit - Flyway annonçait tranquillement "15 migrations, schéma à jour" et la
colonne manquait. Toujours vérifier la ligne "Successfully applied" après un
ajout de migration, pas seulement l'absence d'erreur.

### Lot 24 — audit transversal

Balayage complet demandé après les lots 16-23. Méthode : 18 routes en 1280px
et en 375px, sondes sur `error`/`unhandledrejection`/`fetch` non-ok,
détection de débordement horizontal (`scrollWidth` vs `clientWidth`, voir la
note de calibrage du Lot 10), contraste WCAG sur les écrans récents dans les
deux thèmes, requêtes de cohérence sur les données réelles, logs backend,
build de production.

**Propre** : aucune erreur d'exécution, aucune requête en échec, aucun
débordement horizontal, aucun écran vide, aucun WARN/ERROR backend, build de
production OK, 368 tests verts.

**Trois défauts d'accessibilité trouvés et corrigés** - tous des états que le
balayage de contraste du Lot 12 ne pouvait pas voir, puisqu'il ne regardait
que les couleurs :

- `/types` : le bouton de suppression d'un type est une icône seule, sans
  nom accessible - un lecteur d'écran annonçait "bouton" tout court.
- `/types/new` : les deux champs des ChipListField n'avaient qu'un
  placeholder, jamais un libellé (un placeholder n'en fait pas office). Le
  titre de section leur sert désormais de libellé via `aria-labelledby`, avec
  un identifiant dérivé du titre puisque deux de ces champs coexistent.
- `/recap` : le sélecteur d'année, un `<select>` nu.

**Cohérence des données** : aucune édition orpheline, aucune fiche d'édition
sans tome, aucun numéro de tome en double ou manquant, aucune possession
pointant un tome inexistant. Un seul point signalé, connu : les tomes de Raw
Hero sont répartis sur deux éditions ("Soleil" et "Perfect Edition (test)",
résidu de test), ce qui empêche l'affichage de sa progression - décision
laissée à l'utilisateur.

**Surface morte confirmée** : `/loans` reste sans aucun lien entrant (décision
du Lot 8, code conservé) et `GET /api/wishlist/lookup` n'a toujours aucun
appelant web. Deux constats déjà documentés, inchangés.

### Lot 25 — vérification exhaustive de l'app

Demande : "vérifie toute l'app". Balayage complet, pas un contrôle par
sondage : 67 endpoints backend énumérés depuis l'OpenAPI, 25 routes web x 2
thèmes, les 7 dialogues, les 2 pages publiques, le viewport mobile.

**Backend** — tous les GET sûrs répondent 200. Les trois 400 initiaux
(`/insights/discover`, `/loans`, `/wishlist/lookup`) venaient de paramètres
requis omis par le test, pas de l'API : rejoués corrects, ils répondent 200.
Les deux endpoints publics renvoient bien un 404 nu sur jeton inconnu (pas de
message qui distinguerait "jeton révoqué" de "jeton inexistant").

**Écran entièrement blanc sur la fiche d'une œuvre introuvable.** Le défaut le
plus sérieux de ce lot, et le plus discret : ni chargement, ni erreur, rien.
Cause : TanStack Query **met en pause** toute requête quand il croit le
navigateur hors ligne (`fetchStatus: 'paused'`). La requête reste alors
`pending` sans jamais aboutir, et `isLoading` vaut `false` - car
`isLoading = isPending && isFetching`. Tous les écrans tombaient donc dans
leur garde "pas encore de données" et n'affichaient plus rien. Deux
corrections, à deux niveaux :
- `networkMode: 'always'` par défaut sur le `QueryClient` (main.tsx) : le
  signal `navigator.onLine` est peu fiable (il ment dès qu'une interface
  réseau existe) et sans objet ici, l'API étant jointe en local. Sans pause,
  une requête échoue franchement, remonte en `isError`, et les `ErrorBanner`
  déjà en place font leur travail - sur toute l'app d'un coup.
- `isPending` au lieu de `isLoading` sur la garde de chargement de la fiche :
  `isLoading` retombe aussi à `false` dans les creux entre deux tentatives
  (temporisation exponentielle), même en ligne.

**Piège de vérification** : les *retries* restent en pause tant que la fenêtre
n'a pas le focus (`focusManager`), ce qui est le cas d'un panneau navigateur
masqué. Le chemin d'erreur ne peut donc pas s'observer tel quel dans cet
environnement - il a fallu forcer `retry: 0` à l'exécution sur le
`QueryClient` (atteint via l'arbre de fibres React) pour voir la bannière.

**"Not Found" affiché en anglais** dans une interface entièrement française.
Le repli du client HTTP lisait `body.error`... or l'enveloppe générique de
Spring porte **elle aussi** un champ `error`, qui n'y contient pas un message
mais la phrase de statut HTTP. On la reconnaît maintenant à sa forme
(`timestamp` + `status`) pour retomber sur un message traduit par statut, tout
en préservant les vrais messages du domaine (`{"error": "Un type avec le code
MANGA existe déjà"}`, sans enveloppe) qui, eux, doivent s'afficher tels quels.

**Contrastes** — le Lot 12 avait balayé l'historique d'analyses **vide**, donc
sans ses badges. Deux vrais échecs y dormaient : "Prix correct" à **1.21:1**
et "Cher" à **2.26:1**. Ils venaient du jeton hérité `pink`, non theme-aware,
qui servait aussi à `ErrorBanner` - **2.34:1 en thème clair, soit le composant
qui affiche les erreurs, illisible**. Nouveau jeton `warningInk` (texte posé
SUR un fond `warning`, même rôle que `accentInk`/`dangerInk`), et bascule de
`pink` vers la famille `danger` pour `ErrorBanner`, `AddDraftPage` (x2) et le
survol de `EntityTypesPage`.

**Jeton `faint` recalibré une seconde fois**, dans les deux thèmes
(`#978b80` -> `#9e9288` en sombre, `#746963` -> `#6c625c` en clair) : il avait
été calibré sur les trois fonds neutres (background/surface/surface2), mais il
en existe un **quatrième**, les en-têtes de rayon teintés par l'univers, où
les compteurs d'œuvres retombaient à 4.21-4.44:1.

**L'auditeur de contraste lui-même était faux** sur un point : il lisait
`backgroundColor` et ignorait `background-image`, donc tout **dégradé**. La
carte de récap exportable (texte blanc sur dégradé sombre en ligne) remontait
ainsi 4 faux positifs à 1.08:1. Corrigé en résolvant tous les arrêts du
dégradé et en gardant le pire cas ; le Lot 12 gagnerait à être relu avec cette
version-là - c'est fait ici, les 25 routes ont été rejouées dans les deux
thèmes avec l'auditeur corrigé.

**Résultat final** : 25 routes x 2 thèmes sans aucun échec de contraste, aucun
débordement horizontal à 375px, les 7 dialogues nommés et pilotables au
clavier (`useModalA11y` : Escape, piège de focus, focus rendu au déclencheur -
vérifié en direct sur Filtres et le hub "Plus d'outils"), et les deux pages
publiques correctes (contenu réel, progressions justes, aucune navigation
privée exposée). Les liens de partage créés pour ce test ont été révoqués.

### Lot 26 — vérification des écritures

Le Lot 25 n'avait vérifié que le rendu et les lectures. Ce lot exerce les 46
endpoints d'écriture par un aller-retour complet (créer → modifier →
supprimer) mené dans un **type de collection dédié**, avec comparaison des
compteurs avant/après pour prouver qu'il ne reste rien.

**Un 500 trouvé** : `DELETE /purchase-analysis/editions/{id}` ne comptait que
les tomes rattachés, jamais les observations de prix. La contrainte de clé
étrangère de Postgres restait donc seule à protéger la table et remontait une
`DataIntegrityViolationException` en 500, trace SQL comprise, là où un 409
explicite était prévu juste à côté pour les tomes. `deleteEdition` renvoie
maintenant un `EditionDeletionBlockers(linkedVolumes, linkedObservations)` et
le contrôleur compose la phrase ("1 observation(s) de prix s'y réfèrent
encore"). Deux tests d'intégration couvrent le refus et le cas passant.

**Les refus n'arrivaient jamais à l'écran.** Les contrôleurs écrivent des
messages destinés à être lus ("Impossible de supprimer cette édition : 3
tome(s) y sont encore rattachés"), mais Spring ne transmet le message d'une
`ResponseStatusException` que si `server.error.include-message` est réglé - ce
qui n'était pas le cas. Le client ne recevait que la phrase de statut et
affichait "Conflict". Réglé à `always` (application personnelle
auto-hébergée), avec une nuance côté client : le message serveur est affiché
sauf en **404**, où il ne fait que nommer un identifiant absent ("Entity
introuvable : 3f2a…") - là, le repli traduit dit la seule chose utile.

**Verrou de suppression, par conception** : une œuvre ajoutée avec un nom
d'édition voit une fiche d'édition catalogue créée automatiquement ; l'œuvre
est alors bloquée par son édition, et l'édition par ses tomes. La sortie
existe et est cohérente - supprimer le tome libère les deux (l'édition
disparaît avec son dernier tome) - mais elle n'est pas devinable depuis la
fiche. À garder en tête si un jour la suppression doit être rendue plus
directe. Rappel du même invariant, confirmé ici : `experience` et `loan`
n'ont aucun endpoint de suppression, donc une œuvre qui a connu une lecture
ou un prêt est définitivement indélébile (choix documenté dans
`DeleteEntitySection`).

**Non exercé volontairement** : `POST /purchase-analysis/analyze` (consomme le
quota Gemini et écrit un historique qu'aucun endpoint ne sait supprimer) et
`POST /metadata/bgg/import` (appel réseau externe). `POST
/purchase-analysis/market-observations` existe côté client
(`recordMarketObservation`) mais n'a **aucun appelant dans l'interface** -
troisième surface morte connue, après `/loans` et `/wishlist/lookup`.

**Reste vert** : 368 tests backend + les 2 nouveaux, `tsc -b`, `oxlint`, le
build de production, et aucune erreur console / requête en échec / rejet non
géré sur les 26 routes balayées.

**Trace laissée par la vérification** : les données de test ont dû être
retirées en SQL direct (transaction unique), l'invariant "rien ne disparaît
silencieusement" rendant impossible leur suppression par l'API une fois une
expérience et un prêt créés. Compteurs vérifiés après coup : 3 types, 6
œuvres, 0 prêt, 0 observation - l'état d'avant.

### Lot 27 — surfaces mortes et impasses fonctionnelles

Les Lots 24-26 ont balayé le rendu, les lectures puis les écritures, toujours
depuis l'interface. Ce lot part de l'autre bout : les **fonctions client sans
appelant**. Sur les 13 trouvées, la moitié ne sont pas du code mort mais des
fonctionnalités dont le point d'entrée a disparu au fil de la refonte V1.2 -
un endpoint livré, testé, documenté, et plus rien pour l'appeler.

**Une envie d'amélioration ne pouvait plus être créée.** `/edition-upgrades`
liste et supprime, Profil y renvoie, mais `createEditionUpgradeWish` n'avait
aucun appelant : le point d'entrée vivait sur `SeriesCompletenessSection`,
supprimée au Lot 5. L'écran ne pouvait donc plus qu'annoncer "Aucune envie
d'amélioration pour le moment", définitivement. Nouveau
`EditionUpgradeWishToggle.tsx`, posé dans `EditionProgressSection` juste après
les avertissements "Cette édition est épuisée" / "Nouvelle édition annoncée" -
c'est précisément là que l'envie se forme, et elle porte sur l'édition active,
dont le nom est le premier champ de la requête. Absent tant qu'aucune édition
n'est nommée : vouloir remplacer "l'édition non précisée" n'a pas de sens.

**Un exemplaire vendu ou perdu n'apparaissait nulle part.** Le défaut repéré en
lisant `OwnershipDetails` était que le statut n'était jamais rendu ; en
vérifiant en direct, c'était pire - `VolumeInteractionPanel` filtrait
`status === 'OWNED'` avant même de passer la liste. "Marquer vendu" faisait
donc **disparaître la copie sans laisser la moindre trace**, indiscernable
d'une suppression, alors que l'app oppose explicitement les deux (voir
`DeleteEntitySection` : "contrairement à Marquer vendu/perdu, cette action est
irréversible") et que `OwnershipDetails` documentait l'inverse de ce qu'il
faisait ("un exemplaire vendu/perdu reste affiché ici, pas filtré"). Le filtre
saute, chaque ligne porte sa pastille de statut, et un tome dont il ne reste
que des exemplaires passés affiche le formulaire d'ajout (on peut le racheter)
**puis** son historique sous "Exemplaires passés".

Deux autres actions manquaient sur la même ligne : `POST /ownerships/{id}/lose`
("Marquer perdu", livré depuis le début, jamais exposé - on pouvait vendre,
jamais perdre) et `PATCH /ownerships/{id}/note`. Au passage, l'entrée de menu
"Modifier ma copie" n'ouvrait en réalité que la saisie du prix : scindée en
"Modifier le prix payé" et "Ajouter/Modifier ma note", chacune faisant ce que
son libellé annonce. `updateNote` accepte désormais `null` (et l'envoie quand
le champ est vidé) plutôt qu'une chaîne vide, que le domaine stockerait telle
quelle - "pas de note" doit rester un seul état.

**Une œuvre ajoutée à une Tier List ne pouvait plus en sortir.**
`removeTierListItem` (`DELETE /tier-lists/{id}/items/{entityId}`) n'avait aucun
appelant ; "Retirer le classement" appelle `setTierListItemRank(null)`, qui
déclasse sans retirer. Un ajout par erreur depuis `AddTierListItemsPanel`
n'avait d'autre issue que de supprimer la liste entière. "Retirer de cette
Tier List" ajouté au `TierPicker`, passé **uniquement** par le board
personnalisé : sur le classement général, l'appartenance est implicite (toute
œuvre possédée est candidate), il n'y a rien dont on puisse la retirer. Même
raisonnement pour `updateTierList` : une faute de frappe dans le nom d'une
liste était définitive, "Renommer" rejoint le menu "...".

**Aucun garde-fou anti-doublon sur les types personnalisés.** `SearchPage`
branchait la recherche LOCALE sur le même drapeau que la recherche externe
(`hasMetadataProvider`), donc le bloc "Déjà dans ta collection" - ajouté en
`13405a9` précisément pour éviter les doublons - ne s'affichait jamais sur un
type créé à la main, c'est-à-dire le seul cas où aucune déduplication externe
ne rattrape derrière. La recherche locale est gratuite et ne dépend d'aucun
fournisseur : drapeau séparé. Le bouton "Ajouter « X »" passe en outre **après**
ce bloc - le placer avant revenait à proposer de créer le doublon avant
d'avoir montré qu'il existe.

**Relever un prix de marché n'était possible par aucun geste.**
`SeriesBreakdownItem` affiche "Prix observé sur N annonces", mais rien dans
l'app ne savait écrire dans ce journal : la branche `OBSERVED_MARKET` du moteur
était inatteignable en usage normal. Un bouton "Relever ce prix comme
observation de marché" apparaît maintenant sur chaque lot analysé dont
l'édition est reconnue. Deux précautions : rien n'est relevé automatiquement
(un prix d'annonce ne devient une donnée de marché que sur décision explicite,
même principe que le garde-fou sur les données IA), et le bouton **n'apparaît
pas si les tomes du lot ne sont pas contigus** - `MarketPriceCalculator` divise
le prix relevé par le nombre de tomes de l'intervalle, donc un lot "1, 2, 5"
enregistré en 1-5 donnerait un prix/tome faux. `observedAt` vient de la date de
l'analyse, pas du jour : depuis l'historique, le prix relevé est celui du jour
où l'annonce a été vue.

**Code réellement mort, supprimé** : `listEntitiesByType` (remplacé par
`searchEntities`), `listLoansForOwnership` (remplacé par `listActiveLoans`),
`searchEditionsForSeries`, et les clés de requête devenues sans objet.
`getPreferences`/`updatePreferences` supprimés eux aussi, mais c'est une
**décision, pas un nettoyage** : les `CollectorPreferences` pilotent le moteur
de négociation et ne sont éditables nulle part, donc l'analyse d'achat tourne
depuis toujours sur les valeurs par défaut de la spécification. Les endpoints
restent (Swagger, iOS) ; y donner accès est une fonctionnalité à part entière,
pas un correctif, et n'est pas faite ici.

**Un 500 devenu 400.** Un identifiant absent du corps d'une requête arrive
jusqu'à Spring Data, qui refuse un `findById(null)` : l'`IllegalArgumentException`
levée est enveloppée dans une `InvalidDataAccessApiUsageException`, que le
handler d'`IllegalArgumentException` d'`ApiExceptionHandler` ne voit pas. `POST
/api/entities/quick-add` sans `entityTypeId` répondait donc 500 avec la trace,
pour un corps simplement incomplet. Handler dédié, message générique côté
client (la phrase de Spring est en anglais et parle de l'API JPA, pas de la
requête HTTP) et détail en WARN dans les logs, car cette exception peut aussi
trahir un vrai défaut serveur qu'un 400 muet rendrait invisible. Le balayage
complet "corps de requête invalide" sur les 46 écritures reste à faire - aucune
validation déclarative n'existe dans le backend
(`spring-boot-starter-validation` n'est pas au `pom.xml`, pas un seul `@Valid`).

**L'application n'a aucune authentification, et le compose Synology la publie
sur Internet.** Le README assume l'absence d'authentification comme "cohérente
avec le choix mono-utilisateur, à ajouter si l'app doit un jour être exposée
au-delà du réseau local" - or `docker-compose.synology.yml` fait exactement
cela (Traefik + Let's Encrypt sur deux sous-domaines). Sans garde-fou, qui
connaît l'hôte peut lire ET écrire toute la collection (`GET /api/export/json`,
`DELETE /api/entities/{id}`), Swagger UI comprise ; CORS n'y change rien,
`allowedOrigins` n'étant vérifié que par un navigateur, jamais par `curl`. Cela
vidait aussi de son sens tout le raisonnement "capability URL" des deux
contrôleurs publics.

Authentification HTTP Basic portée par **le proxy, pas par l'application** :
une SPA ne peut pas garder un secret (tout jeton embarqué dans le bundle est
lisible par qui charge la page), alors que Basic est géré nativement par le
navigateur et se retransmet seul aux appels `/api` same-origin proxifiés par
nginx. Deux routeurs par service, le public prioritaire : `/public/*` (les deux
écrans partagés), `/assets/*` (le bundle, sans lequel ces écrans sont blancs,
et qui ne contient aucune donnée) et `/api/public/*` restent hors
authentification - c'est toute leur raison d'être. `BASIC_AUTH_USERS` documenté
dans `.env.example`.

**Le fichier était de toute façon inchargeable.** En le validant pour la
première fois (`docker compose -f docker-compose.synology.yml config`), erreur
YAML pré-existante : `WEB_ALLOWED_ORIGINS: ${...:?erreur - ... (ex: https://...)}`
contient un `": "` dans un scalaire nu, que YAML lit comme une imbrication. Tout
le fichier était invalide, donc le déploiement Synology tel que livré n'aurait
pas démarré. Guillemets ajoutés, fichier validé.

**Vérification** : les quatre correctifs d'interface exercés en direct sur des
données jetables (type, série, tome, liste, envie), avec retour à l'état exact
d'avant - 3 types, 6 œuvres, 9 possessions, 6 éditions, 0 observation, 0 liste,
0 envie. "Marquer perdu" testé pour de vrai (irréversible : aucun endpoint ne
défait un statut) sur un exemplaire jetable, jamais sur les données réelles.
L'endpoint d'observation de marché exercé avec le payload exact du bouton :
201, puis 20 € sur les tomes 1-3 correctement relus en 6.67 €/tome et
`costToCompleteBasis` basculé en `OBSERVED_MARKET` - la ligne retirée ensuite
en SQL direct, aucun endpoint ne sachant supprimer une observation. Le **rendu**
du bouton n'a pas été vu en direct : aucune analyse de l'historique n'a
d'édition reconnue, et en produire une écrirait un historique indélébile en
consommant du quota Gemini. **Levé au Lot 30**, dont la vérification produit
une telle analyse sans appeler l'IA. Contrastes des nouveaux éléments mesurés dans les
deux thèmes (7.4 à 16.3:1). Reste vert : 370 tests backend, `tsc -b`, `oxlint`,
build de production, et sur 17 routes aucune erreur console, aucune requête en
échec, aucun débordement horizontal.

**Sept répertoires vides** supprimés dans `backend/src` (`api/{dto,error}`,
`domain/{shared,catalog,...}`...), restes d'une expansion d'accolades jamais
faite par un shell Windows. Non suivis par git, donc invisibles en revue.

**Trouvé, non corrigé ici** : les tuiles des boards Tier List sont des
`<button>` dont le seul nom accessible vient d'un `title` (leur contenu est une
`<img alt="">`) - le dernier recours de l'algorithme accname, là où les tuiles
de Ma collection, elles, portent leur titre en texte. Pas un échec franc, mais
la forme la plus fragile ; à revoir avec le reste des surfaces purement
visuelles plutôt qu'isolément. **Fait au Lot 29**, avec le balayage complet
qu'il appelait.

### Lot 28 — corps de requête invalides

Le Lot 26 avait exercé les 46 écritures en cas passant, le Lot 27 en avait
corrigé un cas isolé. Ce lot les reprend toutes **avec des corps invalides** :
champs absents, identifiants inexistants, types erronés, UUID malformés, corps
totalement absent. Attendu partout : un 400 ou un 404 lisible. Trouvé : quatre
500, dont deux qui recrachaient la requête SQL et le nom d'une contrainte
Postgres.

Endpoints énumérés depuis l'OpenAPI de l'app (`/v3/api-docs`) plutôt qu'à la
main - 46, le même total qu'au Lot 26. Exercés depuis un **type de collection
dédié** avec ses propres œuvre, tome, possession, édition et Tier List, pour
que les endpoints exigeant un identifiant existant soient réellement atteints
sans toucher aux vraies données.

**Deux NullPointerException.** `POST /relationships` sans corps utile
déréférençait `sourceEntityId` dans le constructeur compact du record
(`Cannot invoke "java.util.UUID.equals(Object)"`), et `POST
/tier-lists/{id}/items` itérait sur un `entityIds` nul (`Cannot invoke
"java.util.List.iterator()"`). Gardes ajoutées, dans le domaine pour la
première (c'est un invariant de `Relationship` : une relation sans extrémité
n'existe pas), dans le contrôleur pour la seconde (c'est la forme de la
requête, pas une règle métier).

**Deux contraintes de clé étrangère laissées seules en défense.** `POST
/wishlist` et `POST /relationships` avec un identifiant d'œuvre inexistant
mais bien formé descendaient jusqu'à Postgres, dont la violation remontait en
500 avec l'`insert into ...` complet et le nom de la contrainte. Exactement le
motif corrigé au Lot 26 pour la suppression d'édition, et exactement ce que
`EditionUpgradeWishController` - qui référence lui aussi une Entity - fait
correctement depuis toujours : vérifier avant d'écrire. Les deux contrôleurs
s'alignent dessus.

**Une œuvre inconnue ajoutée à une Tier List était ignorée en silence.**
`addItems` faisait `entityRepository.findById(entityId).ifPresent(...)` :
l'appelant recevait un 201 et une liste inchangée, en croyant avoir ajouté
quelque chose. Désormais un 400 nommant l'identifiant. La distinction est
volontaire : une œuvre **déjà présente** reste passée sous silence (idempotence
assumée, la rajouter n'est pas une erreur), une œuvre **inconnue** est un défaut
d'appel. Sans effet sur l'interface, qui n'envoie que des œuvres de la
collection et désactive déjà son bouton sur une sélection vide.

**Un refus incohérent.** `POST /experiences` répondait 404 pour une œuvre
inconnue, là où `/loans`, `/wishlist`, `/edition-upgrade-wishes` et
`/tier-lists/general` répondent 400 - l'endpoint existe, c'est le corps envoyé
qui référence une œuvre absente. Le 404 avait de plus un effet de bord côté
client, qui remplace tout message de 404 par un repli traduit (voir Lot 26) :
la raison réelle n'arrivait jamais à l'écran. Aligné sur 400.

**Ce qui allait déjà bien** : UUID malformé dans le chemin (400 "Invalid UUID
string", via le handler d'`IllegalArgumentException`), type erroné dans le
corps (400 "JSON parse error"), corps absent là où il est requis (400
"Required request body is missing"), et les quatre endpoints que le Lot 27
avait déjà couverts par le handler d'`InvalidDataAccessApiUsageException`
(`quick-add`, `experiences`, `loans`, `edition-upgrade-wishes`).

**Sept réponses 2xx sur corps vide, vérifiées et légitimes** : les `PATCH` de
fusion (`/entities/{id}`, `/entities/{id}/variants/{vid}`,
`/purchase-analysis/editions/{id}`, `/tier-lists/{id}`) sont des no-op quand
tout est absent - vérifié explicitement sur une édition renseignée
(éditeur/nb de tomes/prix intacts après un `PATCH {}`), ils ne remettent rien
à zéro. `/ownerships/{id}/note` et `/purchase-analysis/{id}/purchase-price`
effacent, ce qui est leur contrat documenté (`null` efface). `PUT
/tier-lists/general/entities/{id}` déclasse, également documenté.

**Non corrigé, décidé** : `POST /tags` avec `{"label": 42}` crée un tag "42",
Jackson convertissant le nombre en chaîne. Le corriger demanderait de durcir la
configuration de désérialisation pour toute l'API afin d'empêcher un utilisateur
unique de nommer un tag avec un nombre - hors de proportion.

**Trouvé au passage** : il n'existe **aucun endpoint de suppression pour les
tags** (`POST /api/tags` et les rattachements à une œuvre, rien d'autre). Un tag
créé par erreur est définitivement dans la base - le tag de test de ce lot a dû
partir en SQL direct. Quatrième objet indélébile connu, après `experience`,
`loan` et `purchase_analysis`.

**Vérification** : les deux passes rejouées après reconstruction de l'image,
zéro 500 sur les 46 écritures. 378 tests backend (+8 : `RelationshipTest` et
`WishlistEntryTest`, tous deux nouveaux - les deux gardes de domaine n'avaient
aucune couverture). Bac à sable démonté, chaque compteur de table revenu à
l'identique (6 œuvres, 13 tomes, 9 possessions, 3 types, 0 tag, 2 expériences,
6 éditions, 0 observation), préférences et réglage de partage inchangés au
diff près. 11 routes rejouées côté web sans erreur console ni débordement.

### Lot 29 — surfaces purement visuelles

Le Lot 27 avait laissé un seul point ouvert : les tuiles des boards Tier List,
dont le nom accessible ne venait que d'un `title`, « à revoir avec le reste des
surfaces purement visuelles plutôt qu'isolément ». Ce lot fait ce balayage-là,
sur **25 routes** - les 18 publiques plus les 7 à paramètre (fiche, board,
rayon, édition d'un type, détail d'analyse) et les surfaces qui n'existent
qu'ouvertes (dialogues, panneaux).

**L'arbre d'accessibilité du navigateur ne suffisait pas.** Interrogé
directement, il présente sans nom des boutons qui en ont un parfaitement
(les tuiles de Ma collection portent leur titre en texte, dans des `<span>`
imbriqués). S'y fier aurait produit une liste de faux positifs. Le balayage
calcule donc son propre nom accessible, dans l'ordre de l'algorithme accname :
`aria-label`, `aria-labelledby`, `<label for>`, `<label>` englobant, contenu
textuel, `alt` d'une image contenue, puis `title` et `placeholder` - ces deux
derniers signalés à part, car ce sont des recours de dernier rang, pas des
libellés.

**L'auditeur s'est trompé lui-même, une fois.** Sa première version ne
connaissait que `label[for=id]` et pas le `<label>` englobant : quatre cases à
cocher (trois dans Paramètres, une dans Évaluer un achat) sont remontées comme
anonymes alors qu'elles sont correctement étiquetées. Vérifié une par une
avant de toucher au code - aucune correction n'a été faite sur ce faux signal.
Même leçon qu'au Lot 25, où l'auditeur de contraste ignorait les dégradés :
un outil d'audit se vérifie sur un cas connu-bon avant d'être cru.

**Quatre défauts réels, corrigés.**

Les croix de suppression des puces (`ChipListField`) n'avaient aucun nom : le
libellé de la puce vit dans le `<span>` parent, pas dans le bouton, qui
s'annonçait donc « bouton » tout court. Sept d'un coup sur `/types/{id}/edit`.
Le Lot 24 avait corrigé exactement ce défaut sur `/types` et étiqueté les deux
champs de ce même composant - mais il n'a audité que `/types/new`, **un
formulaire vierge, donc sans aucune puce**. Le même angle mort qu'au Lot 25,
où le Lot 12 avait balayé un historique d'analyses vide, donc sans ses badges :
auditer un écran, c'est auditer un écran *rempli*.

Le champ d'import BoardGameGeek n'avait qu'un placeholder, qui ne fait pas
office de libellé et disparaît à la première frappe - `/import-bgg` ne
figurait dans aucun balayage précédent. Libellé visible ajouté, patron de
`SearchPage` (libellé au-dessus, champ et bouton sur la ligne suivante).

Le bouton « + » d'Évaluer un achat n'était nommé que par son `title`, une
phrase d'explication de 80 caractères. `aria-label` court pour l'annonce,
`title` long conservé pour l'infobulle.

Les tuiles des boards, enfin - le point du Lot 27. Une tuile **sans** jaquette
portait déjà son titre en texte ; une tuile **avec** jaquette n'avait que son
`title`. Elles annoncent désormais le rang avec le titre (« Naruto, rang S »,
« Death Note, non classée ») : le rang se lit visuellement dans la ligne, mais
rien ne l'associait à la tuile.

**Une cible trop petite.** Ces mêmes croix de puce faisaient 12x12 px, sous le
minimum de 24x24 du critère WCAG 2.5.8, et l'exception d'espacement ne
s'applique pas puisque les puces se touchent. Zone cliquable portée à 24x24,
padding droit de la puce réduit d'autant : la puce garde sa hauteur de 32 px,
rien ne grossit à l'écran.

**Mesuré, non corrigé** : à 375 px, 53 des 134 éléments interactifs (40 %) font
moins de 44x44, la recommandation confortable. Presque tous passent le seuil AA
réel (24x24, ou l'exception d'espacement) - il reste des liens texte de 16 à
20 px de haut, isolés et larges, donc couverts par l'exception. Aligner toute
l'app sur 44 px relève du système de design (taille des puces, des boutons
secondaires, des liens inline), pas d'un correctif.

**Vérifié propre par ailleurs** : aucune `<img>` sans attribut `alt`, aucune
`<svg>` ni masquée ni nommée, aucun `role="dialog"` sans nom, et les six
`onClick` posés sur un `<div>` sont tous des voiles de modale (fermeture au
clic en dehors) doublés d'Escape via `useModalA11y` - jamais l'unique chemin.

**Vérification** : 25 routes rebalayées après correction, zéro élément sans nom
accessible, zéro débordement horizontal, aucune erreur console. Croix mesurées
à 24x24 et puces inchangées à 32 px de haut, à 375 px comme en desktop.
`tsc -b`, `oxlint` et le build de production verts. Aucune donnée touchée : les
deux liens de partage créés pour auditer les pages publiques ont été révoqués,
les deux réglages singletons relus identiques.

### Lot 30 — l'analyse d'achat parle français

Ce lot devait exposer les `CollectorPreferences`, dernier « endpoint sans
interface » connu. Il a changé de cible en cours de route, pour deux raisons
qui valent mieux que la fonctionnalité prévue.

**La première : le moteur d'analyse parlait anglais à l'écran.** Toute la
sortie de la fonctionnalité phare - conseil de négociation, avertissements
d'édition, justifications des dix critères - était produite en anglais et
affichée telle quelle dans une interface intégralement française. « Asking
price is above fair value - propose an offer close to the fair value range. »
s'affichait sous l'offre conseillée, « Edition "Deluxe" for "Vinland Saga" is
not known yet » sous le détail par série. Aucun lot précédent ne l'avait relevé,
alors que le Lot 25 avait corrigé un « Not Found » anglais autrement plus
discret.

Ce n'était pas un choix : la convention de cette fonctionnalité (anglais pour
les identifiants, les commentaires et les noms de classes) ne dit rien des
chaînes lues par l'utilisateur, et la Phase 2 le confirme - **les deux prompts
Gemini demandent explicitement une justification en français depuis le premier
jour**. Seul le moteur déterministe de la Phase 1 était resté en anglais.

Traduit : les 8 avertissements de `PurchaseAnalysisEngine`, les 5 conseils de
`NegotiationEngine`, les 16 justifications de `VerdictScorer`, et les messages
de refus lisibles à l'écran (`PurchaseAnalysisController`,
`PurchaseAnalysisService`, et 10 invariants de domaine déclenchables par une
saisie). **Règle appliquée** : un message qu'une saisie utilisateur peut
provoquer passe en français, un message qui ne peut résulter que d'une erreur
de programmation reste en anglais - il ne s'adresse pas à l'utilisateur. Les
trois derniers (« A factor score must be between 0 and 100 », « A warning must
have a message », « Observed price fields must be null when observationCount is
0 ») relèvent du second cas.

**Trois fuites résiduelles**, trouvées en relisant la sortie réelle plutôt que
le code : `"État déclaré : GOOD"` et `"Gamme(s) d'édition : [STANDARD]"`
interpolaient la constante d'enum brute au milieu d'une phrase française, et
les montants s'affichaient en `EUR` là où l'interface écrit `€`. Libellés
alignés sur ceux déjà utilisés côté web (`CONDITION_LABELS` /
`EDITION_TIER_LABELS`).

**La seconde raison : un filtre qui n'aurait pas survécu.**
`SeriesBreakdownItem` reconnaissait l'avertissement « doublons » **à sa
formulation anglaise** (`w.message.includes('already owned')`) pour ne pas le
répéter, la même information partant déjà structurée et chiffrée dans le bloc
dédié juste au-dessus. Traduire l'avertissement aurait cassé ce filtre en
silence, et le doublon serait réapparu en prose. Plutôt que de traduire des
deux côtés, le moteur **n'émet plus cet avertissement du tout** : il faisait
doublon avec une donnée déjà présente, et reconnaître un avertissement à son
texte était fragile par construction.

**Les analyses d'avant ce lot gardent leur anglais.** Le résultat est stocké en
JSONB, c'est un instantané, pas un calcul rejoué - les 6 analyses de
l'historique restent telles qu'elles ont été produites. Conséquence assumée :
sur ces six-là, l'avertissement doublons réapparaît dans la liste en prose,
puisque le filtre a disparu. À sa place, et en anglais, comme le reste de ces
instantanés.

**Réserve du Lot 27 levée.** Le bouton « Relever ce prix comme observation de
marché » n'avait jamais été vu à l'écran, faute d'une analyse dont l'édition
soit reconnue. La vérification de ce lot en produit une : le bouton s'affiche,
et le relevé écrit exactement ce qu'il annonce - tomes 1-5 (contigus), 67,00 €
soit la part du lot dans le coût réel, plateforme et état repris de l'annonce,
date de l'analyse, titre de l'annonce en note. Vérifié en base.

**Découvert, à traiter en priorité** : sur les dix `CollectorPreferences`,
**six ne sont lues par aucune ligne du moteur** - `preferCompletedSeries`,
`avoidOngoingSeries`, `preferOmnibusIntegral`, `frenchLanguageOnly`,
`preferEasyToCompleteCollections` et `conditionImportance` (cette dernière
faisant doublon avec `factorWeights.get(CONDITION)`). Elles sont pourtant
persistées, exposées par l'API et documentées comme « meant to be
user-editable ». Seules quatre pilotent réellement le verdict :
`factorWeights`, `minimumDiscountVsRetailPercent`, `editionTierRanking` et
`avoidOutdatedEditionWhenBetterExistsOrAnnounced`.

C'est **pour cette raison** que l'écran de réglages n'a pas été construit :
six interrupteurs qui ne changent rien seraient pires que pas d'écran du tout.
Le travail à faire n'est pas d'ajouter une interface par-dessus, mais de
trancher champ par champ - brancher ou retirer - avant d'exposer quoi que ce
soit.

**Vérification** : 378 tests backend (trois assertions ajustées, une réécrite
pour vérifier la donnée structurée plutôt que la prose supprimée), `tsc -b`,
`oxlint`, build de production. Analyse réelle jouée de bout en bout sur une
édition jetable **avec un prix relevé**, pour que le conseiller IA ne soit
jamais appelé (les vraies données priment) et que rien ne consomme de quota :
sortie intégralement française, à l'API comme à l'écran. Données de
vérification retirées en SQL direct - aucun endpoint ne sait supprimer une
analyse ni une observation - compteurs revenus à l'identique (6 œuvres, 13
tomes, 9 possessions, 6 éditions, 0 observation, 6 analyses).

### Lot 31 — une seule source de vérité pour "X sur Y"

Audit demandé sur la justesse des chiffres, et non plus sur le rendu ou la
robustesse. Méthode : partir de la vérité en base, puis confronter ce que
chaque écran en dit.

**Le même fait, quatre réponses.** "Combien de tomes possédés sur combien"
était recalculé par quatre implémentations indépendantes - la tuile de Ma
collection, la fiche, le moteur de suggestions, la page publique - qui ne
s'accordaient pas :

| | Ma collection | Fiche | Suggestions | Page publique |
|---|---|---|---|---|
| Naruto | 3/72 | 3/72 | **2/72** | 3/72 |
| Raw Hero | **3 tomes** | 3/6 | 3/6 | 3/6 |

Deux défauts distincts, chacun dans une implémentation différente, et aucun
détectable en lisant un seul écran.

**Naruto** : le tome 1 n'a pas d'édition saisie, les tomes 18 et 30 sont en
"Kana". Le web les fusionne (règle explicite de `editionGroups.ts` : une seule
édition nommée plus des tomes sans édition précisée, c'est presque toujours un
tome ajouté sans retaper un nom déjà connu) ; le moteur de suggestions les
ignorait, son `groupVolumesByEdition` faisant `if (edition.isEmpty()) continue`.
Il annonçait donc un tome de moins et un manquant de plus - et l'estimation du
coût pour compléter était calculée sur ce mauvais compte. Le commentaire du
backend se disait « équivalent serveur de `groupVariantsByEdition` » : il l'était,
mais c'est `resolveEditionView` que l'interface applique réellement. Les deux
ont divergé le jour où cette seconde règle est apparue.

**Raw Hero** : la tuile choisissait son édition parmi les tomes CATALOGUÉS
(`singleNamedEdition`), la page publique parmi les tomes POSSÉDÉS. Une édition
parasite à 0 tome possédé - « Perfect Edition (test) », reste d'une session de
test - suffisait donc à faire perdre "3/6" à la tuile, qui retombait sur "3
tomes". Un visiteur extérieur voyait une meilleure information que le
propriétaire.

**Décidé avec l'utilisateur** (les trois questions posées avant de coder) : le
tome sans édition compte dans l'édition nommée ; l'édition « (test) » est
supprimée ; et le correctif va jusqu'à la source unique plutôt que de faire
converger quatre copies.

**`CollectionProgressService`** (paquet `insights`, lecture pure cross-contexte,
même convention que `StatsService`) porte désormais les cinq règles, écrites
une fois : groupes issus des tomes catalogués, fusion du groupe sans édition
quand il n'existe qu'une édition nommée, possession mesurée sur les Ownership
actives par numéro de tome DISTINCT, total pris sur la fiche `MangaEdition` de
cette édition précise et jamais deviné, et **édition dominante** = l'unique
groupe réellement possédé (zéro ou plusieurs : pas de dominante, l'ambiguïté ne
se tranche pas au hasard). `CollectionProgressServiceTest` est la spécification
exécutable de ces règles - huit cas, tous tirés d'un écart réellement constaté.

Consommateurs branchés : `findNearCompleteSuggestions` et
`PublicCollectionController`, qui perdent chacun leur version des règles, plus
un endpoint `GET /api/insights/progress` pour les surfaces suivantes. La page
publique n'a plus aucun calcul : elle lit une dominante et l'affiche.

**Reste à faire, explicitement** : le web calcule encore sa propre copie
(`editionGroups.ts`, `shelfTiles.ts`). Il donne aujourd'hui les mêmes chiffres
que le backend, mais par une implémentation parallèle - donc la classe de bug
n'est pas éteinte tant que Ma collection et la fiche ne consomment pas
`/insights/progress`. C'est le lot suivant, et il supprimera la règle
`singleNamedEdition` qui a produit le défaut Raw Hero.

**Vérifié sans rien corriger** : le bilan annuel, la chronologie mensuelle, les
statistiques par type et la valeur de collection concordent tous avec la base
(9 acquisitions, 2 expériences à 7.0, 8 manga + 1 jeu vidéo, 0 prix renseigné).
La valeur affiche « Pas encore de prix renseigné / Indisponible » plutôt qu'un
"0,00 €" trompeur. Deux fausses pistes écartées en vérifiant plutôt qu'en
supposant : les libellés ne sont pas doublement encodés (les octets sont bien
`c3 a9`, c'était le tuyau de test qui décodait en cp1252), et le "0 / None" de
la page publique pour un jeu vidéo n'apparaît jamais à l'écran.

**Trouvé, non corrigé** : Mon profil annonce « 9 TOMES POSSÉDÉS » alors que le
compte inclut un jeu vidéo - exactement le défaut de vocabulaire corrigé au Lot
17 sur Ma collection et les statistiques, resté sur cet écran-là. Et le bilan
annuel proclame un « auteur/studio le plus présent (1x) » alors que les cinq
séries ont cinq auteurs distincts : à 1 partout, le gagnant est arbitraire, sur
une carte destinée à être partagée.

**Vérification** : 386 tests backend (+8), les trois surfaces backend rejouées
sur les données réelles donnent maintenant la même réponse, les écrans web
aussi, aucune erreur console. Suppression de l'édition « (test) » faite via
l'API : son tome retiré, l'édition disparue avec lui (comportement documenté au
Lot 26), Raw Hero repassé à « Soleil · 3/6 ».

### Lot 32 — Découvrir n'avait pas le filet de la Recherche

Parti d'une remarque de l'utilisateur ("il manque mon token BGG") qui s'est
révélée fausse : le token était déjà en place, identique, bien transmis au
conteneur, et un appel réel à BGG répondait correctement. Mais l'impression
venait de quelque part - deux des trois panneaux de Découvrir étaient vides.

**Jeux de société** : vide par conception, `discoverBoardGames` s'arrêtant
faute de jeu possédé portant un `bggId`. Rien à voir avec le token.

**Manga** : vide à cause d'un vrai défaut. `DiscoveryService` appelait
`JikanMetadataProvider` **en dur**, alors que `MetadataSearchService` (la
Recherche) reçoit la liste complète des fournisseurs et bascule sur
MyAnimeList quand Jikan flanche - or ce relais a été ajouté précisément parce
que MyAnimeList bloque/throttle Jikan par intermittence, et `MAL_CLIENT_ID`
est bien renseigné. Constaté en direct : Jikan répondait 504 sur
"Takeshi Obata", donc Découvrir/Manga n'affichait rien, sans que rien ne le
dise - une panne externe présentée comme une absence de suggestions.

Découvrir interroge désormais, dans l'ordre, tous les fournisseurs qui
couvrent le type (`MetadataProvider.supports`), et rend le premier résultat
non vide - exactement la résilience dont la Recherche disposait déjà. Vérifié
pendant que Jikan était encore en panne : 8 suggestions servies par
MyAnimeList là où il y en avait 0.

**Trouvé, non corrigé** : chercher "les œuvres du même auteur" en passant le
nom du mangaka à une API de recherche par TITRE donne des résultats
approximatifs - "Takeshi Obata" ramène des titres contenant "Takeshi". Le
défaut est antérieur et vaut pour Jikan comme pour MyAnimeList ; le repli le
rend seulement visible. À traiter comme une question de pertinence, pas de
disponibilité.

**Reste ouvert** : un panneau vide reste indiscernable d'une source
indisponible. Distinguer les deux à l'écran demande de changer la forme de la
réponse (aujourd'hui une simple liste), donc un lot à part.

**Vérification** : 386 tests backend, `DiscoveryServiceTest` adapté à
l'injection par liste, appel réel à BGG et à MyAnimeList sur les données
réelles.

### Lot 33 — un export qui n'exportait pas tout

Audit de l'export, jamais vérifié depuis sa livraison (§19). Les comptes
concordaient avec la base (6 œuvres, 12 tomes, 9 possessions, 2 expériences) et
la structure est saine : tomes imbriqués dans leur série, possessions
dénormalisées avec le titre et le libellé du tome. Mais l'export couvrait **7
tables sur une quinzaine**.

Absentes alors qu'elles portaient des données réelles : les **5 éditions de
référence** (nombre de tomes, éditeur, prix neuf, épuisée, meilleure édition
annoncée) et les **2 classements généraux** (Naruto S, Jujutsu Kaisen A).
Absentes aussi, vides ce jour-là mais bien réelles : Tier Lists personnalisées
et envies d'amélioration.

Le texte de l'écran énumérait honnêtement ce qui partait - il ne mentait pas.
Mais il annonce aussi **"garantir l'absence d'enfermement"**, et sous cette
promesse-là le compte n'y était pas : repartir de cet export, c'était perdre
les éditions de référence - donc **plus aucun "X sur Y" reconstructible** - et
les classements. Deux choses saisies à la main, que rien ne permet de
recalculer.

Quatre familles ajoutées, JSON et CSV : `editions`, `generalRankings`,
`tierLists` (une ligne par œuvre classée, un CSV n'ayant pas d'imbrication) et
`editionUpgradeWishes`. Onze fichiers dans le ZIP au lieu de sept. Texte de
l'écran mis en accord, exclusions comprises.

**Restent dehors, volontairement** : l'historique d'analyses d'achat, qui est
une suite d'instantanés dérivés et non des données saisies ; les préférences de
collectionneur, dont six champs sur dix ne sont de toute façon lus par personne
(voir Lot 30) ; et les **jetons de partage**, qui sont des secrets - un export
téléchargeable ne doit pas les diffuser. Les prêts sont laissés de côté pour
une raison technique assumée : `LoanRepository` n'expose que les prêts ACTIFS,
et n'exporter que ceux-là serait une demi-vérité ; ça demande une méthode de
repository, comme il en a fallu une pour les relations au Lot 27.

**Vérifié au passage, sain** : la couche des sources externes, celle-là même que
le Lot 32 avait trouvée fissurée. Recherche manga servie par MyAnimeList
pendant que Jikan est toujours en 504 - le repli fonctionne bien là où il
existait déjà ; BGG répond (34 résultats sur "Naruto"), IGDB répond, Google
Books répond au code-barres comme à la recherche de tomes, la résolution de
titre français répond. Le token BGG que l'utilisateur croyait manquant était
déjà en place et valide.

**Vérification** : 386 tests backend, `ExportCsvWriterTest` étendu aux onze
fichiers et ses cinq constructions adaptées, export rejoué sur les données
réelles - les 5 éditions et les 2 classements y sont, valeurs comprises.

### Lot 34 — le scan demande avant d'écrire

Le scan ajoutait chaque tome reconnu **directement**, sans rien demander : un
geste irréversible - un exemplaire est créé - déclenché par un simple passage
de code-barres devant la caméra, y compris sur un tome scanné par erreur, un
mauvais tome de la pile, ou un tome déjà possédé. Le "· déjà possédé" ajouté au
Lot 27 ne faisait que *constater* l'ajout après coup.

Chaque scan reconnu ouvre désormais un menu contextuel (`ScanActionMenu`) qui
montre ce qui a été identifié - titre, jaquette, tome détecté ou non, édition
devinée, et "Déjà dans ta collection" le cas échéant - puis demande quoi en
faire. **Le scan identifie, l'utilisateur décide.**

Les actions sont exactement celles que l'app sait faire d'un code-barres,
jamais une de plus :
- **Ajouter à ma collection**, avec l'état choisi en haut d'écran ;
- **Choisir l'édition et les tomes**, qui ouvre l'ajout détaillé - le numéro de
  tome n'étant deviné qu'à partir du titre et sans garantie, c'est la sortie
  quand le scan n'a pas su ou que l'édition proposée est fausse ;
- **Ouvrir la fiche**, seulement quand l'œuvre est déjà là (recherche locale
  par titre, gratuite) ;
- **Passer ce tome**, tracé dans le journal pour qu'un tome écarté reste
  visible.

"Ajouter à ma liste d'envies" n'y figure pas, volontairement : une entrée de
wishlist référence une œuvre EXISTANTE (`POST /wishlist` exige un `entityId`,
durci au Lot 28), et un livre scanné absent de la collection n'en a pas. Mieux
vaut pas d'entrée qu'une entrée qui échouerait.

**Une impasse comblée au passage.** Quand `BarcodeDetector` est absent - Safari,
Firefox, tout poste sans caméra - le scanner affichait "utilise la recherche
par code-barres manuelle ci-dessous", **qui n'existait sur aucun de ces
écrans**. `/scan` était donc entièrement inutilisable sur ces navigateurs, en
renvoyant vers un champ imaginaire. Le champ existe maintenant, et passe par
exactement le même chemin que la caméra, menu compris.

**Un échec de scan n'est plus un cul-de-sac.** "Aucune correspondance pour X"
affirmait une absence ; or le fournisseur peut simplement n'avoir pas répondu -
constaté en direct, le même code-barres servi en 200 puis refusé en 404 à
quelques secondes d'intervalle. Devenu "Rien trouvé pour X", avec un lien
"Chercher par titre". Même famille que le défaut du Lot 32 : ne pas présenter
une panne externe comme une réponse négative.

**Vérification** (sans caméra, via la saisie manuelle qui emprunte le même
chemin) : menu ouvert sur un scan reconnu **sans aucune écriture** en base
(compteur d'œuvres inchangé pendant que le menu est ouvert) ; "Ajouter" crée
exactement l'attendu (œuvre + possession, attribut `mangaka` repris du scan, 0
tome puisque le numéro n'était pas détecté - ce que le menu annonçait) ;
"Passer" et Escape journalisent sans écrire ; "Ouvrir la fiche" n'apparaît
qu'une fois l'œuvre présente, vérifié en rescannant le même code juste après
l'ajout ; un scan pendant qu'un menu est ouvert est ignoré, la question posée
n'étant jamais écrasée. Bottom-sheet plein écran en 375px, boîte centrée de
360px en 1280px, aucun débordement, cibles d'action à 359x44. Données de
vérification retirées, compteurs revenus à l'identique.

**Piège de mesure, pour mémoire** : `clientWidth`, `innerWidth` et
`visualViewport.width` valent tous **0** quand le panneau navigateur n'est pas
affiché - un "débordement de 242px" y est apparu sur une page parfaitement
saine. Toujours vérifier que `clientWidth` est non nul avant de conclure quoi
que ce soit sur une largeur.

### Lot 35 — le chemin le plus fréquenté coûtait 1 + 3N requêtes

Deux angles jamais audités : le coût des lectures, et l'intégrité du modèle.

**La latence ne prouvait rien.** Les treize endpoints de lecture répondent tous
entre 6 et 59 ms - sur 6 œuvres et 9 possessions. La vraie question n'est pas
le temps mais le **nombre de requêtes**, seul indicateur qui dit ce qui se
passera à 500 séries.

**Deux instruments écartés avant de conclure.** `pg_stat_user_tables` remonte
ses compteurs de façon différée : il attribuait le travail d'un appel au
suivant, puis a fini par ne plus rien remonter du tout. Ce n'est qu'en activant
`log_statement='all'` côté Postgres - et en cherchant `LOG: execute` et non
`statement:`, les requêtes étant préparées - que la mesure est devenue fiable.
Le réglage a été remis à `none` après coup.

**Trois N+1 sur le même chemin**, celui dont dépendent Ma collection, un rayon,
l'export, la progression, les suggestions et la page publique :

1. `findAllByType` et `search` chargeaient les tomes **une œuvre à la fois** -
   1 + N requêtes, depuis toujours. Remplacé par un `findByEntityIdIn` unique
   avec regroupement en mémoire (`withVariants`), la liste des œuvres étant de
   toute façon déjà chargée.
2. `CollectionProgressService.totalVolumesFor` interrogeait `manga_edition`
   **une fois par groupe d'édition et par œuvre** - défaut introduit au Lot 31,
   dans du code écrit trois lots plus tôt. Toutes les éditions sont désormais
   indexées en une requête, exactement comme `indexEditionTotals` le fait déjà
   côté web.
3. La collection de tags (`@ElementCollection(fetch = EAGER)`) était chargée
   **une œuvre à la fois** : 7 requêtes `entity_tag` pour en lister 6.
   `@BatchSize(size = 100)` la ramène à une par centaine d'œuvres.

**Mesuré, requêtes SQL réelles par appel** :

| | avant `@BatchSize` | après |
|---|---|---|
| `GET /entities/search` | 10 (dont 7 `entity_tag`) | **5** (dont 2) |
| `GET /insights/progress` | 16 (dont 7 `entity_tag`) | **11** (dont 2) |

Ces deux colonnes sont mesurées *après* les correctifs 1 et 2 ; avant eux, les
mêmes appels ajoutaient encore 5 requêtes `variant` et 4 `manga_edition` sur ce
jeu de 6 œuvres. Le gain n'est pas un pourcentage fixe : il **croît
linéairement avec le nombre de séries**, là où le coût précédent le faisait
aussi. Le `select ... from variant where entity_id in ($1..$6)` visible dans le
journal est la preuve directe du regroupement.

**Intégrité : rien à signaler.** Huit contrôles croisés sur les données réelles,
au-delà de ce que les clés étrangères garantissent - possession dont le tome
appartiendrait à une autre œuvre, même chose pour une expérience, numéro de tome
en double dans une même édition, édition rattachée à une œuvre absente,
classement orphelin, tome sans numéro exploitable, édition sans aucun tome
rattaché : **zéro anomalie**. Le seul compteur non nul ("possession active sans
tome") est un jeu vidéo, dont la possession n'a légitimement pas de tome - la
requête était trop large, pas la donnée fausse.

**Vérification** : 386 tests backend, dont les 8 cas de `CollectionProgressServiceTest`
qui garantissent que les règles de progression n'ont pas bougé sous le
regroupement. Chiffres identiques avant/après sur les données réelles, à l'API
comme à l'écran (Ma collection, Suggestions, Statistiques).

### Lot 36 — l'arithmétique du moteur, re-dérivée à la main

Le cœur de la fonctionnalité phare n'avait jamais été vérifié autrement que par
ses propres tests. Ce lot le re-dérive **indépendamment** : un cas dont chaque
valeur est connue d'avance, puis comparaison.

Cas construit : édition à 10 tomes, prix neuf 10 €/tome ; un prix relevé de 32 €
pour les tomes 1-4, soit 8 €/tome observé (une donnée réelle, donc l'IA n'est
jamais appelée) ; annonce de 45 € pour les tomes 1-5, état "bon état", sans
frais.

Valeurs prédites à la main, puis retrouvées **toutes** dans la réponse : coût
réel 45 ; valeur neuve 50 ; décote 10 % ; valeur juste 40 (8 × 5) ; prix
maximum 42 (40 × 1,05) ; cible basse 38 (40 × 0,95) ; seuil d'abandon 52,50
(42 × 1,25) ; 45 dépassant 42 sans atteindre 52,50, la recommandation est
**NEGOTIATE** avec une offre conseillée à 38. Côté critères :
prix/valeur juste 45/40 = 1,125, donc score 30 ; décote 10 % contre 20 %
attendus, donc 50 + (10 − 20) × 2 = 30 ; alignement marché 90 (une observation
réelle existe) ; état "bon état" 55 ; qualité d'édition STANDARD, 6e rang sur 7
dans la hiérarchie par défaut, donc 100 − (5/6) × 80 = 33 ; coût pour compléter
40/50 = 80 %, donc 20.

**Score pondéré : 4885/100 = 48,85 → 49**, exactement ce que le moteur rend, et
49 étant sous le seuil de 50, le verdict "Cher" est correct. **L'arithmétique
est juste, de bout en bout.**

**Les deux surfaces publiques tiennent aussi.** Jeton inconnu, malformé, vide,
en forme d'injection SQL, ou jeton d'une autre fonctionnalité : **404 dans tous
les cas**, indistinctement - rien ne laisse deviner qu'un lien a existé. Après
révocation : 404 immédiat. Les champs réellement exposés sont exactement ceux
promis (titre, jaquette, éditions, progression) - **aucun identifiant, aucun
prix**. L'interrupteur Tier Lists tient sa promesse : `tierLists` vaut `null`
tant qu'il est fermé, et les œuvres classées ne sortent qu'avec titre et
jaquette.

**Un défaut trouvé en chemin.** `POST /purchase-analysis/editions` sur un couple
(titre de série, nom d'édition) déjà pris répondait **500**, avec la requête SQL
et le nom de la contrainte `manga_edition_series_title_edition_name_key`. Un
double clic sur "Enregistrer" suffit à le déclencher. Refus explicite ajouté
avant l'insert : 409 "Une édition « Kana » existe déjà pour la série « X »".

Et surtout, **un filet général** : c'est le quatrième cas de contrainte de base
qui remonte en 500 après la suppression d'édition (Lot 26), la wishlist et les
relations (Lot 28). Chacun ne fermait que sa porte. `ApiExceptionHandler`
traduit désormais toute `DataIntegrityViolationException` en 409 avec un
message générique, le détail partant en WARN dans les logs - plus aucune trace
SQL ne peut atteindre l'écran, quelle que soit la table.

**Vérification** : 386 tests backend, doublon rejeté en 409 lisible et création
légitime toujours acceptée (201), données d'audit retirées, compteurs revenus à
l'identique (6 œuvres, 12 tomes, 9 possessions, 5 éditions, 0 observation, 6
analyses, 2 classements), écrans inchangés.

**Rappel de méthode** : le nettoyage par l'API a échoué à mi-parcours (une
édition encore référencée par son tome), et c'est le SQL en une transaction, dans
l'ordre des dépendances, qui a rétabli l'état - avec la liste de ce qui allait
partir affichée AVANT de supprimer.

### Note Lot 5 — résolue

`QuickAddPage.tsx` (968 lignes) était un formulaire continu très finement
ajusté (débounce, résolution titre français, correspondance tome/jaquette,
gestion de quota). La maquette V1.2 décrit un modèle structurellement
différent (liste de résultats groupés → écran séparé de sélection des
tomes). Un premier alignement sûr (titre, points d'entrée réels, `0d6c015`)
a d'abord été fait sans toucher la structure ; la restructuration complète
a ensuite été explicitement validée par l'utilisateur ("Restructurer
complètement" plutôt que rester en portée réduite) et livrée en `f8d626f` :
`SearchPage.tsx` (liste groupée par titre) → `AddDraftPage.tsx` (sélection
des tomes, reçoit le candidat choisi via `location.state` React Router,
rejoue tout le pipeline résolution-titre/correspondance-jaquette au montage
plutôt que de le partager par un state global). `QuickAddPage.tsx` supprimé.
Bug pré-existant signalé ici comme "à traiter séparément" — **corrigé
depuis** (2026-08-20, voir Lot 11 ci-dessous) : OpenLibrary résolvait
"Vagabond" (Takehiko Inoue) en "Slam Dunk".

## Notes de calibrage (pour éviter de refaire ce travail de lecture)

- Maquette v4 de la fiche (Lot 25) : la source de vérité du zip `Restructuration de page web.zip` est `Fiche série - IozyCore v4.dc.html` — les quatre autres artboards sont ses explorations, et `Menu de la fiche - variantes.dc.html` (100 Ko) compare six systèmes de navigation de fiche dont v4 retient le sixième (barre collante, trois sections numérotées à sous-titre calculé). Le dossier `_ds/modernist-*` du zip est un design system « Modernist » (rouge sur blanc, zéro rayon, Archivo) qu'**aucun** artboard n'utilise : tous sont en styles inline sur la palette terracotta déjà en place. Ne pas le suivre.
- Un `<h1>` de la maquette peut porter un `clamp()` calibré sur un titre court ; toujours le retailler avant reprise (Lot 25 : 46-68px → `clamp(1.75rem, 4.6vw, 2.85rem)`), sinon c'est le Lot « tenir le choc des titres longs » à refaire.
- Une barre collante posée dans `<main>` doit s'arrêter sous l'en-tête, pas sous le viewport : `top-14` / `md:top-16` (hauteurs exactes de `MobileHeader`/`DesktopHeader`) et un `z-index` STRICTEMENT inférieur au leur (`z-[9]` contre `z-10`). Et son débord latéral doit être conditionnel : `-mx-4 px-4` en dessous du point de bascule (où le conteneur porte 16px de marge, voir `AppShell`), `md:mx-0 md:px-0` au-dessus (où il n'en porte plus, et où le même débord la ferait dépasser du contenu).
- `navItems` (mock, ligne ~2893) : source unique desktop rail + bottom bar mobile, exactement 3 entrées (Collection/Rechercher/Découvrir), jamais Wishlist/Profil/Paramètres/Scan en pair.
- Bottom bar mobile (ligne ~1707-1728) : 3 nav items + FAB Scan séparé par une bordure verticale, `order` CSS pour le placer à droite. Le FAB Scan n'a pas `aria-current` — ce n'est pas une 4e destination, juste un raccourci. Réconcilie §12 ("ne pas mettre Scan dans la bottom-nav") : Scan n'est pas un onglet pair, juste un raccourci visuel dans la même barre.
- Drawer Tome (ligne ~1809) : 392px desktop / bottom-sheet 88% mobile. Déjà très proche de `VolumeInteractionPanel.tsx` (420px/85dvh) construit plus tôt cette session — écart mineur, pas de refonte nécessaire.
- Fiche (ligne ~238) : édition cards affichent chacune sa propre barre de progression (déjà fait), "Mes classements" est une section à part entière AVANT "À propos", pas fusionnée avec les tomes.
- Découvrir (ligne ~958) : desktop affiche les 3 panneaux simultanément dans une grille (`discoverGrid`), mobile swipe un seul panneau à la fois — même markup, juste le conteneur qui change (identique au pattern déjà utilisé pour la Fiche : `ficheSwipe`/`fichePanels`).
- DS tokens complets extraits de `IozyCore DS v1.1.dc.html` lignes 432-467 (LIGHT/DARK) — voir Lot 1 pour les valeurs exactes utilisées.
- Tier Lists (Lot 7) : deux mécanismes distincts, pas un seul modèle généralisé — classement général (`EntityRank`, implicite, une œuvre possédée = candidate sans étape d'ajout explicite) vs Tier List perso (`TierList`/`TierListItem`, appartenance explicite via `POST /tier-lists/{id}/items` avant de pouvoir classer). Le hub Découvrir masque un univers entier si aucune œuvre possédée de ce type ET aucune Tier List perso (même principe que les rails vides de Ma Collection).
- `CorsConfig.allowedMethods` ne listait que GET/POST/PATCH/DELETE — Tier Lists est la première feature à utiliser PUT (`setGeneralRank`/`setTierListItemRank`), découvert via un vrai 403 en vérification live du Lot 7b, corrigé en ajoutant PUT à la liste. À garder à l'esprit pour tout futur endpoint PUT.
- Découvrir (Lot 6) : le seuil éditorial exact du mock est **1100px de largeur viewport**, pas un breakpoint Tailwind nommé (`lg`=1024/`xl`=1280 n'y correspondent pas) - implémenté avec la variante arbitraire `min-[1100px]:`, cohérente avec le pattern déjà établi `hidden md:block` (TabBar/DesktopHeader), juste une valeur différente. Vérifié en direct : ratio de colonnes mesuré 767px/465px ≈ 1.65, exactement `1.65fr 1fr`.
- L'écran "Tier Lists" complet (`/tier-lists`, promu depuis l'ancien `TierListsHub.tsx` embarqué dans Découvrir) est une "deuxième grande expérience, à côté de la collection" (commentaire source) : atteint depuis la fiche ("Toutes mes Tier Lists") ou Profil (Lot 8, pas encore fait), **jamais** depuis les cartes de l'aperçu Découvrir qui ouvrent un board directement - un aller simple, pas un détour par le hub. Les boards (`GeneralTierBoardPage`/`CustomTierBoardPage`) reviennent toujours vers `/tier-lists` (bouton retour, suppression), jamais directement vers `/discover`, même quand ils ont été ouverts depuis Découvrir.
- Suggestion "Opportunités" (`NearCompleteSuggestionDto`) ne porte pas `coverImageUrl` (donnée calculée, pas un DTO d'entité) - `DiscoverOpportunitiesPreview` croise avec `searchEntities({})` déjà en cache ailleurs dans l'app plutôt que d'ajouter un champ au DTO backend pour 3 miniatures d'aperçu.
- Balayage responsive (Lot 10) : `window.innerWidth` seul s'est révélé peu fiable dans ce navigateur automatisé sous émulation de viewport - une page avec un vrai débordement horizontal peut faire remonter `window.innerWidth` égal au `scrollWidth` du contenu débordé plutôt qu'à la largeur réelle du viewport (confirmé indépendamment via `visualViewport.width` et `getComputedStyle(document.documentElement).width`, qui restent corrects). Toujours comparer `document.documentElement.clientWidth` (viewport réel) à `document.documentElement.scrollWidth` (contenu réel), jamais `window.innerWidth` seul, pour détecter un débordement dans cet environnement.
- Un vrai débordement horizontal mobile (375px) a été trouvé sur Évaluer un achat (`/purchase-analysis`, PurchaseAnalysisPage.tsx) via cette méthode : deux rangées de formulaire (3 puis 4 champs) empilaient des `flex-1` sans jamais prévoir de repli, contrairement au patron déjà établi ailleurs dans l'app (ex. `AddVolumeSection.tsx` : 2 champs + bouton par rangée maximum). Corrigé par `flex-wrap` + `min-w` par champ (Lot 10, `c73d4c2`) - toujours grouper un champ à largeur fixe et son bouton d'action dans un sous-conteneur dédié pour qu'ils ne se séparent jamais au wrap.
