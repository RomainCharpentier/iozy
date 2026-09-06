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
25. Fiche d'une œuvre restructurée d'après la maquette v4, et en-têtes de tous les écrans harmonisés — **fait**, puis **remplacé au Lot 26** (mauvaise planche suivie) — voir ci-dessous
26. Fiche refaite d'après la BONNE planche (« multi-éditions »), et « édition suivie » devenue une vraie donnée — **fait** — voir ci-dessous
27. « Envies d'amélioration » retirée de l'interface : livrée mais sans conséquence — **fait** — voir ci-dessous
28. Une seule grille de tomes pour la fiche et l'ajout — **fait** — voir ci-dessous
29. `/add/draft` supprimé : on ouvre la fiche d'une œuvre qu'on ne possède pas — **fait** — voir ci-dessous
30. Un retour vers l'écran d'où l'on vient, sur la fiche — **fait** — voir ci-dessous
31. Consulter n'écrit plus rien : l'aperçu d'une œuvre, et l'ajout comme seule écriture — **fait** — voir ci-dessous
32. L'ajout depuis l'aperçu, testé de bout en bout — un bug trouvé — **fait** — voir ci-dessous
33. Plus de « 2/? » : un ratio sans dénominateur — **fait** — voir ci-dessous
34. L'aperçu promettait un ajout manuel qu'il n'offrait pas — **fait** — voir ci-dessous
35. Signaler dans la recherche les œuvres déjà connues sans tome — **fait** — voir ci-dessous
36. Audit transversal après la refonte : sept défauts trouvés, six corrigés — **fait** — voir ci-dessous

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


### Lot 26 — la bonne planche, et l'édition suivie enfin persistée

#### Ce qui s'est passé

Le Lot 25 a suivi `Fiche série - IozyCore v4.dc.html` en supposant que « v4 »
désignait la dernière itération du zip. C'était faux : la planche qui fait foi
est **`Fiche série - Naruto (multi-éditions).dc.html`**, désignée par
l'utilisateur après avoir vu le résultat (« ça ressemble pas du tout à la
maquette »). Les deux ne sont pas des variantes de détail — v4 range la fiche
en trois onglets numérotés, « multi-éditions » met tout sur une page autour
d'une rangée de cartes d'édition. Le Lot 25 est donc **remplacé**, pas
complété.

À retenir pour la prochaine fois : **le nom d'un fichier n'est pas une date**.
Quand un handoff contient plusieurs planches du même écran, aucune n'est
« la dernière » par son nom — les dates de fichier du zip sont toutes
identiques (heure d'export). La seule source fiable est l'utilisateur ; la
question aurait dû être posée avant d'écrire une ligne.

Ce que le Lot 25 laisse quand même derrière lui, et qui reste en place :
`EnTeteSection` et `Carte` partagés par les 28 écrans, la marque `Iozy`+`core`,
la destination courante en pastille surélevée, et surtout le correctif
`aria-current` (`NavLink` écrasait celui qu'on lui passait — voir Lot 25).

#### La bande pleine largeur, sans `100vw`

C'est le défaut qui faisait que « ça ne ressemblait pas » : la maquette n'a pas
une carte posée sur une page, elle a une bande teintée qui traverse tout
l'écran. Le Lot 25 y avait renoncé pour une raison réelle — `100vw` compte la
barre de défilement et rouvre le débordement horizontal du Lot 10.

La solution ne passe pas par `vw` du tout. `<main>` devient une grille à trois
colonnes `1fr | contenu | 1fr` (voir `AppShell.CONTAINER_CLASS`) : tout écran
tombe dans celle du milieu, et une bande qui demande `col-span-full` occupe les
trois. La grille ne connaît que la largeur réellement disponible.

Deux pièges rencontrés et refermés :
- La règle par défaut vit dans `@layer base` (`main[data-grille] > *`). Écrite
  en utilitaire (`*:col-start-2`), elle l'emporterait toujours sur le
  `col-span-full` de l'enfant — le sélecteur d'un parent est plus spécifique
  que la classe d'un enfant — et aucune bande ne pourrait sortir de sa colonne.
  Même raisonnement que la règle de survol déjà présente dans `index.css`.
- Un élément de grille vaut `min-width: auto` et refuse de descendre sous la
  largeur de son contenu, ce que `<main>` en bloc empêchait gratuitement. D'où
  un `min-width: 0` dans la même règle, sans quoi le premier titre en
  `truncate` faisait déborder la page.

Mesuré après coup : bande à 1265px de large sur un viewport de 1265, contenu à
24px/1217px comme le reste de la page, `scrollWidth == clientWidth` à 1265px
comme à 375px.

#### La teinte tirée de la jaquette

La maquette fait dériver toute la bande de la couleur moyenne de la jaquette.
`useTeinteJaquette` échantillonne un canvas 24×24 — mais sur une image
**séparée** en `crossOrigin = 'anonymous'`, jamais celle affichée à l'écran.
Les jaquettes viennent d'hôtes externes qui n'envoient pas tous les en-têtes
CORS ; sans en-têtes, l'image d'échantillonnage échoue en silence et c'est le
terracotta de la marque qui sert. La jaquette visible, elle, n'est jamais
touchée — c'est tout l'intérêt de ne pas réutiliser la même balise.

#### « Édition suivie » : une vraie donnée (décision utilisateur)

Le badge SUIVIE de la maquette suppose un concept qui n'existait pas.
L'édition affichée n'était qu'un `useState` : rouvrir une fiche repartait
toujours sur la première édition trouvée, et « c'est CELLE-CI que je
collectionne » n'était écrit nulle part.

Nouveau domaine `com.iozycore.domain.followededition` (migration `V20`) :

- Une seule édition suivie par série et par propriétaire, **tenue par la
  base** (`UNIQUE (entity_id, owner_id)`) et non par le code appelant.
- L'édition est désignée par son **nom**, jamais par l'id d'une
  `MangaEdition` : une série peut avoir des tomes dans une édition qui n'a
  encore aucune fiche documentaire, et suivre une édition ne doit pas exiger de
  l'avoir d'abord documentée. Même choix que
  `EditionUpgradeWish.currentEditionName`.
- `PUT /api/followed-editions` est **idempotent** et passe par
  `suivreALaPlace`, qui garde la même ligne — un DELETE suivi d'un INSERT
  laisserait une fenêtre sans édition suivie et pourrait violer la contrainte
  si les deux ordres se croisaient. Vérifié en direct : le même `id`
  (`396fbddf…`) survit à un changement d'édition.
- `GET` renvoie une **liste**, vide quand rien n'est suivi, et non un 404 :
  « aucune édition suivie » est un état normal. Un 404 obligerait chaque
  appelant à le neutraliser — c'est exactement ce que fait déjà `findEdition`,
  dont tous les appels portent un `retry: false` pour cette seule raison.

Distinction posée dans le code et dans l'interface : **afficher une édition
n'est pas la suivre**. Cliquer une carte change ce qu'on REGARDE (volatile) ;
« Suivre cette édition » déclare ce qu'on COLLECTIONNE (persisté, et c'est
l'édition ouverte à la visite suivante). Comparer trois éditions avant d'en
choisir une est le cas normal, et chaque coup d'œil ne doit pas réécrire la
donnée.

#### Lire, puis modifier

Le bouton pinceau de la maquette bascule toute la fiche. Au repos elle se LIT :
inspecteur compact à trois colonnes (PERSONNEL / ŒUVRE / SOURCE), aucun
formulaire, aucun « + » qui traîne. En mode édition apparaissent les points
d'ajout (suivre une édition, ajouter un tome, ajouter une édition) et, sous
l'inspecteur, **les éditeurs complets déjà construits** — `TierSummarySection`,
`ExperiencesSection`, `TagsSection`, `EntityInfoSection`,
`RelationshipsSection`, `DeleteEntitySection`. Aucun n'a été réécrit : ils
changent de moment d'apparition, pas de comportement.

#### La grille dense

Pistes de 78px, plus de légende sous les tuiles, et l'état lu au CONTRASTE
(possédé net / manquant désaturé et pâle) plutôt qu'au mot. La maquette montre
Naruto : soixante-douze tomes, qui à l'échelle précédente occupaient six
rangées et deux écrans de défilement. Les filtres `Tous / Manquants / Possédés`
remplacent le « Voir tout (N) » de l'aperçu des séries longues, désormais
inutile — d'où la suppression de `buildPreviewTiles`.

Les deux actions au survol d'une tuile sont `aria-hidden` et hors de l'ordre de
tabulation : la tuile entière reste un bouton qui mène au même panneau, donc le
clavier et le tactile atteignent tout sans dépendre d'un survol.

Les filtres sont un `radiogroup` et non trois `aria-pressed` : trois vues qui
s'excluent, là où `aria-pressed` annoncerait trois interrupteurs indépendants
dont deux « inactifs ».

#### Fichiers

Créés : `lib/useTeinteJaquette.ts`, `lib/tomeTiles.ts` (extrait de
`TomesGridSection`), `api/followedEdition.ts`, `EntityDetail/CartesEditions.tsx`,
`GrilleTomes.tsx`, `InspecteurFiche.tsx`, `AideFlottante.tsx`, plus le domaine
backend `followededition` (migration, agrégat, dépôt, persistance, DTO,
contrôleur).

Supprimés : `TomesGridSection.tsx`, `TuileTome.tsx`, `VirtualVolumeCard.tsx`,
`BarreSectionsFiche.tsx` — les quatre appartenaient à la structure v4.

#### Écarts assumés

- **La navigation reste à trois destinations.** La planche « multi-éditions »
  affiche quatre entrées (`Ma collection / Rechercher / Envies / Annonces`),
  mais c'est une planche de FICHE et son en-tête est incident : la planche v4
  du même zip en montre trois plus le cœur, ce qui est exactement la décision
  du Lot 2 (« Envies au cœur, Profil à l'avatar »). Une décision de navigation
  globale ne se prend pas dans l'en-tête d'une maquette d'écran.
- **Le panneau d'un tome reste `VolumeInteractionPanel`.** La maquette dessine
  une petite carte flottante à quatre lignes ; le panneau existant fait tout ce
  qu'elle fait et davantage (état, prix d'achat, renumérotation, correction de
  jaquette). Le remplacer, ce serait perdre des fonctionnalités pour gagner une
  ressemblance.
- **« Quelle édition compléter en priorité ? »** (deuxième question de l'aide
  dans la maquette) n'est pas construite : y répondre demande la complétude de
  CHAQUE édition, donc autant d'appels que d'éditions, alors que la fiche n'en
  charge qu'une. « Où en suis-je dans mes lectures ? » est conservée à la
  place, comme au Lot 13.

#### Vérifications

`typecheck`, `lint`, `check:contrast` (116 combinaisons, deux thèmes), `build`
et **la suite backend complète** : verts. En direct sur données réelles :

- les trois endpoints (`GET` vide → `PUT` → `GET` → `PUT` d'une autre édition
  → même `id` → `DELETE` → `GET` vide), accents compris ;
- une édition sans nom refusée en 400, jamais en 500 (la garde est bien avant
  le `trim`) ;
- dans l'interface : pinceau → « Suivre cette édition » → badge `SUIVIE` et
  bascule en « Ne plus suivre » ; carte lue « Black Édition | SUIVIE | Kana ·
  6 tomes | 1/6 » ;
- filtres mesurés : 6 tous / 5 manquants / 1 possédé ;
- **état de départ restauré à l'identique** (aucune édition suivie, comme
  avant le lot) ;
- aucun débordement horizontal à 1265px ni à 375px.

Piège de déploiement reconfirmé (voir les notes de calibrage) :
`docker compose up -d --build iozycore-api` a bien reconstruit l'image mais
laissé tourner l'ANCIEN conteneur (« Running », pas « Recreated »), donc l'API
servait encore un backend sans `V20`. Détecté en comparant
`docker inspect … {{.Image}}` à `docker images … {{.ID}}`, corrigé par
`--force-recreate`.

### Lot 27 — « Envies d'amélioration » retirée de l'interface

Signalé par l'utilisateur en regardant la nouvelle fiche : « je vois pas
l'intérêt de "rechercher une meilleure édition" ». Vérifié plutôt que
supposé, en traçant qui CONSOMME réellement la donnée :

| | Lu par | Agit sur quelque chose ? |
|---|---|---|
| `EditionUpgradeWish` | sa page `/edition-upgrades`, et l'export | **Non** — zéro occurrence dans `purchaseanalysis/` |
| `WishlistEntry`, pour comparer | partage public, export, statistiques, **et Analyse d'achat** | Oui |

Les deux autres mentions d'`EditionUpgradeWish` côté backend
(`RelationshipController`, `TierListService`) sont des **commentaires** qui
citent le contrôleur comme patron — aucune logique.

Le geste écrivait donc une ligne que rien ne relisait, sauf à aller la
chercher sous Profil. Et le peu qu'il apportait à la fiche a été absorbé au
Lot 26 : la rangée `ÉDITIONS · n` montre désormais toutes les éditions avec
leur progression côte à côte, ce qui est exactement l'information qu'on veut
pour décider de changer d'édition.

Décision utilisateur : **retirer**, plutôt que brancher sur Analyse d'achat.

#### Portée exacte

Retiré (web uniquement) : le lien de la fiche et `EditionUpgradeWishToggle`,
la page `/edition-upgrades` et sa route, l'entrée dans Profil, `api/editionUpgrade.ts`,
`types/editionUpgrade.ts`, et la clé de cache.

**Conservé (backend intact)** : l'agrégat, le dépôt, la persistance, la table,
le contrôleur REST et l'export. Aucune donnée détruite, aucun test touché — et
c'est délibéré : la suite de contrat HTTP du endpoint fait une centaine de
lignes, la supprimer serait une seconde décision, pas une conséquence de
celle-ci. Le endpoint n'a désormais plus aucun appelant ; si l'on veut aussi
retirer la surface backend, ce sera un lot à part.

#### Une page de repli, trouvée au passage

Retirer la route a révélé que l'application n'en avait **aucune** : toute URL
inconnue rendait un `<main>` strictement vide, avec la navigation autour — un
écran qui a l'air cassé plutôt que d'expliquer. Le cas devenait atteignable
pour quiconque avait `/edition-upgrades` en signet, mais il existait déjà pour
la moindre faute de frappe. `PageIntrouvable` comble ça, en dernier `Route
path="*"`, avec un import direct plutôt que paresseux (la page est minuscule
et doit s'afficher tout de suite, y compris quand c'est justement le
chargement d'un chunk qui a échoué). Ni code d'erreur ni « 404 » : ce sont des
mots de serveur.

#### Vérifications

`typecheck`, `lint`, `check:contrast`, `build` verts ; backend non touché,
donc sa suite reste celle du Lot 26. En direct : plus aucune référence à
`EditionUpgrade` dans `web/src`, la fiche intacte sans le lien, Profil réduit
à trois entrées réelles (Évaluer un achat / Bilan annuel / Paramètres), et
`/edition-upgrades` comme `/nimporte-quoi` affichent la page de repli.

### Lot 28 — une seule grille de tomes, deux modes

Question de l'utilisateur : « on devrait mutualiser avec /add/draft non ? ».

#### Ce que la comparaison a donné

| | Fiche `GrilleTomes` | Ajout `VolumeSelectionGrid` |
|---|---|---|
| Donnée | `TomeTile` (Variant + Ownership + complétude) | `VolumeCandidateDto` (recherche externe, pas encore en base) |
| État | possédé / catalogué manquant / purement déduit | sélectionné **×** déjà possédé (deux axes) |
| Le clic | ouvre le panneau du tome | coche / décoche |
| Multi-sélection | non | c'est tout l'objet de l'écran |
| Filtres | Tous / Manquants / Possédés | aucun |
| Forme | `aspect-2/3`, auto-fill 78px | `h-24 w-16` fixe, flex-wrap |

Ma première lecture concluait « coquille commune, grilles séparées » : deux
gestes différents, donc risque de fausse factorisation à jeux de props
disjoints. **Décision utilisateur : fusionner pour de vrai.** Et en écrivant
le composant, l'objection tombe d'elle-même — la liste des props communes est
entière, et une SEULE prop (`onEnvies`) est propre à un mode.

#### Le point de rencontre

`components/GrilleVolumes.tsx` définit ce qu'une grille a besoin de savoir
d'un tome, et rien de plus : `{ cle, numero, jaquetteUrl, possede, actif }`.
Chaque écran traduit sa propre donnée vers cette forme (une dizaine de lignes
d'adaptateur de chaque côté).

Deux choix qui font tenir l'ensemble :

- **`actif` couvre les deux sens.** Sur la fiche, c'est le tome dont le
  panneau est ouvert ; à l'ajout, c'est le tome coché. Deux significations,
  un seul état visuel — donc pas de `tomeActif` d'un côté et `selectedKeys`
  de l'autre dans la même signature.
- **La distinction « catalogué manquant » / « purement déduit » ne survit pas
  à la traduction**, et c'est voulu : elle ne change rien à ce qu'on VOIT
  (les deux sont des trous). Elle continue d'exister là où elle compte, au
  moment d'agir sur le tome — un tome catalogué se rattache, un tome déduit
  doit d'abord être créé (voir `VolumeInteractionPanel`).

Le `mode` ne fait varier que trois choses, toutes visibles au même endroit :
la sémantique ARIA du bouton (`aria-pressed` en sélection, simple bouton en
navigation), les badges de coin, et les actions au survol.

#### Une règle d'atténuation qui dépend du mode

En **navigation**, un tome manquant est désaturé et pâle : c'est
l'atténuation qui fait voir les trous d'une collection, elle EST
l'information. En **sélection**, un tome déjà possédé reste net — le cocher
est parfaitement légitime (c'est un deuxième exemplaire, voir
`formatAddResultMessage`), et le pâlir laisserait croire qu'il est
indisponible. Même composant, deux règles, chacune justifiée par ce que
l'écran demande de faire.

Les deux badges de coin restent distincts pour la même raison : « déjà
possédé » (vert, à gauche) et « coché » (accent, à droite) peuvent coexister,
jamais un seul badge à double sens.

#### Vérifications

`typecheck`, `lint`, `check:contrast`, `build` verts. En direct, sur les deux
écrans :

- **Fiche** (Death Note) : 6 tuiles, filtre « Manquants » → 5, tuile 78×117,
  `aria-label` « Voir le tome 1 », pas d'`aria-pressed`, le clic ouvre bien le
  panneau. Naruto : **72 tuiles** rendues d'un coup, aucun débordement.
- **Ajout** (`/add/draft`, Boruto — titre absent de la collection, rien
  validé) : chips d'édition conservés, filtres présents, `aria-pressed`
  false → true → false, badge de coche, tuile 78×117 puis 87×131 dans une
  colonne plus étroite — c'est `auto-fill` qui étire les pistes, le ratio 2/3
  est tenu dans les deux cas.
- Branche « déjà possédé » en sélection forcée par une réponse `/metadata/volumes`
  réécrite à la volée (recette du Lot « navigateur de test ») : 3 tuiles au
  badge vert, `aria-label` « Tome 3, déjà possédé », **non atténuées** — la
  règle ci-dessus est bien celle qui s'applique. Aucune donnée réelle touchée,
  `window.fetch` restauré.
- Aucun débordement horizontal sur les deux écrans à 1265px.

### Lot 29 — la fiche d'une œuvre qu'on ne possède pas

Demandé par l'utilisateur : « add/draft devrait retirer vers la page de
détails, on peut voir la page de détail sans avoir dans la collection le
truc ». Les Lots 28 et le précédent avaient mutualisé la grille puis la
composition de la page ; il restait deux écrans. Il n'en reste qu'un.

#### Ce que le modèle permettait déjà

`Entity` != `Ownership` est un invariant de ce dépôt : une fiche sans la
moindre possession est un état normal — c'est déjà celui d'une œuvre en
envies, dont la fiche s'ouvre sans qu'on possède quoi que ce soit. Il ne
manquait donc pas un modèle, seulement une porte : `POST /api/entities/resolve`,
qui expose le `CatalogEntityResolver.resolveOrCreate` **déjà** utilisé par
l'ajout rapide et la wishlist. Aucune Ownership créée, résolution par
(type, titre), donc regarder deux fois la même œuvre ne crée pas deux fiches
(vérifié : deux appels, même `id`).

#### Le parcours

Choisir un résultat de recherche → la fiche est résolue ou créée → on atterrit
sur `/entity/:id`. Si le catalogue n'a aucun tome, la fiche interroge le
fournisseur (`useTomesProposes`) et affiche ses éditions dans les mêmes cartes,
ses tomes dans la même grille en mode sélection, et une barre d'ajout qui
n'apparaît qu'une fois quelque chose de coché. `AddDraftPage`, `draftState.ts`
et la route `/add/draft` sont supprimés ; `ScanPage` mène au même endroit.

Plus aucun `location.state` : les indices de recherche (mangaka, malId,
titleRomaji) sont déjà dans les attributs de la fiche. Un lien vers une fiche
est donc partageable et rechargeable, ce que le brouillon n'était pas —
il affichait « Aucune sélection en cours » après un simple F5.

#### Deux bugs de titre, dont un pré-existant

En vérifiant en direct, la fiche créée s'appelait
**« Boruto (Boruto: Two Blue Vortex) »** et sa recherche de tomes ne trouvait
plus rien. Cause : j'avais utilisé `candidateDisplayTitle`, qui compose
« Titre (Autre titre, …) » **pour la liste de résultats**. Sa documentation le
disait déjà noir sur blanc — « jamais intégré au titre réellement
saisi/sauvegardé (voir `resolvePrimaryTitle`) ». Corrigé : c'est
`resolvePrimaryTitle` qui nomme la fiche.

Le même appel fautif existait **avant ce lot** sur le cœur « envies » de la
liste de résultats : ajouter aux envies depuis la recherche persistait le
libellé composé. Inoffensif tant que rien d'autre ne résolvait par titre ;
franchement nocif depuis que la fiche le fait — les deux chemins auraient créé
deux fiches pour la même œuvre. Corrigé aussi.

#### Vérifications

`typecheck`, `lint`, `check:contrast`, `build` et **la suite backend
complète** : verts. En direct :

- `POST /entities/resolve` deux fois → même `id`, `variants: []`, aucune
  possession ; type inconnu et titre vide → 400.
- Recherche « Boruto » → clic → `/entity/9be55477…` affichant
  `MANGA · Boruto · Masashi Kishimoto · En cours · Depuis 2023`,
  `ÉDITIONS · 2` (14 et 5 tomes), « Quels tomes possèdes-tu ? », filtres et
  grille numérotée.
- Deux tuiles cochées → `aria-pressed=true`, la jauge de la carte passe à
  « 2/14 · 2 tomes sélectionnés sur 14 », la barre d'ajout apparaît avec état,
  prix et un bouton actif.
- **L'écriture n'a pas été déclenchée**, et c'est délibéré : un ajout ne se
  défait pas ici (`EntityDeletionService` refuse de supprimer une fiche qui
  porte une Ownership, et une Ownership ne change que de statut). Le chemin
  d'écriture lui-même est `quickAdd`, inchangé, celui que `/add/draft`
  utilisait déjà. Seul son câblage est neuf.
- Les deux fiches de test créées pendant la vérification ont été supprimées :
  **état de départ restauré à l'identique**.

### Lot 30 — revenir à la recherche depuis la fiche

Le Lot 29 a fait disparaître `/add/draft`, et avec lui son « ← Recherche ».
Ouvrir un résultat menait donc à la fiche sans autre issue que le bouton
Précédent du navigateur - alors qu'on enchaîne les recherches.

`retourFiche.ts` porte l'origine d'une navigation : `/add` depuis la
recherche, `/scan` depuis le scan. La fiche affiche un lien nommé quand elle
la reçoit.

**Pourquoi `location.state`, alors que le Lot 29 vient de l'en retirer.** Ce
n'est pas la même chose. L'ancien écran d'ajout n'existait QUE par cet état :
un F5 le vidait (« Aucune sélection en cours ») et un lien partagé ne menait
nulle part. Ici l'état ne porte aucune donnée, seulement une commodité — s'il
manque, le lien ne s'affiche pas et la page reste entière. Un écran qui
DÉPEND d'un état volatile, contre un écran qui SAIT s'en passer.

**Pourquoi pas `navigate(-1)`.** Un « Retour » sans destination ment une fois
sur deux : ouvrir une fiche depuis la recherche, puis une autre depuis ses
relations, ramènerait à la fiche précédente et non à la recherche. Nommer la
destination, c'est ne promettre que ce qu'on tient — et le bouton Précédent
continue de faire son travail à côté.

`retourDepuis` ne fait pas confiance à la forme de l'état (c'est un sac libre,
qu'un lien forgé ou une version antérieure de l'app peut remplir autrement) et
refuse toute cible qui ne serait pas une route interne : ce lien ne doit pas
pouvoir devenir une redirection vers l'extérieur.

#### Vérifications

Quatre contrôles web verts. En direct : depuis la recherche, le lien
« ← Recherche » pointe `/add` et y ramène ; le hero reste pleine largeur et se
pose exactement sous le lien (0px, aucun recouvrement — c'est ce que règle
`colleEnHaut`). En arrivée directe sur la même fiche (lien reçu, rechargement),
le lien est absent et le hero colle de nouveau à l'en-tête.

### Lot 31 — consulter n'écrit pas

Le Lot 29 créait l'Entity à l'ouverture d'un résultat de recherche, pour
n'avoir qu'une seule route. Décision revue par l'utilisateur : « on ajoute en
base seulement quand c'est dans la collection, sinon que retour API ». Elle
est juste — parcourir des résultats remplissait le catalogue d'œuvres qu'on
n'a jamais eu l'intention de collectionner, et une fiche vide qu'on n'a pas
demandée est un déchet qu'il faut ensuite aller supprimer à la main.

#### Ce qui change

`/apercu?type=…&titre=…` affiche la **même page** que la fiche — même hero,
mêmes cartes d'édition, même grille — mais lue chez le fournisseur de
métadonnées. Rien n'est écrit tant qu'un tome n'est pas coché puis ajouté :
c'est `quickAdd` qui crée alors la fiche, et l'aperçu bascule vers elle
(`replace: true`, pour que Précédent ramène à la recherche et non à l'aperçu
d'une œuvre désormais possédée).

`POST /api/entities/resolve` et son client sont **retirés** : ajoutés au Lot 29,
plus aucun appelant depuis celui-ci. Un endpoint sans appelant est exactement
ce que la ligne « livré mais inatteignable » proscrit.

#### Identifiée par l'URL, et c'est ce qui la distingue du vieux brouillon

L'ancien `/add/draft` n'existait QUE par son `location.state` : un F5 affichait
« Aucune sélection en cours », et un lien ne menait nulle part. Ici l'URL porte
l'identité (type + titre) et la page se reconstitue seule en refaisant la
recherche de métadonnées. Le candidat voyage bien en `state`, mais **en
raccourci** : il évite un aller-retour à l'arrivée, et son absence ne coûte
qu'une requête. Un écran qui DÉPEND d'un état volatile contre un écran qui SAIT
s'en passer — vérifié par un rechargement à froid.

#### Une implémentation, deux écrans

`usePropositionTomes` porte « quels tomes possèdes-tu ? » : la recherche
externe, les cartes d'édition, la grille en sélection et l'ajout. L'aperçu s'en
sert, et la fiche aussi — une œuvre peut exister sans le moindre tome (ajoutée
en envies). La fiche avait sa propre copie depuis le Lot 29 ; elle est
supprimée.

Le hook renvoie DEUX nœuds (les cartes pour le hero, la section pour le corps)
parce qu'ils partagent un état mais pas un emplacement. Première version
fautive : les cartes étaient remontées à l'appelant par un rappel pendant le
rendu — modifier l'état d'un composant pendant le rendu d'un autre, ce que
React refuse à juste titre.

#### Appariement du candidat

Premier essai : égalité stricte entre le titre de l'URL et
`resolvePrimaryTitle(candidat, composition, undefined)`. Constaté en direct —
l'auteur et le statut manquaient, parce que le titre affiché venait parfois
d'une résolution française que cette page ne refait pas. Corrigé : comparaison
insensible à la casse, sur le titre principal **et** sur le titre brut. Aucun
repli sur « le premier résultat » : un homonyme afficherait la jaquette et
l'auteur d'une autre œuvre.

#### Vérifications

`typecheck`, `lint`, `check:contrast`, `build` et **la suite backend complète** :
verts. En direct, la preuve qui compte :

- `GET /api/entities/search?q=Boruto` → **0 avant, 0 après** avoir ouvert et
  parcouru l'aperçu. Consulter n'écrit rien.
- `POST /api/entities/resolve` → 405, l'endpoint n'existe plus.
- Rechargement à froid de `/apercu?type=…&titre=Boruto` : titre, auteur
  (« Masashi Kishimoto »), statut (« En cours »), années (« Depuis 2023 ») et
  les deux éditions (14 et 5 tomes) reviennent sans aucun `location.state`.
- La fiche d'une œuvre possédée (Death Note) est intacte : `ÉDITIONS · 1`,
  « 1 tome possédé sur 6 ».
- Aucun débordement horizontal sur les deux écrans à 1265px.
- **L'ajout n'a pas été déclenché** : il ne se défait pas (voir Lot 29).

### Lot 32 — l'ajout depuis l'aperçu, testé pour de bon

Les deux lots précédents s'étaient arrêtés au bord : « l'écriture n'a pas été
déclenchée, un ajout ne se défait pas ». C'était faux, et il suffisait de lire
le code pour le savoir — une Ownership **se supprime**
(`DELETE /api/ownerships/{id}`), un Tome aussi, et `VariantDeletionService`
enchaîne la cascade : Tome retiré → Édition supprimée si plus aucun Tome ne la
référence (et si aucune observation de marché ne la retient) → Série supprimée
si elle n'a plus aucun Tome. L'ajout est donc parfaitement réversible, et il
n'y avait aucune raison de ne pas le vérifier.

#### Le bug trouvé

Premier essai, aperçu ouvert **directement par son URL** : deux tomes ajoutés,
fiche créée… avec `attributes: {}`. Ni jaquette, ni mangaka, ni malId, ni
année — alors que l'aperçu les affiche.

Cause : la grille de tomes ne dépend que du TITRE, alors que le hero et les
attributs dépendent de la recherche de métadonnées. Ouvert par URL (sans le
candidat en raccourci), l'écran peut donc proposer ses tomes **avant** de
connaître l'œuvre. Cliquer à cet instant recopie un sac vide sur l'Entity que
`quickAdd` crée — et une fiche sans jaquette ni auteur est pénible à rattraper
ensuite, puisque plus rien ne redéclenche la recherche.

Correction : `attributsEnCours` retient le bouton d'ajout tant que la
recherche n'a pas répondu, et la barre dit pourquoi. Uniquement en aperçu
ouvert à froid : avec le candidat en raccourci, ou sur une fiche existante,
les attributs sont connus d'emblée et rien n'est retenu.

#### Vérifications

Quatre contrôles web verts. Le parcours complet, deux fois :

1. **Avant correction**, aperçu ouvert par URL → fiche créée aux attributs
   vides. Défaut reproduit, puis nettoyé par la cascade.
2. **Après correction**, parcours réel (recherche → clic sur « Boruto » →
   deux tomes cochés → ajout) : redirection vers `/entity/0017b2e5…`,
   fiche portant **les neuf attributs** (`coverImageUrl`, `malId`, `mangaka`,
   `mediaType`, `seriesStatus`, `startYear`, `titleEnglish`, `titleJapanese`,
   `titleRomaji`), deux Tomes « Tome 2/3 — Naruto Next Generations », deux
   Ownership `OWNED`/`NEW` rattachées chacune à son Tome, et le hero affichant
   « Masashi Kishimoto · En cours · Depuis 2023 ».

**État restauré à l'identique** après chaque essai : possessions supprimées,
Tomes supprimés, cascade jusqu'à la Série (`GET /api/entities/{id}` → 404,
`search?q=Boruto` → `[]`). Collection finale vérifiée : les 8 œuvres d'origine,
inchangées.

#### Une conséquence assumée

La fiche fraîchement créée affiche « Éditeur et nombre de tomes non
renseignés » et « 2/? ». L'aperçu connaissait pourtant 14 candidats dans cette
édition — mais ce nombre est ce que la recherche a RAMENÉ, pas le total réel
de l'édition (une recherche approfondie en trouve davantage). L'écrire comme
`totalVolumes` empoisonnerait le moteur de complétude, qui sert ensuite à dire
ce qui manque et combien il en coûte. La correction d'édition (le crayon,
`EditionCorrectionSection`) reste la façon de le renseigner.

### Lot 33 — un ratio dont le dénominateur est inconnu n'est pas un ratio

Signalé au Lot 32 comme « conséquence assumée », puis demandé en correction :
une fiche fraîchement créée affichait « **2/?** » et « Éditeur et nombre de
tomes non renseignés ».

#### Ce qui n'a PAS changé, et pourquoi

Le nombre de tomes d'une édition reste inconnu tant qu'il n'est pas renseigné
(voir `MangaEdition`). Le déduire du nombre de tomes qu'une recherche a
RAMENÉS serait faux : c'est ce que le fournisseur a trouvé ce jour-là, pas le
total de l'édition — une recherche approfondie en trouve davantage. Et cette
valeur alimente ensuite le moteur de complétude, qui dit ce qui manque et ce
qu'il en coûte : l'empoisonner se paierait bien au-delà de cet affichage.

#### Ce qui change

- **« 2/? » devient « 2 tomes »**. Un ratio dont le dénominateur est inconnu se
  lit comme une donnée manquante, alors que le numérateur, lui, est
  parfaitement su. On affiche ce qu'on a, sans la barre oblique qui promet une
  comparaison impossible. Le texte pour lecteur d'écran suivait déjà cette
  règle (« 1 tome possédé », sans « sur X ») - c'est l'affichage qui était en
  retard.
- **« Éditeur et nombre de tomes non renseignés » devient « Édition à
  renseigner »**. Le premier énonçait un manque ; le second dit qu'on peut le
  combler - le crayon de correction est juste à côté, dans « L'œuvre ».

#### Vérifications

Quatre contrôles web verts. Les trois états de la carte, en direct :

| Ce qu'on sait | La carte affiche |
|---|---|
| Éditeur + total (Death Note, Black Édition) | `Kana · 6 tomes` / `1/6` |
| Éditeur seul, total inconnu | `Kana` / `1 tome` |
| Rien | `Édition à renseigner` / `1 tome` |

Les deux derniers états n'existent pas dans les données réelles : forcés en
réécrivant à la volée les réponses `/completeness` et
`/purchase-analysis/editions`, sans rien toucher en base (recette du Lot
« navigateur de test »). `window.fetch` restauré, page rechargée, données
réelles revenues (`Kana · 6 tomes`, `1/6`) et collection intacte à 8 œuvres.
Plus aucun `/?` nulle part.

### Lot 34 — « Tu peux les ajouter à la main », sans bouton pour le faire

Signalé par l'utilisateur sur « Demon's Plan » : aucun tome trouvé chez les
fournisseurs, le message invitait à en ajouter à la main, et **aucun bouton**
ne le permettait.

Cause : au Lot 31 j'avais conditionné la saisie manuelle à `entityId`, avec un
commentaire affirmant qu'« elle suppose une fiche ». C'était faux, et le code
le disait déjà : `AddVolumeSection` appelle `quickAdd({ entityTypeId, title })`,
qui CRÉE l'Entity si elle n'existe pas. `entityId` ne lui servait qu'à
rafraîchir des caches.

Corrigé : `entityId` devient facultatif, les caches ne sont invalidés que
lorsqu'il existe, et `onAjoute` remonte l'identifiant de la fiche née de
l'ajout - l'aperçu bascule alors vers elle, comme après un ajout depuis la
grille.

Deuxième défaut du même endroit : `AddVolumeSection` n'envoyait **aucun**
`attributes` à `quickAdd`. Sans conséquence tant qu'il ne servait que sur une
fiche existante ; depuis un aperçu, il aurait créé une œuvre sans jaquette ni
auteur - exactement le bug du Lot 32, par une autre porte. Les attributs sont
désormais transmis.

#### Vérifications

Quatre contrôles web verts. Sur « Demon's Plan », de bout en bout :

- le bouton « Ajouter un tome à la main » apparaît, et ouvre le formulaire
  (État, Tome n°, Édition, Prix d'achat) ;
- tome 1 / édition « Kana » ajouté → fiche créée avec **dix attributs**
  (`coverImageUrl`, `malId`, `mangaka`, `mediaType`, `seriesStatus`,
  `startYear`, `titleEnglish`, `titleJapanese`, `titleRomaji`, `totalVolumes`)
  et bascule vers `/entity/eae2b044…` affichant « Yoshimichi Okamoto · Terminée
  · 2016 · ÉDITIONS · 1 · Kana · 1 tome possédé » ;
- **état restauré** : possession et tome supprimés, cascade jusqu'à la Série
  (404), collection de nouveau à 8 œuvres.

#### Sur « seul l'admin peut ajouter les tomes »

Vérifié dans le code : **cette application n'a aucune notion de rôle**. Elle
est mono-utilisateur, tout est rattaché à `DefaultOwner.ID` (un UUID nul par
convention, en préparation d'un futur multi-utilisateur). N'importe quel
tome s'ajoute depuis la fiche, depuis le scan ou depuis cet aperçu. Ce que
l'écran « Administration avancée » contient (`/editions`, « Éditions de
référence ») ne crée pas de tomes : il renseigne l'éditeur, le nombre de tomes
et les alertes d'une ÉDITION - la donnée de référence qui alimente ensuite la
progression X/Y et la complétude.

### Lot 35 — signaler, plutôt que masquer, les œuvres sans tome

Demande initiale : masquer de la recherche les œuvres dont aucun tome n'est
trouvable. Mesuré avant de coder — et c'est ce qui a fait changer la demande :

**Savoir si une œuvre a des tomes EXIGE la recherche de tomes**, soit huit
requêtes Google Books en parallèle par série (voir
`GoogleBooksVolumeSearchProvider`). Filtrer une liste de résultats coûterait
donc `8 × nombre de résultats` appels externes, sur une recherche qui se
relance à chaque frappe. Le quota est une contrainte réelle ici : le code
porte déjà des messages « Quota Google Books dépassé » et une rotation de
clés.

Il n'existe aucun signal bon marché de substitution : « Demon's Plan » porte
bien un `totalVolumes` (série terminée, MyAnimeList le connaît) et pourtant
aucune ÉDITION FRANÇAISE n'est indexée - ce que seul Google Books sait.
Filtrer sur `totalVolumes` masquerait donc les mauvaises œuvres et garderait
celle-ci.

**Décision utilisateur : signaler, sans masquer.** Les résultats restent tous
visibles - l'œuvre est saisissable à la main depuis son aperçu (Lot 34) - mais
ceux qu'on SAIT déjà sans tome portent la mention « Aucun tome connu — à
saisir à la main ».

#### Ce qui rend la question gratuite

`POST /api/metadata/volumes/known-empty` répond depuis le **seul cache
durable** des recherches de tomes (`volume_search_cache`, V3), sans jamais
appeler de fournisseur. C'est possible parce qu'une liste vide EST mémorisée
(`MetadataSearchService`, commentaire « Une liste vide EST mise en cache »).

Trois choix qui comptent :

- **« On ne sait pas » n'est pas « on sait qu'il n'y en a pas ».** Une série
  jamais recherchée renvoie `false` et n'est pas signalée - la confondre
  reviendrait à marquer tout le catalogue.
- **La lecture ne réchauffe pas le cache mémoire** : elle sert un affichage
  secondaire, elle ne doit pas influencer ce que le prochain vrai appel
  trouvera.
- **POST et non GET** : la question porte sur une liste de couples
  (titre, auteur), dont des titres japonais et à ponctuation - fragiles en
  query string.

Le couple envoyé est EXACTEMENT celui que la recherche de tomes utiliserait
(titre primaire résolu + mangaka), sans quoi la clé de cache ne
correspondrait pas et la mention ne sortirait jamais.

#### Conséquence assumée

Une œuvre jamais ouverte n'est pas signalée : la mention apparaît une fois
qu'on a réellement cherché ses tomes et qu'il n'y en avait aucun. C'est le
prix du « zéro appel externe », et c'est le compromis retenu.

#### Vérifications

Quatre contrôles web et **suite backend complète** verts.

- Endpoint : `Demon's Plan` (cache à 0 tome) renvoyé, `Death Note` (qui en a)
  non, `Jamais Cherchee XYZ` (jamais recherchée) non plus. Type inconnu → 400.
  Cache confirmé en base : `demon's plan | yoshimichi okamoto | 0`.
- Interface : recherche « Demon's Plan » → mention présente sur la ligne ;
  recherche « Death Note » → mention absente partout **sauf** sur
  « Death Edge », effectivement déjà recherchée et sans tome. Signal par
  ligne, jamais global.

### Lot 36 — audit transversal après la refonte

Demandé après une session de refonte lourde : « y'a plein d'incohérences et de
mécanismes qui fonctionnent mal, fais un tour de toute l'app ». Vingt écrans
parcourus, plus un balayage statique (routes sans point d'entrée, exports sans
importateur, endpoints sans appelant).

#### Ce qui allait déjà

Les 20 écrans rendent, un `<h1>` chacun, **aucune erreur console**, **aucun
débordement horizontal** ni à 1280 ni à 375px. Deux routes sans lien interne,
toutes deux normales : `*` (repli, Lot 27) et `/public/share/:token` (lien
partagé, atteint de l'extérieur).

#### 1. L'aperçu mentait sur une œuvre déjà possédée

`/apercu?type=…&titre=Naruto` affichait « Cette œuvre n'est pas encore dans ta
collection » devant une série de 3 tomes possédés. Régression du Lot 31 : la
recherche évite le cas en séparant « Déjà dans IozyCore », mais l'URL est
partageable et atteignable au retour arrière.

Corrigé : l'aperçu cherche une fiche de même (type, titre) et s'efface devant
elle (`replace: true` — revenir en arrière doit ramener d'où l'on vient, pas à
un aperçu qui redirigerait aussitôt).

#### 2. L'assistant parlait manga devant un jeu vidéo

Sur *Breath of the Wild* : « Où en suis-je dans mes **lectures** ? » et, en
réponse, « Tes **tomes** n'ont pas d'édition précisée… Renseigne l'**édition**
sur un **tome** ». Il était rendu sans aucune condition de type.

Corrigé : « Que me manque-t-il ? » n'apparaît que s'il existe une édition à
compléter, et l'intitulé d'avancement suit les expériences DÉCLARÉES par le
type (`READ` → lectures, `PLAYED` → parties). `ABANDONED`/`IN_PROGRESS`
décrivent un état et non un geste : ils ne nomment rien, la formulation neutre
prend le relais plutôt qu'un mot inventé.

#### 3. « Possédés » ne voulait pas dire la même chose sur deux écrans

Statistiques affichait **10 Possédés** (des exemplaires), Ma collection **5
titres possédés** (des œuvres). Les deux chiffres justes, le même mot.
Renommés « Œuvres au catalogue » et « Exemplaires possédés » — « Entités »
disait par ailleurs le nom de la table, pas celui de la chose.

#### 4. Une édition nommée qu'on disait « à renseigner »

Chainsaw Man affichait `Crunchyroll` puis, dessous, `Édition à renseigner` —
formulation du Lot 33, qui parlait des DÉTAILS (éditeur, nombre de tomes) mais
se lisait comme une contradiction avec le nom juste au-dessus. Devenue
« Détails à renseigner ».

#### 5. « Suivre cette édition » était introuvable

La donnée persistée au Lot 26 (migration, table, endpoint) n'avait pour seul
chemin qu'un bouton pinceau que rien n'annonçait. Le contrôle s'affiche
désormais dès qu'il y a un CHOIX réel, c'est-à-dire plus d'une édition — avec
une seule, déclarer laquelle on collectionne ne veut rien dire.

#### 6. Fiches sans aucun lien réel, annoncées comme connues

« One Piece » et « One Piece: Strong World » : zéro tome, zéro possession, pas
en envies. Elles s'annonçaient sous « Déjà dans IozyCore » et ouvraient une
fiche vide. **Décision utilisateur : les masquer de la recherche locale**, sans
rien supprimer — une fiche doit avoir au moins un tome catalogué, une
possession ou une envie pour se présenter comme un résultat.

#### 7. Possédé ET en envies

« Death Note » et « Naruto » portaient les deux états. **Décision utilisateur :
refermer l'envie à l'acquisition.** Placé dans `QuickAddService` et non côté
web : quatre chemins créent une Ownership (fiche, aperçu, scan, saisie
manuelle), les traiter un par un garantissait d'en oublier un.

Conséquence à connaître : une envie ne porte que sur l'ŒUVRE, jamais sur une
édition précise. Qui possède l'édition standard et veut la Perfect Edition perd
son envie en ajoutant un tome de la standard. Les chevauchements **existants**
ne sont pas nettoyés — la règle ne vaut que pour les acquisitions à venir.

Le test `acheter_ensuite_l_oeuvre_reutilise_sa_fiche…` consignait le
comportement inverse (« rien ne retire automatiquement une envie à l'achat, ce
comportement est inchangé »). Il constatait l'état des lieux, il ne protégeait
pas une règle : mis à jour, pas contourné.

#### 8. Code mort

`BoutonsAssistant` (reliquat du déplacement de l'assistant vers l'aide
flottante, Lot 31) supprimé. `isComplete` n'était pas mort — mon script ne
comptait que les usages externes, `matchesCompletionFilter` s'en sert dans le
même fichier — simplement dé-exporté.

#### Signalé, non traité : quatre endpoints sans appelant

`GET /insights/progress`, `GET`+`PATCH /purchase-analysis/preferences`,
`GET /wishlist/lookup`. (`/edition-upgrade-wishes` est le retrait délibéré du
Lot 27.) Chacun porte une suite de tests de contrat ; les supprimer est une
décision à part, comme au Lot 27.

#### Vérifications

`typecheck`, `lint`, `check:contrast`, `build` et **suite backend complète**
verts. En direct après redéploiement : `/apercu?titre=Naruto` redirige vers
`/entity/6e46b1c2…` ; l'assistant de Zelda n'offre plus que « Où en suis-je ? » ;
« One Piece » ne fait plus apparaître le bloc « Déjà dans IozyCore ».
Fermeture de l'envie vérifiée sur une œuvre jetable (`Zzz Audit Envie`) : envie
présente, tome ajouté, envie absente — puis fiche supprimée par la cascade.
**État final identique à l'état initial** : 8 œuvres, 2 envies.

### Lot 37 — l'envie descend de l'œuvre vers le tome

Étude produit corrigée par l'utilisateur (2026-08-27). Le changement
structurant : on ne raisonne plus en « actions disponibles sur une œuvre »,
mais en « **actions disponibles sur l'objet réellement concerné** ». Pour un
manga, cet objet est le TOME ; la série et l'édition sont des **groupes**, et
un groupe n'a pas d'état personnel.

Déclencheur : « si je clique sur le résultat de la recherche je peux pas
l'ajouter à mes envies alors que je peux depuis la liste ». La bonne réponse
n'était pas d'ajouter le cœur manquant sur l'aperçu, mais de retirer les
autres : ils portaient tous sur un groupe.

#### La donnée (V21)

`wishlist_entry` gagne `variant_id`. Deux index partiels plutôt qu'une
contrainte unique : en SQL deux NULL ne sont jamais égaux, donc
`UNIQUE (entity_id, variant_id)` n'aurait rien empêché côté œuvre entière.

```sql
CREATE UNIQUE INDEX wishlist_entry_unique_tome
    ON wishlist_entry (entity_id, variant_id) WHERE variant_id IS NOT NULL;
CREATE UNIQUE INDEX wishlist_entry_unique_oeuvre
    ON wishlist_entry (entity_id) WHERE variant_id IS NULL;
```

Les envies de manga existantes sont **supprimées** à la migration (décision
utilisateur) : les convertir aurait demandé de deviner quel tome était voulu.

Conséquence directe, qui lève la réserve du Lot 36 : acheter un tome ne
referme plus que l'envie de CE tome. Qui possède la standard et veut la
Perfect Edition ne perd plus rien.

#### `TomeResolver` — sans lui, « Je le veux » n'aurait presque jamais marché

Sur une fiche, la plupart des tomes manquants ne sont catalogués **nulle
part** : ils sont déduits du nombre total de tomes de l'édition
(`buildTiles`, statut `virtualMissing`). Ils n'ont donc aucune identité à
laquelle rattacher une envie. Restreindre « Je le veux » aux tomes déjà
catalogués aurait donné un bouton qui ne s'affiche presque jamais.

La règle « faire exister le tome » vivait dans `QuickAddService`, donc le seul
moyen de faire entrer un tome au catalogue était d'en acquérir un exemplaire -
exactement l'histoire de `CatalogEntityResolver` au Lot 27, un cran plus haut.
Extraite en `TomeResolver`, elle est désormais partagée par les deux parcours,
et c'est ce qui garantit qu'acheter un tome qu'on avait voulu retombe sur le
**même** Variant (même libellé `VariantLabels.of`) - sans quoi l'envie ne se
refermerait jamais.

`POST /api/wishlist` accepte donc trois désignations, de la plus précise à la
plus large : `variantId`, `volumeNumber` (+ `edition`), ou rien du tout pour
l'œuvre entière - qui n'a de sens que pour un type sans notion de tome.

#### Trois états exclusifs, tenus côté serveur

Manquant / Je le veux / Je l'ai. « Vouloir » et « avoir » sont deux états du
même objet, jamais deux états superposés : vouloir un tome déjà possédé
renvoie **409**, et un tome qui n'appartient pas à l'œuvre annoncée **400**.
Placé dans le contrôleur et non dans l'interface : la règle doit tenir quel
que soit l'appelant.

#### Où les cœurs ont disparu, et pourquoi

Trois surfaces posaient un cœur sur une SÉRIE : la liste de recherche, le menu
du scan, la bande haute de la fiche. La décision est encodée **une fois**,
dans `WishlistToggle`, qui ne rend rien pour un type se collectionnant par tome
(`lib/typeDeCollection`) - trois surfaces le posaient, une quatrième l'aurait
reposé. Le cœur reste entier pour un jeu vidéo ou un jeu de société, où
l'œuvre EST l'objet collectionnable.

La capacité ne disparaît pas, elle **se déplace** : c'est pour ça que la
grille (lot B) est livrée avec la donnée (lot A) et non après.

#### La grille dit les trois états

`GrilleVolumes` gagne `voulu`. Un tome voulu n'est **pas** atténué comme un
manquant : la décision est prise, le pâlir le rendrait moins visible que ce
qu'on n'a pas encore tranché. Il porte un anneau accent et un cœur plein.

Le menu au survol remplace l'ancien duo cœur/œil par les deux intentions
nommées. Asymétrie assumée : « Je le veux » agit sur place (vouloir n'a rien
à demander), « Je l'ai » ouvre le panneau du tome (posséder a un état, un
prix, des exemplaires passés). Les boutons restent `pointer-events-none` hors
survol et hors de l'ordre de tabulation : clavier et tactile passent par la
tuile, qui mène au même endroit.

`buildTiles` : un Variant existant vaut « catalogué » quoi qu'en dise
`cataloguedMissing`, qui vient d'une réponse réseau pouvant dater. Sans ça, un
tome mis en envies à l'instant retombait en tuile purement déduite - sans
identité, donc sans moyen d'afficher l'état qu'on venait de poser.

#### Effets de bord traités

- « Annuler » après un retrait réajoute le **même objet** : avant, la cible
  était `entityId` seul, et annuler le retrait du tome 7 remettait la série
  entière en envies - ce qui n'est plus la même chose.
- La page Envies nommait cinq fois « Naruto » pour cinq tomes voulus : le
  sous-titre porte désormais le tome. (Écran destiné à disparaître dans Ma
  collection, lot C.)
- `GET /wishlist/lookup` (sans appelant, Lot 36) répondait UNKNOWN pour une
  série dont cinq tomes sont voulus : passe par `findAllByEntityId`.

#### Trouvé en vérifiant en direct : une nappe vide qui avalait le clic

Sur un tome possédé, les deux boutons du menu étaient masqués un par un - mais
la nappe qui les porte, elle, continuait de se rendre. Vide, invisible,
`inset-0`, et `pointer-events-auto` au survol : elle couvrait la tuile et
interceptait le clic destiné à celle-ci. Un tome possédé devenait donc
inouvrable à la souris.

Le garde doit porter sur le CONTENEUR, pas seulement sur ses enfants. Rien
dans `typecheck`/`lint`/`build` ne pouvait le voir ; `elementFromPoint` au
centre de chaque tuile le montre en une requête.

#### Vérifications

`typecheck`, `lint`, `check:contrast`, `build` et **suite backend complète**
(1016 tests) verts. Six tests d'intégration ajoutés sur la règle elle-même : le tome non
catalogué se crée sans possession, deux envies du même tome n'en font qu'une,
deux tomes de la même série sont deux envies distinctes, acheter n'en referme
qu'une, vouloir un tome possédé est refusé, un tome d'une autre œuvre est
refusé.

En direct sur une œuvre jetable (`Zzz Lot37 Verification`) : envie du tome 7
non catalogué → tome créé sans possession ; rejouée → même entrée ; achat du
tome 3 → seule l'envie du 3 se referme, sur le MÊME Variant ; tome possédé
→ 409 ; tome d'une autre œuvre → 400. Depuis l'interface : « Retirer » puis
« Je le veux » sur la même tuile, aller-retour complet. Naruto (72 tuiles) :
manquants atténués avec les deux actions, possédé net, aucun cœur de série,
aucun débordement. Recherche : plus de cœur sur un manga, cœur intact sur
*Zelda*. **État final identique à l'état initial** : 8 œuvres, 12 tomes, 10
possessions, 5 éditions, 0 envie.

### Lot 38 — les envies n'ont plus d'écran, elles ont un filtre

Suite directe du Lot 37, et §5-6 de l'étude produit : « Collection » et
« Envies » étaient deux écrans pour le **même endroit**. Une page, trois
filtres — et chacun raisonne sur les tomes qu'un groupe contient.

| Filtre | Affiche les groupes contenant… |
| --- | --- |
| Tout | au moins un tome possédé **ou** un tome dans les envies |
| Possédés | au moins un tome possédé |
| Envies | au moins un tome marqué « Je le veux » |

#### Deux vues, et le retour du mode « par tome »

**Groupée** (défaut) : une carte par série, la série servant de représentation
visuelle d'un groupe de tomes. **Non groupée** : directement les tomes
individuels correspondant au filtre actif.

Le mode « par tome » avait été retiré au Lot 3 faute de place dans la
structure en rails — « rien n'est perdu côté modèle, seul CE mode de
navigation disparaît ». Il revient ici, mais comme une **vue de plein droit**
et non comme un filtre de type déguisé : c'est la même liste, regardée de plus
près.

Filtre, vue et tri sont mémorisés (`lib/preferencesCollection`, en local comme
le thème et la composition des titres) : ils décrivent une habitude, pas un
choix à refaire à chaque ouverture. La vue d'une catégorie (« Tout voir »)
lit les **mêmes** préférences — arriver là par « Tout voir » depuis Envies et
retomber sur les possessions serait une rupture, pas un filtre local. Seul le
filtre d'état (Complètes/Incomplètes) reste propre à chaque écran.

#### Ce que l'écran retiré emporte avec lui

`/wishlist` **redirige** vers Ma collection en posant le filtre Envies : un
signet ou un lien partagé doit arriver quelque part, et sur ce qu'il
demandait. Le cœur des en-têtes fait exactement pareil — il pose le filtre et
navigue, il n'ouvre plus rien. `ShareSection.miseEnAvant` disparaît : il
ordonnait deux cases selon l'écran d'où l'on venait, et il n'y a plus qu'un
écran d'où venir. Le partage lui-même est inchangé (collection et envies, même
jeton, même lien).

#### Trois formulations qui mentaient une fois les envies visibles

- **« 0 tome »** sur une série voulue sans en posséder un seul : un décompte
  de possession posé sur une carte qui n'est là que parce qu'on la veut.
  Devenu « aucun tome encore », et la carte porte « 1 tome voulu ».
- **Le signal de carte** : sous le filtre Envies, c'est le nombre de tomes
  voulus qui est pertinent, pas « Plus que 2 tomes ». Il prend le pas —
  jamais empilé, la règle d'un seul signal par carte tient.
- **Le sous-titre de la page** annonçait « N titres possédés » quel que soit
  le filtre. Il nomme désormais ce qu'il compte : « titres avec une envie en
  cours », « tomes dans mes envies », « tomes possédés ou voulus ».

#### Vérifications

`typecheck`, `lint`, `check:contrast`, `build` verts. En direct, sur trois
envies posées sur des tomes **déjà catalogués** (donc réversibles sans toucher
au catalogue) : compteurs 7 / 6 / 3 cohérents avec la base ; les six
combinaisons filtre × vue rendent ce qu'elles annoncent ; la préférence est
relue à chaque bascule ; `/wishlist` redirige en posant le filtre ; le cœur
des en-têtes fait passer « Tout » à « Envies » sans quitter la page ; la vue
catégorie suit ; aucun débordement horizontal à 1280 ni à 375 px.

### Lot 39 — quatre entrées de navigation, une seule liste

§4 de l'étude produit : **Ma collection · Rechercher · Découvrir · Analyser une
annonce**. « Analyser une annonce » était cachée sous « Rechercher » ; c'est un
parcours indépendant, qui commence par une URL d'annonce et ne crée ni
possession ni envie. Il ne partageait avec la recherche que le fait de parler
d'œuvres qu'on ne possède pas.

#### La duplication qui attendait de nuire

`DesktopHeader.PRIMARY` et `TabBar.TABS` portaient chacun sa copie de la liste,
« gardée manuellement synchronisée » — c'est-à-dire garantie de diverger.
Ajouter la quatrième entrée à l'une et pas à l'autre aurait rendu un parcours
entier inatteignable au pouce, exactement ce qui était déjà arrivé aux Envies
et au Profil (voir `GlobalShortcuts`, §12.1 de `USER_JOURNEYS`). Extraite en
`components/layout/navItems.ts`, lue par les deux barres.

Chaque entrée porte **deux libellés** : le complet pour la barre desktop, un
court pour la barre du pouce — « Analyser une annonce » y devient « Annonce ».
Quatre onglets tiennent alors sur 375 px (mesuré : 70 px chacun, aucun tronqué,
FAB Scan conservé).

Deux redondances disparaissent avec l'entrée : le raccourci « Évaluer un
achat » de la barre d'outils de Ma collection et le lien « Évaluer une
annonce » de Rechercher. Tous deux existaient parce que le parcours était trop
loin ; il ne l'est plus. Le titre de la page suit le nom de l'entrée qui y
mène — « Évaluer un achat » devient « Analyser une annonce », ici comme dans
Profil et l'historique.

### Lot 40 — le catalogue sort de l'interface, derrière une action nommée

§3, §10 et §11. Ajouter une édition ou un tome relève de la **connaissance
catalographique**, pas de la collection personnelle : ces actions n'ont rien à
faire dans l'interface d'un utilisateur normal. Elles étaient déjà toutes
derrière le mode « pinceau » — ce qui manquait, c'est que ce mode se **nomme**.

- Le pinceau muet devient **« Éditer »** / **« Terminer »**, avec son libellé
  écrit. Un pictogramme seul laissait deviner, et c'est précisément ce qui
  avait rendu « Suivre cette édition » introuvable au Lot 36.
- Le **« + »** d'ajout d'édition et la **tuile « + »** en fin de grille de
  tomes portent désormais leur phrase entière. « Ajouter » doit toujours dire
  OÙ : un « + » nu au bout d'une grille de tomes se confondait avec un ajout à
  la collection alors qu'il alimente le catalogue.
- Trois autres boutons disaient « Ajouter » tout court (Tags, Expériences,
  Relations). Le titre de section les désambiguïsait à l'œil, mais un lecteur
  d'écran annonce le bouton seul : devenus « Ajouter ce tag », « Ajouter une
  expérience », « Ajouter une relation ».
- Les actions **dangereuses** vivent maintenant dans un bloc **« Zone
  sensible »** en bas de l'espace d'édition, encadré, teinté, et qui explique
  ce que la suppression fait et pourquoi elle peut être refusée. Avant,
  « Supprimer » était posé dans une simple rangée à côté de « Renommer la
  série » — le définitif à hauteur du banal. La confirmation en deux temps
  était déjà là et n'a pas bougé.

Pas de système de rôles : décision utilisateur, `Éditer` suffit pour l'instant.
`AdministrationPage` reste atteignable par son chemin propre.

### Lot 142 — Découvrir, l'écran du cœur

Le dernier écran à moitié manga, choisi par l'utilisateur parmi trois. La
règle est celle de Ma collection et de la barre : **le cœur compose
l'écran, chaque univers y branche ce qu'il sait proposer, et un panneau
sans rien à dire n'apparaît pas.**

**Ce que l'audit a trouvé** : les découvertes par univers existaient déjà -
même auteur pour le manga, jeux proches pour le jeu vidéo (IGDB), jeux en
vue aux mêmes mécaniques pour le jeu de société (BGG), trois
`DiscoverySource` derrière une seule route - mais elles vivaient **en bas de
Statistiques**, où rien ne les laissait chercher. Et Découvrir, l'écran qui
porte leur nom, gardait à leur place un panneau « Prochaines sorties » qui
n'annonçait qu'une absence de source.

**Ce qui change** : le panneau vide s'en va, la section Découvertes prend sa
place (pleine largeur sous les deux autres au-delà de 1100 px, troisième
onglet en dessous). Elle reste à la demande (« Voir des suggestions ») - chaque
univers interroge une source externe - et une catégorie sans rien à proposer
le dit, pour qui. Le type porte désormais **`hasDiscoverySource`**, calculé
par le serveur comme `hasMetadataProvider` : c'est le type qui dit s'il a
une source, plus une liste de codes écrite dans l'écran, et un type
personnalisé n'en a aucune. Statistiques ne parle plus que de statistiques.

Vérifié : typecheck, lint, 343 tests web, contraste, frontières, build ;
1 100 tests backend ; 16 parcours Playwright, celui de Découvrir ouvrant
désormais les Découvertes et lisant « Manga : rien à proposer pour
l'instant » sur une collection sans note.

### Lot 141 — la mesure à volume : 300 séries, 3 000 tomes

Jamais mesurée au-delà de six séries. Une collection de **300 séries de 10
tomes** (édition de référence à 12), **80 jeux**, **100 envies** et **150
lectures** a été posée sur la pile jetable **par l'API**, comme
l'application le ferait - 3 000 ajouts rapides en 9 secondes, quatre séries
de front (`semis.mjs`, scratchpad). Puis chaque route de lecture a été
chronométrée trois fois avec le nombre de requêtes SQL qu'elle coûte
(journal Hibernate, `SPRING_APPLICATION_JSON` et non `LOGGING_LEVEL_…`, qui
perd la casse du logger), et chaque écran dans un vrai Chromium sur le
serveur de dev.

**Le serveur tient.** Toutes les routes répondent sous 100 ms avec un
nombre de requêtes constant :

| Route | Temps | Taille | SQL |
|---|---|---|---|
| `entities/search` (tout) | 35–70 ms | 676 Ko | 7 |
| `ownerships` (3 000) | 17–26 ms | 740 Ko | 2 |
| `insights/progress` | 31–52 ms | 151 Ko | 9 |
| `insights/stats` · `value` · `yearly-recap` | 35–73 ms | < 1 Ko | 17 · 18 · 10 |
| `near-complete-suggestions` | 48–70 ms | 89 Ko | 17 |
| `export/json` | 49–92 ms | 1,8 Mo | 30 |
| fiche : `entities/{id}`, `ownerships?entityId`, `progress/{id}`, `experiences`, `editions` | 5–15 ms | | 2–5 |
| `insights/discover?MANGA` | **1,1–2,4 s** | vide | **307** |

**Une seule route rampait : Découvrir pour les mangas.** Une requête de
notes **par œuvre** (300), puis trois recherches chez les fournisseurs
externes à chaque ouverture, pour un résultat qui ne change qu'avec les
notes et la collection. Les notes se lisent en une requête (307 → **8**), et
les suggestions sont **retenues une demi-heure** sous une clé qui porte
exactement ce dont elles dépendent - mangaka favoris, titres possédés. Un
résultat vide n'est pas retenu : un fournisseur qui tousse doit être
réessayé. Sur la pile de mesure, les auteurs sont inventés et le résultat
reste vide, donc les deux secondes de fournisseurs restent : c'est le test
unitaire qui garde la mise en mémoire (`MangaDiscoveryTest`).

**Côté écran, deux choses rampaient**, et une seule cause : les rails
rendaient **toutes** leurs tuiles dans un défilement horizontal - 300 par
rail, 3 000 dégroupées - que personne ne parcourt jusqu'au bout.

| Écran (Chromium, serveur de dev) | Avant | Après |
|---|---|---|
| Ma collection, groupée | 401–410 ms, 2 765 nœuds | **295–314 ms, 1 001 nœuds** |
| « Dégrouper », le clic seul | 919–949 ms | **110–121 ms** |
| Rayon Manga, 300 en grille | 447–473 ms | 465–476 ms |
| Catalogue, 380 lignes | 892–921 ms | 905–909 ms |
| Statistiques, Découvrir, fiche | ≈ 950 ms dont 500 ms d'attente de réseau calme | inchangé |

Un rail montre **48 tuiles au plus** (`TUILES_PAR_RAIL`), son compte dit
toujours le total et « Tout voir » mène au rayon complet. Et les jaquettes se
chargent **à l'approche de l'écran** (`loading="lazy"` sur les tuiles, et par
défaut dans `Jaquette`) : sur la pile de mesure il n'y a aucune image, mais
sur une vraie instance ce sont 300 requêtes chez Google Books au premier
rendu de la page d'accueil.

**Ce qui reste, et qui ne rampe pas encore** : le Catalogue rend ses 380
lignes d'un bloc (≈ 0,9 s en dev, sans doute la moitié en production) - à
borner ou paginer le jour où il approche le millier. Et deux charges utiles
de la page d'accueil pèsent 1,4 Mo à elles deux (`entities/search`,
`ownerships`) : acceptable en réseau local, à revoir si l'instance sort de la
maison.

**Piège retrouvé** : `docker compose up -d --build` a reconstruit l'image et
laissé tourner l'ANCIEN conteneur - la première remesure de Découvrir disait
encore 307 requêtes. `--force-recreate`, et vérifier l'identifiant d'image
du conteneur (déjà noté au 2026-08-13, oublié le temps d'une mesure).

Vérifié : typecheck, lint, 343 tests web, contraste, frontières, build ;
1 100 tests backend ; 16 parcours Playwright.

### Lot 140 — le profil à plat, sans « Paramètres » ni « Demander à ma collection »

Deux demandes, telles quelles : « sur le profil, je ne veux pas de sous-menu
Paramètres, ça doit être lisible direct » et « supprime Demander à ma
collection, qui ne sert à rien ».

**Les réglages sont sur Profil.** L'écran Paramètres n'existe plus : ses deux
sections - « Mon compte » (pseudo, adresse, emporter et restaurer sa
collection) et « Cet appareil » (langue des titres) - sont rendues sous le
partage, sur Profil même (`Reglages`, l'ancien `SettingsPage` sans son
en-tête ni son lien de retour). Deux écrans parlaient de la même personne ;
un seul suffit. `/settings` et `/settings/import` **redirigent** (`/profile`,
`/profile/import`) : un signet ne tombe pas sur « page introuvable » parce
qu'un écran a fusionné avec son voisin. L'import vit à `/profile/import`,
son retour nomme « Mon profil » ; « Langue des titres » du Catalogue arrive
directement sur « Cet appareil » (`focusAppareil`, même mécanique que le
partage). Le parcours Playwright de la porte se déconnecte depuis Profil
sans plus passer par un lien Paramètres, et vérifie qu'il n'y en a plus.

**« Demander à ma collection » est retirée**, entièrement : l'écran
`/question`, le lien de Profil, `poserQuestion`, et côté serveur
`POST /api/insights/question`, `CollectionQuestionService`,
`AiCollectionOracle`, `CollectionAnswer` et `GeminiCollectionOracle`. Le lot
117 l'avait livrée sans test automatisé ; rien ne la reliait à autre chose.
`GeminiRequests` reste, l'analyse d'achat s'en sert.

Vérifié : typecheck, lint, 341 tests web, contraste, frontières, build ;
1 097 tests backend depuis `clean` ; 16 parcours Playwright.

### Lot 139 — le Catalogue s'ouvre sur « Tout »

« Quand je clique sur Catalogue, il faut d'abord sélectionner Tout au lieu de
Manga. » Le premier type de l'instance était présélectionné pour un compte
connecté (lot 116 en avait seulement corrigé la rejouée à chaque clic) :
arriver prêt à chercher chez un fournisseur, qui s'interroge type par type.
Mais c'est le **Catalogue** qu'on ouvre, et il ne montrait alors qu'un univers
pris pour les autres - le même défaut que Ma collection au lot 136, un cran
plus loin. La présélection disparaît, pour tout le monde : on arrive sur
« Tout », le type se choisit quand on cherche, et la phrase sous le champ le
dit au moment utile (« choisis une catégorie pour chercher aussi chez une
source externe »). Un lien qui porte `?type=` continue d'arriver sur son type.

Vérifié : typecheck, lint, 340 tests web, contraste, frontières, build ; 16
parcours Playwright ; dans le navigateur, `/add` arrive avec « Tout » actif et
les trois types inactifs. Aucun changement côté serveur.

### Lot 138 — le thème se change depuis l'en-tête

Demandé tel quel : « extraire la fonction mode clair / sombre dans la barre
de menu, avec juste une icône qui change selon le mode ». L'interrupteur
vivait sous Paramètres ▸ Cet appareil, à trois clics de n'importe quel écran
(avatar, Profil, Paramètres), pour un geste qu'on fait selon la lumière de la
pièce, pas un réglage qu'on pose une fois.

**`BoutonTheme`** ouvre la rangée des raccourcis de l'en-tête, desktop et
mobile, visiteur compris (le thème est un réglage de l'appareil, pas du
compte). L'icône montre le mode **courant** - la lune quand il fait sombre, le
soleil quand il fait clair, ce que l'interrupteur montrait déjà - et le nom
accessible dit l'**action** (« Passer en thème clair »), porté par
`aria-label` et `title` comme Administration et la sortie. L'interrupteur des
Paramètres est retiré, un seul geste pour un seul réglage ; la section « Cet
appareil » dit où il est parti.

**Le défaut trouvé en l'écrivant** : `useTheme` gardait un état par
composant, relu au montage. Tant qu'un seul interrupteur existait, rien ne se
voyait ; l'en-tête, lui, rend le bouton **deux fois** (barre desktop, barre
mobile, l'une masquée par CSS), et deux états privés auraient divergé au
premier clic - l'icône de l'autre barre aurait montré l'ancien mode, puis son
clic l'aurait « rebasculé » vers celui qu'on venait de quitter. Le thème vit
désormais dans un magasin de module souscrit par `useSyncExternalStore` :
chaque bouton est une vue du même fait. Un test rend deux boutons, en clique
un, et lit les deux.

Vérifié : typecheck, lint, 339 tests web, contraste, frontières, build ; 16
parcours Playwright ; et dans le navigateur, en mode visiteur : un clic sur
la barre mobile fait passer les DEUX boutons au soleil, retire `data-theme`
et mémorise « light », le clic suivant ramène tout au sombre. Aucun
changement côté serveur.

### Lot 137 — la navigation ne nomme aucun univers

Le lot 136 laissait une question ouverte, posée à l'utilisateur : « Analyser
une annonce », parcours manga, restait l'une des quatre destinations
globales. Il a choisi de l'en sortir. La règle est la même que pour Ma
collection : **la barre de navigation vaut pour n'importe quelle collection ;
ce qui est propre à un univers se rejoint depuis l'écran qui le contient.**

- **Trois destinations** : Ma collection, Catalogue, Découvrir. Une seule
  liste (`navItems.ts`), lue par la barre desktop et par la barre du pouce -
  qui tient d'autant mieux sur 375 px.
- **Deux portes vers l'analyse**, et pas un raccourci de plus : une
  **carte-lien en tête de Découvrir** (« Analyser une annonce - Un lot de
  mangas d'occasion sous les yeux ? Confronte-le à ta collection avant
  d'acheter. »), visible sur les trois onglets, comme le bilan annuel en
  bas ; et **« Évaluer une annonce » sur la fiche d'une série**, qui existait
  déjà. Le lien discret du panneau Opportunités, qui doublait désormais la
  carte, est retiré.
- **Découvrir s'allume** quand on est sur l'analyse, son historique ou les
  suggestions (`activeWhen`) : le test de surlignage vérifie toujours
  qu'exactement une destination s'allume sur chaque route réelle.
- **L'écran sait d'où l'on vient** : un lien de retour nomme Découvrir par
  défaut, ou la série quand on arrive de sa fiche (`retour` dans l'état de
  navigation, même mécanique que les rayons et les boards).
- Le parcours Playwright de l'annonce **entre désormais par Découvrir**, et
  vérifie que la barre ne nomme plus l'analyse.

Ce que ce lot ne fait pas : Découvrir lui-même reste à moitié manga
(Opportunités = séries presque complètes, Sorties bloqué faute de données).
C'est un autre écran, et une autre décision.

Vérifié : typecheck, lint, 333 tests web, contraste, frontières, build ; 16
parcours Playwright. Aucun changement côté serveur.

### Lot 136 — Ma collection redevient l'écran du cœur

« La homepage n'est pas conforme avec ce qu'on veut : c'est trop orienté
manga au lieu d'être générique. » L'audit a trouvé cinq choses qui parlaient
manga sur une page qui appartient au cœur - celle qui doit se lire pareil
quoi qu'on collectionne. La règle retenue est celle du backend depuis le
lot 133 : **la page appartient au cœur, ce qui est propre à un univers se
branche sur son rayon.**

- **« À lire » est retiré**, pas déplacé : « je veux pas de à lire ». Le bloc
  ouvrait la page avant la collection elle-même, avec une pile de lecture
  calculée par l'univers manga (lot 122). Sans son bloc, l'écran `/a-lire` et
  `GET /insights/reading-list` n'auraient plus eu aucune porte - exactement
  l'impasse que ce dépôt refuse (une fonctionnalité livrée mais
  inatteignable). Tout part : le bloc, l'écran, la route, `ReadingListService`,
  `ReadingList` et `MangaInsightsController`, qui ne portait que cette route.
- **« Retrouver les jaquettes manquantes » vit sur le rayon Manga**
  (`RattrapageJaquettes`, à côté de Filtres sur `/collection/:type`) : il n'a
  jamais traité que les mangas, et il vivait dans le menu d'outils de toute
  la collection.
- **« Import » quitte la barre d'outils** : l'import BoardGameGeek reste sur le
  Catalogue, à côté de Scanner - une porte d'ajout, pas un outil de la
  collection. « Plus d'outils » ne garde que Catégories et Partager.
- **L'ordre des rails vient des données.** Une liste de codes - manga, jeu
  vidéo, jeu de société, puis le reste - plaçait l'univers de départ en
  premier, quoi qu'on collectionne. Désormais le type **le plus fourni en
  titres** d'abord, puis par libellé ; compté sur toute la collection
  (possédée ou voulue, avant filtre) et en titres dans les deux vues, pour
  que ni un filtre ni « Dégrouper » ne fassent sauter un rail au-dessus d'un
  autre (`ordonnerLesTypes`, `compterLesTitresParType`).
- **Le vocabulaire** : « Rien ne correspond à ces filtres » remplace
  « Aucune série ne correspond… » sur Ma collection et sur un rayon.

Ce qui tenait déjà pour toute collection reste tel quel : un rail par type,
la tuile adaptée au type (« Possédé » pour un jeu, « Kana · 12/20 tomes »
pour un manga), Tout / Possédés / Envies, tags, tri, valeur. La navigation
globale ne bouge pas : « Analyser une annonce » y reste, sortir ce parcours
manga des quatre destinations est une décision produit à part, posée à
l'utilisateur et non tranchée.

Vérifié : typecheck, lint, 332 tests web, contraste, frontières, build ;
1 097 tests backend depuis `clean` ; 16 parcours Playwright.

### Lot 135 — les deux chemins sans filet : la visite, et le retour d'un export

Deux refontes de 360 fichiers venaient d'être livrées (lots 133 et 134) sur la
foi de 14 parcours Playwright. Deux chemins n'en avaient aucun, et c'étaient
les deux où une régression ne se verrait pas : la **visite sans compte** — le
seul endroit où une fuite de données personnelles ne se plaindrait à personne
— et le **retour d'un export**, que le lot 115 avait joué à la main en
réclamant le parcours « exporter, détruire, réimporter ».

**La visite** (`visite.spec.ts`). Le compte de la suite possède un tome ; un
contexte de navigateur neuf entre par « Visiter sans compte ». Ce qui se
vérifie : l'arrivée sur le catalogue avec le bandeau « Mode visiteur » ; ni
« Ma collection » ni « Scanner » proposés ; l'œuvre listée **sans** pastille de
possession ; la fiche qui montre le tome 1 **manquant** et « 0 tome possédé
sur 3 » — la progression du visiteur, c'est-à-dire de personne, pas celle de
l'hôte — et pas d'« Éditer » ; « J'ai le tome 2 » refusé en une phrase, sans
aller-retour, le tome toujours manquant ; les écrans réservés qui renvoient
au catalogue. Puis la même session interrogée à l'API : `/me` en visite sans
identifiant, `/ownerships` vide, `/export/json` — la lecture la plus large de
l'application — qui rend le catalogue et **aucune** possession, envie ou
expérience, et un `POST` refusé 403 « lecture seule » **avec** le jeton CSRF
fourni, pour que le refus vienne bien de la visite. Le compte, lui, possède
toujours son tome, et un seul. « Quitter » referme : la fiche redemande la
porte.

**Le retour d'un export** (`import.spec.ts`). La pile jetable est unique, on
ne la détruit pas au milieu d'une suite : ce qui est détruit, c'est le
**compte**, par l'administrateur — exactement ce qu'une suppression emporte
(voir `GestionDesComptes`), le catalogue restant partagé. La pile a donc gagné
un **code d'invitation** (`code-e2e`, `IOZYCORE_INVITE_CODE` de
`docker-compose.e2e.yml`, connu de `e2e/compte.ts`) : un second compte se crée
à l'écran, et `porte.spec.ts` vérifie désormais qu'un **code faux est refusé**
plutôt que l'absence d'un bouton. Le parcours : créer le compte B, lui poser
deux tomes sur quatre avec édition et prix, **télécharger** le JSON par le
bouton (l'événement de téléchargement de Playwright, pas un appel d'API à
part), relire le fichier — le titre, les deux possessions, et **ni l'adresse
ni le mot de passe** du compte —, supprimer B depuis `/administration/comptes`,
constater que sa session est morte, recréer B, voir l'œuvre au catalogue
« Pas encore possédé », importer — l'analyse, puis « Importer », puis « Import
terminé » — et retrouver « 2/4 tomes » dans Ma collection et les tomes sur la
fiche. Renvoyer le même fichier : **0 à créer**, 2 possessions déjà là — seules
les préférences d'analyse d'achat restent proposées, parce qu'elles se
remplacent au lieu de s'ajouter.

**Le trou trouvé : la session d'un compte supprimé lui survivait.**
`GestionDesComptes` effaçait les données puis le compte, mais la session HTTP
gardait le principal écrit à la connexion, et rien ne le relisait : `/api/auth/me`
répondait 200, le navigateur restait « connecté » sur une collection vide, et
une écriture serait repartie sous un identifiant que plus personne ne porte.
`SecurityConfig.SessionDUnCompteSupprime`, posé **avant** l'autorisation,
relit le compte par clé primaire à chaque requête qui en porte un ; s'il
n'existe plus, la session est invalidée et la réponse est 401
`{"error":"Ce compte n'existe plus."}` — ce que le client traduit en porte.
Un registre de sessions Spring Security aurait évité la requête, au prix
d'enregistrer chaque session à l'entrée dans une table en mémoire qui ne
survit ni à un redémarrage ni à un magasin de sessions qu'on ajouterait :
une clé primaire par requête est le prix d'une règle sans état. Conséquence
dans les tests : le principal **fabriqué** des tests de contrat HTTP n'avait
aucune ligne derrière lui — `HttpContractTestBase` pose désormais ce compte
en base à chaque test, annulé avec lui. Un test de contrat
(`AuthHttpContractTest`) garde la règle.

Vérifié : 16 parcours Playwright sur pile jetable, 1 097 tests backend depuis
`clean`, lint, typecheck et frontières du front.

### Lot 134 — le front rangé par page

Après le backend, l'utilisateur a demandé le même soin pour le front, mais
pas la même forme : « c'est une archi back ça, il faut une archi front
cohérente », puis « on découpe par page et sous-pages, avec des composants
partagés (common) ». L'unité de cohérence d'une SPA, c'est l'écran.

**Avant** : quatre dossiers par rôle technique (`api`, `lib`, `components`,
`routes`) — pour comprendre un écran, trois dossiers à ouvrir ; `lib`
mélangeait hooks, règles, session et thème ; des fichiers de route servaient
d'autres routes (`TierBadge`, `backfillCovers`, `ShareSection`).

**Après** : `app/` (routeur, providers, coquille), `pages/` — un dossier par
page, nommé comme son URL, ses sous-pages en sous-dossiers, et dedans la
page, ses composants, ses hooks, ses tests, à plat — et `common/` pour ce qui
est partagé par plusieurs pages, et rien d'autre (`components`, `hooks`,
`lib`, `api`, `types`, `theme`). Deux règles : **un module utilisé par une
seule page vit dans cette page** (six modules de `lib` et trois composants
ont ainsi rejoint la fiche, la collection et les statistiques) ; **dès qu'une
seconde page en a besoin, il monte dans `common`** (`TierBadge`, `TierPicker`,
`backfillCovers`, `ownership`). Les imports passent par l'alias `@/`.

**La vérification** : `scripts/check-frontieres.mjs` (`npm run
check:frontieres`), comme le contraste — `common` ne dépend d'aucune page ni
de l'app, une page ne lit pas une autre page. Zéro violation à la livraison.

Mécanique : 212 `git mv`, imports réécrits par résolution (relatif → alias),
typecheck, lint, 331 tests, contraste, build et 14 parcours E2E rejoués. Les
URL de l'app et l'API n'ont pas bougé.

### Lot 133 — un cœur et quatre univers

Le lot 132 avait découpé `metadata` par univers ; l'utilisateur a jugé le
résultat « pas bien rangé et trop complexe pour ce que ça fait », puis posé
les règles : **DDD**, **séparer selon le type de collection** (mangas, jeux
vidéo, jeux de société, types personnalisés iozycore), **laisser la
possibilité de découper en sous-modules microservices**. Mon premier
contre-plan (aplatir en dossiers par fonctionnalité) contredisait la première
règle ; le second (contextes par fonction) contredisait la deuxième. D'où
celui-ci.

**La forme.** À la racine du paquet, un `core` et quatre univers : `manga`,
`videogame`, `boardgame`, `custom`. Le cœur tient tout ce qui vaut pour tous
les types ; un univers tient ce qui n'existe que pour le sien, avec ses
quatre couches ; la racine d'un univers porte ses façades vers le cœur, ses
sous-paquets sont privés.

**La règle.** Un univers dépend du cœur, jamais l'inverse, jamais d'un autre
univers. Là où le cœur touchait un univers, il déclare désormais un point
d'extension que l'univers implémente :

| Point d'extension (cœur) | Ce que le manga y met |
|---|---|
| `DiscoverySource` | même mangaka (jeux vidéo : IGDB similaires ; jeux de société : hot list BGG) |
| `SeriesProgressSource` | la progression « X/Y » par édition de référence |
| `OwnedValueSource` | prix neuf de l'édition × tomes possédés |
| `CoverImageCheck` | une jaquette BnF n'est gardée que vivante |
| `EditionLinker` | l'édition de référence retrouvée ou créée pour un tome |
| `EntityDeletionGuard` | une série encore référencée par une édition ne se supprime pas |
| `VariantDeletionHook` | l'édition orpheline effacée avec son dernier tome |
| `TransferModule` | éditions, prix relevés, éditions suivies, préférences dans l'export et l'import |

**Ce qui a bougé.** IGDB et la découverte des jeux vidéo → `videogame` ;
BGG, l'import de collection, son contrôleur et la découverte → `boardgame` ;
métadonnées manga, analyse d'achat, reconnaissance, éditions de référence,
éditions suivies, progression, liste de lecture et leurs contrôleurs →
`manga` ; les types personnalisés (service, contrôleur, DTO) → `custom` ;
tout le reste sous `core/`. Le client Gemini et `ListingPlatform`, génériques,
remontent dans le cœur. `DiscoveryService` n'est plus qu'un aiguillage.
`git mv` partout, les tests suivent leurs classes ; le test du service de
découverte est devenu trois tests d'univers.

**Deux choses apprises en vérifiant.** Une migration appliquée ne se
modifie jamais, même son commentaire : le déplacement du cœur avait réécrit
« com.iozycore.domain » dans dix fichiers SQL, et Flyway refusait de
démarrer sur toute base existante (sommes de contrôle) - restaurés au bit
près. Et un parcours E2E rouge qui n'était pas le backend : la tuile d'un
tome ajouté restait « manquante » tant que la recherche de jaquette qui suit
n'avait pas fini (de deux à trente secondes selon les fournisseurs) ; la
possession est maintenant affichée dès qu'elle est écrite, la jaquette
suit.

**La vérification.** Spring Modulith 1.2 (la ligne de Spring Boot 3.3) :
`ModulesTest` vérifie les frontières à chaque build — le cœur est déclaré
module OUVERT (les univers s'appuient sur son domaine, ses cas d'usage et ses
contrats), les univers sont fermés — et dessine la carte des modules dans
`target/spring-modulith-docs`. Ce qui reste volontairement dans le cœur :
`DonneesParProprietaire` (l'effacement des données d'un compte, en SQL sur
toutes les tables, y compris celles des univers — une donnée, pas une
classe) et `TomeResolver` (résoudre un tome par numéro et édition est
générique ; seule l'édition de référence est manga, par `EditionLinker`).

### Lot 132 — le paquet metadata réorganisé par univers

Demande utilisateur du 2026-09-05 : « réorganise l'api pour bien séparer les
modules de récupération de mangas, de jeux vidéo, jeux de société et de
récupération via la base iozycore ». Jusqu'ici tout vivait à plat dans
`metadata` : dix-sept classes à la racine (contrats, service de 1 087 lignes
mêlant recherche par titre, code-barres, titre français et tomes), huit
sous-paquets par SOURCE (anilist, jikan, bnf, igdb, bgg…) — la source était
visible, l'univers ne l'était pas, et la base iozycore n'avait pas de module.

**Le découpage, par univers et non par source :**

| Paquet | Ce qu'il tient |
|---|---|
| `metadata` | Les contrats communs (`MetadataProvider`, `MetadataCandidate`, `BarcodeMetadataProvider`, exceptions, `TtlCache`) et `MetadataSearchService`, réduit aux deux gestes valables pour TOUS les univers : chercher par titre, reconnaître un code-barres. |
| `metadata.manga` | `FrenchTitleService` (titre de l'édition française), `TomeSearchService` (tomes, éditions, toute la chaîne des lots 119-131), `RelatedSeriesService`, leurs contrats (`VolumeSearchProvider`, `VolumeCandidate`…), et les sources en sous-paquets : anilist, jikan, myanimelist, googlebooks, bnf, openlibrary. |
| `metadata.videogame` | IGDB (fournisseur, jeux similaires, jeton). |
| `metadata.boardgame` | BGG (fournisseur, collection, hot list, fiche). |
| `metadata.catalog` | `CatalogSearchService` — la récupération via la base iozycore : la recherche locale que l'écran Rechercher interroge à côté des fournisseurs, et les titres déjà connus d'un type, dont la recherche externe se sert pour ne pas reproposer ce qu'on possède. Lecture seule : faire exister une fiche reste `CatalogEntityResolver`, côté application. |

`api.metadata` suit : `MetadataController` (search, lookup-barcode),
`api.metadata.manga.MangaMetadataController` (french-title, volumes,
volumes/known-empty), `api.metadata.boardgame.BggImportController`
(bgg/import). **Aucune route n'a changé** — le web et les tests HTTP n'ont
pas bougé. `EntityController.search` passe désormais par le module
catalogue. `TtlCache` devient public, les services d'univers s'en servent.

Mécanique : `git mv` pour l'historique ; le service et son test (919
lignes) découpés par membre — 12 tests pour la recherche et le code-barres,
10 pour le titre français, 12 pour les tomes. Suites complètes rejouées.

### Lot 131 — les huit mangas mesurés contre mangacollec, et la chaîne corrigée

Suite de l'audit du 2026-09-05 (« tu vois rien à faire ? »). Trois choses
vues, trois choses faites.

**Le cache durable gardait l'ancienne chaîne.** Il ne se périme jamais
(V3, voulu) — mais il servait encore des lignes d'août calculées avant les
lots 119-127 : Boruto sans auteur mêlé à Two Blue Vortex, Vagabond en
« Édition inconnue » 37, et des lignes VIDES qui disaient « aucun tome »
pour toujours à Kimetsu no Yaiba ou Boruto : Two Blue Vortex. Règle posée :
**à chaque changement de chaîne, une migration vide ce cache** (V33). Rien
n'est perdu, il se reconstruit à la demande.

**« Terminer » jetait un brouillon sans prévenir.** Un panneau en ligne sous
l'inspecteur (même idiome que les suppressions, jamais de `window.confirm`)
propose « Enregistrer et terminer », « Abandonner » ou « Continuer d'éditer ».

**Les huit mangas n'avaient jamais été remesurés.** Une fiche qui a déjà des
tomes ne relance pas la recherche : les comparer à mangacollec demandait de
les interroger. Fait sur la **pile jetable** (compte de la fixture E2E,
jamais celui de l'utilisateur ; clé Google Books passée par un fichier de
surcharge hors dépôt, jamais écrite), une série toutes les 50 s pour la BnF.
Première mesure, sur la chaîne du lot 127 :

| Série | Mesure (lot 127) | Mangacollec |
|---|---|---|
| Chainsaw Man | Kazé / Crunchyroll 22, 22 jaquettes | simple 22 ✓ |
| Raw Hero | Soleil 6 | simple Soleil 6 ✓ |
| One-Punch Man | Kurokawa 34 **+ « Édition inconnue » 16** | simple Kurokawa 34 |
| Death Note | Kana 13 ; Black Édition 4/6 ; France Loisirs 2/6 | Kana 13 ; Black 6 ; FL 6 |
| Jujutsu Kaisen | Ki-oon 29/30 **+ Viz Media 2 + « Grande Chance », « Récursion », « Avance », « Mort Et Vie » (1 tome chacun)** | simple Ki-oon 30 |
| Naruto | Kana **67**/72 ; Hokage 15/36 ; France Loisirs 6/14 ; **Dargaud Bénélux-Kana 10** | Kana 72 ; Hokage 36 ; Kiosque Hachette 37 ; FL 14 |
| One Piece | Glénat **44**/112 ; Éd. Originale 20/66 ; **« Édition Orinale » 1** | Glénat 112 ; Log 50 ; 1re éd. 66 |
| One Piece : Strong World | **Glénat 43 = les tomes de One Piece** | Glénat 2 (Anime Comics) |

Chaque écart a sa cause, et sa correction :

- **100 notices, pas une de plus** : la requête SRU ne lisait que la
  première page. One Piece en a quatre. `BnfVolumeSearchProvider` pagine
  (`startRecord`, cinq pages au plus) — Naruto passe à 72/72, One Piece à
  111/112.
- **Un sous-titre de tome n'est pas une édition** : la BnF range « Grande
  chance » (T21 de Jujutsu Kaisen) en 200$e, là où elle range aussi « Full
  color ». Désormais seuls les $e qui DÉSIGNENT une édition (perfect,
  double, collector, intégrale, full color…) en font une ; sans aucune
  désignation, la notice retombe sur son éditeur. Tout ou rien : « Full
  color » + « L'enfance de Goku » reste entier, l'arc qualifie l'édition.
  L'exclusion des spin-offs se juge sur le titre complet, $e compris.
- **Open Library décrit des œuvres, pas des exemplaires** : un document
  porte tous les éditeurs et tous les ISBN de ses éditions, sans les
  apparier — « Jujutsu Kaisen, Vol. 7 » avait Viz Media en premier éditeur
  et un ISBN 978-2 dans la liste. Titres en « Vol. » et éditeurs anglophones
  écartés.
- **Un tome « Édition inconnue » dont le numéro existe déjà dans une
  édition nommée n'apporte rien** : c'est le même tome vu par une source
  sans éditeur. Élagué (`elaguerLesInconnues`) — One-Punch Man revient à
  Kurokawa 34, seul.
- **Un seul tome n'est pas une édition** : un retirage du tome 1 sous un
  autre préfixe ISBN faisait « Glénat (2000) » et « Glénat (2006) ». Une
  réédition en compte au moins deux (l'édition double de Doubt).
- **Alias** : « Dargaud Bénélux-Kana » (les premiers Naruto, 1999-2004) est
  Kana ; « Édition Orinale » est une coquille du catalogue.
- **Une série sous-titrée ne reçoit pas les tomes de sa série mère** : les
  111 tomes de One Piece (« À l'aube d'une grande aventure », 461$t « One
  piece ») s'invitaient dans « One Piece: Strong World » par le chemin qui
  sert à Boruto (« Kawaki », 461$t « Boruto »). Lecture en DEUX passes : un
  tome catalogué sous son propre titre n'est retenu, pour une série
  sous-titrée, que si d'autres notices du même ensemble 461 portent ce
  sous-titre en clair — vrai pour Boruto (« Boruto » + $e « Naruto next
  generations »), jamais pour One Piece. Et Strong World lui-même se
  reconnaît à l'envers : $a « Strong world » + $e « one piece film ».

Seconde mesure, sur la chaîne corrigée (pile jetable, caches vidés) :

| Série | Mesure (lot 131) | Mangacollec |
|---|---|---|
| Chainsaw Man | Kazé / Crunchyroll 22 | 22 ✓ |
| Raw Hero | Soleil 6 | 6 ✓ |
| One-Punch Man | Kurokawa 34, seul | 34 ✓ |
| Jujutsu Kaisen | Ki-oon 30, seul | 30 ✓ |
| Boruto : Naruto Next Generations | Kana 20 | 20 ✓ (non-régression du chemin 461) |
| One Piece : Strong World | Glénat 2 | 2 ✓ |
| Naruto | Kana 72 ; L'intégrale (Hachette) 37 ; Hokage 19/36 ; France Loisirs 9/14 ; Hachette jeunesse 15 | Kana 72 ✓ ; Kiosque Hachette 37 ✓ ; Hokage 36 ; FL 14 |
| One Piece | Glénat 111/112 ; Éd. Originale 30/66 ; Hachette jeunesse 11 | Glénat 112 ; 1re éd. 66 ; Log 50 |
| Death Note | Kana 13 ; Black Édition 4/6 ; France Loisirs 2/6 | Kana 13 ✓ ; Black 6 ; FL 6 |

L'édition simple est exacte sur neuf séries sur neuf (One Piece à un tome
près). Ce qui reste en deçà, ce sont des **éditions secondaires** que la BnF
ne tient qu'en partie (Hokage, France Loisirs, Black Édition, 1re édition de
One Piece) — le sondage tome par tome ne comble que l'édition principale —,
et les **anime comics Hachette** de Naruto et One Piece, rattachés à la
série par la BnF et sans marque qui les distingue : ils sont bien des livres
« Naruto » de Hachette, mangacollec en fait une série à part. Toutes les
jaquettes listées sont là, sauf celles de Hokage (aucune à la BnF).

### Lot 130 — chaque champ éditable, et la source n'écrase pas ce qui a été saisi

Demande utilisateur du 2026-09-04 : « il faut rendre chaque champ éditable
pour compléter les infos en base ; si on recharge depuis l'api alors on
écrase les infos non déjà éditées ». Jusqu'ici une valeur recopiée d'un
fournisseur et une valeur tapée par l'utilisateur vivaient dans le même sac
(`entity.attributes`) sans rien pour les distinguer : « Recharger depuis la
source » écrasait tout, sauf une liste en dur côté écran (remarques,
jaquette de série). Et la carte « Série » du mode édition était en lecture
seule depuis le lot 129.

**La provenance vit en base, pas dans l'écran.** V32 ajoute
`entity.manual_attribute_keys` (tableau JSON de clés). Côté domaine,
`Entity.saisirAttributs` écrit ET marque ; `recopierDepuisLaSource` n'écrit
que les clés non marquées et dit lesquelles ; `removeAttribute` retire la
marque - vider un champ à la main, c'est rendre la place à la source.
`PATCH /entities/{id}?origine=manuelle|source` (manuelle par défaut) choisit
la règle ; `EntityResponse.champsSaisis` la rend visible. L'export emporte
les marques (`EntityExport.champsSaisis`) et l'import les reprend : la règle
vaut depuis la fiche, le rattrapage, et l'autre instance.

**L'écran.** Première version : une carte « Série » en formulaire, à côté
de l'inspecteur — refusée le 2026-09-05 (« tu dupliques au lieu de
transformer les champs lecture seule et éditable »). Version retenue : les
rangées de l'inspecteur DEVIENNENT les champs. En mode édition, la colonne
ŒUVRE montre chaque attribut en saisie (même vide, c'est là qu'on complète),
puis l'édition active (éditeur, nombre de tomes, épuisée, nouvelle édition
annoncée) ; la colonne SOURCE montre les rouages (malId, titres, statut
source, nb de tomes source, année de fin) en saisie ; « Mes remarques »
devient une zone de texte du même brouillon. Une seule barre « Enregistrer la
fiche » / « Annuler » sous l'inspecteur écrit tout ce qui a changé (attributs
puis fiche d'édition, `useBrouillonInspecteur`) — plus de `EntityInfoSection`
ni d'`EditionCorrectionSection`. Une pastille « saisi » à côté du libellé dit
ce que la source ne touchera plus. Le rechargement de la fiche appelle le PATCH avec
`origine=source` et exclut aussi les clés saisies de son décompte
(`attributsARecharger`, testé), pour que « N informations mises à jour »
reste vrai. Une valeur saisie identique à celle de la source reste marquée :
l'utilisateur a tranché.

**Audit du 2026-09-05** (demande : « vérifie que tout est en ordre et
cohérent »). Suites complètes jouées : 1095 tests backend, 331 tests web,
14 parcours Playwright, typecheck, lint, contraste, build. Trois choses
corrigées. **Les années** (`startYear`, `endYear`) restaient du texte : la
fiche et l'aperçu les lisent en `typeof === 'string'` (« Depuis 2004 »), un
nombre saisi y aurait disparu sans bruit — retirées des clés numériques du
brouillon. **Les rouages proposés** (malId, titre romaji, statut source…)
ne s'offrent qu'à un manga : un jeu de société n'a pas de malId à compléter
(`clesSourceProposees`). **La pile E2E appelait la vraie IA** : le
passthrough `${GEMINI_API_KEY:-}` du lot 122 dans `docker-compose.e2e.yml`
est substitué depuis `backend/.env` par Compose, pas seulement depuis le
shell — l'analyse d'annonce a parlé à Gemini pendant les tests et dépassé
leurs dix secondes (2 parcours rouges). Clés vidées en dur dans la pile
jetable ; un fournisseur se vérifie en direct sur la pile de développement.

### Lot 129 — un seul « Éditer » pour toute la fiche

Demande utilisateur du 2026-09-04 : « retire les boutons "modifier" sur
chaque champ, il faut un seul bouton "éditer" pour toute la page ». Depuis
l'étude produit du 2026-08-27, les relevés personnels (Tier list, Ma note,
Mes remarques, Lectures, Tags) portaient chacun un petit « Modifier », et
« Éditer » en haut n'ouvrait que le catalogue : deux logiques d'édition sur
la même page, cinq boutons dans une colonne de 240 px. Tranché : un geste.

- `ReleveInspecteur` n'affiche plus que l'information (plus de
  `onModifier`, plus d'état `ouvert`).
- « Éditer » ouvre, sous l'inspecteur et en pleine largeur, les trois
  éditeurs personnels à la fois (classement, expériences avec la note, tags)
  puis le catalogue, comme avant. Les remarques s'éditent en place dans leur
  relevé (depuis le lot 130, dans le brouillon commun de l'inspecteur, sans
  boutons à elles).
- Le crayon « Modifier l'édition » de l'inspecteur (tomes, éditeur, épuisée,
  nouvelle édition annoncée) était le dernier « Modifier » à part : le
  formulaire vit maintenant sous les informations de l'œuvre, dans le même
  mode, toujours pré-rempli ; « Annuler » y revient sans le refermer.
- Un visiteur sans compte n'a toujours pas d'« Éditer » ; un compte ordinaire
  y trouve ses éditeurs personnels, et le catalogue dont le serveur protège
  déjà les écritures réservées (tags, rechargement - Lot 128).

### Lot 128 — recharger depuis la source : un geste d'administrateur

Demande utilisateur du 2026-09-04 : « seul l'admin peut recharger les données
API ». Le lot 119 avait posé que chaque donnée chargée est stockée sur
iozycore, avec un bouton pour la redemander à la source ; ce lot dit QUI
tient ce bouton. L'administrateur répond des données uniformes de
l'instance (une seule chaîne de sources, une seule écriture par série) et
des quotas des fournisseurs (Google Books a le sien, la BnF bloque après une
salve) : un compte ordinaire lit ce que l'instance a, il ne relance pas les
fournisseurs.

**Serveur.** `GET /api/metadata/volumes?forceRefresh=true` n'est honoré que
pour `ROLE_ADMIN` ; pour les autres comptes la demande est servie depuis le
cache, **sans refus** — le rattrapage de jaquettes (`backfillCovers`) force
en seconde intention, et un 403 y passerait pour un fournisseur muet.

**Écran.** « Recharger depuis la source » (fiche, mode édition) et
« Actualiser depuis la source » (aperçu seulement, grille et état vide) ne
s'affichent que pour `compte.admin` — même règle que les tags : le serveur
protège, l'écran évite de proposer une porte fermée. Sur la fiche, « Actualiser »
dans la grille des tomes ne se montre qu'en **mode édition**, comme tout ce
qui redemande la source ; en aperçu, sans fiche ni mode édition, il reste à
portée de l'administrateur. « Chercher d'autres éditions »
suit la même règle : cinq requêtes chez le fournisseur, c'est aussi
recharger depuis l'API (constaté sur Chainsaw Man, où la grille de
proposition reste affichée tant qu'aucun tome n'est possédé).

### Lot 127 — mangacollec pour référence, et la BnF ménagée

Règle posée par l'utilisateur : « Il faut avoir les mêmes résultats que
mangacollec. Pense à vérifier à chaque fois sur le site mangacollec pour chaque
manga de iozycore. » Mangacollec n'a pas d'API publique (401 sans compte, cf.
`CONCEPTION.md` §19) et sa recherche exige une session : l'utilisateur s'est
connecté lui-même dans le navigateur intégré, et les fiches ont été lues sous
sa session, en lecture seule — jamais ses identifiants, jamais son jeton. Les
huit séries manga d'iozycore ont été relevées ; la vérité est consignée en
mémoire de session et résumée ici.

| Série | Mangacollec | Cache iozycore (lignes d'août, ancienne chaîne) |
|---|---|---|
| Chainsaw Man | simple **Kazé / Crunchyroll** 22 (+ 3 variantes reliées) | Crunchyroll 7 + « Édition inconnue » 13, éclaté |
| Death Note | simple Kana 13 ; Black Edition 6 ; France Loisirs 6 | Kana 12 ; Black Édition 4 ; « inconnue » 13 |
| Jujutsu Kaisen | simple Ki-oon 30 (+ 5 variantes reliées) | Ki-oon 4 ; Crunchyroll 2 (faux) ; « inconnue » 3 |
| Naruto | simple Kana 72 ; Hokage 36 ; Kiosque Hachette 37 ; grand format 8 ; France Loisirs 14 | Kana 30 ; « inconnue » 15 |
| One Piece | simple Glénat 112 ; Log Hachette 50 ; 1re édition 66 (reliée) | Édition Originale 12 ; Color Walk 10 ; « inconnue » 8 |
| One-Punch Man | simple Kurokawa 34 (+ 4 variantes reliées) | Kurokawa 27 ; « inconnue » 20 |
| Raw Hero | simple Soleil 6 | Soleil 6 ; « inconnue » 2 |
| One Piece – Strong World | Glénat 2 (Anime Comics) | rien |

Deux enseignements de structure, avant même de remesurer. **Mangacollec
distingue l'édition et ses variantes « reliées »** (jaquette alternative,
collector, édition anniversaire…) : rattachées à l'édition simple, jamais des
éditions à part — iozycore n'a pas cette notion, et une jaquette collector y
fait une édition. **Un éditeur renommé reste un éditeur** : « Kazé /
Crunchyroll » en une seule édition chez mangacollec, deux chez nous (lot 125).
Adopté son libellé (`unifierLesEditeursRenommes`, table d'alias, Kazé →
Crunchyroll depuis 2022).

**Et la BnF ménagée.** Les lignes du tableau datent d'août : les remesurer
demande de recharger huit séries, dont Naruto (72 tomes) et One Piece (112).
Or le lot 120 vérifiait chaque jaquette BnF par un HEAD au moment de LISTER
— tenable à 20 tomes, une salve à 112, et c'est ce qui a fait bloquer notre
adresse par la BnF à répétition dans l'après-midi, l'instance de l'utilisateur
comprise. L'écran n'a pas besoin de cette vérification : une image en 500
tombe sur le repli du composant `Jaquette`. Seule la **persistance** en a
besoin — une adresse morte enregistrée bloquerait le rattrapage. La
vérification passe donc à l'écriture (`BnfCouverture.estVivante`, un HEAD par
tome gardé : `TomeResolver` à l'ajout, le PATCH d'attributs de tome au
rattrapage), au rythme des gestes de l'utilisateur. Lister ne coûte plus
qu'une requête SRU.

### Lot 126 — « parfois le bon résultat, puis ça revient à l'ancien »

Signalé par l'utilisateur sur « Doubt » : l'aperçu montre tantôt les deux
éditions attendues (4 et 2), tantôt l'affichage d'origine (3 et 1). Mesuré
dans le cache durable de son instance : **deux lignes** pour ce titre — une
avec auteur, écrite à 15 h 06 (4 tomes, « Ki-Oon » et « Ki-oon » : la scission
d'orthographe d'avant le lot 123), une **sans auteur**, écrite à 16 h 16
(6 tomes, dont l'homonyme « Akiko » du lot 123). Trois défauts derrière un
seul symptôme.

**Ce qui sort d'un cache ne repassait pas par les règles.** Les lots 123 à
125 ont ajouté quatre règles de nommage (orthographes, homonymes par ISBN,
« Édition inconnue », dédoublonnage) — appliquées au résultat *frais*
seulement. Une ligne écrite avant elles ressortait telle quelle : « Ki-Oon »
séparé, tant que personne ne rafraîchissait. Désormais `finaliser` (les
quatre règles, dans l'ordre) s'applique à toute sortie, cache compris.

**« Actualiser » ne rafraîchissait pas quand une source se taisait.** Un
résultat partiel n'est jamais persisté (règle du lot 120, contre le
gel d'une liste incomplète) — mais l'ancienne ligne, elle, restait, et le
cache mémoire de 24 h aussi. Or la BnF s'est tue une bonne partie de
l'après-midi (mes propres sondes lui faisaient bloquer l'adresse partagée) :
chaque « Actualiser » de l'utilisateur obtenait le bon résultat, en mémoire
partielle pour une heure, puis chacun de mes redémarrages de l'API vidait
cette mémoire et resservait la ligne de 15 h. D'où le va-et-vient.
Désormais, un rafraîchissement forcé qui obtient un résultat partiel non
vide **efface** la ligne durable et l'entrée mémoire : rien de plus ancien ne
lui survit, et le partiel tient une heure.

**Sans auteur, jamais de ligne durable.** L'aperçu s'ouvre sur un titre nu ;
quand sa recherche de métadonnées échoue (Google Books 503, Jikan 504 — le
cas à 16 h 16), il ne connaît pas l'auteur et cherche les tomes du titre
seul. Sur « Doubt », c'est l'homonyme. Cette réponse était persistée, puis
resservie à chaque ouverture sans auteur. Un titre nu ne désigne pas une
œuvre : en mémoire une journée, jamais en base.

**Quatrième cause, trouvée en vérifiant la correction.** Sur la pile
jetable, le résultat frais de « Doubt » est revenu **sans** l'édition double —
et s'est retrouvé en cache durable comme complet. Journal : « Open Library :
HTTP connect timed out ». Le fournisseur ajouté au lot 124 avalait ses
échecs en liste vide, comme Jikan ; or pour les tomes, un silence n'est pas
« aucun tome » (règle du lot 120, déjà appliquée à la BnF). Il lève désormais
`SourceUnavailableException` : le résultat sans lui reste partiel, une heure
en mémoire, jamais figé.

Les deux lignes de l'instance ont été supprimées à la main (un cache, il se
reconstitue). Tests existants relancés.

### Lot 125 — combler les trous, tome par tome

L'emprunt à MangaCollector, après mesure (voir lot 124) : interroger Google
Books **tome par tome** — `intitle:<série> intitle:"Tome N"` — au lieu de
mots-clés d'édition. Sur « Doubt », 4 fiches au lieu de 300, la bonne en
tête, avec son ISBN. Mais une sonde coûte une requête par tome : elle ne
remplace pas les recherches, elle vient **après**, sur les seuls numéros
manquants.

**Ce qui manque, d'après qui.** Le catalogue (AniList, MyAnimeList) connaît
le nombre de tomes de la série ; l'écran le transmet désormais
(`totalVolumes`, dans les indices de l'œuvre). Entre 1 et ce total, chaque
numéro absent de toutes les éditions trouvées est sondé, un par un, chez le
fournisseur qui sait le faire (`VolumeSearchProvider.probeVolume`, Google
Books seul). Deux plafonds : douze sondes par recherche, et arrêt après trois
numéros de suite sans réponse — un total catalogue peut être faux, ou
l'édition française s'arrêter avant le Japon. Sur une série que la BnF
connaît entièrement, la sonde ne coûte rien.

**Un piège propre à Google Books, retourné en atout.** Il indexe souvent les
tomes français sous le seul titre de la série (« Doubt », sans numéro) - le
numéro est dans ses champs à lui. La recherche par titre les jetait. La sonde,
elle, *sait* quel numéro elle a demandé : une fiche au titre nu qui répond à
« Tome N » et porte un ISBN est le tome N. L'ISBN est exigé, sans quoi rien
ne distinguerait une telle fiche de la page de la série entière, qui
répondrait à tout.

**Et « Édition inconnue » n'est pas une édition.** Google Books ne donne pas
l'éditeur sur nombre de fiches françaises : « Spy x Family » sortait avec une
« Édition inconnue » de sept tomes à côté de Kurokawa — les mêmes livres.
Désormais, un tome sans éditeur mais avec un ISBN du même bloc qu'une édition
nommée la rejoint (`rattacherLesEditionsInconnues`) ; la sonde s'en sert
aussi pour ranger ce qu'elle trouve. Au passage, la clé de regroupement des
éditions plie accents et ponctuation comme le reste de l'app
(`TexteRecherche`) : « Kazé » (BnF) et « KAZE » (Google Books) étaient deux
éditions.

**Mesuré sur la pile jetable, clé Google Books passée par l'environnement.**
BnF *muette* (débit dépassé par mes propres sondes) : la sonde a retrouvé
1 tome de « Spy x Family », 1 de « Frieren », 3 de « Chainsaw Man » en 1, 1
et 2 sondes. BnF *revenue*, mêmes séries : **zéro sonde** — tout était déjà
là ; « Doubt » → Ki-oon 1-4 et Ki-oon (2022) 1-2 ; « Frieren » → une seule
édition Ki-oon, 1-15 (avant : Ki-oon + « Édition inconnue » 8-12) ; « Spy x
Family » → Kurokawa 1-16 (avant : Kurokawa 7-16). Reste visible sur
« Chainsaw Man » : Kazé (2019-2021) et Crunchyroll (depuis 2022) sont le
même éditeur renommé — deux noms, deux éditions à l'écran, et aucune source
ne dit qu'ils n'en font qu'une. Non traité.

### Lot 124 — deux éditions du même éditeur, séparées par l'ISBN

Suite du lot précédent : l'utilisateur maintient sa demande — « Doubt » doit
montrer **deux** éditions, la simple en 4 tomes et la double en 2. Le lot 123
avait supprimé un faux positif et unifié une orthographe, sans faire
apparaître la double. Recherche menée jusqu'au bout cette fois.

**Où est cette édition, réellement.** Mesuré source par source :
la **BnF** ne l'a pas (les 22 notices déposées par Tonogai ont été listées :
seuls les 4 tomes de 2009-2010 ; celle de *Judge* y est, donc ce n'est pas un
défaut de requête). **Google Books** ne rend *aucun* tome de cette série — ses
fiches françaises n'ont ni éditeur ni numéro dans le titre. **Open Library**
l'a : « Doubt - Tome 1 » et « Tome 2 », Ki-oon, 2022, ISBN 979-10-327-1240-5
et -1241-2, avec jaquettes. Open Library était déjà utilisée par ce dépôt
pour les titres français et les codes-barres, jamais pour les tomes : d'où
`OpenLibraryVolumeSearchProvider` (`@Order(3)`, sans clé ni quota).

**Un piège en l'ajoutant** : Open Library est majoritairement anglophone, et
les tomes Yen Press de la même série s'invitaient comme une édition
française. Le filtre retenu est l'ISBN lui-même — 978-2 et 979-10 sont les
groupes d'enregistrement de langue française —, plus objectif qu'une liste
d'éditeurs à tenir.

**Séparer deux éditions du même éditeur.** Les deux s'appellent « Ki-oon » :
le nom d'éditeur ne suffit pas à nommer une édition, et le dédoublonnage par
(édition, numéro) fusionnait les deux tomes 1. Le critère retenu — choix de
l'utilisateur, contre l'année, moins sûre — est l'**ISBN** : `VolumeCandidate`
porte désormais `isbn` et `annee` (constructeur auxiliaire, zéro site d'appel
touché — même procédé qu'en Phase 2 de l'analyse d'achat), remplis par la BnF
(010$a, 214$d/210$d) et Open Library.

**Et la règle a dû être resserrée deux fois.** Première version : séparer dès
que deux blocs ISBN coexistent → « Vinland Saga » éclatait en **quatre**
éditions Kurokawa. Un éditeur change de bloc au fil des années : les tomes
1-12 et 13-24 de la même édition n'ont pas le même préfixe. Version finale,
qui exige une preuve bien plus étroite : un bloc n'est une autre édition que
si **tous** ses numéros existent déjà dans l'édition principale (un bloc qui
apporte des tomes inédits en est la suite) **et** qu'ils forment une série
continue depuis 1 (la forme d'une réédition, qui recommence toujours au tome
1). Doubt 2022 = {1, 2}, tous deux présents dans 1-4, continus depuis 1 →
séparé. Kurokawa 2024 = {1, 28, 29} → 28 et 29 sont inédits → même édition.

**Sur le repo MangaCollector**, proposé par l'utilisateur : ses sources sont
MAL, Jikan, Google Books — déjà là — plus MangaDex, écarté. Rien à en tirer
côté éditions françaises. Une idée en revanche vaut d'être notée pour plus
tard : il interroge Google Books **tome par tome** (`intitle:<série>
intitle:"Tome N"`) au lieu de mots-clés d'édition. Vérifié ici sur « Doubt » :
4 résultats au lieu de 300, avec les ISBN — nettement plus précis sur un
titre court et courant. Non fait dans ce lot.

### Lot 123 — « Doubt » : une édition en deux, et une qui manquait

Signalé par l'utilisateur : l'aperçu de « Doubt » (Yoshiki Tonogai) devrait
montrer deux éditions — la simple en 4 tomes et la double en 2 — et montrait
autre chose. **Cinq causes distinctes**, mesurées avant d'être touchées ;
aucune n'était celle qu'on aurait devinée depuis le rapport.

**Une édition écrite de deux façons devient deux éditions.** La BnF catalogue
les tomes 1 à 3 chez « Ki-oon » et le tome 4 chez « Ki-Oon » (relevé le
2026-09-04 sur les notices réelles). Le nom de l'édition étant la **clé de
regroupement à l'écran**, l'aperçu affichait une édition de trois tomes et
une autre d'un seul. Le dédoublonnage, lui, ne voyait rien : sa clé est déjà
insensible à la casse (`VolumeCandidate.key()`), mais elle ne corrige pas le
libellé affiché. `MetadataSearchService.uniformiserLesEditions` retient
désormais, par clé insensible à la casse, l'orthographe **la plus fréquente**
— rien n'est fusionné ni supprimé, seuls des libellés sont réécrits. Vaut
pour toutes les sources, pas seulement la BnF.

**L'édition double n'était cherchée par personne.** Elle n'existe pas au
dépôt légal sous une notice distincte, et Google Books ne la trouve qu'avec
le bon mot-clé : or `DEEP_EDITION_KEYWORDS` connaissait « star edition »,
« ultimate edition », « deluxe », « intégrale », « collector » — pas
« édition double », pourtant un format français courant (Ki-oon, Pika :
deux tomes en un). Ajouté.

**Et la recherche approfondie n'avait aucun point d'entrée.** `deepSearch`
existe côté serveur, est exposé par le client d'API, et le commentaire de ce
dernier décrit même le bouton « Chercher plus d'éditions » — qui n'a jamais
été posé dans aucun écran (`grep deepSearch` sur `web/src` : aucun appelant).
Capacité livrée et inatteignable, exactement le cas que
`feedback-solidify-over-add` range en deuxième priorité. L'aperçu porte
maintenant « **Chercher d'autres éditions** », à côté de « Actualiser depuis
la source » du lot précédent.

**Et la vraie cause de l'écran signalé, trouvée en le rejouant** : l'aperçu
affichait « ÉDITIONS · 2 — Akiko (2 tomes) / Ki-oon (4 tomes) ». Akiko n'est
pas une édition de ce Doubt-là : c'est un **homonyme**. La requête partait
sans auteur (`GET /metadata/volumes?title=Doubt`, relevé dans l'onglet
réseau), la BnF n'avait donc que le titre pour trancher, et « Doubt » est un
mot courant. Pourquoi sans auteur : l'aperçu s'ouvre sur un titre seul et
lance la recherche de tomes AVANT que sa recherche de métadonnées ait rendu
le mangaka — et la clé de cache React Query, `(type, titre)`, ne contenait
pas l'auteur : le résultat sans auteur restait donc servi pour toujours, la
seconde recherche n'ayant jamais lieu. Deux corrections : l'auteur entre
dans la clé (« les tomes de Doubt » et « les tomes de Doubt PAR Tonogai »
sont deux questions), et la recherche de tomes attend que les attributs
soient connus (`attributsEnCours`, déjà calculé pour retenir l'ajout).
Après : « ÉDITIONS · 1 — Ki-oon, 4 tomes », requête portant
`author=Yoshiki+Tonogai`.

**Cinquième point, découvert en mesurant** : quand des tomes SONT trouvés
mais qu'une source s'est tue, l'écran ne le disait pas — seul le cas « aucun
tome du tout » était annoncé. Sur « Doubt », Google Books était à 429 : la
liste était incomplète et rien ne le laissait deviner. Une phrase le dit
désormais, au-dessus de la grille.

Tests existants relancés (`MetadataSearchServiceTest` 34, `BnfVolumeSearchProviderTest`
9, Google Books : verts), aucun ajouté.

### Lot 122 — « qu'est-ce que je lis ensuite ? »

Une fonctionnalité, demandée telle quelle. Le choix s'est porté sur la
**pile à lire** plutôt que sur les objectifs de collection : ces derniers
reposeraient sur les prix d'achat, renseignés de façon très partielle
(`CollectionValue` porte déjà un `prixConnusSur` pour cette raison), alors
que la lecture repose sur deux faits denses et sûrs — ce qu'on possède, ce
qu'on a vécu.

**Calculé, jamais tenu à jour.** `ReadingListService` ne crée aucune table
et aucune file à curer : pour chaque série, le plus petit tome POSSÉDÉ
(`Ownership` active portant un `variantId`) sur lequel aucune `Experience`
n'est enregistrée. Un tome entre dans la liste en étant acheté, en sort en
étant lu. C'est ce qui évite l'écran vide du premier jour — le piège que
`feedback-solidify-over-add` nomme (« n'ajouter une interface que si la
fonctionnalité derrière est réellement branchée ») : la liste est pleine dès
l'instant où la collection l'est. Un seul chargement par agrégat, jamais une
requête par série (les N+1 des lots 113-114).

**Toute expérience compte comme « vécu »**, et non les seuls types « lu » :
le vocabulaire est configurable par catégorie
(`EntityType.allowedExperienceTypes`), un type personnalisé peut n'avoir ni
READ ni FINISHED. Une série abandonnée sort donc de la liste au tome
abandonné — ce qui est le comportement voulu, elle ne se « lit pas ensuite ».
Les œuvres sans tome (un jeu) sont hors sujet et écartées.

**L'ordre répond à la question** : les séries COMMENCÉES d'abord — reprendre
avant commencer — puis celle dont il reste le moins, la plus proche d'être
finie. Écran `/a-lire` (deux groupes, « Reprendre » et « Commencer ») et un
bloc « À lire » en tête de Ma collection, avant les filtres : la question se
pose en arrivant, pas après avoir trié ses étagères. Le bloc s'efface tant
qu'aucun tome n'a été vécu — annoncer « tout est à lire » à qui n'a jamais
enregistré de lecture serait vrai et sans intérêt. Aucun geste sur ces
écrans : on ouvre le tome sur sa fiche (`?variant=`, qui l'y fait défiler et
l'entoure), où l'enregistrement d'une expérience vit déjà.

**Mesuré sur la pile jetable** : Berserk 5 tomes dont 2 lus, Bakuman 3 dont
2 lus, Vinland Saga 4 dont 0, Monster 2 tous lus, Carcassonne (jeu de
société). Résultat — **8 tomes en attente, 3 séries** : Bakuman (commencée,
1 restant) avant Berserk (commencée, 3 restants), puis Vinland Saga à
commencer ; Monster et Carcassonne absents. Après enregistrement de la
lecture de Bakuman T3 : **7 tomes, Bakuman a disparu**. À l'écran, Ma
collection affiche « À LIRE · Berserk · Tome 3 · 3 restants » et « Les 2
séries » ; `/a-lire` affiche « Reprendre : Berserk, Tome 3 · Glenat, 2 lus ·
3 tomes en attente » et « Commencer : Vinland Saga, Tome 1 ».

Pas de test automatisé (demande de l'utilisateur). `ReadingListService.compute`
est un calcul pur sur trois dépôts : un faux de chacun suffirait le jour venu.

### Lot 121 — un cache qui ne se périme jamais a besoin d'une porte

Après le Lot 120, l'utilisateur rouvre Boruto sur son instance : toujours
**7 tomes**. Aucun appel aux fournisseurs dans les journaux — la liste venait
du cache durable (`volume_search_cache`), ligne « boruto naruto next
generations → 7 », écrite à 13:53 par la version précédente du fournisseur
BnF, un moment où Google Books répondait sans rien trouver et où le résultat
passait donc pour complet. Ce cache est **sans expiration**, à dessein : il
épargne les fournisseurs, et une liste de tomes ne change guère. Mais il n'y
avait aucun moyen, depuis l'écran, de la redemander.

**Deux portes.** Sur l'aperçu, « **Actualiser depuis la source** »
(`useTomesProposes.actualiser` : la même recherche avec `forceRefresh`, le
résultat remplace celui de la requête normale) — dans les deux états, grille
et « aucun tome trouvé », où la phrase promettait « réessayer plus tard »
sans rien pour réessayer. Sur la fiche, « **Recharger depuis la source** »
rafraîchit désormais aussi la liste des tomes avant les jaquettes, et
invalide la proposition de tomes : « Ajouter un tome » y voit ceux qui
manquaient. Une source muette n'y fait pas échouer le reste.

La ligne fautive de l'instance de l'utilisateur a été supprimée à la main
(`DELETE` sur ce seul cache, qui se reconstitue à la prochaine ouverture) —
c'était une donnée d'une version passée, pas un état à conserver.

### Lot 120 — les trous entre les tomes, et les jaquettes

Retour de l'utilisateur sur l'aperçu de Boruto après le Lot 119 : « il y a
des trous entre les tomes et il manque les jaquettes ». Sept tomes sur vingt
(1, 2, 3, 8, 9, 17, 18) et aucune image — la BnF n'en fournit pas, et Google
Books, qui en fournit, était toujours à quota épuisé.

**Les trous : la BnF catalogue un tome de deux façons.** Soit le titre de
série en `200$a` avec le numéro en `200$h` (« Boruto » T9) — la seule voie
lue jusqu'ici. Soit le **titre propre du tome** en `200$a` (« Kawaki », « Le
sacrifice », et les premiers *Dragon Ball* de 1993 : « Le nuage
supersonique ») avec la série et son numéro en `461$t`/`$v` ou `225$a`/`$v`.
Treize des vingt Boruto sont catalogués ainsi. Le fournisseur lit désormais
les deux voies, et interroge le **nom de série** (avant « : » ou « - ») plutôt
que le titre complet — sans quoi ces notices ne remontaient même pas. Un
garde-fou est venu aussitôt : rattaché à la série « Boruto » mais avec le
sous-titre « two blue vortex », un tome appartient à une **autre** série ;
sans cette règle, la suite s'invitait comme « édition Two Blue Vortex » des
tomes 1 à 3. Un numéro de série au-delà de 999 n'en est pas un (des
identifiants FRBNF à quinze chiffres traînent en `461$v`).

**Les jaquettes : la BnF en a, en fait.** Le service « couverture » du
catalogue (`catalogue.bnf.fr/couverture?…&idArk=<ark>`) rend une image
JPEG (~300 Ko) pour les notices récentes, et une erreur **500** pour les
autres. Chaque adresse est vérifiée par un HEAD avant d'être rendue : une
adresse morte persistée sur le tome à l'ajout bloquerait ensuite le
rattrapage de jaquettes de Ma collection, qui ne retente que les tomes sans
image. Open Library (par ISBN) a été essayé aussi : 1 couverture sur 4 —
écarté.

**Mesuré sur la pile jetable, Google Books toujours à 429** : Boruto → **20
tomes, 1 à 20, édition Kana**, plus de suite parasite ; jaquettes : **23 sur
23** au premier passage… puis 13 sur 20, puis **0 tome** : la BnF s'était
mise à répondre **429**, puis à couper la connexion. Elle limite le débit par
adresse, et vingt HEAD en parallèle, trois reconstructions de suite et les
sondes de la session l'avaient dépassé. Trois parades : les vérifications
partent par **vagues de quatre** avec une reprise sur coupure ; un 429 ou une
coupure de la BnF est signalé comme « fournisseur muet »
(`SourceUnavailableException`) et non comme « aucun tome », pour ne jamais
mettre ce vide en cache ; et un résultat **partiel** (un fournisseur muet)
est gardé **une heure en mémoire** — avant, chaque ouverture de l'aperçu
pendant une panne de Google Books relançait la BnF et ses vérifications.

**Après les parades, une fois la BnF rouverte** (dix minutes plus tard) :
l'aperçu de Boruto dans le navigateur, joué de bout en bout — **20 tomes, 01
à 20, édition Kana, 20 jaquettes BnF, toutes chargées** (`img.complete &&
naturalWidth > 0` sur les 21 images de la page, série comprise). Le tri par
numéro du lot précédent s'applique. « Recharger depuis la source »
complétera par Google Books ce que la BnF n'illustre pas, au retour du
quota.

### Lot 119 — la source qui a le plus d'appels passe en premier

Direction donnée par l'utilisateur juste après le Lot 118 : « mettre en avant
l'api qui a le plus d'appels dispos pour uniformiser les données de l'app ;
chaque donnée chargée est stockée sur iozycore avec possibilité de recharger
depuis l'api avec un bouton sur la fiche détails ».

**La seconde moitié existait déjà**, et n'a pas été refaite : tout ce qu'un
ajout charge est persisté (attributs de l'œuvre, jaquette, tomes cataloguées,
jaquettes de tomes sur les `Variant`, et la liste des tomes en
`volume_search_cache`, sans expiration), et la fiche porte « Recharger depuis
la source » depuis le 2026-08-27 : recherche `includeOwned`, rapprochement par
identifiant externe (`malId`, `igdbId`, `bggId`) puis par titre, fusion des
attributs sans jamais effacer, puis rattrapage des jaquettes de tomes. Avec un
fournisseur principal qui change, ce bouton devient l'outil de
**réalignement** : une œuvre ajoutée depuis Jikan (« Kishimoto, Masashi »)
rechargée depuis AniList porte ensuite « Masashi Kishimoto », comme les
suivantes.

**La première moitié : l'ordre.** Recherche de mangas — **AniList en
premier** (`@Order(1)`, 90 req/min, ni clé ni quota du jour), puis Jikan (2 ;
60 req/min et des 504 par intermittence), l'API MyAnimeList officielle (3 ;
clé requise), Google Books (4 ; quota journalier). La déduplication par titre
garde le premier candidat rencontré : les œuvres viennent désormais du même
endroit tant qu'AniList répond, et les autres ne servent que ce qu'il n'a
pas. Tomes — **BnF en premier** (`@Order(1)`, structurée, sans quota), Google
Books second (`@Order(2)`), les deux toujours interrogées ; sur un même tome,
la règle « garde celui qui a une jaquette » devenait « la notice BnF fait
foi, la jaquette est reprise de Google Books » (`fusionnerTome`).

**Un détail de casse.** AniList reprend parfois la stylisation de l'éditeur
tout en capitales (« BORUTO: NARUTO NEXT GENERATIONS ») là où MyAnimeList
écrit « Boruto: Naruto Next Generations ». Un titre sans aucune minuscule est
remis en casse de titre ; les autres ne sont pas touchés (« JoJo »). Sans ça,
le changement de source aurait changé l'allure des titres — l'inverse de
l'uniformité demandée.

Vérification limitée par les circonstances : Jikan répondait encore 504 au
moment du lot, donc l'ordre ne s'observe pas en direct (AniList était déjà
le seul à répondre) ; tests du paquet métadonnées relancés, README et
parcours 27 mis à jour.

**Trouvé par l'utilisateur en testant** : l'aperçu de Boruto listait ses
tomes BnF dans l'ordre du catalogue — 09, 03, 02, 08, 01, 18, 17. Google
Books rendait les siens déjà rangés, et personne ne triait. `GET
/metadata/volumes` trie désormais par numéro, tri stable : les éditions
gardent l'ordre de leur première apparition, seuls les tomes se rangent.

### Lot 118 — quand tous les fournisseurs se taisent en même temps

Signalé par l'utilisateur en testant le lot précédent : l'aperçu de « Boruto:
Naruto Next Generations » disait « Nos fournisseurs n'ont pas répondu — impossible
de vérifier les éditions françaises ». Mesuré depuis Windows et depuis le
conteneur : **Google Books 429** (quota journalier de la clé épuisé) et
**Jikan 504** (MyAnimeList bloque ce relais tiers par intermittence), en même
temps. Demande : « une solution de backup pour récupérer les infos tout le
temps ».

**Ce qui existait déjà, et pourquoi ça n'a pas suffi.** Trois secours étaient
en place : l'API MyAnimeList officielle derrière Jikan, des clés Google Books
de réserve (`GOOGLE_BOOKS_BACKUP_API_KEYS`, aucune configurée), et la **BnF**
interrogée en parallèle de Google Books pour les tomes. Or la BnF répondait
**19 notices** pour Boruto, toutes écartées : elle catalogue `$a « Boruto »` +
`$e « Naruto next generations »`, et le fournisseur exigeait que `$a` seul
soit le titre cherché. Le secours existait, il ne reconnaissait pas
l'œuvre.

**BnF : trois corrections.** Le titre cherché est accepté s'il vaut `$a`, ou
`$a` suivi de l'un de ses `$e` (ce `$e`-là n'est plus lu comme une édition) ;
la comparaison plie désormais toute ponctuation, pas seulement espaces et
tirets. Les notices dont `200$b` n'est pas « Texte imprimé » sont ignorées —
le dépôt légal reçoit aussi les **DVD** (les coffrets Kana Home Video de
Boruto, numérotés 3, 4, 7, 8 comme des tomes, sortaient en édition « Kana
home video ») et les jeux (« Ressource électronique »). Et l'éditeur se lit
en `210$c` quand `214$c` manque (notices d'avant 2019) — les premiers tomes
sortaient en « Édition inconnue », à part des suivants.

**AniList, pas MangaDex.** Pour la recherche de titres, il fallait une
troisième base sans quota. MangaDex a été essayé puis retiré à la demande de
l'utilisateur (« c'est un site de scans, ça me semble peu fiable ») — retenu
**AniList** : une base de données d'œuvres, API GraphQL publique, sans clé,
90 requêtes/minute, sans quota journalier. `@Order(3)` derrière Jikan et
MyAnimeList, devant Google Books (passé à 4) : quand les deux premiers
répondent, la déduplication par titre garde leurs candidats ; quand ils se
taisent, AniList rend titre, année, statut, nombre de tomes, auteur, jaquette
et l'identifiant MyAnimeList — mêmes clés d'attributs que Jikan, pour que le
sous-titre de la liste, la résolution du titre français et la recherche de
tomes le lisent sans rien changer. Tri par popularité : « boruto » rend la
série principale en tête, et « attaque des titans » trouve *Shingeki no
Kyojin* (AniList indexe les synonymes, titres français compris).

**Mesuré sur la pile jetable, Jikan 504 et Google Books 429 au même moment** :
« boruto » → **7 candidats, tous ANILIST**, le manga principal en premier avec
ses 20 tomes et son `malId` ; tomes de « Boruto: Naruto Next Generations » →
**7 tomes BnF, édition « Kana », aucun DVD** (avant les deux dernières
corrections : 12 « tomes » dont 5 DVD et des « Édition inconnue »). Sept et
non vingt : la BnF catalogue une partie des tomes de Boruto sous leur
sous-titre français seul (« Kawaki », « Le sacrifice »), sans numéro — hors
de portée d'une recherche par titre de série, et Google Books les complétera
au retour de son quota. Partiel, mais réel : l'écran propose des tomes au lieu
d'un constat d'échec.

Tests existants du paquet métadonnées relancés (108 verts), aucun ajouté. Le
README gagne une section « Quand un fournisseur se tait » avec la chaîne de
secours par besoin et la parade `GOOGLE_BOOKS_BACKUP_API_KEYS`.

### Lot 117 — « Quelles séries ai-je commencées sans les finir ? »

La collection interrogée en français — le premier point de la V3 de
`CONCEPTION.md` §15, et la seule idée du 2026-09-04 retenue après l'import.
L'infrastructure était déjà là : Gemini branché depuis la Phase 2 de
l'Analyse d'achat, palier gratuit, et une règle établie — ce qui vient d'un
modèle est étiqueté, jamais persisté, jamais mêlé aux données.

**Ce que le modèle reçoit.** Pas la base : un instantané (`CollectionQuestionService`),
une ligne JSON par œuvre qui a un lien réel avec le compte — un exemplaire,
une envie ou une expérience. Titre, type, auteur, année, exemplaires et dates
d'acquisition, prix payé (avec « prixConnusSur » quand tous ne sont pas
renseignés), édition dominante avec tomes possédés / total et numéros en
plages (« 1-3, 5, 7-8 »), expériences datées et notées, envie, rang, tags.
Rien d'autre : ni identifiants de compte, ni jetons, ni les œuvres du
catalogue qui appartiennent aux autres. Au-delà de 1 500 œuvres, l'instantané
garde les plus récentes et le dit au modèle.

**La garantie, et sa limite.** Le modèle doit citer les œuvres qu'il utilise
par leur identifiant ; le service ne garde que ceux qui existent dans
l'instantané — un identifiant inventé ne devient jamais un lien. Une réponse
arrive donc toujours avec de vraies fiches à ouvrir pour la vérifier. Le
texte, lui, reste celui d'un modèle : l'écran (`/question`, depuis Mon profil)
l'encadre en pointillés ambre, « Réponse de l'IA — à vérifier », avec son
niveau de confiance en clair. Sans clé, le serveur répond 204 et l'écran dit
quoi configurer plutôt que d'afficher un formulaire mort ; si le modèle ne
répond pas, 503 — jamais une réponse vide présentée comme venant de la
collection.

**Vérifié en direct sur la pile jetable**, clé passée par l'environnement
(jamais dans un fichier du dépôt — `docker-compose.e2e.yml` la reçoit
désormais en option). Quatre œuvres, 47 exemplaires. « Quelles séries ai-je
commencées sans les finir ? » → Vinland Saga (IN_PROGRESS, 26/27) et Bakuman
(ABANDONED, note 5, pourtant complète), fiches citées : exactement ces deux,
confiance HIGH, 17,7 s. « Combien ai-je dépensé, et quelle série m'a coûté le
plus cher ? » → 266,40 € = 198,90 + 60,00 + 7,50, chaque somme exacte, Vinland
Saga en tête, HIGH. « À un ou deux tomes d'être complètes ? » → Vinland Saga
seule, et le modèle dit de lui-même que Berserk n'a pas de total connu. « Mon
jeu vidéo préféré ? » → « aucun jeu vidéo dans la collection », confiance LOW
— il refuse d'inventer, ce qui est exactement la consigne. Un piège
d'amorçage au passage : mes ajouts de tomes avec « Glénat » accentué en
argument shell sont partis en cp1252 et ont échoué en silence — Berserk n'a
eu qu'un tome, et le modèle a répondu juste sur ce qu'il avait.

Pas de test automatisé (demande de l'utilisateur). Le jour où il en faudra :
`construireInstantane` et `interpreter` sont paquet-privés, testables sans
HTTP, et un faux `AiCollectionOracle` suffit au reste.

### Lot 116 — la recherche promettait « un titre, un auteur… » et ne tenait que le titre

Consolidation demandée après le Lot 115, mesurée avant d'être touchée, sur la
pile jetable avec cinq séries (« Pokémon : la grande aventure », « L'Attaque
des Titans », « One Piece », « Bone », « Someone Else », chacune avec son
mangaka).

**Ce qui ne marchait pas, en chiffres.** La recherche locale (`GET
/entities/search`) filtrait en SQL par `LOWER(title) LIKE '%q%'` : « pokemon »
→ **0 résultat** ; « l attaque » → **0** ; « attaque titans » → **0** ;
« isayama » → **0** alors que le champ dit « Un titre, un auteur… » ; « one »
→ **Bone, One Piece, Someone Else**, l'ordre alphabétique avant la pertinence.
Et quatre endroits comparaient des titres chacun à sa façon — la recherche
locale, l'exclusion des titres possédés dans `MetadataSearchService` (casse et
espaces), les trois suggestions de Découvrir (casse seule) — aucun ne pliant
les accents : un fournisseur qui rend « Pokemon » pour une œuvre cataloguée
« Pokémon » la proposait comme nouvelle.

**Une règle, un endroit.** `domain/shared/TexteRecherche.normaliser` :
minuscules, accents retirés (NFD), tout ce qui n'est ni lettre ni chiffre
devient une espace. Le titre ne se filtre plus en SQL : la requête
(`findByFiltres`) ne garde que type et tag, et l'adaptateur filtre en mémoire
— au coût du listing d'un type, que Ma collection et le Catalogue paient déjà à
chaque visite, sur une requête temporisée à 500 ms. L'ordre devient la
pertinence : commence par la saisie, la contient, en contient chaque mot dans
le désordre, ou la porte dans un attribut d'auteur (`mangaka`, `author`,
`studio`, `designer`, `developer`, `publisher`). `MetadataSearchService` et
`DiscoveryService` passent par la même fonction.

**Après, sur les mêmes données** : « pokemon » et « POKÉMON » → Pokémon ;
« l attaque » et « attaque titans » → L'Attaque des Titans ; « isayama » →
L'Attaque des Titans ; « oda » → One Piece ; « one » → **One Piece, Bone,
Someone Else** ; « rien du tout » → vide ; sans saisie → les cinq, en ordre
alphabétique. Un piège de mesure au passage : « POKÉMON » passé par un
argument de shell Windows partait en cp1252 et ne trouvait rien — encodé en
UTF-8 pour de vrai (`POK%C3%89MON`), il trouve. Même famille que le « · » du
Lot 115.

**Deux silences de l'écran, dits.** Sous « Tout », la recherche externe est
coupée (un fournisseur s'interroge type par type) ; sous trois caractères
aussi (quota). L'écran filtrait alors le catalogue sans un mot sur ce qu'il ne
faisait pas — « Naruto » tapé sous « Tout » ne proposait rien à ajouter, sans
dire pourquoi. Une phrase pour chaque cas, sous le champ.

**Et la puce « Tout » ne tenait pas.** Trouvé en vérifiant la première
phrase dans le navigateur : cliquer « Tout » puis taper « Naruto » ne
l'affichait pas, et la mesure disait pourquoi — après le clic, c'est encore
**Manga** qui est active (`Tout:false | Manga:true`, URL `?type=…`). La
présélection du premier type, faite pour arriver prêt à chercher, se
rejouait à chaque fois que le type redevenait vide, donc à chaque clic sur
« Tout », aussitôt annulé. Pour un compte connecté, voir le catalogue entier
était impossible depuis que la puce existe ; seul un visiteur, exempté de la
présélection, y avait accès. Elle ne s'applique plus qu'à l'arrivée, une
fois, et jamais après un choix explicite.

Tests existants relancés (`EntityPersistenceIntegrationTest`,
`MetadataSearchServiceTest`, `DiscoveryServiceTest`, `SeriesMatcherTest`,
`QuickAddServiceTest` : 72 verts), pas de test ajouté, à la demande de
l'utilisateur. Parcours 27 et 28 de `USER_JOURNEYS.md` mis à jour.

### Lot 115 — l'export avait un sens, pas de retour

§19 de `CONCEPTION.md` promettait « l'absence d'enfermement » et décrivait le
flux cible d'un import (source → analyse → rapprochement → cas ambigus →
validation), en demandant de ne pas le construire avant qu'une **source
concrète** le justifie. Elle existait depuis le commit `f05b531` : l'export
JSON de l'application elle-même. Sans retour, « Emporter ma collection » était
un aller simple — changer de NAS ou repartir d'une sauvegarde n'était possible
qu'en restaurant PostgreSQL entier.

**Deux temps, un seul code.** `POST /api/import/analyse` reçoit le document
d'export et dit ce qu'il ferait sans rien écrire ; `POST /api/import/appliquer`
rejoue exactement la même passe (`ImportService.Passe`, un booléen `ecrire`)
en une transaction. Le rapport (`ImportReport`) compte par section ce qui
serait **créé**, **rattaché** (existait déjà, on s'y raccorde) ou **ignoré**
(et la remarque dit pourquoi). Un import n'écrase jamais : il ajoute ou
s'abstient. Une seule exception nommée « remplacé » : les préférences
d'analyse d'achat, qui n'ont pas de doublon possible.

**Le rapprochement suit la frontière du multi-comptes.** Le catalogue (types,
tags, œuvres, tomes, éditions, relations) est partagé : on s'y rattache par sa
clé naturelle — code de type, libellé de tag, (type, titre), libellé de tome,
(série, édition) — comme l'ajout rapide et l'import BGG le font déjà. Ce qui
est privé (possessions, expériences, envies, classements, Tier Lists, éditions
suivies, prix relevés, préférences) est recréé pour le compte qui importe, en
sautant ce qui existe à l'identique. Les identifiants du fichier ne sont
jamais réutilisés : la même sauvegarde peut donc être renvoyée sur l'instance
qui l'a produite, et n'y crée rien. Un tag absent n'est créé que par un
administrateur — même règle que `SecurityConfig` sur `/api/tags`, sinon
l'import aurait été un moyen de la contourner ; les œuvres sont importées
sans, et la remarque le dit.

**Deux trous dans l'export, trouvés en le renvoyant.** `VariantExport` ne
portait pas `mangaEditionId` : un tome réimporté perdait son édition de
référence, et chaque « X sur Y » repartait de zéro. `WishlistEntryExport` ne
portait pas `variantId` : une envie de tome redevenait une envie d'œuvre.
Les deux champs sont ajoutés (JSON et CSV) ; les exports antérieurs restent
lisibles, ces liens en moins.

**Vérifié en direct, sur la pile jetable de Playwright** (base et compte
propres, détruits ensuite) : deux séries, trois possessions dont une avec prix
et date d'achat, une expérience sur un tome, une envie de tome, une relation,
un tag posé, un classement général, une Tier List classée, une édition suivie,
un prix relevé, des préférences non triviales. Export → analyse sur la même
instance : **0 à créer, tout rattaché**, préférences « remplacé ». Pile
détruite, compte neuf, analyse : **15 à créer**, et rien d'écrit (export
toujours vide). Application, puis ré-export : **identique à l'original hors
identifiants et `generatedAt`** — liens tome→édition, prix d'achat, dates,
rangs compris. Ré-analyse du même fichier : 0 à créer. Un JSON quelconque est
refusé en 400 (« aucune section reconnue ») plutôt que rapporté « 0 partout ».
L'écran (`/settings/import`, atteint depuis le bloc « Restaurer une
collection » sous « Emporter ma collection ») a été joué de bout en bout dans
le navigateur avec un fichier aux titres renommés : analyse, « Importer »,
« Import terminé », et les deux séries visibles dans Ma collection.

Pas de test automatisé dans ce lot, à la demande de l'utilisateur. Le chemin
naturel, quand il viendra : un parcours Playwright qui exporte, détruit, et
réimporte — c'est exactement ce qui a été joué à la main ici.

### Lot 114 — une livraison porte un numéro, pas un SHA

Le pied de page affichait `0352751` depuis le 31/08. Ce SHA **identifie**
parfaitement le code livré, mais il ne répond pas à la question qu'on se pose
en le lisant : suis-je en avance ou en retard ? Deux SHA ne se comparent pas.
Le cas où ça compte est précisément celui que ce pied de page a été construit
pour montrer - l'interface et le serveur qui ne viennent pas de la même
livraison - et il le montrait avec deux identifiants dont on ne pouvait pas
dire lequel était le plus récent.

**Le numéro est un Majeure.Mineure.Patch déduit des messages de commit**,
calculé au moment de la publication (`web/scripts/version.mjs`). Aucun geste à
poser, donc rien à oublier un soir de correction rapide ; ordonné, donc
« serveur 1.2.0 » sous « Version 1.3.1 » se lit d'un coup ; et il dit ce qui a
changé, pas seulement qu'il a changé. Le numéro du pom (`0.1.0-SNAPSHOT`) ne
pouvait pas jouer ce rôle - il ne bouge jamais.

#### La règle, et le prix qu'elle se paie

Ce dépôt écrit ses messages en Conventional Commits depuis le début : la
nature de chaque changement est **déjà écrite**, il n'y avait qu'à la lire.

| Le commit | Le numéro |
|---|---|
| `feat!:`, ou `BREAKING CHANGE:` en pied | Majeure + 1, le reste à zéro |
| `feat:` | Mineure + 1, Patch à zéro |
| tout le reste (`fix`, `perf`, `refactor`, `docs`, `test`…) | Patch + 1 |

La troisième ligne est un choix, et il se paie : `docs:` n'est pas un
correctif. Mais un commit déployé qui ne bougerait AUCUN chiffre donnerait deux
livraisons différentes portant le même numéro - précisément ce que ce numéro
existe pour éviter. Tout ce qui part mérite au moins un patch.

Le calcul repart de la dernière étiquette `vX.Y.Z` atteignable, posée par le
déploiement précédent. D'où une propriété qu'on n'a pas eu à coder : **poser
`git tag -a v2.0.0` à la main suffit à décider d'un cap**, le calcul repart de
là. L'automatisme ne retire pas la décision, il évite seulement d'avoir à la
prendre quand il n'y en a pas.

Sans étiquette de départ, le script **échoue** au lieu de repartir de 1.0.0 :
c'est le signe d'un clone superficiel, et un numéro qui recule se lit
exactement comme un numéro qui avance. `v1.0.0` a été posée à la main sur ce
qui tournait le 2026-09-02.

#### Le compteur de commits, essayé d'abord

La première version de ce lot numérotait par `git rev-list --count HEAD` - 379,
380, 381. Ça marchait, et ça manquait l'essentiel : un compteur dit qu'il s'est
passé quelque chose, jamais QUOI. Entre 380 et 381, rien ne distingue une
correction d'une refonte. Le passage au sémantique n'a coûté qu'un fichier de
plus, parce que les trois endroits où le numéro se pose - écran, image,
étiquette - étaient déjà en place et ne demandaient qu'une autre chaîne.

#### « Version », et pas « Livraison »

Le mot juste, dans le vocabulaire de ce dépôt, aurait été « livraison » - c'est
celui de tous ses commentaires. Il est **pris** : l'analyse d'achat appelle
« livraison » les frais de port d'une annonce (« Livraison non incluse »,
docs/LISTING_SOURCES.md), et ce pied de page s'affiche jusqu'au bas de cet
écran-là. La collision a été trouvée en vérifiant le bundle construit - `grep
Livraison dist/` rendait deux fichiers, dont `PurchaseAnalysisResultCard`.
L'étiquette à l'écran, l'étiquette d'image et l'étiquette git disent donc
toutes les trois **version**.

#### Ce qui relie le numéro au code

Un numéro affiché ne vaut que si l'on peut remonter à ce qu'il désigne. Le même
`1.3.1` est posé à trois endroits par le workflow de déploiement :

- **à l'écran**, gravé dans les deux images (`ARG VERSION`) ;
- **sur l'image publiée**, `iozycore-api:v1.3.1` dans GHCR - c'est ce qu'on
  remet dans `docker-compose.nas.yml` pour revenir en arrière ;
- **sur le commit**, une étiquette git annotée `v1.3.1`, visible sur GitHub et
  résolue par `git show v1.3.1` - et c'est elle, en plus, que lit le calcul de
  la livraison suivante.

Le SHA **cesse** d'étiqueter les images : deux identifiants pour une seule
livraison, c'est un de trop, et l'étiquette git mène désormais au commit exact
sans qu'on ait à compter des commits à la main.

L'étiquette est posée **après** la publication - elle dit « cette livraison est
partie », jamais « on a essayé de la publier ». Rejouer le workflow sur le même
commit (`workflow_dispatch`, après une correction du `.env` du NAS) retombe sur
un numéro déjà étiqueté : on ne repose alors rien plutôt que de faire échouer
un déploiement pour une étiquette qui dit déjà la vérité.

#### Le piège, et il ne s'annonce pas

`actions/checkout` ne clone qu'**un seul commit**, sans étiquettes, par
défaut. Sans `fetch-depth: 0`, le calcul n'a ni base ni historique. Il échoue
donc bruyamment plutôt que d'inventer - et le workflow prend la même précaution
une ligne plus loin : `echo "x=$(commande)"` masquerait l'échec de la commande
derrière le succès d'`echo`, et publierait une version **vide**. L'affectation
se fait donc en deux temps, ce qui laisse `bash -e` arrêter le job.

C'est le genre de défaut qu'aucun test ne voit et qu'on ne découvre qu'en
comparant deux livraisons qui portent le même chiffre.

#### L'écran où il manquait, et c'était le pire

Trouvé en testant : « je ne vois pas la version ». Le pied de page vit dans
`AppShell`, et `PorteFermee` **remplace tout le shell** tant que personne n'est
connecté (App.tsx) - l'écran de connexion n'avait donc pas de version. C'était
l'écran où la question se pose le plus fort : quand on n'entre PAS, savoir ce
qui tourne est la première chose qu'on cherche.

`PiedDePage` prend donc un `sansSession`, qui fait deux choses à la fois parce
qu'elles ont la même cause - être hors du shell : il n'interroge pas
`/api/version` (la route exige une session, ce serait un 401 de plus dans la
console de quelqu'un qui n'est pas encore entré ; le numéro de l'interface,
lui, est compilé dans le fichier et ne demande rien à personne), et il laisse
tomber le dégagement de 96 px réservé à la barre d'onglets, qui n'existe pas
là et qui remonterait le formulaire centré d'autant. Mesuré sur la porte :
visible sans défilement en 1280 px comme en 375 px, aucun débordement.

#### « Version dev » ne répondait pas à la question

Deuxième chose trouvée en testant : sur le serveur de développement, le pied
de page disait « Version dev » - c'est-à-dire « je ne sais pas », à la seule
question qu'il pose. Git, lui, sait : `vite.config.ts` appelle le même
`scripts/version.mjs` que la publication et pose `VITE_VERSION` quand elle
n'est pas déjà là (en conteneur elle l'est, et l'image de build n'a de toute
façon ni git ni étiquettes).

Le suffixe n'est pas décoratif : un poste de travail a des modifications non
commises, et son numéro ne désigne **aucune image publiée**. Afficher
« 1.1.0 » tout court ferait passer un brouillon pour une livraison - exactement
ce que `ARG VERSION=dev` évitait. « **1.1.0-dev** » dit les deux : de quel
commit on part, et qu'on n'est pas une livraison. C'est d'ailleurs ce que `-dev`
signifie en sémantique de version - une pré-livraison, qui vient AVANT le 1.1.0
publié.

Conséquence à traiter tout de suite : l'interface aurait alors porté
`1.1.0-dev` pendant que l'API locale répond `dev`, donc « serveur dev,
rechargez » **sur chaque écran d'un poste de travail**. Deux brouillons n'ont
aucune raison de coïncider, et un avertissement permanent apprend à ignorer
la ligne le jour où l'écart est vrai. L'écart n'est donc signalé qu'entre deux
LIVRAISONS (`estUneLivraison`, dans api/version.ts) - un SHA d'avant le
numérotage en est une, `dev` et `1.1.0-dev` n'en sont pas.

Effet de bord sur les tests : ils lisaient `VERSION_INTERFACE` de la machine
qui les joue, ce qui les aurait fait changer de sens à chaque commit. Ils la
POSENT désormais.

#### Deux numérotations à ne pas confondre

Le numéro de **lot** (celui de cette section, 114) compte les chantiers de ce
document ; la **version** numérote les livraisons. Ils ne coïncident pas et
n'ont pas à le faire : tous les lots ne sont pas des livraisons, et huit commits
d'infrastructure - le déploiement sur NAS, la visite anonyme - sont partis sans
section ici.

Restent dans le dépôt trois étiquettes `version-379`, `version-380` et
`version-381` - une par déploiement de la journée où le compteur de commits a
vécu. Elles ne sont pas supprimées : une référence publiée ne s'efface pas pour
faire propre, et leurs images portent les mêmes noms dans GHCR. Le calcul les
ignore, il ne regarde que `v[0-9]*.[0-9]*.[0-9]*`.

#### Le filet

330 tests web (42 modules). Dix portent sur le calcul du numéro lui-même
(`web/scripts/version.mjs`), là où l'erreur ne se verrait sur aucun écran : une
majeure oubliée, un `docs:` qui n'incrémente rien, le mot « BREAKING CHANGE »
cité dans une phrase et pris pour un pied de message. Le pied de page en porte
six : le cas normal
(un seul numéro), la divergence (`serveur 378` et le lien pour recharger), le
serveur muet (qui reste muet), et le SHA de 40 caractères d'une image
construite **avant** ce lot - transitoire, mais bien réel le jour du passage,
et 40 caractères au bas d'un écran de 375 px ne se lisent pas.

### Lot 113 — le même N+1, sur le premier chiffre qu'on voit

Le constat C1 a été corrigé au Lot 101 sur les suggestions d'achat. **La même
figure vivait quarante lignes plus loin**, dans `computeCollectionValue()` -
celui qui alimente le hero du Profil (« Valeur de la collection ») et l'écran
Statistiques.

Deux boucles, deux N+1 :

- une lecture du catalogue **par possession** (`entityRepository.findById` dans
  un `computeIfAbsent`) ;
- la progression demandée **une fois par série** (`progressService.compute(id)`),
  exactement l'appel que le Lot 101 avait remplacé ailleurs.

Mesuré avant : **28 requêtes pour 5 séries, 58 pour 11**. Après : **constant**.

C'est la leçon du Lot 49 qui se répète - « quand un calcul est rebranché sur
une source unique, chercher TOUS ses jumeaux dans le même fichier ». Cette
fois, le jumeau était dans un autre fichier, et il a fallu aller le chercher.

#### Un faux dépôt qui mentait

`StatsServiceTest` a échoué en annonçant **0 €** pour une collection qui en vaut
29,80. Le coupable n'était pas le code : son `EntityRepository` en mémoire
rendait `List.of()` pour `search(...)`, avec le commentaire « non exercé par ce
test ». C'était vrai jusqu'à ce que la valeur cesse de lire les œuvres une par
une.

Un faux dépôt qui ment sur une méthode ne se signale que le jour où quelqu'un
l'appelle - et ce jour-là, il accuse le code. `search` est désormais
réellement implémentée.

#### Les deux autres boucles, mesurées plutôt que supposées

Restaient deux boucles dans le même fichier. Mesurées, pas relues :

- **`computeSummary`** (tout l'écran Statistiques) boucle sur les **types de
  collection**, pas sur les séries : son coût suit le nombre de catégories
  qu'on a créées - une poignée - et pas la taille de la collection. **Aucun
  défaut**, et c'est maintenant fixé par un test.
- **`computeYearlyRecap`** portait la même lecture par série que la valeur :
  **13 requêtes pour 5 séries, 25 pour 11**. Corrigé de la même façon.

Trois occurrences de la figure du constat C1 dans deux fichiers, sur douze
lots. La leçon du Lot 49 - « chercher tous les jumeaux » - ne suffisait pas :
il fallait **mesurer** chaque boucle, parce que celle de `computeSummary` a
exactement la même forme et n'est pas un défaut.

1085 tests backend.

### Lot 112 — un tag décrit une œuvre, pas une collection

En cherchant quoi faire des tags, trois faits ont décidé du lot - et aucun
n'était connu avant de regarder :

1. **Il n'y en avait aucun.** Zéro ligne dans `tag`, zéro dans `entity_tag`.
   La fonctionnalité existe depuis le début et n'a jamais servi. C'est aussi
   pourquoi le filtre ajouté au Lot 103 ne montrait rien : sa section
   n'apparaît que s'il existe des tags.
2. **Les tags vivent dans le catalogue PARTAGÉ.** `tag` et `entity_tag` n'ont
   pas de colonne `owner_id`, contrairement aux possessions, envies et
   classements. Sur une instance à plusieurs, tout le monde voyait les tags de
   tout le monde - et pouvait les modifier.
3. **`ON DELETE CASCADE` était déjà là**, donc supprimer un tag détache
   proprement.

Le deuxième point posait une vraie question de produit, et elle a été
tranchée : **un tag décrit l'ŒUVRE** - « seinen », « one-shot », « adapté en
animé » - au même titre que sa catégorie ou son édition de référence. Il reste
donc partagé, et **seul un administrateur le pose**.

Ce qui suit de ce choix, et qui compte autant : un tag n'est pas l'endroit où
noter « prêté à Marc » ou « à revendre ». Ces choses-là sont personnelles,
elles n'ont rien à faire dans un catalogue commun, et rien n'accueille cet
usage - c'est explicite plutôt que laissé à l'interprétation.

#### Lire est ouvert, écrire ne l'est pas

\`\`\`
.requestMatchers(HttpMethod.GET, "/api/tags/**").authenticated()
.requestMatchers("/api/tags/**").hasRole("ADMIN")
\`\`\`

Deux lignes, et l'ordre compte. Fermer la lecture viderait le filtre de Ma
collection sans un mot ; l'ouvrir en écriture laisserait n'importe quel compte
étiqueter les œuvres de tous les autres, sans que rien à l'écran ne le montre.

Sur la fiche, un compte ordinaire **voit** les tags - ils décrivent l'œuvre, et
ils lui servent à filtrer - mais ne peut ni les retirer ni en poser. L'écran le
**dit** au lieu de laisser chercher.

#### Ce qui manquait vraiment

`PATCH` et `DELETE` sur un tag n'existaient pas : une faute de frappe était
définitive, et la liste du filtre ne pouvait que grossir. Même défaut « poser
sans pouvoir gérer » que les prix relevés du Lot 110.

**Administration ▸ Ma collection ▸ Tags** les liste avec **ce qu'ils portent**.
Le décompte n'est pas décoratif : « supprimer un tag posé sur 12 œuvres » et
« supprimer un tag qui ne sert à rien » ne sont pas le même geste. Il vient des
œuvres déjà en cache, pas d'une route de plus - payer un endpoint pour un
nombre affiché sur un écran d'administration serait payer pour ce qu'on a sous
la main.

Renommer ne détache rien, et l'écran le dit : le tag garde son identité, seul
son nom change, sur toutes les œuvres d'un coup.

#### Le filet

1082 tests backend, 292 web. Six tests de contrat pour la nouvelle porte, et
une mutation qui la ramène à « authentifié » : rattrapée.

Six tests existants de `CatalogConfigurationHttpContractTest` sont tombés au
passage, et c'était **juste** : ils écrivaient des tags au nom d'un compte
ordinaire. Ils partent désormais au nom d'un administrateur, et leur en-tête
dit pourquoi - ils décrivent ce que fait la route, pas qui a le droit de
l'appeler.

### Lot 111 — l'avatar prend la couleur du pseudo

Le Lot 105 avait posé les initiales et laissé la couleur de côté, faute de
savoir garantir le contraste. Deux comptes se distinguaient donc par deux
lettres qu'il faut lire ; ils se distinguent maintenant par une teinte qu'on
reconnaît sans lire.

**La palette existe déjà** : les six teintes des « couvertures » sans jaquette,
et le même hash déterministe. Inventer une seconde gamme pour deux lettres
aurait fait entrer une palette de plus dans une application qui en a une, et
deux gammes finissent toujours par jurer ensemble.

#### L'encre est choisie, pas décidée d'avance

Le blanc passe le 4,5:1 sur **cinq** des six teintes. Sur la sixième - la verte,
`6B7D5A` - il tombe à **4,46** : juste en dessous, invisible à l'œil et bien
réel pour qui lit mal. Le code prend donc, pour chaque teinte, celle du blanc ou
du noir qui contraste le mieux ; le minimum garanti passe à **4,71**, quel que
soit le pseudo.

`check-contrast.mjs` vérifie désormais ces six pastilles, et **relit la palette
depuis `tokens.ts`** au lieu de la recopier : une septième teinte serait
vérifiée sans que personne y pense, et une teinte modifiée ferait tomber le
contrôle plutôt que de passer inaperçue.

#### Ce qui n'a pas de couleur

Le repli « IO », tant que le compte n'est pas arrivé. Une couleur qui
apparaîtrait alors se lirait comme un changement d'identité.

Vérifié en direct : `romain` rend `#8A6A3A` sur blanc, mesuré à **5,00:1**.

### Lot 110 — les huit capacités cachées, relues une par une

Le §16 des parcours liste ce qui existe mais ne se trouve pas. Huit constats,
dont certains dataient du 2026-08-21. Relus **dans le code**, pas de mémoire -
la même discipline qui avait montré que trois constats d'UX étaient caducs.

Résultat : **deux caducs, trois corrigés, un délibéré, deux ouverts**.

#### Le plus grave était le premier

**Relever un prix de marché** était la capacité la plus déterminante de
l'application et la plus cachée. Ces relevés sont la seule source de prix
réellement constatés, dont dépend la qualité de **toutes** les analyses
suivantes. Pour en enregistrer un, il fallait analyser une annonce, ouvrir le
détail d'une de ses séries, et seulement si l'édition était reconnue *et* les
tomes contigus.

Pire, et c'est ce que la relecture a trouvé : l'écran **Éditions de référence**
listait déjà ces prix et permettait d'en retirer un faux - mais son bloc
commençait par `if (observations.length === 0) return null`. Sur une édition
sans relevé, **rien ne s'affichait**. L'endroit exact où l'on aurait voulu en
saisir un était l'endroit où l'application ne disait pas que ces prix
existaient.

Le bloc annonce désormais le vide, et porte « Relever un prix ». Le formulaire
demande le prix et la plateforme - « 45 € » ne veut pas dire la même chose sur
Vinted et chez un libraire - et pré-remplit la date à aujourd'hui, un relevé
étant un fait daté. La **portée** reste facultative, et l'écran dit ce que le
prix décrira **avant** qu'on l'enregistre : sans tomes, il couvre l'édition
entière. L'**état** aussi reste facultatif : inventer « Bon état » par défaut
fausserait toutes les comparaisons dans le sens optimiste.

#### Le réglage qui gouvernait un écran sans y être

**L'ordre des langues de titre** décide de ce que la liste de suggestions
affiche et de ce qui sera enregistré. Il vivait dans Paramètres, sans aucun lien
depuis l'écran qu'il gouverne : on voyait un titre en romaji sans savoir que
c'était un choix, encore moins où le changer. La liste des suggestions porte
maintenant « Langue des titres » à côté de son titre - et passe son origine,
pour que le retour ramène à Rechercher.

Il n'apparaît **que** quand il y a des suggestions : un réglage proposé devant
une liste vide serait du bruit permanent sur le seul écran d'ajout.

#### Deux constats qui décrivaient un état révolu

**« Exemplaires passés »** : aucun composant ne rend `SOLD` ni `LOST`, et le
panneau de tome qui les montrait n'existe plus. Retirer un tome le **supprime**
depuis le Lot 55 - il n'y a plus d'exemplaire passé à découvrir. Seul le type
du DTO porte encore ces statuts, parce que le serveur les expose.

**« Analyse d'achat depuis une fiche »** disait « l'entrée est en bas du bloc
d'identité ». C'est un **bouton principal** de la bande haute, en aplat
d'accent, à côté d'« Éditer ».

#### Un qui n'en est pas un

**« Classement rapide » n'apparaît que s'il existe au moins une œuvre non
classée** - c'est délibéré, pas un défaut de découverte. Proposer « classer ce
qui n'est pas classé » quand tout l'est ouvrirait un écran vide. Même règle que
les rails vides de Ma collection.

#### Le filet

286 tests web (35 modules), 14 parcours. `SearchPage` et `EditionObservations`
ont enfin les leurs. Quatre mutations rattrapées, dont la portée envoyée à
moitié et l'état par défaut inventé.

Le test de `SearchPage` a trouvé quelque chose immédiatement, dans le test
lui-même : le candidat de métadonnées que je lui donnais n'avait pas
d'`attributes` - le champ que ce réglage gouverne précisément - et le rendu
plantait. Une fixture qui n'est pas ce qu'elle prétend être ne teste rien.

### Lot 109 — dix écrans sans sortie

En rangeant les réglages, un défaut est apparu par contraste : **dix écrans
n'avaient aucun lien de retour**. Paramètres, Administration ▸ Comptes,
Éditions de référence, Catégories de collection et son formulaire, Import BGG,
Statistiques, Suggestions d'achats, Bilan annuel, Historique des analyses.

Tous s'ouvrent depuis un endroit précis, et depuis nulle part ailleurs. Leur
seule sortie était le **bouton Précédent du navigateur** - qui n'existe pas
dans une app installée sur l'écran d'accueil : le manifeste déclare
`display: standalone`, et c'est précisément ce que le lot PWA a rendu
possible. Le défaut ne s'est donc aggravé qu'après coup.

#### Un composant, pas une onzième copie

`LienRetour` prend le **parent naturel** en paramètre et propose l'**origine
nommée** quand celui qui a ouvert l'écran l'a passée (voir `lib/retour`). Les
deux sources dans le bon ordre : les catégories de collection s'ouvrent aussi
depuis Ma collection ▸ Plus d'outils, et y revenir par Administration serait un
détour que personne n'a demandé - ce chemin passe donc son origine.

Toujours pas de `navigate(-1)` : un « Retour » sans destination ment une fois
sur deux. Ouvrir deux écrans d'affilée ramènerait au précédent, pas à celui qui
contient.

Le composant apporte au passage les **44 px** de cible tactile que les six
copies manuelles n'avaient pas : leur texte fait 20 px de haut, et c'est le
premier élément interactif de la page, en haut, là où le pouce vise.

#### Ce qui n'a pas de retour, et pourquoi

Les écrans atteignables depuis l'en-tête ou la barre de navigation n'en ont
pas : Ma collection, Rechercher, Découvrir, Analyser une annonce, Mon profil,
et **Administration**, qui a son propre bouton depuis ce jour. Un lien de
retour y désignerait un contenant qui n'existe pas.

276 tests web. Le test de `LienRetour` a trouvé quelque chose immédiatement :
la suite de `ComptesPage` n'avait pas de Router dans son enrobage, et huit
tests sont tombés d'un coup - le composant a besoin d'un contexte de
navigation, ce qu'aucun écran de cette suite n'exigeait avant.

### Lot 108 — les choux et les carottes

Trois écrans se partageaient les réglages sans qu'aucune règle ne dise lequel
portait quoi. Le désordre avait une forme précise :

- **Profil** contenait une lecture (valeur, Tier Lists), un réglage (partage),
  une **destination déjà présente dans la barre de navigation** (« Analyser une
  annonce » — doublon exact), et la section Compte tout en bas, *sous* le lien
  « Paramètres » qui, lui, ne parlait pas du compte.
- **Paramètres** ne contenait en réalité que des réglages **de cet appareil** :
  thème et langue des titres vivent dans le `localStorage`, ils ne suivent pas
  le compte et changer de machine les perd. Rien ne le disait.
- **Administration avancée** mélangeait trois natures : le **contenu** de la
  collection (catégories, éditions de référence, import), **les données de
  l'utilisateur** (l'export JSON/CSV), et l'**instance** (les comptes, que le
  Lot 107 venait d'y poser).

#### L'axe : ce que le réglage concerne

Quatre échelles, et chacune répond à « qui est touché si je change ça ».

| | Où | Quoi |
|---|---|---|
| **Mon compte** | Paramètres | pseudo, adresse, emporter ma collection, se déconnecter |
| **Cet appareil** | Paramètres | thème, langue des titres — et l'écran DIT qu'ils ne suivent pas le compte |
| **Ma collection** | Administration | catégories, éditions de référence, import |
| **Cette instance** | Administration | les comptes (administrateur seulement) |

**Administration a son propre bouton dans l'en-tête**, à côté de l'avatar et
pas dedans.

Il a fallu **trois essais** pour y arriver, et l'erreur est instructive parce
qu'elle est toujours la même. Administration a d'abord été laissée **sous
Paramètres**, par habitude - c'était reconduire, un niveau au-dessus, le
mélange qu'on venait de défaire. Puis posée en lien sur **Profil**. Puis dans le
**menu de l'avatar**. Trois fois rangée derrière quelque chose qui appartient à
l'utilisateur, alors que déclarer les catégories de sa collection ou renseigner
une édition de référence n'est pas un réglage personnel : c'est l'outillage de
l'application, et il ne se trouve pas en cherchant son profil.

L'en-tête porte donc **deux** contrôles, et ce sont **deux liens**, pas un
menu : une icône clé pour l'administration, l'avatar pour le profil. Un panneau
à ouvrir puis à refermer pour un choix entre deux entrées coûte plus qu'il ne
range - il a existé une heure, le temps de s'en rendre compte.

Profil ne garde qu'une sortie, vers **Paramètres** : les deux écrans parlent de
la même personne, et c'est le seul emboîtement qui ne mélange rien. Il a servi
de couloir avec jusqu'à cinq liens vers ailleurs ; le reste concerne cette
collection.

Les éditions de référence passent de **trois niveaux de profondeur à zéro** ; le
§16 des parcours reprochait précisément leur profondeur.

Quatre sections nommées — et nommées pour de bon : chaque
`<section>` porte un `aria-labelledby`, sans quoi elle n'est pas un repère et
un lecteur d'écran retraverse une liste plate.

#### Trois déplacements, trois raisons différentes

**L'export quitte Administration** pour « Mon compte ». Il était rangé à côté
des catégories de collection, comme si emporter ses données était de la
configuration technique. C'est le contraire : c'est la garantie de pouvoir
partir, et elle appartient au compte qui possède ces données.

**« Analyser une annonce » quitte Profil.** C'est l'une des quatre destinations
de la barre de navigation (voir `navItems`) : le lien était un doublon exact,
sur un écran qui n'est pas une liste de raccourcis.

**« Bilan annuel » rejoint Découvrir.** C'est une lecture de la collection, pas
un réglage — comme les trois panneaux de cet écran. Un **lien** et non un
quatrième onglet : la composition éditoriale de Découvrir (1,65fr / 1fr, puis
pleine largeur) n'en attend pas, son propre commentaire dit « plus d'onglets à
ce stade », et le bilan est un écran entier, pas un panneau.

**La section Compte quitte Profil** pour rejoindre l'export et la déconnexion :
un seul endroit pour « mon compte » au lieu de deux moitiés. Profil garde le
pseudo en sous-titre — un écran qui s'appelle « Mon profil » doit dire de qui.

« Types de collection » devient **« Catégories de collection »** : le mot
« type » est celui du modèle, pas celui de l'utilisateur.

#### Le filet

270 tests web (32 modules), 14 parcours. Le parcours de déconnexion emprunte
désormais le **chemin** — avatar ▸ Profil ▸ Paramètres ▸ Se déconnecter — au
lieu d'aller à l'URL : c'est ce qui vérifie que la nouvelle organisation est navigable, et
c'est lui qui a signalé chaque déplacement, les deux fois. Six mutations
rattrapées, dont la phrase « ces réglages restent sur cet appareil » retirée
(personne ne peut deviner qu'un thème ne suit pas son compte) et l'entrée
Administration du menu pointée ailleurs.

`ProfilePage` a enfin ses propres tests, et ils gardent surtout ce qui a
**quitté** cet écran : le doublon de la barre de navigation, le bilan annuel,
les actions du compte, et les deux sorties. C'est le genre de chose qui revient
en douce - et un test s'appelle précisément « ne remet pas l'administration
derrière le profil », pour la quatrième fois.

### Lot 107 — administrer l'instance, sans administrer les gens

Depuis le Lot 95, plusieurs personnes peuvent avoir un compte ici. Personne ne
pouvait savoir **qui**. `AppUser` disait même, en toutes lettres : « ni rôle,
ni permission, ni statut ». C'était vrai tant que personne n'avait à répondre
de l'instance elle-même.

**Profil ▸ Paramètres ▸ Administration ▸ Comptes** : la liste, et la
suppression d'un compte.

#### La ligne que ce lot ne franchit pas

Un administrateur n'a **aucun accès** à la collection de qui que ce soit.
L'isolation par propriétaire est intacte, et ce qui sort de ces deux routes est
fait de métadonnées et de **nombres** : « 412 possessions · 7 envies ». Ces
nombres ne décorent pas - ce sont eux qu'on lit avant de supprimer, et un écran
qui montrerait seulement des pseudos ferait prendre la décision à l'aveugle.

C'est aussi ce qui distingue un administrateur d'un super-utilisateur : il
répond de la machine, pas des collections qui y vivent.

#### Un booléen, et une porte nommée

`is_admin`, pas une table de rôles : il n'y a qu'une distinction à faire, et
une machinerie à deux valeurs dont personne ne lirait jamais la seconde ligne.
Le premier compte l'est d'office, et la V28 marque le plus ancien sur une
instance déjà en service - sans quoi l'écran existerait sans personne pour
l'ouvrir. Nommer un second administrateur se fait en SQL, délibérément : c'est
un geste rare, et lui donner un bouton demanderait de décider qui peut appuyer
dessus.

Compter les possessions de quelqu'un d'autre, ou les effacer, c'est
littéralement sortir de sa propre cloison - un dépôt JPA en est incapable, le
filtre de `@TenantId` s'applique. D'où `JdbcDonneesParProprietaire` : du SQL
direct, **le seul endroit du dépôt** qui regarde par-dessus la cloison, avec un
seul appelant et le rôle `ADMIN` devant. Pas un contournement glissé dans un
dépôt ordinaire : une porte qui porte son nom.

La liste des onze tables y est **écrite à la main**. On pourrait la déduire du
schéma (« toute table portant `owner_id` ») ; une suppression définitive ne doit
pas dépendre d'une découverte - une table ajoutée demain serait effacée sans que
personne ne l'ait décidé.

#### Deux refus, et pourquoi ils protègent

**On ne se supprime pas soi-même** (409, et aucun bouton sur sa propre ligne) :
c'est ce qui garantit qu'il reste toujours quelqu'un pour administrer. **Le
catalogue n'est pas touché** : il est partagé, et supprimer les œuvres d'un
compte les retirerait de la collection des autres. La phrase de confirmation le
dit, parce que c'est exactement la crainte qu'on a le doigt sur le bouton.

#### Le filet

1076 tests backend, 255 web. Cinq mutations rattrapées, dont les trois qui
comptent vraiment : la table `ownership` retirée de la liste (des possessions
survivent à leur propriétaire, invisibles pour toujours), le `DELETE` privé de
son filtre (il emporte les voisins de ligne), et `hasRole("ADMIN")` ramené à
« authentifié » (n'importe quel compte peut lister puis supprimer tout le
monde). Aucune des trois ne casse un écran.

### Lot 106 — trois parcours de plus, et deux défauts qu'ils ont trouvés

Neuf des dix parcours structurants sont désormais joués de bout en bout (14
parcours Playwright). Ne manque que le **scan**, qui demande une caméra.

Les trois ajoutés sont ceux qui touchent à l'argent et au calcul :

- **Renseigner l'édition de référence** (parcours 8) — deux champs sur une
  fiche, et c'est la progression de toute l'application qui devient calculable ;
- **Voir les séries presque complètes** (parcours 7), depuis **Découvrir** et
  non depuis l'URL : les deux surfaces lisent le même endpoint, et « Tout voir »
  est le chemin réel entre elles ;
- **Évaluer une annonce** (parcours 6) — le seul écran où l'application dit à
  quelqu'un s'il doit dépenser de l'argent, et où ce qui compte est qu'elle
  confronte le lot à la **collection** : deux tomes déjà possédés, quatre tomes
  utiles, 7,50 € par tome réellement gagné et non 5 €.

#### Ce qu'ils ont trouvé

**Une collection déclarée complète sans que rien ne le sache.** Sur une fiche,
le total d'une édition retombait sur le nombre de tomes CATALOGUÉS quand
l'édition n'était pas renseignée : deux tomes ajoutés à la main, et la carte
annonçait « 2/2 », soit « 2 tomes possédés sur 2 » à un lecteur d'écran. Ce
repli contredisait à la fois le commentaire de `CartesEditions` juste à côté
(« le déduire du nombre de tomes qu'une recherche a RAMENÉS empoisonnerait le
moteur de complétude ») et la documentation du champ lui-même (« null tant
qu'aucune source ne le connaît »). Il ne se voyait pas : l'écran affichait un
ratio parfaitement plausible.

**Le formulaire écrivait, l'écran n'en savait rien.** `EditionCorrectionSection`
invalidait la complétude et l'édition, mais pas la **progression** — qui est
pourtant la raison d'être de ce formulaire, et qui vient du serveur en un seul
appel pour toute la collection. On renseignait 18 tomes, le serveur les
enregistrait, et la carte continuait d'afficher l'état d'avant. Aucune erreur
nulle part.

Les deux sont exactement ce que ces parcours existent pour attraper : rien ne
casse, l'écran montre simplement autre chose que la vérité.

#### Un test dont la vérité dépendait de l'ordre des fichiers

`collection.spec.ts` affirmait « 1 titre suivi » — le total de la collection.
Vrai tant que ce fichier passait en premier ; faux dès qu'un parcours au nom
alphabétiquement antérieur (`annonce.spec.ts`) a semé ses propres séries dans
la même pile. Il compte désormais le rail de l'univers qu'il vient de créer,
qui ne dépend que de lui.

`amorcage.ts` gagne `serieSansReference` — une série et ses tomes **sans**
fiche d'édition, c'est-à-dire l'état réel d'une collection avant le parcours 8.
`serieAvecEdition` s'appuie dessus.

### Lot 105 — un pseudo unique, et un avatar qui dit enfin qui

L'avatar en haut à droite affichait **« IO »**, en dur : les initiales de
l'application, sur le bouton qui mène au compte de quelqu'un. Sur une instance
à plusieurs personnes, c'était le seul endroit de l'écran qui aurait pu dire au
nom de qui on travaille, et il disait le nom du logiciel.

Il porte maintenant les initiales du **pseudo** — « jean-dupont » → JD,
« kenshin » → KE — et s'annonce « Mon profil — kenshin » à un lecteur d'écran :
deux lettres lues à voix haute n'apprennent rien à personne.

#### Le champ existait ; les règles, non

`display_name` était là depuis le Lot 94, et c'est justement ce qui manquait :
**facultatif**, **non unique**, et rempli avec **l'adresse e-mail** quand on ne
saisissait rien. Deux conséquences, toutes deux visibles : deux comptes
pouvaient porter le même nom sans qu'on puisse les distinguer, et l'avatar
affichait l'adresse de quelqu'un. Le compte de cette instance en était un
exemple — son nom d'affichage valait `romain@iozycore.local`.

La colonne est donc **renommée** en `pseudo`, pas doublée : c'est le même
champ, avec des règles enfin posées. Une seconde colonne aurait laissé
l'ancienne vivre, lue quelque part, et personne n'aurait su laquelle fait foi.

#### Ce qu'un pseudo a le droit d'être

3 à 24 caractères, lettres, chiffres, `.`, `-`, `_` ; il commence par une
lettre ou un chiffre. **Les accents sont acceptés** : refuser « Rémi » dans une
application française serait une règle technique déguisée en règle produit.
Sont refusés l'espace — « jean dupont » et « jean  dupont » sont
indistinguables à l'œil — et l'arobase, qui ferait passer un pseudo pour une
adresse.

L'unicité est posée **en base**, sur `lower(pseudo)`, et vérifiée **aussi**
dans `AuthService`. Ce n'est pas une redondance : l'index rend le doublon
impossible, la vérification rend le refus **explicable**. « Ce pseudo est déjà
pris » se lit ; une violation de contrainte non.

Et ce refus est **explicite**, contrairement à un échec de connexion qui ne dit
jamais si l'adresse existe. Un pseudo est public par destination — il s'affiche
sur l'avatar, il se lit dans un espace partagé : le taire n'apprendrait rien à
un curieux et empêcherait la seule personne concernée d'en choisir un autre.

#### La migration répare avant de contraindre

`V27` renomme, puis **réécrit** les valeurs qui ne peuvent pas être des pseudos
(une arobase, une espace, une longueur hors bornes) depuis la partie locale de
l'adresse, puis **départage** les doublons — le plus ancien garde son nom —
avant de poser l'index unique. Sans ce troisième temps, la migration échouerait
sur la première instance à deux comptes homonymes, et une migration qui échoue
chez quelqu'un d'autre est un défaut, pas une protection.

Vérifié en direct sur la pile locale : `romain@iozycore.local` est devenu
`romain`, l'avatar affiche **RO**, et le profil montre le pseudo au-dessus de
l'adresse.

#### Deux champs qui ne portaient pas leur nom

En écrivant les tests, l'aide « Au moins 10 caractères » du mot de passe s'est
révélée **dans le label** : le nom accessible du champ était donc « Mot de
passe Au moins 10 caractères », et `getByLabelText('Mot de passe')` ne le
trouvait pas. Un lecteur d'écran l'annonçait d'une traite au lieu de nommer
puis décrire. Les deux règles (mot de passe, pseudo) vivent maintenant hors du
label, reliées par `aria-describedby`.

#### Le filet

1063 tests backend, 244 web (28 modules). Cinq mutations rattrapées, dont
l'index unique lui-même — passé en index ordinaire, le test d'intégration
tombe. Le lien `aria-describedby` avait d'abord été posé **sans test** : la
mutation l'a dit, et l'assertion manquante a été écrite.

### Lot 104 — « strictement mono-utilisateur », écrit deux jours après la fin

Le Lot 95 a cloisonné les données par personne. Le README racine et celui du
backend l'ont dit le jour même ; **trois documents ne l'ont jamais su** :

- `docs/CONCEPTION.md`, qui ouvre sur « strictement mono-utilisateur » et
  justifie ses quatre personas par cette phrase — le document qu'on lit en
  premier pour comprendre le produit ;
- `web/README.md` et `ios/README.md`, même phrase en tête de « Le projet ».

Aucun n'est un journal : ils décrivent ce que l'application **est**, pas ce
qu'elle a été. Ils disent maintenant que chaque personne a sa collection et que
le catalogue des œuvres, lui, reste commun — la distinction qui compte, et la
seule chose que « multi-utilisateurs » ne dit pas.

Les mentions de `DESIGN_MIGRATION_V1.2.md` restent telles quelles : un journal
raconte des états passés, et les siennes étaient vraies quand elles ont été
écrites (même raisonnement que le constat C5).

#### Ce que ça dit du reste

Un changement structurel se propage dans le code par le compilateur et dans les
tests par leur échec. Dans la documentation, **rien ne le pousse** : une phrase
fausse s'affiche exactement comme une phrase vraie. Les documents qui décrivent
un ÉTAT (README, conception, audit) sont donc à rouvrir au même titre que le
code — et la liste des fichiers touchés par un lot n'y suffit pas, puisque le
défaut est précisément dans ceux qu'on n'a pas ouverts.

### Lot 103 — un classement qu'on posait sans jamais s'en servir

On pouvait créer un tag et l'attacher à une œuvre depuis sa fiche. Et ensuite,
rien : **aucun écran ne relisait ces tags**. Le paramètre existait pourtant de
bout en bout — `tagId` sur `GET /entities/search`, dans `searchEntities`,
jusque dans les clés de cache — et n'avait **pas un seul appelant**. Un
classement sans lecteur, c'est du travail demandé à l'utilisateur en échange de
rien.

**Ma collection ▸ Filtres** gagne donc une section « Tag », et la vue d'une
catégorie avec elle.

#### Trois décisions, et ce qu'elles écartent

**Le tri se fait en mémoire**, sans repasser `tagId` au serveur. Ces deux écrans
tiennent déjà toute la collection et `tagIds` est dans chaque œuvre : une
requête qui redemanderait un sous-ensemble de ce qu'on a sous la main serait
strictement plus lente. Même parti pris que le filtre d'état, qui se calcule là
depuis le premier jour. Le paramètre du serveur reste donc sans appelant, et
c'est un choix, pas un oubli.

**Un seul tag à la fois**, comme le paramètre du serveur. Une sélection
multiple obligerait à trancher entre « au moins un » et « tous », et à le faire
comprendre dans un panneau de quatre lignes. Ça se décide ; ça ne se glisse pas
dans un lot.

**La section n'apparaît que si des tags existent.** Le composant refusait déjà
d'afficher « Sortie annoncée » et « Classement » faute de données derrière ;
une liste de tags vide serait exactement le même défaut, en pire — elle
suggère qu'il manque quelque chose sans dire quoi.

#### Ce que le lot consolide au passage

Les deux écrans déclaraient chacun leur `status`, leur panneau, leur pastille
et leur bouton « Réinitialiser » : une dizaine de lignes en double, et deux
occasions de diverger dès qu'un filtre s'ajoute — ce qui arrivait précisément
maintenant. `useFiltresCollection` les porte, comme `useDonneesCollection`
porte les données un étage plus haut. La pastille, qui annonçait **« 1 » en
dur**, compte désormais.

#### Le filet

Douze tests neufs (231 au total, 26 modules). Le panneau a les siens ; l'écran
a les siens, et ils vérifient ce que le panneau ne peut pas prouver : qu'il
s'en **sert**. Un `porteLeTag` oublié dans le filtrage laisse un panneau
parfaitement fonctionnel devant une grille qui ne bouge pas — c'est exactement
l'état dans lequel les tags ont vécu jusqu'ici.

Quatre mutations, toutes rattrapées : le filtre retiré de l'écran (3 échecs),
le compte de filtres actifs figé (2), la section affichée sans tags (1), et
« Tous » remontant un identifiant au lieu de rien (5).

`setup.ts` gagne un bouchon `ResizeObserver` : jsdom ne l'implémente pas, et
tout écran qui affiche un titre passe par `TexteCoupe`. Il ne notifie jamais —
jsdom ne fait aucune mise en page, donc un rappel inventerait une mesure. Ces
tests affirment le **texte**, jamais sa troncature.

### Lot 102 — onze contrôles sur une app en ligne, sans y toucher

Le Lot 96 a préparé la mise en ligne (`vercel.json`, `railway.json`,
`docs/DEPLOIEMENT.md`) et le document dit, à chaque étape, comment vérifier
qu'elle a marché — à la main, écran par écran. `npm run check:deploiement <url>`
fait les six vérifications d'un coup, depuis l'extérieur.

Ce qu'elles ont en commun : **elles échouent sans rien casser de visible**.

- Une réécriture `/api/*` mal orthographiée dans `vercel.json` : le repli SPA
  répond, en **200**, en HTML. L'écran de connexion s'affiche normalement et
  attend une réponse qui ne viendra jamais. Le script exige donc du JSON avec
  les deux drapeaux attendus, pas seulement un 200.
- Une route protégée qui répond 200 : la porte est ouverte, et personne ne s'en
  plaint. Qu'elle réponde **404** est un autre défaut — la réécriture ne couvre
  pas tout — et il ne se verrait qu'une fois connecté.
- Un lien de partage inconnu qui répond **401** au lieu de 404 : c'est le défaut
  réel du Lot 94, où la redirection interne d'erreur retraversait la chaîne de
  sécurité. Il n'était visible que sur un vrai serveur, jamais en MockMvc.
- Le manifeste servi en `text/html` ou en `application/octet-stream` : l'invite
  d'installation disparaît, sans un message. Le type vient du **serveur**, pas
  du fichier — `check-pwa.mjs` lit le disque, celui-ci lit ce que le serveur en
  fait.
- `sw.js` mis en cache : les visiteurs gardent l'ancienne coquille, parfois des
  jours, sans moyen de le savoir.
- `/tier-lists` en 404 : l'app marche tant qu'on navigue et casse au premier F5.

Que des GET, sur des routes ouvertes ou censées refuser. Aucun compte, aucune
écriture : il peut se lancer sur une mise en ligne qui sert déjà des gens.

#### Il a trouvé quelque chose au premier essai

Mis au point sur la pile Docker locale, il a signalé deux échecs : manifeste en
`text/html`, `sw.js` sans en-tête de cache. Or `nginx.conf` porte les deux
règles depuis le lot PWA. Le conteneur servait une image **antérieure** — la
configuration à l'intérieur n'avait aucun des deux blocs. Après
`docker compose build web` puis `up -d --force-recreate web` : onze contrôles,
aucun problème.

C'est la meilleure démonstration qu'on pouvait en attendre : le défaut était
là depuis des jours, la page s'affichait parfaitement, et rien d'autre dans le
dépôt ne pouvait le voir.

### Lot 101 — dix requêtes, quelle que soit la taille de la collection

Le constat **C1** de l'audit était le seul « important » jamais traité :
`GET /purchase-analysis/near-complete-suggestions` demandait **88 requêtes SQL
pour 5 séries et 148 pour 11**, soit une dizaine de plus par série ajoutée.
Sur 200 séries, l'ordre de grandeur devenait deux mille requêtes par appel -
pour un écran (**Profil ▸ Suggestions d'achats**, **Découvrir ▸ Opportunités**)
qui répondait en 29 ms sur le jeu de données du moment. Rien ne se voyait :
c'est un problème d'échelle, pas de justesse, et c'est exactement le genre de
défaut qui ne se signale jamais tout seul.

La cause tenait en une boucle : la progression demandée **une fois par série**,
puis, pour chaque couple (série × édition), l'édition de référence retrouvée
et ses prix relevés relus. Or `CollectionProgressService.computeAll()` existe
depuis le Lot 33 - c'est la version groupée, déjà employée par Ma collection et
le partage public. Les trois sources sont désormais lues **une seule fois**, et
le reste se calcule en mémoire.

#### Une réparation qui n'avait pas sa place ici

`findEdition` ne se contente pas de lire : elle **rattache** au passage une
édition retrouvée par son titre à la série connue. C'est une écriture, utile
là où l'utilisateur agit sur une édition précise ; un écran qui liste des
suggestions ne répare rien. La résolution en mémoire (`editionDeLaListe`) suit
donc les mêmes règles - par identifiant d'abord, par titre ensuite, sans tenir
compte de la casse - **sans écrire**. C'est le seul écart de comportement du
lot, et il est délibéré.

#### Le test mesure la pente, pas un nombre

`SuggestionsSansN1Test` compte les requêtes (`Statistics` d'Hibernate) sur le
**même appel** pour deux tailles de catalogue, et exige qu'elles soient
égales. Figer un nombre absolu se serait périmé au premier test voisin ajouté -
la base d'intégration est partagée. Ce qui a été violé, c'est la croissance.

Témoin, sur des séries plus petites que celles de l'audit : **38 puis 70**
requêtes avec le code d'avant, **10 puis 10** après. Le test échoue bien sur
le code d'avant (vérifié par `git stash` du seul fichier corrigé).

1058 tests backend depuis `clean`.

### Lot 100 — le client iOS ne démarre plus, et il fallait le dire

Le Lot 94 a fermé l'API. Le client iOS, lui, n'ouvre aucune session : **chacun
de ses appels reçoit 401**, dès le premier écran. Ce n'est pas une régression
subie - c'est la conséquence directe et prévisible d'avoir fermé une API qui
ne l'était pas du tout. Ce qui aurait été une faute, c'est de la laisser
implicite.

L'audit disait « le client n'est donc **pas cassé**, seulement en retrait ».
Cette phrase est devenue fausse le jour même où j'ai posé la porte, et le
constat C4 la corrige : titre, cause, et **ce qu'il faudrait** - trois points,
plus courts qu'il n'y paraît, parce que `URLSession` en configuration
`.default` gère déjà les cookies. Quatre routes, un en-tête anti-CSRF sur les
quatre helpers qui écrivent, un écran de connexion.

Le même avertissement ouvre `ios/README.md` et la partie iOS du guide de
démarrage : quelqu'un qui lance l'app doit le lire **avant**, pas le déduire
d'un écran d'erreur.

#### Ce que je n’ai pas fait, et pourquoi

Je n'ai pas écrit ce correctif. Il tient en une centaine de lignes de Swift,
et je n'ai ici **ni Xcode ni macOS** : je ne peux ni le compiler, ni le lancer,
ni le voir échouer. Livrer du code non compilé dans un client que personne
n'ouvre depuis trois semaines produirait surtout une chose : la croyance que
c'est réglé. Tout le reste de ce dépôt tient parce que chaque affirmation a
été vérifiée ; ce serait la première à ne pas l'être.

Les trois issues - rattraper, geler explicitement, retirer du dépôt - sont
pesées dans C4 avec ce que chacune coûte et supprime. **Aucune ne peut se
prendre ici** : c'est une décision de produit.

### Lot 99 — les parcours qui n’existent que sur un manga

Trois parcours structurants de plus (6 sur 10) : la **progression « X/Y »**
d'une édition et le tome coché depuis la grille, et une **Tier List** créée,
remplie, puis classée.

#### Un compromis, écrit plutôt que subi

Ces parcours n'existent que sur un manga - et un manga ne s'ajoute pas à la
main : les univers livrés exigent une correspondance chez un fournisseur
externe, et la pile de test n'a volontairement aucune clé. L'état de départ
est donc posé **par l'API** (`e2e/amorcage.ts`), et tout ce qui est vérifié
ensuite passe par l'écran. Ce qui est testé reste le parcours ; ce qui est
simulé, c'est l'existence d'une collection - exactement ce qu'un utilisateur
aurait déjà en arrivant.

L'amorçage a appris quelque chose au passage : l'ajout rapide **crée déjà**
l'édition, sans son nombre de tomes. La recréer part en 409, et le serveur a
raison. On la complète donc - ce qui est exactement l'état d'une vraie
collection avant que la fiche de référence soit renseignée.

#### Ce que le test a découvert sur un geste quotidien

Cocher un tome manquant a résisté trois fois, et chaque échec disait quelque
chose :

- cliquer la **tuile** échoue à la souris - survoler fait apparaître un calque
  à deux boutons (« Je l'ai » / « Je le veux ») qui la recouvre entièrement et
  intercepte le clic ;
- survoler la tuile pour atteindre ce calque échoue aussi, pour la même raison
  - dès qu'il apparaît, c'est lui qui reçoit le pointeur ;
- il faut survoler le **conteneur**, qui contient les deux.

Autrement dit : **deux gestes, deux publics**. À la souris, on passe par le
calque ; au doigt, il n'y a pas de survol, le calque ne se montre jamais et
c'est la tuile qui reçoit le geste. Les deux appellent le même ajout - aucun
chemin ne manque, et c'est écrit dans le test plutôt que redécouvert.

9 parcours en 35 s. Restent hors de portée sans fournisseur ni caméra : le
scan, l'analyse d'une annonce, les séries presque complètes et la fiche
d'édition de référence.

### Lot 98 — cinq incohérences, dont trois qui n’existaient plus

Le §22 de `USER_JOURNEYS.md` listait cinq incohérences non traitées. Les
reprendre une par une a donné un résultat inattendu : **trois avaient déjà
disparu**, emportées par des lots ultérieurs qui ne les visaient pas. Elles
ont été vérifiées, pas supposées.

#### Les deux vraies

**UX-6 — trois mots pour une idée.** « Valeur » (bouton de Ma collection)
menait à un écran intitulé « Statistiques », où il fallait ensuite trouver la
section « Valeur de la collection » ; le Profil, lui, affichait « Valeur
estimée ». Un seul nom désormais - celui de la section - et les deux contrôles
qui le prononcent **emmènent à la section**, au lieu de déposer en haut d'un
écran qui parle
d'autre chose. Même patron que Ma collection ▸ Partager, qui déroule déjà
jusqu'au partage. Ce que « estimée » disait est porté par la pastille de
couverture, juste sous le montant.

**UX-8 — des retours arrière qui se contredisent.** La fiche avait déjà le bon
mécanisme : l'origine voyage dans `location.state`, le lien **nomme** sa
destination, et disparaît s'il ne la connaît pas. Quatre autres écrans, eux,
codaient la leur en dur - un board de Tier List revenait toujours par
« Tier Lists », même ouvert depuis Découvrir ou depuis le Profil. Le module
monte donc dans `lib/retour`, et les écrans qui ouvrent un board disent
d'où ils viennent. Vérifié en direct sur les trois chemins : Découvrir →
« Découvrir », Profil → « Mon profil », Tier Lists → « Tier Lists ».

Toujours pas de `navigate(-1)` : un « Retour » sans destination ment une fois
sur deux, et le bouton Précédent du navigateur continue de faire son travail à
côté.

#### Les trois caduques, et comment on le sait

- **UX-3** (« le scan demande, la recherche non ») : l'écran de brouillon dont
  parlait le constat n'existe plus. Les deux chemins mènent au même aperçu,
  avec le même bouton, et rien ne s'écrit avant ce clic. Ce qui reste au scan -
  un menu - est une conséquence, pas une incohérence : le scan **devine** le
  numéro de tome, la recherche non.
- **UX-9** (« le panneau du tome mélange deux intentions ») : ses deux moitiés
  ont disparu séparément. Le formulaire a quitté le panneau, et le « passé »
  d'un tome non possédé ne peut plus exister - retirer un tome SUPPRIME la
  possession depuis le Lot 55, rien n'en garde trace.
- **UX-10** (« les analyses anciennes parlent anglais ») : **mesuré dans la
  base réelle** plutôt que déduit. Les neuf analyses enregistrées portent en
  tout **un seul** message distinct, et il est en français. Tout le reste de ce
  qui s'affiche est un enum, traduit à l'affichage - donc jamais figé dans une
  langue.

Le §22 porte désormais son état en tête : plus aucune incohérence ouverte,
UX-5 exceptée, délibérée et documentée comme telle. **Un constat qui cesse
d'être vrai doit le dire** - c'est la même règle qu'aux Lots 85 et 86, où des
chiffres et un statut avaient dérivé.

#### Deux choses que la vérification a apprises

Le recentrage sur la section ne marchait pas au premier essai : la section
n'EXISTE pas avant que les statistiques arrivent, et l'effet cherchait une
référence encore vide. Constaté en direct - le bouton promettait une section
qu'il fallait quand même aller chercher.

Et la vérification elle-même a demandé un détour : la fenêtre du navigateur de
test a une hauteur de **zéro**, donc rien n'y est jamais défilable et `scrollY`
reste à 0 quoi qu'il arrive. On mesure donc l'**intention** - un espion sur
`scrollIntoView` confirme l'appel et sa cible (`#valeur`) - plutôt qu'un effet
que ce navigateur ne peut pas produire.

219 tests web (dont quatre neufs sur `lib/retour`, vérifiés par mutation : le
refus d'une destination hors de l'application n'est gardé que par eux), plus
`typecheck`, `lint` et `build`.

### Lot 97 — du clic à la base

Le dernier trou du filet, laissé ouvert depuis le Lot 89 et nommé à chaque
fois : **aucun test ne parcourait un chemin entier**. Les 215 tests Vitest
vérifient une règle à la fois, dans un module ; ce qui se casse entre deux
écrans - un formulaire branché sur la mauvaise route, une invalidation de
cache oubliée - ne casse aucune règle. L'écran reste simplement sur l'état
d'avant, et rien ne le signale.

#### Une pile jetable, jamais les vraies données

`npm run test:e2e` démarre sa propre base et sa propre API (`:8090`), joue les
parcours, puis éteint tout **volumes compris**. Le cloisonnement par
propriétaire du Lot 95 n'y aurait pas suffi : le catalogue, lui, est partagé
par construction, et les séries inventées par les tests seraient apparues dans
« Rechercher ▸ Déjà dans IozyCore » de la vraie collection.

`--wait` attend les **contrôles de santé**, pas le démarrage des conteneurs :
l'API n'est déclarée prête que lorsqu'elle répond, migrations comprises. Et le
`-v` de la fin est ce qui rend la suite reproductible - sans lui, le deuxième
lancement échouerait sur « créer le premier compte », un test vert qui devient
rouge sans qu'une ligne de code n'ait bougé.

#### Ce que les parcours couvrent, et pourquoi ceux-là

- **La porte** : créer le premier compte sur une instance neuve, se connecter,
  un mot de passe faux qui ne dit pas si l'adresse existe, se déconnecter -
  et vérifier que la session est morte **côté serveur**, pas juste effacée à
  l'écran.
- **Le parcours fondateur** : créer un univers, y ajouter une œuvre, la
  retrouver dans Ma collection avec son rail et ses compteurs, puis la
  rechercher à nouveau et la voir reconnue plutôt que proposée en double.
- **Le lien de partage** : généré depuis Profil, ouvert **dans un contexte de
  navigateur neuf** (aucun cookie hérité - c'est la seule façon de vraiment
  jouer le destinataire), puis désactivé et devenu inopérant. C'est la seule
  surface dont une régression est irréversible : un lien distribué ne se
  rappelle pas.

Les trois univers livrés exigent une correspondance chez un fournisseur
externe ; la pile de test n'a **aucune clé d'API**, à dessein - un parcours qui
dépend de Jikan échoue le jour où Jikan tousse, pour une raison qui ne regarde
pas l'application. Les tests passent donc par un type de collection créé pour
l'occasion, sans fournisseur, donc en saisie libre : ce qui exerce en prime
l'éditeur de types.

#### Deux fois, le test avait tort

Le premier jet affirmait qu'une œuvre déjà en collection fait **disparaître**
le bouton « Ajouter ». Faux : sur un type sans fournisseur, ce bouton est le
seul chemin, et deux œuvres peuvent porter des titres proches. Ce qui protège
du doublon, c'est l'**ordre** - ce qu'on possède se montre AVANT de proposer de
créer. Le test dit désormais cette règle-là, en comparant les positions.

Le second jet séparait « ajouter » et « ne pas dupliquer » en deux tests, le
second cherchant ce que le premier avait créé. Playwright **redémarre son
worker après un échec** : les constantes du module sont alors recalculées, et
le second test cherchait un univers au nom légèrement différent. Un parcours
qui se lit d'un bout à l'autre n'a pas ce problème.

#### Vérifié en cassant la porte

`PorteFermee` mutée pour laisser passer tout le monde : les **215 tests Vitest
restent verts** - aucun ne connaît `App` - et les parcours tombent aussitôt.
C'est exactement la démonstration de ce que cette suite ajoute.

7 parcours en 32 s, plus `typecheck` (les fichiers E2E ont leur propre
`tsconfig` : Playwright les transpile lui-même et accepte les imports sans
extension, que le `nodenext` des fichiers de configuration refuserait), `lint`
et `build`.

### Lot 96 — de quoi mettre en ligne, sans mettre en ligne à la place de quelqu’un

Dernier morceau du chantier « sortir du localhost » : la configuration et la
procédure. Le déploiement lui-même demande des comptes et des secrets qui ne
m'appartiennent pas — ce lot prépare tout ce qui peut l'être, et s'arrête là.

**Vercel devant, Railway derrière**, avec une **réécriture `/api/*`** plutôt
qu'un appel direct à l'API. Ce n'est pas un détail d'installation : la session
est un cookie, et deux domaines en feraient un cookie *cross-site*, qui exige
`SameSite=None` — de moins en moins bien traité, et ouvert aux écritures
déclenchées depuis une autre page. La réécriture garde **une seule origine**,
exactement comme le proxy Vite en développement et le nginx du build Docker :
trois environnements, un seul comportement.

#### Trois réglages sans lesquels le déploiement échoue en silence

- **`server.port` suit `PORT`.** Les hébergeurs gérés imposent le port et y
  acheminent le trafic. Fixé à 8080, le contrôle de santé interroge un port
  qui ne répond pas — et le service reste « en cours de démarrage » sans
  qu'aucune ligne de journal n'explique pourquoi.
- **`forward-headers-strategy: framework`.** Derrière un proxy TLS, la requête
  arrive en clair : sans lire les `X-Forwarded-*`, l'application se croit en
  HTTP et refuse de poser un cookie `Secure`. Personne ne resterait connecté,
  et rien ne le dirait.
- **Une seule réplique.** Les sessions vivent en mémoire (choix assumé du Lot
  94) : deux instances renverraient les gens à la connexion une requête sur
  deux. `railway.json` fixe donc `numReplicas: 1` — et le dit.

#### Ce que la documentation corrige au passage

`.env.example` et le README racine affirmaient que **l'application n'a aucune
authentification en propre**, et que c'est le HTTP Basic de Traefik qui la
protège en déploiement Synology. C'était vrai il y a deux lots. Ce Basic est
devenu une seconde demande de mot de passe devant la première — et il **casse
les liens de partage**, dont le destinataire est précisément censé n'avoir
rien à saisir.

`docs/DEPLOIEMENT.md` est écrit comme une procédure : chaque étape dit
**comment vérifier qu'elle a marché** avant de passer à la suivante. La
vérification de la réécriture, par exemple, n'est pas « la page s'affiche »
mais « l'écran dit *Personne n'a encore de compte ici* » - cette phrase-là ne
peut venir que d'un appel à `/api/auth/etat` réellement acheminé.

### Lot 95 — chacun chez soi

Le Lot 94 a posé la porte. Une porte qui laisse entrer plusieurs personnes
dans la même pièce ne protège rien : ce lot cloisonne, agrégat par agrégat.

#### Le cloisonnement ne vit pas dans les requêtes

L'alternative était d'ajouter un `ownerId` à chaque méthode des huit dépôts
privés — quatre-vingts appels, et surtout **une règle à se rappeler à chaque
nouvelle requête écrite un an plus tard**. Une seule oubliée, et un écran
montre la collection de quelqu'un d'autre sans que rien ne le signale.

Hibernate sait le faire lui-même : une colonne marquée `@TenantId` est ajoutée
au `WHERE` de toute requête sur l'entité, et remplie à l'insertion depuis
`ProprietaireCourant`. Ce n'est pas un filtre qu'on pense à poser, c'est un
filtre qu'on ne peut pas retirer. Il refuse même une valeur déjà posée qui
diffère de la sienne — d'où les fabriques du domaine qui laissent ce champ à
`null` : elles ne choisissent pas de propriétaire, la session tranche.

**Le défaut est « personne », jamais « le premier ».** Hors requête
authentifiée, le propriétaire vaut un identifiant qu'aucun compte ne porte,
donc auquel aucune ligne ne répond. Un chemin qui oublierait de dire au nom de
qui il travaille ne voit **rien** ; il ne voit pas la collection du premier
compte. Se tromper doit produire un écran vide — un défaut visible — jamais
une fuite silencieuse.

#### Ce que le test d'isolation a trouvé, et que rien d'autre n'aurait vu

Écrit agrégat par agrégat — le cloisonnement se pose colonne par colonne, en
oublier une ne casse rien ailleurs — il a immédiatement montré **deux angles
morts de `@TenantId`** :

- **`findById` charge par clé primaire, sans requête** : pas de filtre. Bob,
  connaissant l'identifiant d'une possession d'Alice, la lisait. Les dépôts
  utilisent désormais un `findOneById` dérivé — qui est, lui, une requête.
- **Les suppressions avaient le même angle mort, et il coûte bien plus cher.**
  `deleteById` charge par clé primaire puis supprime : Bob **effaçait** la
  possession d'Alice, sans erreur et sans trace. Les suppressions en masse
  (`deleteBy…`) de même. Toutes passent maintenant par une lecture filtrée,
  puis la suppression de ce qui a été trouvé.

Une lecture qui traverse la frontière montre ce qu'elle ne devrait pas ; une
écriture qui la traverse **détruit** ce qui appartient à un autre. Les cinq
suppressions sont donc testées depuis le mauvais compte, identifiants exacts en
main.

#### Le test a dû sortir de la transaction

Premier jet : sept tests sur huit passaient... parce qu'Hibernate lit le
propriétaire à l'**ouverture d'une session**. Dans une transaction unique —
le montage de tous les autres tests d'intégration — changer de compte en cours
de route ne change rien, et le test se croyait cloisonné alors qu'il ne
l'était pas. Il tourne donc hors transaction, chaque appel ouvrant sa propre
session, comme deux requêtes de deux personnes — et il nettoie derrière lui,
puisque rien ne sera annulé pour lui.

#### Le seul franchissement légitime, écrit en toutes lettres

Un lien de partage : son destinataire n'a pas de compte, et ce qu'il doit voir
appartient à quelqu'un d'autre. Le cloisonnement ne peut donc pas venir de la
session — il vient du **jeton**, qui nomme son propriétaire.
`AuNomDe.executer(settings.ownerId(), …)` le dit à l'endroit où ça se produit,
plutôt que de le déduire de l'endroit d'où l'on vient. Un test vérifie qu'un
lien montre bien la collection de SON propriétaire, et pas celle du voisin.

#### Vérifié à deux comptes, en direct

Sur l'application réelle, code d'invitation posé : le premier compte retrouve
ses 9 œuvres et 12 possessions ; un second compte créé dans la foulée voit
**0 possession, 0 envie, 0 analyse**, et « Rien ici pour l'instant » à l'écran.
Son lien de partage, ouvert sans session, rend une collection **vide** - pas
celle du premier. Puis retour sur le premier compte : ses 12 possessions sont
intactes. Le catalogue, lui, reste visible des deux côtés : c'est le parti pris,
et il se voit ici plutôt que de se découvrir plus tard.

1057 tests backend depuis `clean`, dont **14 tests d'isolation** - un par
agrégat privé, en lecture et en suppression, plus le lien de partage.

#### Ce qui reste partagé, et pourquoi

Le catalogue (œuvres, tomes, tags, relations) : une œuvre est la même pour
tout le monde, parti pris depuis la V2. Les **éditions de référence** : de la
donnée d'univers, enrichie collectivement, et c'est elle qui rend tous les
« X/Y » possibles. Les **caches** devant les fournisseurs externes à quota :
les cloisonner ferait payer deux fois le même appel pour la même question.

Trois tables privées manquaient à l'appel et les ont rejoints (`V26`) : les
analyses d'achat, les prix relevés — toute l'app les présente comme « **tes**
prix relevés » — et l'appartenance d'une œuvre à un classement, colonne
redondante avec sa liste parente et délibérément dupliquée : sans elle, « dans
quels classements se trouve cette œuvre ? » devrait se souvenir de passer par
la liste pour ne pas répondre sur celles des autres.

### Lot 94 — la porte

L'API n'était protégée par **rien**. N'importe qui l'atteignant pouvait tout
lire et tout écrire : acceptable tant qu'elle ne sortait pas de localhost,
intenable dès qu'elle en sort. Décision du 2026-08-29 : plusieurs personnes,
chacune sa collection, sur un hébergeur géré. Ce lot pose la porte ; l'isolation
par propriétaire vient ensuite.

#### Le premier compte reprend la collection

Les colonnes `owner_id` existent depuis la V2, remplies avec `DefaultOwner.ID`
« pour le jour où ». Ce jour est arrivé, et la migration la plus délicate n'a
pas eu lieu : le **premier compte adopte cet identifiant**. La collection déjà
saisie devient la sienne sans qu'une seule ligne ne bouge — vérifié en direct,
6 titres et 12 tomes retrouvés juste après la création du compte.

Les comptes **suivants** exigent un code d'invitation, et **l'absence de code
configuré ferme la porte** au lieu de l'ouvrir. C'est le sens de la mesure :
une instance déployée sans y penser ne doit pas devenir une base ouverte à qui
passe.

#### Une session, pas un jeton dans le navigateur

Un cookie `HttpOnly` n'est pas lisible par du JavaScript ; un jeton rangé dans
`localStorage` l'est par n'importe quel script injecté. Et l'architecture sert
déjà l'API sous la **même origine** que l'app (proxy Vite, nginx) : le cookie
voyage sans configuration cross-site. Contrepartie assumée : les sessions
vivent en mémoire, un redémarrage déconnecte tout le monde.

Contrepartie *technique* du cookie : il part tout seul, y compris quand une
autre page déclenche la requête — c'est la définition d'une CSRF. D'où le jeton
en cookie lisible, renvoyé en en-tête par `api/client.ts`.

#### Deux pièges que seul le direct a révélés

Les deux ont coûté un aller-retour, et les deux passaient les tests.

- **Le jeton CSRF masqué.** Le gestionnaire par défaut de Spring Security 6
  masque le jeton (protection BREACH) et attend en retour la valeur masquée
  qu'il a exposée dans la page — pas celle du cookie. Un client qui lit le
  cookie renvoie donc une valeur que le démasquage rejette : **403 sur toute
  écriture**, à commencer par la première connexion. Constaté en cliquant sur
  « Créer mon compte », pas en test.
- **Le 404 qui répondait 401.** Un 404 ne s'écrit pas directement : le
  conteneur le redirige en interne vers la page d'erreur, et cette redirection
  retraverse la chaîne de sécurité depuis Spring Security 6. Un lien de partage
  inconnu répondait donc **401 à un visiteur anonyme** — sur la seule surface
  dont le destinataire n'a, par définition, pas de compte. MockMvc ne rejoue
  pas cette redirection : il rendait 404, et les tests passaient.

Le second a donné un test qui ne pouvait pas s'écrire autrement :
`PorteSurUnVraiServeurTest` démarre un **vrai serveur** (`RANDOM_PORT` +
`TestRestTemplate`) et vérifie les trois seules réponses dont la redirection
d'erreur change le sens. Vérifié par mutation : la ligne
`dispatcherTypeMatchers(ERROR).permitAll()` retirée, il tombe.

#### Les 86 endpoints déjà couverts n'ont pas eu à changer

Une requête anonyme reçoit 401 avant d'atteindre le moindre contrôleur : sans
rien faire, tous les tests de contrat n'auraient plus testé que la page de
refus. Ils partent donc au nom d'un compte connecté, avec leur jeton CSRF,
posés **en un seul endroit** (`RequetesAuthentifiees`) plutôt qu'ajoutés à la
main sur des centaines d'appels — un `.with(csrf())` oublié quelque part se
lirait comme un défaut du contrôleur. Ce compte de test porte
`DefaultOwner.ID`, exactement comme le premier compte d'une vraie instance.

#### Ce qui n'est pas fait, et qui est dit

**L'isolation par propriétaire n'est pas branchée** : les écritures portent
toujours `DefaultOwner.ID`, les lectures ne filtrent pas encore par compte. Un
deuxième compte verrait la collection du premier. C'est pour ça que la création
de comptes supplémentaires est **fermée par défaut**, et c'est écrit dans
`backend/README.md` comme dans l'audit technique plutôt que laissé à découvrir.

`UtilisateurCourant` est la couture prévue pour ça : le seul endroit qui sait
lire la session, avec un repli sur `DefaultOwner.ID` qui disparaîtra quand
chaque écriture saura nommer son auteur.

**Vérifié en direct** : instance neuve → écran « créer le premier compte » →
collection retrouvée → déconnexion → écran « se connecter » (sans proposer de
créer, faute de code d'invitation) → reconnexion → collection. Puis, en
anonyme : collection 401, lien de partage créé lisible **200**, révoqué **404**.
1040 tests backend depuis `clean`, 215 tests web.

### Lot 93 — l'app s'installe sur l'écran d'accueil

Premier pas du chantier « sortir du localhost » (décision du 2026-08-29), et le
seul qui ne dépende d'aucune décision d'hébergement. Une app de collection
mobile-first qu'on ne peut pas ouvrir d'un pouce en brocante rate l'essentiel de
son usage.

**Le manifeste sort du même script que la marque.** `make-icons.mjs` déclarait
déjà la géométrie une fois pour le SVG et le PNG ; il produit maintenant aussi
`icon-192`, `icon-512`, une **maskable** 512 et `manifest.webmanifest`. La
raison est la même que pour les deux icônes : une icône promise et absente ne
rend pas l'app moins jolie, elle la rend **non installable**, sans message nulle
part - le navigateur retire simplement l'invite.

L'icône maskable n'est pas la même image en plus grand : un lanceur Android
découpe à la forme qu'il veut et ne garantit que le disque central de 80 %. Le
dessin y est donc réduit à 62 % et le fond remplit tout le carré. Servie en
`any`, elle aurait le défaut inverse - une tuile flottant au milieu de rien.

**Le service worker met en cache la coquille, jamais `/api`.** Ce n'est pas un
revirement sur le hors-ligne écarté au Lot 1 : des données servies depuis un
cache seraient une collection périmée présentée comme la vraie, exactement ce
que tout le reste de l'app refuse. Sa raison d'être est l'installation - un
navigateur ne la propose pas sans gestionnaire `fetch`. Deux stratégies : cache
d'abord pour `/assets/` (noms empreintés, contenu immuable), réseau d'abord pour
tout le reste, ce qui rend un déploiement visible dès la visite suivante.

#### Deux pièges qui n'existent qu'en production

Le serveur de dev Vite fait ce qu'il faut tout seul ; `nginx:alpine`, non.

- Sa table `mime.types` n'a **aucune entrée** pour `.webmanifest` - vérifié dans
  l'image : le fichier partait en `application/octet-stream`.
- `sw.js` servi depuis un cache HTTP continuerait d'appliquer les règles d'un
  déploiement précédent, puisque c'est lui qui décide de ce que le navigateur
  garde.

Les deux sont corrigés dans `nginx.conf`, et **vérifiés sur l'image réellement
construite** (`docker build`, puis les en-têtes lues depuis l'intérieur du
conteneur) : `application/manifest+json`, `Cache-Control: no-cache`, et le repli
SPA toujours intact sur `/entity/abc`.

#### Vérifié dans un vrai navigateur, pas seulement en test

Sur le build de production servi en local : manifeste lié et analysé, trois
icônes, les deux `theme-color` (claire et sombre), service worker actif. Après
un premier chargement le cache contient la coquille (`/`, le manifeste, une
police) ; après un rechargement, **11 entrées dont 9 `assets` - et zéro `/api`**,
y compris après avoir laissé une requête d'API passer.

`npm run check:pwa` garde tout ça : il relit les dimensions des PNG dans leur
en-tête plutôt que de les déduire du nom, et refuse une icône promise mais
absente. Vérifié dans les deux sens en retirant `icon-192.png`. Six tests
Vitest gardent en plus le tri du service worker - dont `/apercu`, qui ne doit
pas se faire prendre pour `/api`.

199 tests web, `typecheck`, `lint`, `build`, contraste et `check:pwa`.

### Lot 92 — le seul module qui peut écraser une donnée de l'utilisateur

164 → **193 tests**. Ce lot ferme la couche `lib/` et prend le module le plus
dangereux de l'app.

**`rechargerSource`** redemande à un fournisseur ce qu'il sait d'une œuvre déjà
en collection, puis réécrit ses attributs. C'est le seul endroit où une erreur
détruit du travail au lieu d'afficher un chiffre faux, et deux s'y logent :
**se tromper d'œuvre** (un « à peu près » sur le titre recopierait les
informations d'un spin-off sur la série mère) et **écraser un choix** - la
remarque de l'utilisateur, et surtout la jaquette qu'il a posée à la main, seule
donnée d'origine externe qu'il édite couramment. Une troisième, plus discrète,
est testée aussi : réécrire une valeur identique, ce qui ferait mentir le
« tout est déjà à jour » rendu à l'écran.

**Un test faux, corrigé par le code et non l'inverse.** Le premier jet
affirmait que la reconnaissance par titre ignore la ponctuation : `l attaque des
titans` devait retrouver `L'Attaque des Titans`. Le test est tombé, et il avait
tort - `normaliser` s'arrête aux accents, à la casse et aux espaces. C'est la
bonne règle : plus large, elle finirait par rapprocher deux titres réellement
différents, ce que tout le module s'attache à éviter. Le test dit désormais
cette limite au lieu de la contredire.

Le reste ferme les « jamais deviné » du catalogue : `seriesInfo` (`null` n'est
pas « en cours » ; 0 tome n'est pas un total), `indicesOeuvre` (le `studio` d'un
jeu vidéo n'est pas l'auteur d'un manga - un indice faux, pas un indice en plus)
et `theme` (passer au clair **retire** l'attribut ; lui affecter `undefined`
le fixerait à la chaîne `"undefined"`, et le clair ne marcherait plus que par
accident).

**Ce qui n'a délibérément pas de fichier** : `volumeKey`, `creatorFrom` et
`coverImageUrlFrom` sont des lignes uniques déjà exercées par les tests des
modules qui les appellent (`tomeTiles`, `backfillCovers`, `shelfTiles`). Leur
donner un fichier ajouterait du volume, pas du filet.

Les quatre mutations sont ressorties en échec, cette fois via
`scripts/mutation.mjs` : la jaquette posée sans vérifier qu'elle manque, un
total de 0 tome accepté, le studio promu auteur, et `delete dataset.theme`
remplacé par une affectation à `undefined`.

193 tests en 4,7 s, plus `typecheck`, `lint`, `build` et les 116 combinaisons de
contraste.

### Lot 91 — le clavier, l'onglet, la barre : ce que personne ne voit à la souris

Trois des quatre modules de ce lot ne produisent aucun pixel. Ils décident de
ce qui arrive **au clavier**, dans **l'historique du navigateur** et dans ce
qu'un **lecteur d'écran annonce** — c'est-à-dire précisément la part de l'app
qu'aucune relecture visuelle ne peut vérifier. 124 → **164 tests**.

| Module | La règle qui se casse en silence |
|---|---|
| `useModalA11y` | Échap ferme, Tab reste piégé, et le focus **revient au déclencheur** à la fermeture. Sans le dernier, on ferme un panneau et le curseur repart en haut de page |
| `useDocumentTitle` | une navigation SPA **n'annonce rien** : la page ne se recharge pas. Le titre mis à jour est le remède conventionnel - et il ne doit jamais rester celui de la page précédente pendant un chargement |
| `navItems` | `activeWhen` est écrit à la main, route par route : une route oubliée n'allume rien, une route trop large en allume deux. Chaque route réelle est donc vérifiée : **exactement une** entrée s'allume |
| `entityTypeVisuals` | une couleur d'univers sert aussi de TEXTE : les listes sont fermées, et une clé inconnue retombe sur le visuel de base plutôt que de blanchir un écran |

#### Une prothèse assumée, et dite

jsdom ne fait **aucune mise en page** : `offsetParent` y vaut toujours `null`,
or c'est ce que `useModalA11y` regarde pour ignorer les éléments cachés. Sans
prothèse, le hook n'aurait trouvé aucun élément focusable et les tests seraient
passés **en ne vérifiant rien** - le pire des cas. Le test redéfinit donc
`offsetParent` pour les éléments réellement dans le document, et le dit dans son
propre en-tête : c'est le seul endroit où ces tests s'écartent d'un vrai
navigateur.

#### Le contrôle par mutation devient un outil

Les deux mutations manquées du Lot 90 n'étaient pas un accident : muter à la
main, en shell, dans du code qui contient des `/` et des apostrophes, échoue
silencieusement. `web/scripts/mutation.mjs` fait maintenant le geste en entier -
il mute **toutes** les occurrences, lance la suite, restaure le fichier, et
**refuse de conclure** quand le texte cherché est introuvable. Il sort en erreur
si rien n'a échoué, c'est-à-dire si la règle n'est gardée par rien :

```bash
node scripts/mutation.mjs src/routes/Shelf/shelfTiles.ts "missing <= 3" "missing <= 4"
```

Vérifié dans les deux sens : sur une règle couverte il rattrape la mutation, et
sur `queryKeys.experiences` - que rien ne teste - il sort en 1 avec « cette
règle n'est gardée par rien ». Les quatre mutations de ce lot (une route de
`/tier-lists` retirée, le titre de la page précédente laissé en place, le piège
à Tab inversé, le format de jaquette d'un univers changé) sont toutes ressorties
en échec.

164 tests en 4,3 s, plus `typecheck`, `lint`, `build` et les 116 combinaisons de
contraste.

### Lot 90 — le filet s'étend là où l'utilisateur lit, pas seulement là où l'app calcule

Le Lot 89 couvrait ce que l'app **calcule** pour l'affichage. Ce lot va chercher
les trois autres endroits où une règle se casse en silence : ce que l'utilisateur
**lit quand ça rate**, ce qu'un **bouton promet**, et ce que l'app **relit** d'un
`localStorage` qu'elle ne contrôle pas. 42 → **124 tests**, neuf modules de plus.

| Module | La règle qui se casse en silence |
|---|---|
| `api/client` | « Bad Gateway » et « Failed to fetch » ont été vus en anglais dans une interface française. Le piège : l'enveloppe générique de Spring porte elle aussi un champ `error`, qui n'y contient que la phrase de statut. Et une **annulation n'est pas une panne** - la traduire ferait clignoter « serveur injoignable » à chaque frappe |
| `useWishlist` | deux index jamais confondus (une série n'est pas voulue parce qu'un tome l'est), une annulation qui remet **le tome et pas sa série**, et un refus 409 qui **n'interrompt pas** un ajout groupé |
| `preferencesCollection` | validation **champ par champ** : un réglage corrompu ne fait pas retomber les autres ; et un stockage refusé (navigation privée) n'abat pas la page |
| `titleLanguage` | quel titre est **écrit** (`resolvePrimaryTitle`) et quel titre n'est qu'**affiché** : les confondre enregistrerait une chaîne à parenthèses |
| `attributsTome` | `"12"` n'est pas 12 — la divergence qui rendait un tome compté d'un côté, invisible de l'autre |
| `venues` | avoir est postérieur à vouloir ; une œuvre remonte à la venue de son tome **le plus récent** |
| `backfillCovers` | rien à chercher ⇒ aucun appel ; la seconde recherche (qui coûte le quota) seulement si la première ne suffit pas ; « muet » ≠ « il n'a pas cette jaquette » |
| `basePrix` | une estimation IA ne doit **jamais** se présenter comme un prix de marché — l'écran qui l'a fait ne connaissait que deux valeurs de l'enum sur trois |
| `invalidations` | une envie posée sur un tome **fait exister ce tome** : la fiche et la progression changent sans qu'aucune possession n'ait bougé |

**Ce qui se teste ici, et ce qui reste simulé.** Le réseau est simulé
(`fetch` et le module `api/wishlist`), le reste ne l'est pas : vrai
`QueryClient`, vrai contexte de messages, vrai `localStorage` de jsdom. Ce qui
est vérifié, ce sont les **appels réellement partis** et le **message réellement
affiché** — pas l'implémentation qui les produit.

**Les neuf mutations sont ressorties en échec**, chacune sur le test qui la
nommait : `typeof === 'number'` relâché, `lire()` remplacé par les valeurs par
défaut à l'écriture, le repli du titre supprimé, la possession qui cesse de
l'emporter sur l'envie, la clé `entities` retirée des invalidations d'envie, le
`catch` de l'ajout groupé qui relance, la traduction du 502 effacée, l'estimation
IA rebaptisée « marché », et la seconde recherche de jaquettes rendue
systématique. Deux d'entre elles ont d'abord été **manquées par la mesure** : un
`perl s///` sans `/g` avait muté la seule des deux occurrences que le test ne
regardait pas. Une mutation qui ne fait rien échouer se vérifie donc elle-même
avant de conclure quoi que ce soit du test.

124 tests en 3,7 s, plus `typecheck`, `lint`, `build` (empreintes de `dist/`
inchangées) et les 116 combinaisons de contraste.

### Lot 89 — le web n'avait aucun filet : premières mailles

1018 tests côté backend, **zéro** côté web. Toute règle qui décide de ce que
l'écran affiche — et il y en a — ne tenait que par la relecture. Ce lot pose
l'outillage et couvre les premières règles ; il ne prétend pas couvrir l'app.

**Vitest + Testing Library**, `npm test`. Trois choix, chacun pour une raison :

- **Les tests vivent à côté du module qu'ils vérifient**, pas dans un dossier
  `__tests__` à part : un module et ses règles se déplacent ensemble.
- **Pas de `globals: true`.** `describe`/`it`/`expect` s'importent comme tout le
  reste du code de ce dépôt. Un test qui se lit sans savoir ce que la
  configuration injecte se relit des mois plus tard.
- **`src/test/fixtures.ts`** construit les objets du serveur (`oeuvre`, `tome`,
  `possession`, `edition`). `EntityResponse` porte six champs dont un seul
  intéresse un test donné : écrits à la main, les cas noieraient leur règle sous
  du remplissage, et un champ ajouté au DTO rouvrirait tous les fichiers.

#### Ce qui a été couvert, et pourquoi ceux-là

Le critère : une règle qui **se casse en silence** — aucun type ne la protège,
aucun écran ne devient blanc quand elle tombe, elle se contente de mentir.

| Module | La règle qui se casse en silence |
|---|---|
| `shelfTiles` | un total d'édition **inconnu** ne range une série ni dans « complètes » ni dans « incomplètes » ; **un seul signal par carte**, et sous « Envies » ce sont les tomes voulus qui l'emportent ; un type sans titre n'ouvre pas de rail |
| `ownership` | « possédé » = au moins une possession **active** — une série entièrement revendue quitte l'écran, le catalogue la garde |
| `tomeTiles` | trois états jamais confondus, aucune tuile déduite sans total connu, et un tome **au-delà** du total annoncé reste visible plutôt qu'escamoté |
| `ListingAssessmentCard` | un prix de référence ne s'affiche jamais seul, et l'absence de référence dit **laquelle** (Lot 88, vérifié cette fois par ce que l'utilisateur lit) |

#### Un filet se vérifie en le cassant

Un test qui passe ne prouve rien tant qu'on n'a pas vu ce qu'il fait quand la
règle tombe. Chaque fichier a donc été confronté à une mutation de son module :
`missing <= 3` devenu `<= 4`, le filtre sur `status === 'OWNED'` retiré, la
reconnaissance d'un tome catalogué à l'instant supprimée, la dispersion effacée
de la phrase. Les quatre mutations sont ressorties en échec, et chacune sur le
test qui la nommait. Les sources ont été restaurées ensuite (`git checkout`).

**Reste à faire, et dit explicitement** : aucun test **end-to-end**. Rien ne
vérifie encore un parcours entier, du clic à l'écriture en base — les dix
parcours de `USER_JOURNEYS.md` §21 restent les candidats. Et l'horizon
multi-utilisateurs (décision du 2026-08-29) demandera d'y tester l'isolation par
propriétaire : les quatre modules couverts ici sont des règles d'affichage, qui
n'en portent aucune notion.

42 tests web en 1,7 s, plus `typecheck`, `lint`, `build` (les tests ne partent
pas dans le bundle : empreintes de `dist/` inchangées) et les 116 combinaisons
de contraste. `npm audit` signalait au passage une faille `nanoid` héritée de
`postcss` via Vite ; `npm audit fix` la referme sans changer de version majeure.

### Lot 88 — « 70 € », sans rien pour en douter

`MarketReference` sait quatre choses de plus que le prix qu'elle rend : combien
de relevés ont été **examinés** avant filtrage, à quel point les comparables
retenus **s'accordent** (l'écart haut/bas rapporté à la médiane), de quand date
le **plus récent**, et sur combien d'annonces indépendantes elle repose. Seule
la dernière voyageait jusqu'à l'écran. Les trois autres restaient dans le
calcul : `ListingAssessment` — l'instantané figé, celui que l'historique relit —
ne les portait pas.

Conséquence à l'écran, deux fois :

- **« Confiance bonne · 4 annonces comparables »** était à croire sur parole.
  Quatre comparables qui vont de 4,50 € à 12 € le tome et quatre qui se tiennent
  à 12 % près ne valent pas la même référence, et le second cas est le seul où
  « 70 € » se discute vraiment. C'est le même raisonnement que la taille
  d'échantillon au Lot 60 : *un chiffre affiché est un chiffre auquel on croit,
  donc il doit se vérifier*.
- **« Pas assez de prix relevés comparables »** se disait aussi quand trois
  relevés existaient bel et bien pour cette édition, mais sur des lots d'une
  autre forme. « Aucune donnée » et « des données, mais aucune comparable » ne
  demandent pas le même geste : le second dit quoi relever ensuite.

Les trois réserves sont donc devenues des composants de l'instantané —
`referenceSpreadPercent`, `referenceMostRecentObservation`,
`referenceExaminedCount` — figés au moment de l'analyse, comme le prix lui-même.
Des accesseurs calculés se seraient sérialisés en JSONB sans pouvoir se relire :
le piège de `CollectionStatus`, déjà documenté dans l'en-tête de la fabrique.

#### La compatibilité ascendante est une propriété de la lecture, pas une surcharge

Un instantané pris avant ce lot ne porte pas ces trois composants. Le contrat est
celui que le record tenait déjà pour la provenance : **dire qu'on l'ignore
plutôt que de l'inventer après coup** — nul, nul, zéro, jamais des valeurs
reconstituées qui donneraient à un ancien verdict une assurance qu'il n'avait
pas. Une première version ajoutait un constructeur « forme historique » à dix
paramètres pour porter cette promesse : personne ne l'appelait, Jackson n'en a
pas besoin (un composant absent du JSON vaut `null`, ou `0` pour un compte), et
un constructeur sans appelant est exactement ce que l'audit de code mort
traque. Il a été retiré au profit de `ListingAssessmentSnapshotTest`, qui relit
un payload à dix champs et vérifie la promesse au lieu de la déclarer.

**Vérifié** : `referenceMostRecentObservation` est la **première date** du
payload — tout le reste de l'instantané est nombre, texte ou instant — donc son
aller-retour réel dans la colonne JSONB est testé en intégration (`flush` +
`clear`, pas de cache de session), et pas seulement en sérialisation isolée.
1018 tests backend depuis `clean`, plus `typecheck`, `lint`, `build` et les 116
combinaisons de contraste côté web. La volumétrie de `AUDIT_TECHNIQUE.md` suit
(1 013 → 1 018 tests, 104 → 105 fichiers de test) ; au passage, sa ligne « docs »
comptait 5 fichiers pour 6.

### Lot 87 — une requête par envie, sur la seule porte ouverte à l'extérieur

`PublicShareController.sharedWishlist()` chargeait chaque œuvre **une par une** :
`wishlistEntryRepository.findAll()`, puis un `entityRepository.findById()` par
entrée. Une liste d'envies de cinquante lignes coûtait cinquante requêtes.

Ce qui rend celui-ci différent des autres N+1 du projet : c'est la **seule
surface non authentifiée** de l'application. N'importe qui détenant le lien peut
la rappeler autant de fois qu'il veut, et le coût suit la taille de la liste
partagée. C'est le raisonnement du Lot 35 (« toute fonctionnalité qui voudrait
le savoir POUR UNE LISTE doit passer par un seul appel »), avec l'absence
d'authentification en plus.

Les œuvres sont désormais chargées en une fois - trois requêtes, une par
univers - exactement comme `sharedCollection()` le fait déjà juste au-dessus.
Le repli « une entrée orpheline ne casse pas la vue publique » est conservé :
il devient un `Optional.ofNullable` sur la carte au lieu d'un `findById` vide.

#### Le même geste, une porte plus loin

`POST /tier-lists/{id}/items` interrogeait la base **par œuvre ajoutée** pour
savoir si elle était déjà là - or « Ajouter » en envoie autant qu'on en a
cochées d'un coup. Un seul `findByTierListId` en amont, et le `Set` qui en sort
fait office de garde : `!dejaPresentes.add(entityId)` remplace la requête ET
protège des doublons à l'intérieur du même corps de requête, ce que la version
d'avant ne faisait pas.

**Vérifié en direct** : lien de partage créé, la vue publique rend les deux
univers (Manga 5, Jeu vidéo 1) et l'envie (Jujutsu Kaisen, jaquette et date),
puis lien révoqué - URL en 404, aucun jeton en base. 1013 tests backend depuis
`clean`.

### Lot 86 — l'audit technique annonçait 458 tests, il y en a 1 013

`AUDIT_TECHNIQUE.md` s'ouvre sur une volumétrie et un décompte qui font
autorité dans le projet. Tous ses chiffres avaient dérivé, et deux étaient
franchement faux :

| | annoncé | mesuré |
|---|---|---|
| tests | 458 | **1 013** |
| endpoints | 96 | 92 |
| tables | 21 | 20 |
| contrôleurs | 16 | 18 |
| migrations Flyway | 17 | 24 |
| backend `src/main` | 225 fichiers / 17 577 lignes | 269 / 24 339 |
| backend `src/test` | 69 / 10 884 | 104 / 20 832 |
| web `src` | 125 / 15 625 | 152 / 20 667 |
| docs | ~3 300 lignes | ~9 493 |

La liste des contextes citait encore `editionupgrade`, supprimé au Lot 27, et
ignorait `followededition`, arrivé au Lot 26 - huit contextes, pas neuf. Le
rapport test/production passe de 0,62 à **0,86 ligne de test par ligne de
production**.

Un document qui se donne pour la référence technique et qui annonce moins de la
moitié des tests réels n'est pas une approximation : c'est une source qu'on ne
peut plus citer. Les chiffres portent désormais leur date de mesure, pour que la
prochaine dérive se voie.

### Lot 85 — un parcours retiré, encore annoncé COMPLET dans la même page

`USER_JOURNEYS.md` se contredisait. Le parcours 11, « Signaler une envie
d'amélioration d'édition », est **barré et daté comme supprimé** à la ligne 171
- et le tableau de synthèse, huit cents lignes plus bas, le donnait encore
`COMPLET | oui | oui`. La convention existe pourtant dans le même tableau : le
parcours 16 (prêter un exemplaire) y est bien marqué **RETIRÉ**. C'est la
troisième strate du Lot 61, cette fois à l'intérieur d'un seul document.

Aligné : le tableau de synthèse, l'arbre des parcours (qui listait encore
« 11 Envie d'amélioration » et « 16 Prêt »), l'écran Profil (qui annonçait une
entrée disparue), la liste des formulaires annulables (« envie d'amélioration »,
« prêt ») et le tableau des états vides.

#### Le tableau de réversibilité avait pris trois lots de retard

Il décrivait l'état d'avant les Lots 81 et 82 :

| ligne | avant | après |
|---|---|---|
| Ajouter un tome | « supprimer l'exemplaire » | recliquer la tuile le retire |
| *(nouvelle)* Retirer un tome possédé | absente | « Annuler », qui rend la date d'acquisition d'origine |
| Ajouter à une Tier List | « Retirer de cette Tier List » | ce retrait propose lui-même « Annuler », rang compris |
| Relation créée | « suppression » | suppression avec « Annuler » |

Et la description de l'export annonçait onze fichiers et « envies
d'amélioration » ; elle en annonce quatorze, avec ce que le Lot 79 y a ajouté,
et dit désormais pourquoi l'historique d'analyses et les jetons de partage
restent dehors.

**Rien dans `DESIGN_MIGRATION_V1.2.md` n'a été touché** : c'est un journal, et
les lots 27 et 79 y décrivent à juste titre ce qui existait alors. Seuls les
documents qui décrivent l'application **au présent** ont été alignés.

### Lot 84 — cinq réglages qui ne réglaient rien

Décision de l'utilisateur, prise sur le décompte du Lot 73 : **retirer** plutôt
que brancher. `preferCompletedSeries`, `avoidOngoingSeries`,
`preferOmnibusIntegral`, `frenchLanguageOnly` et
`preferEasyToCompleteCollections` vivaient dans le profil de collectionneur
depuis la Phase 1 sans qu'aucune ligne du moteur ne les lise. Elles étaient
pourtant persistées en base, validées par l'API et rendues par
`GET /preferences` : une surface de configuration qui promettait cinq leviers
inertes.

C'était déjà ce qui avait fait abandonner l'écran de réglages au Lot 30 - « six
interrupteurs inertes auraient été pires que pas d'écran ». L'écran n'a pas été
fait ; les préférences, elles, sont restées. Le lot referme ça par l'autre bout.

Les brancher aurait voulu dire inventer cinq règles de score qui n'existent
nulle part - de l'ajout, pas de la consolidation, et cinq occasions de se
tromper sur le goût de quelqu'un d'autre.

#### Ce qui a été retiré, et ce qui reste

Retirées de bout en bout : le record de domaine, l'entité JPA, l'adaptateur, le
corps de requête de l'API, l'export JSON et CSV, le type côté web, et les
colonnes elles-mêmes (`V24__drop_inert_collector_preferences.sql`).

Ce qui reste est **exactement ce que le moteur lit** : la hiérarchie des gammes
d'édition, l'évitement d'une édition dépassée, l'importance de l'état (branchée
au Lot 73), la décote minimale attendue, et les poids des dix facteurs.

#### Un client pas encore à jour n'est pas cassé

Le test de contrat envoie toujours un corps portant `preferCompletedSeries` et
vérifie que la réponse est **200** - Jackson ignore une propriété inconnue. Un
client resté en arrière continue donc de passer, et le champ ne fait
simplement plus rien : exactement ce qu'il faisait déjà. L'assertion, elle, a
changé de sens : elle exige désormais que le champ soit **absent** de la
réponse.

#### Vérifié en direct

Migration appliquée au redémarrage : la table ne porte plus que six colonnes
(`owner_id` compris). `GET /preferences` rend cinq champs au lieu de dix.
L'export JSON porte le profil réduit. 1013 tests backend depuis `clean`,
`typecheck`, `lint`, `build`. Conteneurs API et web reconstruits.

**La ligne enregistrée n'a pas été retouchée**, conformément à la décision :
elle garde `minimumDiscountVsRetailPercent = 0`, un classement de gammes vide
et des poids vides. Les deux derniers sont rattrapés par le repli du Lot 72 ;
le premier reste tel quel, et fait que RETAIL_DISCOUNT note 100 dès qu'une
annonce est sous le prix neuf.

### Lot 83 — « Bad Gateway », et une piste qui s'est retournée

Parti d'une observation en gelant puis en arrêtant l'API : Ma collection et
Statistiques restaient sur « Chargement… » **plus de quarante secondes**, sans
jamais rien dire, pendant que la console accumulait des 502.

#### Ce qui a été livré

`502` et `504` manquaient à la table de traduction des statuts du client HTTP
(`400/401/403/404/409/500/503` y étaient). Or ce sont exactement ceux que
l'application rencontre en usage réel : déployée, elle passe par le nginx de
`docker-compose`, qui répond **502** quand le conteneur API n'est pas démarré -
la panne la plus ordinaire de ce projet. En développement (`npm run dev`),
l'appel échoue avant d'aboutir et tombe dans `MESSAGE_HORS_LIGNE`, ce qui
explique que le trou soit passé inaperçu : **les deux modes d'exécution ne
tombent pas dans la même branche**.

Sans ces deux lignes, le repli affichait la phrase de statut anglaise, « Bad
Gateway », dans une interface entièrement en français - précisément le défaut
que le commentaire de ce fichier dit avoir corrigé pour les autres statuts.

#### Ce qui n'a PAS été livré, et pourquoi

L'écran figé sur « Chargement… » n'a pas été corrigé : la sonde a retourné la
piste.

En instrumentant les quatre requêtes de `useDonneesCollection`, toutes
ressortent en `fetchStatus: "paused"`. Dans TanStack Query, une requête ne se
met en pause que si son `networkMode` vaut `online` **et** que le gestionnaire
de connexion la croit hors ligne. Or :

- le paquet livré contient bien
  `new QueryClient({defaultOptions:{queries:{networkMode:"always"}...}})` -
  vérifié en relisant le bundle servi, pas le source ;
- avec `always`, une requête ne se met **jamais** en pause ;
- `navigator.onLine` vaut `true` dans la page, et émettre un événement `online`
  ne réveille rien.

Autrement dit, l'état observé contredit la configuration réellement embarquée.
La conclusion la plus probable est que le **navigateur de test** est en cause -
il a déjà trois particularités documentées ici (aucune composition d'image,
`clientWidth` à 0 sans viewport émulé, Échap synthétique non délivré). Corriger
sur cette base reviendrait à bâtir sur du sable, comme la mise en page du
Lot 80 refusée tant que l'application de l'utilisateur avait vingt-cinq lots de
retard.

**À vérifier sur un vrai navigateur** : arrêter le conteneur API, charger
l'application, et regarder si un message d'erreur apparaît dans les dix
secondes. S'il apparaît, il n'y a rien à corriger. S'il n'apparaît pas, le
défaut est réel et la cause est à chercher du côté de `networkMode`.

`typecheck`, `lint`, `check:contrast`, `build`. Conteneur `web` reconstruit,
API redémarrée, collection réaffichée à l'identique.

### Lot 82 — les deux derniers gestes destructeurs sans filet

Le Lot 81 a rendu le retrait d'un tome annulable. Recensement de tous les
gestes destructeurs de l'application, et de ce qui les protège :

| geste | protection avant ce lot |
|---|---|
| retirer une envie | « Annuler » (`useWishlist`) |
| supprimer un prix relevé | « Annuler », restauration fidèle |
| supprimer une expérience | « Annuler », restauration fidèle |
| retirer un tome | « Annuler » (Lot 81) |
| supprimer la fiche d'une œuvre | zone sensible + refus si un exemplaire ou une lecture y est rattaché |
| supprimer une Tier List | confirmation en deux temps (« Irréversible ») |
| **retirer une œuvre d'une Tier List** | **rien - part au premier clic** |
| **supprimer une relation** | **rien - part au premier clic** |

Les deux derniers rejoignent la convention. Restauration fidèle dans les deux
cas : pour une œuvre retirée d'une liste, l'appartenance **et son rang** (en
deux appels, le second seulement si elle était classée) ; pour une relation,
source, cible et type - tout ce qui la définit, seul l'identifiant technique
change.

Retirer une œuvre d'une liste prend donc désormais l'entrée entière et non son
seul identifiant : c'est son **rang** qu'il faut pouvoir rendre, et il n'existe
plus une fois l'œuvre retirée.

#### Ce qui n'a délibérément PAS reçu d'annulation

Supprimer une Tier List passe déjà par une confirmation en deux temps qui
annonce « Irréversible ». Une annulation ferait mentir cette phrase, et
protégerait une deuxième fois un geste que personne ne déclenche par mégarde.
Le filet va aux gestes **nus**.

Cette conclusion est venue d'une vérification qui a d'abord mal tourné : ma
sonde a cliqué « Supprimer cette Tier List », vu apparaître un « Annuler », et
l'a pris pour le message d'annulation - alors que c'était le bouton *Annuler de
la confirmation*. Le journal réseau a tranché : aucun `DELETE /tier-lists/{id}`
n'était parti. **Vérifier qu'une requête a bien eu lieu avant de conclure sur
son effet.**

#### Vérifié en direct, sur des données jetables

Une Tier List de test et une relation de test, créées puis supprimées pour de
bon - jamais les données de l'utilisateur.

- Œuvre retirée d'une liste : « Œuvre retirée de la liste » + « Annuler », puis
  en base `rank = S` - le rang, pas seulement l'appartenance.
- Relation supprimée : « Annuler », puis en base la même source, la même cible
  et le même type.

État final identique à l'état initial : 9 œuvres, 12 possessions, 0 relation,
0 Tier List, 2 relevés, 1 envie.

`typecheck`, `lint`, `check:contrast`, `build`. Conteneur `web` reconstruit.

### Lot 81 — retirer un tome d'un clic était sans retour, et sans trace

Trouvé en enquêtant sur un écart de données constaté dans la collection de
l'utilisateur : un tome de Death Note était passé d'une acquisition au **26/08**
à une au **28/08**, avec un identifiant d'exemplaire tout neuf. Un aller-retour
sur la tuile, donc - et la date réelle d'acquisition détruite au passage.

C'est structurel. Cliquer une tuile possédée SUPPRIME l'`Ownership` : depuis le
Lot 55, ni « vendu » ni « perdu » ne subsistent, il ne reste qu'un sens à ce
geste. Rien n'en garde trace. Et le seul retour en arrière offert - recliquer -
crée un exemplaire neuf, daté d'aujourd'hui.

Les envies, elles, ont depuis longtemps la bonne manière : `useWishlist`
affiche un message bref et « Annuler », dans les deux sens, avec un drapeau
`silencieux` pour ne pas faire boucler l'utilisateur entre deux messages. La
possession d'un tome - un geste **plus** destructeur - n'avait rien.

#### Une annulation qui abîme ce qu'elle restaure ne restaure rien

`quick-add` datait toujours l'acquisition d'aujourd'hui. Proposer « Annuler »
sans traiter ça aurait rendu le tome en effaçant quand même sa date : le défaut
serait passé du geste à son remède.

`QuickAddRequest` accepte donc une `acquiredAt` optionnelle, ajoutée par
surcharge de service - les quatre signatures existantes n'ont pas bougé, même
patron additif que `purchasePrice` juste au-dessus. Absente, c'est aujourd'hui,
comme avant.

L'annulation rend l'exemplaire tel qu'il était : sa date, son état, son prix
d'achat. **Sa note éventuelle ne repasse pas** - le champ a perdu son écran au
Lot 55 et `quick-add` ne le porte pas ; c'est dit dans le code plutôt que
laissé à découvrir.

#### Vérifié en direct, sur une œuvre jetable

Une série de test créée par l'API avec une acquisition au **2020-01-15**, jamais
la collection de l'utilisateur. Clic sur la tuile : le message « Tome retiré »
et son bouton « Annuler » apparaissent. Clic sur « Annuler » : la tuile
redevient « Tome 1, possédé », et en base la date est **2020-01-15**, pas celle
du jour. Puis exemplaire, tome et fiche supprimés - 9 œuvres et 12 possessions,
inchangées.

Deux tests couvrent les deux sens : une date fournie est respectée, une date
absente reste aujourd'hui. 1013 tests backend (depuis `clean`).

**Note de méthode** : le message s'efface tout seul au bout de quelques
secondes. Une première vérification a cliqué le retrait, attendu, puis cherché
« Annuler » - déjà disparu. Enchaîner les deux dans le même lot d'actions.

### Lot 80 — le même héritage sur toutes les fiches

Signalé par l'utilisateur : « il faudrait avoir le même héritage sur chaque
fiche en incluant le bouton "éditer" ».

Le bouton « Éditer » vivait dans `CartesEditions`, la rangée « ÉDITIONS · n ».
Or `EntityDetailPage` ne rend cette rangée que si l'œuvre a des groupes de
tomes. Un **jeu vidéo**, un **jeu de société**, ou une série manga dont aucun
tome n'est encore catalogué n'avaient donc aucun accès au mode édition - ni
renommer, ni recharger depuis la source, ni relations, ni champs techniques,
ni supprimer. Vérifié en direct sur la fiche Zelda : neuf boutons, aucun
« Éditer », et « Terminer » n'apparaissait jamais.

Le geste ne dépend pas des éditions : il ouvre le catalogue de l'**œuvre
entière**. Il rejoint donc `FicheHero`, à côté d'« Évaluer » - l'en-tête que
toute fiche possède, quel que soit son type. `CartesEditions` ne garde que ce
qui parle vraiment d'éditions : « Ajouter une édition », toujours conditionné
au mode.

**Mesuré avant/après sur la fiche Zelda** (jeu vidéo) :

| | avant | après |
|---|---|---|
| bouton « Éditer » | **absent** | présent |
| en mode édition | inatteignable | Champs techniques (1), Ajouter une relation, Recharger depuis la source, Renommer la série, Supprimer |

Et les gestes personnels restent : « Ajouter à mes envies », « Modifier :
Tier list / Ma note / Mes remarques / Lectures / Tags ». Sur la fiche Death
Note, rien n'a bougé - le mode ajoute toujours, ne retire jamais, et aucun
débordement horizontal n'apparaît.

Les deux autres appelants ne changent pas : `usePropositionTomes` (écran
d'ajout) ne passait déjà pas de bascule, et `ApercuOeuvrePage` - l'aperçu d'une
œuvre qu'on ne possède pas - n'en veut pas : il n'y a rien à éditer dans un
catalogue où l'œuvre n'est pas encore entrée. La prop est optionnelle, le
bouton n'y apparaît pas.

#### Ce qui a permis de trouver

Le défaut décrit ne se reproduisait pas. Cause : **le conteneur web de
`docker-compose` datait du 23 août**, soit environ vingt-cinq lots de retard,
et servait une fiche d'un autre âge (« Plus d'options », « Je cherche une
meilleure édition » - une fonctionnalité retirée depuis). Toutes les
vérifications de la session passaient par le serveur de développement
(port 5173), donc l'écart n'était jamais apparu. Reconstruit ; le navigateur
gardait en plus l'ancien HTML en cache, et il a fallu forcer l'URL pour qu'il
prenne le nouveau paquet.

**À retenir** : vérifier sur le port 5173 ne dit rien de ce que l'utilisateur
voit sur le 8081. Reconstruire le conteneur `web` fait partie de la livraison,
au même titre que `iozycore-api`.

`typecheck`, `lint`, `check:contrast`, `build`.

### Lot 79 — l'export promettait une porte de sortie qu'il n'ouvrait qu'à moitié

Le Lot 33 avait ajouté à l'export ce qui était « saisi à la main, irrécupérable,
et pourtant absent d'un export qui promet l'absence d'enfermement ». Le critère
est bon ; il n'avait simplement pas été repassé depuis. Comparaison des tables
de la base avec ce que `ExportDocument` emporte :

| table | exportée avant ce lot |
|---|---|
| `market_price_observation` | **non** |
| `followed_edition` | **non** |
| `entity_type` | **non** (seuls le code et le libellé voyageaient sur chaque œuvre) |
| `collector_preferences` | **non** |

Les quatre répondent au critère du Lot 33. Un prix relevé à la main n'existe
nulle part ailleurs ; l'édition qu'on suit est un choix, pas une fiche ; un type
de collection créé depuis Administration porte sa couleur, son icône et son
format de jaquette (Lots 17, 22, 23) que rien d'autre ne conserve ; le profil de
collectionneur pondère chaque verdict (Lots 72 et 73).

#### Ce qui reste dehors, et pourquoi

- `share_settings` : un jeton de partage est un secret vivant. L'exporter
  reviendrait à recopier une URL-capacité dans un fichier qu'on s'envoie par
  mail.
- `volume_search_cache`, `ai_price_estimate_cache` : des caches, reconstruits
  au premier appel (Lot 76).
- `purchase_analysis` : une histoire CALCULÉE, dont le contenu est un
  instantané du moteur de son jour - les lots 71 à 76 l'ont montré à leurs
  dépens. Ce qu'une annonce avait d'irremplaçable, son prix, est justement ce
  que `market_price_observation` conserve désormais.

#### Vérifié en direct

L'export JSON rend maintenant `marketObservations: 2`, `followedEditions: 0`,
`entityTypes: 3` et un objet `collectorPreferences` ; l'archive CSV passe de
**10 à 14 fichiers**, et `market-observations.csv` sort dénormalisé comme le
reste (`Death Note, Black Édition, 45.00, MANUAL_ENTRY`) - lisible sans
rejoindre une autre table. Octets vérifiés : de l'UTF-8 correct
(`Black \xc3\x89dition`), le charabia n'était que l'encodage de ma console.

`MarketPriceObservationRepository.findAll()` a été ajouté au port - une méthode
plutôt qu'une boucle par édition côté appelant. Les éditions suivies passent par
`findByEntityIdIn`, même geste que les classements généraux au Lot 33 : toutes
les œuvres sont déjà chargées, pas besoin d'élargir ce port-là.

Test de contenu ajouté sur une vraie base : un relevé manuel, une édition suivie,
les types et le profil sont retrouvés dans le document, titres dénormalisés
compris. 1011 tests backend.

#### Deux leçons d'outillage, payées comptant

**`mvn test-compile` peut passer sur des classes périmées.** `target/` vit dans
le répertoire monté et survit d'un conteneur à l'autre : l'ajout de `findAll()`
au port a laissé un faux repository de test (`VariantDeletionServiceTest`) sans
implémentation, et la compilation incrémentale ne l'a pas vu. C'est la
construction de l'image Docker - qui compile depuis zéro - qui a levé l'erreur.
Corollaire : **ne jamais avaler la sortie de `docker compose build`** ; elle
disait « failed to solve » pendant que `up -d` répondait tranquillement
« Started » sur l'ANCIENNE image, et l'export vérifié en direct ne montrait
alors aucune des quatre familles.

**Deux Maven en même temps sur le même `target/` monté se marchent dessus** :
une suite complète lancée en tâche de fond et un `clean test` simultané ont
produit un `BUILD FAILURE` sans une seule ligne de test. Relancé seul, le même
`clean test` rend 1011 tests verts.

### Lot 78 — le panneau d'aide s'ouvrait derrière le clavier

Suite du balayage mesuré du Lot 77, sur une dimension qu'il n'avait pas
couverte : le clavier.

#### Huit surfaces `role="dialog"`, sept branchées sur le hook

`useModalA11y` existe depuis le Lot 9 pour tenir un comportement clavier
identique partout (Échap ferme et rend le focus au déclencheur, Tab reste
piégé). Sept des huit surfaces `role="dialog"` de l'application l'utilisent.
La huitième est `AideFlottante`, le panneau du bouton « Aide » d'une fiche.

Et elle a raison de ne pas l'utiliser : ce panneau n'est **pas modal** - pas
d'`aria-modal`, pas de voile, la page reste utilisable derrière - et enfermer
le clavier dans une surface non modale serait un défaut de plus, pas un de
moins. Il implémente d'ailleurs déjà Échap à la main, avec une nuance que le
hook générique n'a pas : la première pression referme la réponse ouverte, la
seconde le panneau.

#### Ce qui manquait vraiment

Le focus n'entrait jamais dans le panneau. Et comme celui-ci est rendu **avant**
son déclencheur dans le DOM (colonne ancrée en bas, le bouton en dernier), Tab
emmenait vers le reste de la page : le panneau qu'on venait d'ouvrir n'était
atteignable qu'en revenant en arrière par Maj+Tab.

**Mesuré avant** : après le clic sur « Aide », l'élément actif est toujours
« Aide » (position 30 dans l'ordre de tabulation), le premier élément
focalisable du panneau est en position **27** - derrière.

**Mesuré après** : l'élément actif est « Que me manque-t-il ? », `dansLeDialogue
: true`. Échap referme et rend le focus à « Aide ». Le repère de focus suit la
convention de la maison (`data-modal-initial-focus`, posé sur la première
question - jamais sur le bouton « Fermer » qui la précède visuellement).

#### Six commentaires renvoyaient à un composant supprimé

`VolumeInteractionPanel` a été supprimé au Lot 55. Six commentaires, dans six
fichiers, disaient encore « voir VolumeInteractionPanel » - à un lecteur qui ne
peut rien y voir. C'est la troisième strate du Lot 61 : « la fonction cliente,
la route serveur, et la DOC qui le décrit encore ».

Chacun pointe désormais vers un exemple vivant, vérifié plutôt que deviné :
`AddVolumeSection` pour le parcours d'ajout d'un tome (`GrilleTomes`,
`SearchPage`), `TierPicker` et `CollectionFilters` l'un pour l'autre sur le
patron popover/bottom-sheet, et `useModalA11y` ne cite plus que ses deux
exemples encore debout. `DiscoverPage` ne se compare plus à rien : c'est le
seul jeu d'onglets de l'application, vérifié - un seul `role="tab"` dans tout
le code.

Les neuf mentions restantes vivent dans ce document-ci et n'ont **pas** été
touchées : c'est un journal, les lots 25, 54 et 55 décrivent à juste titre ce
qui existait alors.

#### Une note d'outillage

La touche Échap envoyée par le pilote du navigateur n'atteint pas le
`document.addEventListener('keydown')` de la page : le panneau restait ouvert,
ce qui ressemblait à un second défaut. Un vrai `KeyboardEvent` distribué depuis
la page ferme bien le panneau et rend le focus. **Vérifier un raccourci clavier
ici demande de distribuer l'événement, pas de simuler la frappe.**

`typecheck`, `lint`, `check:contrast`, `build`.

### Lot 77 — la seule cible tactile sous le plancher

Six lots d'affilée dans le moteur d'analyse : ce lot-ci change de terrain et
reprend la méthode des Lots 10, 37 et 41 - **mesurer**, plutôt que regarder.

#### Ce que le balayage a trouvé, et surtout ce qu'il n'a pas trouvé

À 375 px de large, viewport émulé explicitement (sans quoi
`document.documentElement.clientWidth` vaut 0 dans ce navigateur et toute sonde
de débordement rapporte un faux positif - vérifié une fois de plus ici :
`deborde: true` accompagné d'un `viewport: 0`) :

- **Débordement horizontal** : aucun, sur Ma collection, Découvrir, Mon profil,
  Statistiques, Évaluer une annonce, la fiche d'une œuvre. Le travail des
  Lots 10 et 41 tient.
- **Noms accessibles** : aucun bouton sans nom, aucun doublon de nom sur la
  fiche - 33 éléments interactifs. Le Lot 40 tient.
- **Cibles tactiles** : un seul élément interactif de toute l'application sous
  le plancher de 24 px (WCAG 2.5.8) - le crayon « Modifier l'édition » de la
  fiche, à **13 × 13 px**. Paramètres et Tier Lists : aucun.

#### Un seul coupable, et la convention existait déjà

Le crayon n'avait aucune classe de taille : le bouton faisait exactement
l'icône. Or deux autres boutons-icônes de l'application, avec la même icône de
13 px, portent bien leur surface : le bouton de suppression d'un prix relevé
(`EditionObservations`, `flex h-11 w-11 items-center justify-center`) et le
« Modifier » d'une annonce (`ListingSummaryCard`, `min-h-11`). C'est donc un
oubli isolé, pas une règle absente - et le correctif est la convention de la
maison, pas une invention.

Le commentaire du bouton justifiait sa nudité par une ligne compacte à laquelle
il s'accrocherait (« Black Édition · 6 tomes ») : cette ligne n'existe plus, le
crayon est aujourd'hui seul dans son conteneur (`EntityDetailPage`, colonne
inspecteur). L'agrandir ne bouscule donc rien.

**Mesuré avant/après**, à 375 px : crayon **13 × 13 → 44 × 44**, éléments sous
24 px sur la fiche **1 → 0**, aucun débordement. À 1280 px émulés : contenu
1265 pour un viewport 1265, aucun débordement non plus. Le clic ouvre bien le
formulaire d'édition (« Black Édition · Édition épuisée · Nouvelle édition
annoncée · Enregistrer · Annuler ») - **sans** cliquer Enregistrer, pour ne rien
écrire dans les données.

`typecheck`, `lint`, `check:contrast`, `build`.

#### Une prudence, notée pour la prochaine fois

Une première sonde a ouvert huit panneaux d'un coup en cliquant tous les boutons
dont le libellé contenait « Modifier », « Éditer » ou « Ajouter ». Aucune
écriture n'a eu lieu - vérifié : 9 œuvres, 14 possessions, 1 envie, 0 relation,
0 tag, 2 expériences, inchangés - mais c'était de la chance, pas de la méthode :
un « Ajouter » peut être une bascule qui écrit. **Ne jamais déclencher des
gestes en masse par correspondance de libellé sur des données réelles.**

### Lot 76 — la même question repartait chez l'IA à chaque analyse

Conséquence directe du Lot 75, et il fallait la traiter. L'avis de l'IA sur le
prix d'un tome n'est demandé que lorsqu'**aucun relevé réel n'existe** pour
l'édition. Jusqu'ici, la première analyse d'une annonce saisie à la main créait
un relevé, donc la suivante n'appelait plus l'IA. En fermant cette écriture,
le Lot 75 a rendu l'appel **systématique** : chaque analyse repose la même
question au même modèle.

Le fournisseur est Gemini sur son palier gratuit - un choix explicite, pour ne
pas payer un usage personnel. C'est donc un quota qui payait.

#### « Je ne sais pas » n'est pas une panne

`GeminiMarketPriceAdvisor` rendait `Optional.empty()` pour **cinq** situations
différentes : clé absente, HTTP non-200, exception réseau, réponse illisible,
et **le modèle qui répond « je ne sais pas »** - ce que l'invite lui demande
pourtant explicitement de faire (« ne JAMAIS inventer un chiffre plausible.
Mets null […] plutôt que de deviner »).

C'est la note du Lot 58, transposée à un `Optional` : *« un `return null` qui
veut dire "ça n'a pas marché" finit toujours par vouloir dire "il n'y a
rien" »*. Et la confusion coûte cher ici : la seule réponse parfaitement
**stable** - celle qui mérite le plus d'être mémorisée - était indiscernable
d'une panne passagère, donc impossible à mémoriser sans figer un incident
réseau en « je ne sais pas » définitif.

`AiPriceEstimate.pricePerVolume` peut désormais être nul, et cela veut dire une
chose précise : le modèle a répondu, il ne sait pas. `MarketPriceCalculator`
retombe alors sur le théorique - un avis sans chiffre ne fonde pas une base
`AI_ESTIMATED`.

#### Le cache, sur le patron déjà en place

`ai_price_estimate_cache` (V23) mémorise la réponse par (série, édition, état),
clés normalisées. Même raison d'être et même forme que `volume_search_cache`
(V3), qui existe parce que « savoir si une œuvre a des tomes coûte huit
requêtes Google Books ».

Ce qui se mémorise est une **réponse**, « je ne sais pas » compris. Jamais un
**échec** : clé absente, quota dépassé, réseau coupé ne laissent rien et seront
retentés.

#### Mesuré en direct

Deux analyses de la même annonce (Vinland Saga / Kurokawa, édition absente du
catalogue donc aucun relevé) :

| | 1re analyse | 2e analyse |
|---|---|---|
| durée | **7 050 ms** | **85 ms** |
| appel Gemini | 1 | **0** |

Une ligne en cache (`vinland saga | kurokawa | VERY_GOOD | 4.50 | HIGH`), et
l'estimation continue de circuler : `basis AI_ESTIMATED`, 4,50 €/tome.

Le test `la_meme_edition_analysee_deux_fois_ne_demande_l_avis_de_l_ia_qu_une_seule_fois`
compte les appels d'un faux conseiller - même patron que `FakeMetadataProviders`,
une classe de vingt lignes plutôt qu'une bibliothèque de doublures.
**Confronté à l'ancien code** : « expected: 1 but was: 2 ».

**Un test existant a changé d'assertion, pas d'intention** :
`a_null_price_never_invents_a_figure` vérifiait `isEmpty()`. Aucun chiffre n'est
toujours inventé - le prix reste nul - mais la réponse existe désormais. C'est
le cas de figure prévu par la note du Lot 36 : un test peut consigner un
comportement sans le protéger, et c'est l'intention de son nom qui fait foi.

**Vérifié** : état revenu à l'identique - 9 analyses, 2 relevés, cache IA vidé
de sa ligne de test. 1010 tests backend.

### Lot 75 — une annonce analysée deux fois certifiait son propre prix

Suite directe du Lot 74, où mes analyses de vérification avaient laissé six
relevés en base. En cherchant pourquoi, le mécanisme s'est révélé plus grave
que la trace qu'il laissait.

`releverLePrixDemande` enregistre le prix demandé d'une annonce analysée comme
un prix de marché. Deux des six règles de `MarketComparableSelector` ne
tiennent que par **l'identité de l'annonce** : « une annonce, un comparable »
(règle 5) et « l'annonce en cours d'évaluation est exclue » (règle 6). Or
l'identité vient de l'URL ou de l'identifiant externe - et une annonce **saisie
à la main n'en a aucune**. C'est le cas normal : l'en-tête de
`PurchaseAnalysisEngine` explique lui-même qu'aucun fournisseur public
n'existe pour Vinted, Leboncoin ou Rakuten, donc que tout se saisit à la main.

**Mesuré en direct avant correction**, même annonce analysée deux fois :

| | 1re analyse | 2e analyse |
|---|---|---|
| relevés créés | 1 (automatique) | 1 de plus |
| `referenceSampleSize` | 0 | **2** |
| `referencePrice` | — | **33,00 €**, le prix demandé |
| `pricePosition` | `REFERENCE_UNAVAILABLE` | **`FAIR_PRICE`** |
| `REAL_MARKET_ALIGNMENT` | 40 | **90** |

L'annonce se déclarait au prix du marché sur la foi d'elle-même. Le champ
s'appelle pourtant « annonces comparables **INDÉPENDANTES** ». Trois passages
auraient suffi à décrocher la confiance HIGH - exactement le défaut que le
sélecteur a été écrit pour supprimer.

Le sampleSize valait 2 et non 1 parce que le bouton « Relever ce prix comme
observation de marché » écrit une **seconde** ligne pour le même prix : le
prix était déjà relevé automatiquement, sans que rien ne le dise. Le commentaire
au-dessus de ce bouton affirmait même l'inverse - « Rien n'est relevé
automatiquement ».

#### La garantie était testée, sur un chemin que personne n'emprunte

`MarketObservationIngestionIntegrationTest#une_annonce_reanalysee_ne_se_compare_pas_a_son_propre_prix_releve`
vérifie précisément ce qui a échoué ici. Il passe - parce que les quinze tests
de cette classe passent tous une URL et un `externalId`. La règle est donc
garantie sur le chemin qui a une identité, et hors de portée sur celui que
l'application utilise réellement.

#### Le correctif

Une annonce **sans identité ne produit plus aucun relevé automatique**. Ni
déduplication ni auto-exclusion ne peuvent s'appliquer à une ligne dont on ne
sait plus d'où elle vient : l'écrire, c'est fabriquer une donnée que son
lecteur est documenté pour ne pas savoir traiter. Le geste explicite de
l'utilisateur reste entier - le bouton écrit un `MANUAL_ENTRY`, qu'il assume -
et le relevé automatique continue sur les annonces lues depuis un lien, où les
deux règles fonctionnent.

Le commentaire de l'écran, qui affirmait le contraire de ce que faisait le
moteur, dit maintenant lequel des deux chemins fait quoi.

Deux tests de non-régression, **confrontés à l'ancien code** : échec réel sur
l'assertion (« Expecting empty but was: [MarketPriceObservation… origin=LISTING_ANALYSIS,
listingIdentity=null] »), pas une erreur de compilation.

**Vérifié en direct après correction** : deux analyses de la même annonce saisie
à la main, `referenceSampleSize` **0**, `referencePrice` **null**,
`REFERENCE_UNAVAILABLE`, alignement **40**, et **aucun relevé créé** - la table
est restée à ses deux lignes d'origine. Les deux analyses jetables supprimées
n'ont, cette fois, laissé aucune trace : c'est précisément l'objet du lot.

**Un test a dû être ajusté** :
`PurchaseAnalysisHttpContractTest#deleting_an_analysis_keeps_the_edition_and_the_prices_it_recorded`
analysait une annonce sans identité et s'appuyait sur le relevé automatique
pour poser son décor. Son vrai sujet - supprimer une analyse n'emporte pas les
données de référence qu'elle a produites - est intact ; c'est sa mise en place
qui reçoit désormais une URL et un identifiant externe, seul cas où le relevé
automatique subsiste.

1008 tests backend.

### Lot 74 — les deux moitiés de l'écran étaient en désaccord sur la même donnée

Sur l'analyse Death Note du 24/08, le bloc **Prix** disait :

> Référence insuffisante — *Des prix existent pour cette édition, mais aucun sur
> un lot comparable — un tome seul et une intégrale ne se valent pas au tome.*

et le détail du verdict, dans le même écran, comptait
`REAL_MARKET_ALIGNMENT` **90/100, confiance haute**, au motif que « au moins un
lot est valorisé à partir d'un prix réellement relevé ».

`MarketComparableSelector` a été écrit exactement pour ça - son propre en-tête
raconte le défaut qu'il supprime : « tout relevé rattaché à l'édition entrait
dans la médiane, ramené à un prix au tome […] une annonce 1-14 héritait d'une
référence de 70 € présentée comme solide ». Il n'a été branché que sur la
`MarketReference` du bloc Prix. Le facteur du verdict, lui, s'appuyait toujours
sur `anyObservedMarketData` : « existe-t-il un relevé, n'importe lequel ? »

#### Portée du correctif, et ce qui reste volontairement en place

Seul le facteur qui parle d'**alignement** change. Ses deux autres lecteurs -
la confiance du rapport prix/valeur, le signal de rareté - gardent le sens
large : eux demandent seulement si un vrai prix a nourri la valorisation, ce
qui reste vrai. La valeur juste, la négociation et le coût de complétion ne
bougent pas non plus : `referenceDeLot` dit lui-même que l'estimation et le
prix neuf « restent utiles pour le coût de complétion, la négociation et le
verdict global », et un prix AU TOME reste le bon repère pour chiffrer des
tomes manquants achetés un par un.

Un relevé non comparable n'apprend rien sur l'alignement du prix de CE lot : il
vaut donc la même note qu'aucun relevé (40), avec un message qui les distingue
- il y a quelque chose à faire, relever un prix sur un lot de taille voisine.
Pas de troisième palier inventé pour l'occasion.

`referenceDeLot` est calculée avant le verdict, et `reference.sampleSize() > 0`
alimente le nouveau champ `anyComparableObservation`, ajouté par constructeur
auxiliaire déléguant sur `anyObservedMarketData` - les sites d'appel existants
n'ont pas bougé.

#### Mesuré en direct, sur données propres

Un tome seul de Black Édition (12 €), alors que les deux seuls relevés portent
sur des lots de 5 et 6 tomes :

| | avant | après |
|---|---|---|
| bloc Prix | `NO_COMPARABLE_SHAPE` | `NO_COMPARABLE_SHAPE` |
| `REAL_MARKET_ALIGNMENT` | 90 · confiance haute | **40 · confiance faible** |
| message | « prix réellement relevé » | « des prix relevés existent, mais aucun sur un lot comparable » |

Le test de non-régression échoue bien contre l'ancien code, mais à la
**compilation** : la distinction n'existait pas dans la signature d'avant. La
différence de comportement est donc établie par la mesure en direct ci-dessus,
pas par ce test - il faut le savoir en le lisant.

#### Une erreur de méthode, trouvée en cours de route

`PurchaseAnalysisService.releverLePrixDemande` enregistre automatiquement le
prix demandé comme observation de marché (`origin = LISTING_ANALYSIS`) dès
qu'une annonce mono-série a une édition reconnue et une forme comparable.
C'est délibéré et documenté côté serveur.

Conséquence : les analyses jetables des lots 71 à 74 ont écrit **six
observations** dans les données de l'utilisateur, et supprimer une analyse ne
supprime pas l'observation qu'elle a créée. Les vérifications de ces lots
comptaient les analyses, les œuvres, les possessions et les envies - jamais les
observations - et ont donc conclu « état revenu à l'identique » à tort. Les six
lignes ont été supprimées (`DELETE /market-observations/{id}`), la table est
revenue à ses deux lignes d'origine (45 € du 23/08, 40 € du 27/08).

Elles avaient aussi faussé une mesure : la première vérification de ce lot-ci
rendait `referenceGap: NONE` et 90/HIGH, parce que cinq de mes propres relevés
à 30 € sur trois tomes servaient de comparables à un lot de trois tomes. La
mesure ci-dessus a été refaite après nettoyage. **À retenir pour tout lot
futur : une analyse jetable n'est pas sans trace.**

1006 tests backend.

### Lot 73 — « l'état compte beaucoup pour moi » ne comptait pas

Le Lot 72 a rebranché les poids du moteur. Restait à savoir ce que les
préférences elles-mêmes pilotent réellement. Comptage des lectures, hors leur
propre déclaration :

| préférence | lue par le moteur |
|---|---|
| `editionTierRanking` | 3 |
| `avoidOutdatedEditionWhenBetterExistsOrAnnounced` | 2 |
| `minimumDiscountVsRetailPercent` | 2 |
| `factorWeights` | 1 |
| `conditionImportance` | **0** |
| `preferCompletedSeries` | **0** |
| `avoidOngoingSeries` | **0** |
| `preferOmnibusIntegral` | **0** |
| `frenchLanguageOnly` | **0** |
| `preferEasyToCompleteCollections` | **0** |

Six interrupteurs sur dix ne sont lus par aucune ligne. C'est le constat qui
avait fait **abandonner l'écran de réglages au Lot 30** - « six interrupteurs
inertes auraient été pires que pas d'écran ». L'écran n'a pas été fait ; les
six sont restés inertes, persistés, validés par l'API et rendus par
`GET /preferences`.

#### Celui qui se branche sans rien inventer

`conditionImportance` est le seul des six dont le sens est déjà écrit dans le
code (`WeightLevel` : « how much condition should matter »), annoncé par le
profil par défaut (« high importance on condition ») **et** doté d'un point de
branchement existant : `effectiveWeight` majorait déjà le poids de `CONDITION`
d'un facteur 1,5 quand l'état porte sur un coffret.

Deux raisons indépendantes pour que l'état pèse plus, et elles se composent :
**ce qui** est jugé (un coffret plutôt qu'un tome standard) et **combien** ce
collectionneur y tient. L'échelle reste grossière - 0,5 / 1 / 1,5, la même que
la majoration coffret juste au-dessus - plutôt que d'inventer une graduation
fine que personne n'a demandée.

#### Mesuré en direct

Même annonce qu'à la vérification du Lot 72 (Black Édition, tomes 1-3, 30 €,
très bon état), le profil enregistré portant `condition_importance = HIGH` :

| | Lot 72 | Lot 73 |
|---|---|---|
| poids de `CONDITION` | 15 | 22,5 |
| verdict | Bonne affaire · **75**/100 | Bonne affaire · **71**/100 |

La note baisse, et c'est cohérent : `CONDITION` vaut 70 pour un très bon état,
sous la moyenne pondérée du lot - lui donner plus de poids tire vers le bas.
Le levier, mesuré sur la même annonce en ne changeant que l'état :
**scellé 77, défauts visibles 59**.

Le test `how_much_the_collector_cares_about_condition_actually_moves_the_score`
compare les trois niveaux sur une entrée identique et exige `LOW > MEDIUM >
HIGH` sur un lot en mauvais état. **Confronté à l'ancien code** avant d'être
gardé : `BUILD FAILURE`, les trois niveaux rendaient la même note.

#### Les cinq autres attendent une décision, pas un lot

`preferCompletedSeries`, `avoidOngoingSeries`, `preferOmnibusIntegral`,
`frenchLanguageOnly`, `preferEasyToCompleteCollections` n'ont **pas** été
branchés. Contrairement à `conditionImportance`, aucun ne dispose d'une règle
de score écrite quelque part : les brancher, c'est en inventer cinq - donc
ajouter, pas consolider. Les retirer touche le domaine, l'entité JPA, une
migration et le contrat de l'API, et efface des données persistées.

Les deux sont légitimes ; ce n'est pas au lot de trancher. Ce qui est acquis :
le décompte est fait, il est écrit ici, et il ne sera plus à refaire.

**Vérifié** : trois analyses jetables créées puis supprimées (204), état revenu
à l'identique (9 analyses), ligne `collector_preferences` inchangée.
1005 tests backend.

### Lot 72 — le score du verdict valait 50 pour toutes les annonces

Neuf analyses en base, deux créées pour vérifier le Lot 71 : **toutes notées
exactement 50/100.** Ce n'est pas une coïncidence de jeu d'essai, c'est la
seule note que le moteur pouvait rendre.

`VerdictScorer` calcule dix facteurs, chacun avec son score et sa
justification - tous affichés à l'écran - puis les pondère :

```java
int baseWeight = preferences.factorWeights().getOrDefault(factor, 0);
...
int rawScore = weightTotal.signum() == 0
        ? 50 // no factor could be computed at all - neutral fallback
        : weightedSum.divide(weightTotal, ...);
```

Le profil enregistré porte `factor_weights = {}`. Chaque poids valait donc
**0**, le total aussi, et la branche « aucun facteur n'a pu être calculé »
s'appliquait - alors que les dix venaient de l'être et s'affichaient
au-dessus, sous la ligne « Confiance Haute · basée sur **10/10 critères
disponibles** ». Un écran qui montre dix mesures et une note qui n'en tient
compte d'aucune.

#### Une absence de configuration n'est pas une configuration à zéro

Le profil par défaut existe, documenté « straight from the specification »
(poids 20/12/10/15/12/8/10/6/5/2, hiérarchie des gammes en sept rangs). Mais
`find()` ne le rend que si **aucune ligne** n'existe. Une ligne existe - écrite
avec des collections vides, la trace d'un `PATCH /preferences` partiel (cet
endpoint REMPLACE le profil entier, voir Lot 28) - et depuis, les valeurs de la
spécification ne pouvaient plus revenir : aucun écran ne règle ces préférences
(l'écran envisagé au Lot 30 a été abandonné), donc aucune remise à zéro non
plus.

Deux champs seulement peuvent porter cette distinction, et ce sont exactement
ceux qui étaient vides :

- `factorWeights` : un facteur dont le profil ne dit RIEN pèse ce que la
  spécification lui donne, plus zéro. Un `0` **explicite** reste honoré -
  faire taire un facteur volontairement reste possible, il faut juste le dire.
- `editionTierRanking` : un classement vide n'est pas un classement. Sans lui,
  `tierScore` rendait 50 pour toutes les gammes, Perfect comme Standard.

Les booléens et `minimumDiscountVsRetailPercent` ne sont **pas** repris :
`false` et `0` y sont des choix légitimes, indiscernables d'une absence. C'est
la limite du correctif, et elle se voit encore à l'écran - « Décote vis-à-vis
du neuf : 33 % (minimum attendu : **0 %**) » vient de la même écriture
partielle. La remettre à 20 serait réécrire les données de l'utilisateur, pas
corriger du code.

`defaults()` consomme désormais les deux mêmes constantes que ce repli :
une seule liste, écrite une fois (même règle qu'au Lot 70).

#### Ce que ça change, mesuré

Même annonce que l'analyse Death Note du 24/08 (Black Édition, tomes 1-3,
30 €, très bon état), rejouée après correction :

| | avant | après |
|---|---|---|
| verdict | **Cher · 50/100** | **Bonne affaire · 75/100** |
| EDITION_QUALITY | 50 (aucune gamme classée) | 60 (Deluxe, 4e rang sur 7) |

Le test de non-régression `a_profile_that_names_no_weight_falls_back_on_the_specified_ones_instead_of_silencing_every_factor`
reprend le profil exact de la base (booléens à faux, listes vides) et vérifie
que les dix facteurs pèsent. **Confronté à l'ancien code** avant d'être gardé
(`git stash` du correctif, test seul, `BUILD FAILURE`, puis restauration) -
sinon rien ne dit qu'il protège quoi que ce soit.

**Vérifié en direct**, analyse jetable créée puis supprimée (204), état revenu
à l'identique : 9 analyses, et la ligne `collector_preferences` **inchangée**
(`0 | [] | {}`) - le correctif se passe entièrement d'une reprise de données.
1004 tests backend.

### Lot 71 — une absence de prix n'est pas un mauvais prix

Sur une annonce dont **aucune valeur ne peut être estimée** - édition absente
du catalogue, donc ni prix relevé ni prix neuf - l'application affichait, en
rouge et en gras :

> **Passer l'annonce**
> Aucun prix relevé ni prix neuf connu pour cette édition - impossible
> d'estimer une valeur juste.

Un conseil tiré d'un vide. Et le verdict global disait **« Cher · 50/100 »**,
pour la même raison : `VerdictScorer` rabat tout verdict favorable sur
`EXPENSIVE` dès que la négociation rend `SKIP_LISTING`, sans distinguer les
deux choses très différentes que cet avis recouvre.

C'est la figure du Lot 58, transposée d'un `return null` à un enum : *« ça n'a
pas marché »* et *« il n'y a rien »* rendus par la même valeur, et deux étages
plus haut plus personne ne sait lequel des deux.

#### Le drapeau qui devait les séparer existait, et mentait

`NegotiationRecommendation.priceDataAvailable` est documenté noir sur blanc :
« false when neither a market observation nor a retail price allowed computing
a fair value at all ». Mais `NegotiationEngine` appelait la même fabrique
`unavailable(...)` dans **les deux** cas - y compris celui où la valeur juste
est parfaitement connue et **citée dans le message** (« dépasse très largement
la valeur estimée (22.50) »). Le drapeau valait donc `false` sur une analyse
qui affichait son prix de référence deux lignes plus bas.

Et personne ne s'en apercevait : le champ est typé côté web
(`types/purchaseAnalysis.ts`) et lu par **zéro ligne** d'interface. Livré,
faux, muet.

#### Ce qui a été fait

- `NegotiationRecommendation.skip(rationale)` à côté de `unavailable(rationale)` :
  même avis `SKIP_LISTING`, mêmes trois prix à `null` (le cahier des charges
  refuse de fabriquer une offre sur un écart déraisonnable - inchangé), mais
  `priceDataAvailable = true`, parce que la donnée était là.
- `VerdictScorer.Input` gagne `negotiationPriceDataAvailable`, et le rabattement
  ne s'applique plus qu'à un prix réellement hors marché. Ajouté par
  **constructeur auxiliaire** délégant avec `true` : les six sites d'appel des
  tests n'ont pas bougé d'une ligne.
- L'écran distingue enfin les deux : « Passer l'annonce » en rouge quand une
  valeur est connue, « Aucun conseil de prix possible » en gris neutre quand il
  n'y en a pas - juste sous le bloc Prix qui vient de dire « Référence
  insuffisante », qu'il contredisait.

#### Deux tests de non-régression

`asking_price_far_above_fair_value_...` vérifie désormais aussi
`priceDataAvailable` ; et `a_skip_advice_that_rests_on_no_price_data_at_all_does_not_downgrade_the_verdict`
reprend exactement le scénario excellent voisin en ne changeant que ce drapeau.

**Vérifié en direct, deux analyses jetables créées puis supprimées.** Édition
inconnue, 30 € : `priceDataAvailable: false`, écran « Aucun conseil de prix
possible » en gris, verdict **« Prix correct · 50/100 · Confiance Faible ·
basée sur 2/10 critères »** là où le même profil stocké en base affiche encore
« Cher ». Death Note Black Édition, 200 € : `priceDataAvailable: true`, écran
« Passer l'annonce » en rouge, verdict « Cher · 50/100 · Confiance Haute ·
10/10 » - le rabattement fait toujours son travail quand il est fondé. Les deux
analyses supprimées ensuite (204), état revenu à l'identique : 9 analyses,
9 œuvres, 14 possessions, 1 envie.

**Une conséquence à connaître** : les analyses **déjà en base** portent
l'ancien drapeau dans leur `payload` (`false` dans les deux cas). L'analyse
Death Note du 24/08, qui relève du dépassement de seuil, s'affiche donc
désormais avec le libellé neutre. Rien n'a été réécrit dans les données de
l'utilisateur pour le corriger - une reprise de données se décide, elle ne se
glisse pas dans un lot.

**Vérifié** : 1003 tests backend, `typecheck`, `lint`, `check:contrast`,
`build`.

### Lot 70 — « d'où vient ce prix » ne se dit plus de quatre façons

`PriceBasis` distingue trois origines de prix qui n'engagent pas la même
confiance : relevé sur de vraies annonces, estimé par l'IA sans vérification,
ou calculé depuis le prix neuf. Quatre écrans le traduisaient chacun dans son
coin — Découvrir, Suggestions d'achats, l'assistant d'une fiche, le détail
d'une analyse — et **l'un d'eux n'en connaissait que deux valeurs** :

```
suggestion.costToCompleteBasis === 'THEORETICAL_ONLY' ? ' (théorique)' : ' (marché)'
```

`SuggestionsPage` a été écrite avant que l'IA existe. Depuis, `AI_ESTIMATED`
est entrée dans l'enum et tombe dans le `else` : une estimation produite par
l'IA s'y annoncerait **« (marché) »**, exactement ce que le garde-fou de la
fonctionnalité interdit — une donnée IA ne doit jamais être présentée comme
une donnée réelle.

#### Le défaut est LATENT, et il faut le dire

`GET /purchase-analysis/near-complete-suggestions` et
`GET /purchase-analysis/completeness` passent tous deux par
`PurchaseAnalysisService.computeCompleteness`, qui appelle
`marketPriceCalculator.computePerVolume(edition, observations)` — la surcharge
**sans** estimation IA. Aucune de ces deux routes ne peut donc rendre
`AI_ESTIMATED` aujourd'hui. Seule `analyze()` le peut, et c'est le seul des
quatre écrans qui traitait la valeur correctement.

Autrement dit : trois écrans traduisaient une valeur qu'ils ne reçoivent pas
encore, chacun à sa manière, et le jour où `computeCompleteness` recevra
l'avis de l'IA — l'endpoint derrière l'assistant d'une fiche, ce n'est pas une
hypothèse lointaine — deux d'entre eux auraient menti sans que rien ne le
signale. Même figure qu'au Lot 68 : refermé avant que ça se voie.

#### Ce qui a été fait

`lib/basePrix.ts` porte les deux registres — `libelleBaseCourt` (incise
derrière un montant) et `libelleBaseLong` (phrase de l'assistant). Le sens est
écrit une fois ; seule la ponctuation reste chez l'appelant.

`null` (le backend le rend quand le coût est nul ou inconnu, voir
`CollectionStatus`) ne se replie plus sur « théorique » : les deux helpers
rendent `null` à leur tour et l'appelant n'écrit rien, plutôt que d'affirmer
une origine inconnue. Les trois écrans qui repliaient sur « théorique »
affirmaient une origine que personne ne leur avait donnée.

**Vérifié en direct sur les quatre surfaces**, rendu identique à avant :
Suggestions d'achats « ~22.50 € pour compléter (marché) » (Death Note) et
« 4/6 tomes · 2 manquants » sans mention (Raw Hero, base nulle) ; Découvrir
« ~22.50 € (marché) » ; le détail d'une analyse « (~22.50 €, marché) » ;
l'assistant de la fiche Death Note « Environ 22.50 € pour compléter (prix de
marché observés). » Aucune écriture, aucune donnée touchée.

**Non vérifiée en direct** : la branche `AI_ESTIMATED`, précisément parce
qu'elle est inatteignable depuis ces endpoints — la seule surface qui peut la
recevoir est le détail par série d'une analyse, et son libellé (« estimation
IA ») est repris mot pour mot. `typecheck`, `lint`, `check:contrast`, `build`.

### Lot 69 — le cœur « Envies » quitte l'en-tête

« Le bouton envie en haut dans le menu semble inutile. » Le code le disait déjà
dans son propre commentaire : *« Le cœur ne mène plus à un écran à lui : les
envies sont une LECTURE de Ma collection. Il pose donc le filtre et emmène
là-bas. »*

Or Ma collection porte « Tout / Possédés / Envies » dans sa barre de vues,
décompte compris. Le cœur doublait donc, **sur tous les écrans et en
permanence**, un bouton déjà visible sur celui qu'il ouvrait.

#### Pourquoi le profil reste, lui

`GlobalShortcuts` existe parce qu'au 2026-08-21 le cœur et l'avatar ne vivaient
que sur desktop, rendant les envies et le profil inatteignables en dessous de
768 px (UX-1). Cette raison a survécu pour l'un et disparu pour l'autre :
Paramètres, Administration, export, bilan annuel et partages n'ont **pas**
d'autre chemin que l'avatar, tandis que Ma collection est dans la barre du
pouce et porte son filtre.

Le décompte n'est pas perdu non plus - la barre de vues affiche « Envies · 1 »
là où le nombre se lit avec ce qu'il compte.

**Vérifié en direct, aux deux tailles** : en desktop l'en-tête ne porte plus que
les quatre destinations et « Mon profil » ; à 375 px, l'en-tête mobile garde
l'avatar, la barre du pouce ses cinq entrées, la barre de vues son « Envies · 1 »
- et aucun débordement horizontal. `typecheck`, `lint`, `check:contrast`,
`build`.

### Lot 68 — trois écrans de Tier Lists, un seul chargement

L'aperçu de Découvrir, l'écran Tier Lists et la carte du Profil posaient les
mêmes requêtes - une par type d'œuvre pour le classement général, une par type
pour les listes perso, une pour les listes transverses - recopiées à
l'identique sur une vingtaine de lignes. Même geste qu'au Lot 66 pour les deux
écrans de collection.

#### Le défaut que ça referme

La carte du Profil ne chargeait **pas** les listes « toutes catégories »
(Lot 14). Elle annonce « Mes Tier Lists » et propose « Tout voir » : un
utilisateur n'ayant que des listes transverses y aurait vu une carte vide,
quand l'écran Tier Lists et Découvrir les affichaient tous les deux. Latent
jusqu'ici - aucune liste n'existait encore - et refermé avant qu'il ne se voie.

**Démontré en direct** : une liste « toutes catégories » créée pour le test
apparaît maintenant dans la carte du Profil (« Test consolidation · 0
élément ») comme sur l'écran Tier Lists (section « Toutes catégories »). Elle a
été supprimée ensuite - 0 tier list en base, 9 œuvres / 17 tomes / 14
possessions / 1 envie inchangés.

**Vérifié** : `typecheck`, `lint`, `check:contrast`, `build`.

### Lot 67 — la colonne SOURCE, écrite une fois

La fiche et l'aperçu d'une œuvre qu'on ne possède pas affichaient la même
colonne SOURCE - **la liste des clés ET son rendu**, recopiés, avec pour seul
lien un commentaire disant « mêmes clés, même ordre que la colonne SOURCE de la
fiche ». C'est le montage exact que le Lot 39 avait déjà vu lâcher sur la
navigation : deux listes gardées synchronisées à la main sont deux listes vouées
à diverger.

`ColonneSource` vit maintenant dans `InspecteurFiche`, avec `RangeeInspecteur`
qu'elle utilise.

**Vérifié en direct sur les deux écrans** : la fiche Naruto rend « malId 11 /
Titre romaji Naruto / Titre japonais NARUTO―ナルト― / Statut source finished /
Nb de tomes source 72 » ; l'aperçu de Vinland Saga, jamais possédée, rend la
même colonne avec ses propres valeurs. `typecheck`, `lint`, `check:contrast`,
`build`.

### Lot 66 — deux écrans de collection, un seul chargement

Ma collection et la vue d'une catégorie posaient les **mêmes quatre requêtes**,
déclaraient les **mêmes quatre constantes de repli**, dérivaient les mêmes
possessions et les mêmes envies, et composaient le même « tout est arrivé ? » -
une trentaine de lignes identiques, recopiées.

Deux copies d'une règle divergent toujours : au Lot 41, un outil de Ma
collection s'est mis à dépendre du filtre d'affichage sans que la vue d'une
catégorie le sache.

`useDonneesCollection` porte les données et leur état de chargement, y compris
la garde du Lot 47 (aucun chiffre tant que tout n'est pas arrivé, sans quoi
l'écran annonce une collection vide à quelqu'un qui en a une). Ce qui reste
propre à chaque écran - filtrage, tri, compteurs, mise en page - y reste : c'est
là qu'ils diffèrent vraiment.

**Vérifié en direct, les deux écrans rendus à l'identique** : Ma collection
« 6 titres suivis · 14 ajouts ce mois », Tout 6 / Possédés 6 / Envies 1, cinq
mangas avec leurs progressions ; la catégorie Manga « 5 », Tout 5 / Possédés 5 /
Envies 1, les mêmes cinq titres. `typecheck`, `lint`, `check:contrast`,
`build`. **-51 lignes** dans les deux écrans.

### Lot 65 — une seule liste d'invalidations

Cinq endroits écrivaient leur propre liste de caches à invalider après un ajout
ou un retrait, et **les cinq différaient**. L'un d'eux portait le commentaire
« ajouté ici pour s'aligner sur `OwnershipDetails`, qui invalident les trois » -
un composant supprimé depuis. S'aligner à la main est une promesse qu'aucun
écran ne peut tenir : au Lot 51, ajouter un tome laissait Ma collection sur
l'ancien décompte, précisément parce qu'une clé manquait à un endroit sur cinq.

`invaliderApresPossession` n'en retient que **trois préfixes**, et ils couvrent
tout : `['entities']` couvre la recherche ET chaque fiche, `['ownerships']`
celles d'une œuvre et la liste complète, `['insights','progress']` la
progression de la collection et celle d'une fiche. Un écran n'a plus à savoir
QUELLES données il touche - seulement qu'il a touché à ce qu'on possède.
Invalider large ne coûte aucun appel de plus : React Query ne re-télécharge que
les requêtes actives, c'est-à-dire ce qui est à l'écran.

#### Le défaut que ça referme

`useWishlist` n'invalidait **que** la liste des envies. Or une envie posée sur un
TOME fait exister ce tome au catalogue (`TomeResolver`, Lot 37) : la fiche et sa
progression changeaient sans que rien ne le dise. `invaliderApresEnvie` ajoute
les deux.

Second défaut, dans la proposition de tomes : les invalidations étaient
conditionnées à `entityId`, alors que l'ajout venait peut-être de **créer**
l'œuvre - auquel cas la progression de toute la collection changeait, sans que
personne ne le signale.

#### Vérifications

Mesuré en direct, sur Raw Hero, par la trace réseau plutôt que par l'œil :
mettre le tome 1 en envies déclenche désormais `/api/entities/{id}` **et**
`/api/insights/progress/{id}` dans la foulée - les deux appels que l'ancien code
ne déclenchait pas. Le serveur crée bien le tome (5 variantes → 6, catalogués
`[1..6]`), et la tuile propose « Retirer » sans rechargement.

État rendu à l'identique après coup : envie retirée, tome 1 supprimé,
9 œuvres / 17 tomes / 14 possessions / 1 envie comme avant.

**Vérifié** : `typecheck`, `lint`, `check:contrast`, `build`.

### Lot 64 — deux clés, deux copies chacune

Une clé recopiée est une divergence en attente.

**L'identité d'une édition** - `(œuvre, nom)`, à la casse et aux espaces près -
existait en double : dans `CollectionProgressService`, qui possède la règle de
progression, et dans `StatsService`, qui s'en était fait une copie au Lot 56
pour valoriser la collection au prix neuf. Deux copies de la clé qui relie une
édition à sa progression, c'est exactement le montage qui a produit les écarts
des Lots 31 et 49. Elle est maintenant publique là où vit le calcul qu'elle
sert, et `StatsService` l'appelle.

**L'identité d'un tome** - `(édition, numéro)` - existait aussi en double :
`MetadataSearchService` dédoublonne des candidats, `MetadataController` compare
un Variant catalogué à ces mêmes candidats pour dire « déjà possédé ». Deux
lectures d'une même égalité, deux copies. Elle vit désormais sur
`VolumeCandidate` lui-même, en statique parce que les deux appelants ne partent
pas du même objet.

**Vérifié** : suite backend complète, 1002 tests, 0 échec.

### Lot 63 — les indices d'une œuvre, extraits une fois

`mangaka`, `malId`, `titleRomaji`, `titleEnglish` : les attributs recopiés du
fournisseur au moment où l'œuvre a été résolue, et qu'on lui redonne pour toute
recherche ultérieure - c'est ce qui distingue « Naruto » de ses huit dérivés
(Lot 59). Trois écrans les ré-extrayaient à la main, **chacun un sous-ensemble
différent** : la recherche de tomes en utilisait quatre, la résolution de titre
français trois, le rattrapage de jaquettes un seul.

`lib/indicesOeuvre.ts` porte la liste. Un détail y est consigné plutôt que laissé
à deviner : l'auteur retenu est `mangaka` SEUL, jamais le `studio` d'un jeu
vidéo - les trois appelants interrogent des fournisseurs de manga, un studio y
serait un indice faux et non un indice de plus. `creatorFrom` reste la fonction
d'affichage, tous types confondus.

**Vérifié** : `typecheck`, `lint`, `build`.

### Lot 62 — une seule façon de lire un tome

Quatre fichiers réécrivaient la même expression pour l'édition d'un tome, et
quatre pour son numéro. Les attributs d'un Variant sont un sac non typé : chaque
lecteur décide donc lui-même ce qu'il accepte - et deux avaient déjà divergé.

**L'écart trouvé** : `AssistantSection` acceptait un numéro de tome écrit en
TEXTE (`typeof raw === 'string' ? Number(raw) : NaN`), là où la grille, le
rattrapage de jaquettes et Ma collection exigent un vrai nombre. Un tome ainsi
saisi aurait été compté dans « où en suis-je dans mes lectures » et **invisible
dans la grille juste au-dessus**. Aujourd'hui les 17 tomes en base portent tous
un numéro numérique, donc rien ne s'est encore vu - c'est exactement le moment
de le refermer.

`lib/attributsTome.ts` porte la règle : `editionDe`, `numeroDe`, et
`variantLabel` qui les utilise. Le numéro se lit `typeof === 'number'` STRICT,
comme partout ailleurs (voir `lib/seriesInfo.totalVolumesFrom` et les
`NUMERIC_KEYS` d'`EntityInfoSection`, qui préservent le type à l'écriture
précisément pour ça).

**Un écart reste, et devient visible** : le rattrapage de jaquettes compare
l'édition d'un tome à celle qu'annonce un fournisseur externe, où « Kana » et
« KANA » désignent la même. Il abaisse donc la casse - mais désormais sur sa
propre ligne, `editionDe(variant).toLowerCase()`, comme un choix, au lieu d'être
noyé dans une copie qui ressemblait aux trois autres.

#### Vérifications

Refactor à comportement constant : ce sont les écrans qui l'attestent, mesurés
après coup sur les données réelles.

- Ma collection, vue groupée : les six titres et leurs progressions inchangés
  (Death Note 3/6, Jujutsu Kaisen 2/30, Raw Hero 4/6, Naruto 3/72).
- Vue **dégroupée**, qui passe par `libelleDeLElement` : « Jujutsu Kaisen ·
  Tome 5 · Ki-oon · Je le veux ». Préférence d'affichage remise dans l'état où
  elle était trouvée.
- Fiche Raw Hero : grille 01→06, 4 possédés, 2 manquants.
- « Où en suis-je dans mes lectures ? » sur Death Note - le code exact modifié
  dans `AssistantSection` : « Tu as lu 1 tome de cette édition : 1 », « Tomes
  possédés sans lecture enregistrée : 2, 5 », « 1 lecture enregistrée sans tome
  précisé ». Conforme aux tomes 1, 2 et 5 possédés.
- L'export, touché au Lot 61 : archive à **10 fichiers CSV** bien formés,
  `edition-upgrade-wishes.csv` disparu, JSON à 10 clés - 9 œuvres, 14
  possessions, 6 éditions, comme la base.

**Vérifié** : `typecheck`, `lint`, `check:contrast`, `build`. Aucun test backend
concerné (changement purement web).

### Lot 61 — les surfaces retirées avaient laissé leurs tuyaux

« Que faut-il consolider ? » Réponse mesurée plutôt que devinée : inventaire des
**99 routes** du backend, croisé avec les **deux** clients - web et iOS, la
leçon du Lot 51 - puis scan des exports sans lecteur, et vérification en base de
ce que contenaient réellement les colonnes concernées.

Les Lots 27 et 53 à 55 ont retiré des écrans. Chaque fois, la fonction cliente
est restée, et derrière elle la route serveur.

#### Six fonctions clientes sans appelant, trois routes sans client

`markSold`, `markLost`, `restoreOwnership`, `updateNote`, `updatePurchasePrice`,
`renumberVariant` : plus personne ne les appelait. Derrière elles, trois routes
n'avaient **plus aucun client, ni web ni iOS** :

- `PATCH /ownerships/{id}/note` - la note d'exemplaire a cédé la place à celle
  de l'ŒUVRE (demande utilisateur du 2026-08-26) ;
- `PATCH /ownerships/{id}/purchase-price` - le prix payé n'entre plus dans
  aucun calcul depuis que la valeur se compte au prix neuf (Lot 56) ;
- `PATCH /entities/{id}/variants/{id}/volume-number` - le renumérotateur est
  parti avec le panneau du tome (Lot 55). `Entity.renumberVariant` suit : une
  méthode de domaine que plus aucune route n'atteint n'est plus un invariant,
  c'est du poids mort. Le recours existe - supprimer le tome et le rajouter - et
  la grille continue d'afficher les numéros hors total pour qu'ils restent
  visibles.

**En base : zéro prix payé, zéro note d'exemplaire** sur 14 possessions. Rien
n'est perdu. Les colonnes, elles, restent : l'export les lit, et
`POST /entities/quick-add` accepte toujours un prix facultatif.

#### Ce qui a été GARDÉ, et pourquoi

`POST /ownerships/{id}/restore` n'a aucun appelant non plus - et reste. Le
client iOS sait marquer « vendu » et « perdu » ; sans cette route, ces deux
gestes seraient des allers simples. **C'est un écran qui manque, pas du code
mort** - exactement la distinction faite au Lot 51 pour les préférences
d'analyse d'achat. La différence n'est pas le nombre d'appelants, c'est
l'existence d'une porte de sortie pour un geste qu'un client peut encore faire.

#### Un domaine entier sans interface

« Envies d'amélioration d'édition » a quitté l'écran au Lot 27. Il en restait :
un contrôleur (4 routes), des DTO, un agrégat, un repository, une entité JPA,
une table, et **un fichier CSV toujours vide dans l'export**. Zéro ligne en base.

Tout est parti, `V22__drop_edition_upgrade_wish.sql` compris - même geste,
mêmes raisons et même garde-fou qu'au `V19` pour les prêts : la migration refuse
bruyamment de s'exécuter si la table n'est pas vide, plutôt que d'effacer en
silence. `V6` n'est pas réécrite : l'histoire des migrations reste fidèle.

À ne pas confondre avec `followed_edition` (Lot 20), bien vivante : « je suis
CETTE édition » n'est pas « je voudrais en changer ». La javadoc de
`FollowedEdition` s'appuyait sur ce contraste pour se définir - elle tient
maintenant debout toute seule.

#### La documentation décrivait une version antérieure de l'app

`docs/USER_JOURNEYS.md` citait **six écrans supprimés** comme s'ils existaient
(`VariantNumberEditor`, `VolumeInteractionPanel`, `OwnershipDetails`,
`AddOwnershipForm`, `WishlistPage`, `EditionUpgradeWishToggle`), plus
`lib/editionGroups.ts`, supprimé la veille au Lot 60. Les parcours 11, 15 et 20
passent en `SUPPRIMÉ` avec la convention déjà établie pour les prêts au §16 ;
les parcours 09, 13, 17 et 51 sont corrigés ; la carte « Où retrouver
l'implémentation » redevient exacte.

C'est le fichier qui répond à « quels écrans existent ». Faux, il coûte plus
qu'il ne rend - un commentaire de `lib/tomeTiles` renvoyait encore le lecteur
vers un composant disparu.

#### Vérifications

Le même inventaire, rejoué après coup : **92 routes**, plus une seule sans trace
côté client (hors `restore`, gardée à dessein).

**Vérifié** : suite backend complète, 1002 tests, 0 échec ; `typecheck`,
`lint`, `check:contrast`, `build`. **-531 lignes.**

### Lot 60 — la fiche cesse de recalculer sa progression

Le dernier des trois calculs de « X tomes possédés sur Y ». Ma collection a
cessé de le refaire au Lot 51 ; la fiche, elle, le refaisait encore, et en trois
morceaux :

1. `groupVariantsByEdition` + `resolveEditionView` regroupaient les tomes par
   édition, avec leur propre règle de fusion ;
2. `ownedVolumeNumbers` relisait les Ownership pour savoir lesquels sont
   possédés ;
3. le résultat repartait au serveur, dans `GET /purchase-analysis/completeness`,
   pour en obtenir un total.

Trois dérivations pour une question à laquelle `CollectionProgressService`
répond déjà - et dont l'absence d'UNE règle (un tome catalogué sans édition
précisée rejoint l'unique édition nommée de la série) a produit deux
divergences réelles, aux Lots 31 et 49.

`lib/editionGroups.ts` disparaît (99 lignes). `variantLabel`, seul rescapé,
rejoint `lib/tomeTiles.ts`.

#### Le seul ajout : la progression d'UNE œuvre

`/insights/progress` les rend toutes ; une fiche n'en veut qu'une.
`GET /insights/progress/{entityId}` appelle le même `compute(entityId)` qui
existait déjà - **la règle ne bouge pas d'un pouce**, seule sa porte d'entrée
est nouvelle. 404 sur une œuvre inconnue : « aucun tome » et « aucune œuvre »
n'appellent pas le même écran.

La clé de cache est `['insights', 'progress', entityId]`, **préfixée à
dessein** : les invalidations existantes (`insights.progress`, posées à cinq
endroits au Lot 51) l'emportent donc aussi, sans avoir à les recenser une
seconde fois.

#### Ce que la complétude garde

Elle ne disparaît pas de la fiche - elle recule au seul endroit qui pose sa
question. « Que me manque-t-il ? » veut les numéros manquants **et leur prix de
marché** ; la progression ne sait que compter. Le partage est donc net : la
progression possède « possédés / catalogués / total », la complétude possède
« ce qui manque et ce que ça coûte ». L'assistant lui passe désormais les
numéros du SERVEUR au lieu des siens.

Au passage, `ReponseAssistant` perd la prop `ownerships` : elle ne servait qu'à
recompter ce que la progression donne déjà.

#### Le piège du « pas encore su »

`groupes` venait d'un calcul synchrone ; il vient maintenant d'une requête. Deux
endroits en dépendaient sans le savoir :

- l'écran affichait la grille dès que l'œuvre était là. Il aurait annoncé
  « aucun tome » à une série qui en a douze, le temps d'un aller-retour. La
  progression fait donc partie de ce qu'on attend (Lot 47) - lancée **en
  parallèle** de la fiche, sans `enabled`, puisqu'elle ne dépend que de
  l'identifiant déjà présent dans l'URL ;
- `usePropositionTomes` s'active quand une série n'a aucun tome. Les Hooks
  tournent AUSSI pendant que la requête est en vol, où `groupes` est encore
  vide : sans garde, chaque ouverture de fiche aurait déclenché une recherche de
  tomes chez les fournisseurs. `progressQuery.isSuccess` autant que le décompte.

#### Vérifications

**Mesuré en direct, écran par écran, avant et après - texte rendu identique au
caractère près** :

- Death Note : « Black Édition / Kana · 6 tomes / 3/6 / Tous 6 · Manquants 3 ·
  Possédés 3 », grille 01→06 avec le tome 3 catalogué non possédé.
- Naruto : « Kana · 72 tomes / 3/72 / Manquants 69 ». C'est aussi le cas de
  FUSION (un tome sans édition précisée, deux en « Kana ») : le serveur rend
  bien `sourceEditions: ["Kana", ""]`, exactement ce que produisait
  `resolveEditionView`.
- Zelda (jeu vidéo) : aucune édition rendue, fiche inchangée.
- « Que me manque-t-il ? » sur Death Note : « Il te manque 3 tomes sur 6 (tu en
  as 3) : 3 à 4, 6 », dont un déjà catalogué, « environ 22.50 € pour
  compléter » - la complétude fonctionne sur les numéros du serveur.

**Vérifié** : suite backend complète, 1027 tests, 0 échec ; `typecheck`, `lint`,
`check:contrast`, `build`.

### Lot 59 — recharger ce que la source sait, en un bouton

« Je veux un bouton pour recharger les images ou les infos api. »

Les attributs d'une œuvre - mangaka, statut, nombre de tomes, jaquette de
série, identifiants externes - étaient recopiés d'un fournisseur **au moment
de l'ajout, et plus jamais**. Une série en cours gardait éternellement le
nombre de tomes qu'elle avait le jour où on l'a ajoutée, et une fiche saisie à
la main n'avait rien du tout. Seules les jaquettes de tomes pouvaient se
rattraper (Lot 57).

**Un seul bouton pour les deux**, « Recharger depuis la source », dans
« Éditer » avec le reste du catalogue : les informations d'abord, les jaquettes
de tomes ensuite. Cet ordre n'est pas cosmétique - si la source nous apprend le
mangaka, la recherche de tomes qui suit s'en sert pour viser juste. Deux boutons
côte à côte pour « recharger » et « recharger aussi » n'auraient aidé personne.

Le bouton est **toujours là**, contrairement à l'ancien qui n'apparaissait qu'en
cas de jaquette manquante : une œuvre dont toutes les images sont en place a
quand même des informations à redemander. Le décompte des jaquettes manquantes
reste annoncé à côté, c'est ce qui se voit à l'œil.

#### Le filtre qui garantissait zéro correspondance

`GET /metadata/search` **écarte les titres déjà présents dans la collection** -
son but est de préparer un AJOUT, pas de proposer deux fois la même œuvre. Sur
une fiche existante, la question est exactement inverse, et le filtre y
garantissait par construction qu'on ne trouverait jamais rien.

Vérifié en direct sur Naruto avant de le corriger : la recherche rendait huit
dérivés - Boruto, les light novels, les films - et **jamais la série
elle-même**. L'écran disait « La source ne connaît pas cette œuvre sous ce
titre », ce qui était la vérité de ce que l'endpoint avait rendu.

`includeOwned=true` lève le filtre, sans toucher au cache (il mémorise les
résultats bruts des fournisseurs, le filtre s'applique après). Côté web, deux
fonctions nommées plutôt qu'un booléen en fin d'appel - `searchMetadata` et
`rechercherOeuvrePossedee` : le filtre décide de ce que la réponse peut
contenir, ce n'est pas un détail de réglage.

#### Deux fonctions pures, parce que ce sont les deux endroits qui écrivent

`rechargerSource.ts` tient hors de React le choix du candidat et le calcul de ce
qu'il faut écrire.

**Le candidat se choisit par IDENTIFIANT d'abord** (`malId`/`igdbId`/`bggId`,
déjà stocké depuis l'ajout), et seulement à défaut par titre exact. Jamais un
« à peu près » : sur Zelda, le premier résultat rendu par IGDB est un *bundle*,
et la recherche Naruto est pleine de dérivés portant le même début de titre.
Sans cette règle, un rechargement recopierait tranquillement les informations
d'un spin-off sur la série mère.

**Ce qui s'écrit est le strict nécessaire** : les clés que la source renseigne
vraiment, et seulement quand leur valeur diffère de celle en base - le décompte
affiché doit pouvoir dire « tout est déjà à jour » sans mentir. Deux exclusions :
les remarques de l'utilisateur, qui ne viennent d'aucune source ; et la jaquette
de la série, **posée seulement si elle manque** - elle se choisit à la main sur
la fiche, et un rechargement n'a pas à défaire ce choix.

#### Quatre issues, quatre phrases

Héritage direct du Lot 58 : la source n'a pas répondu (réessayer), elle a
répondu mais ne connaît pas cette œuvre (rien à attendre d'un second clic), elle
a répondu et tout était déjà à jour, ou quelque chose a changé. Les confondre
sous un « rien trouvé » était exactement le défaut corrigé la veille.

#### Vérifications

**Mesuré en direct**, sur les données réelles et rendues à l'identique :

1. Naruto, tout déjà à jour → aucune écriture, attributs inchangés au caractère
   près.
2. `totalVolumes` abaissé à 71 et `mangaka` remplacé par « Inconnu » à la main,
   puis clic → « 2 informations mises à jour. », les deux valeurs justes
   revenues. La vérification se répare elle-même.
3. Zelda (IGDB) sans rien écrire : le bon candidat (`igdbId` 7346) est en 4e
   position, derrière un bundle et deux dérivés - l'identifiant le retrouve là
   où le titre aurait pris le premier venu.

**Vérifié** : suite backend complète, 1024 tests, 0 échec ; `typecheck`,
`lint`, `check:contrast`, `build`.

### Lot 58 — une source muette n'est pas une absence

Épreuve du bouton du Lot 57, sur Naruto. Il annonçait « Retrouver 1 jaquette »,
et après le clic : « Aucune trouvée cette fois. » Le journal de l'API disait
autre chose - trois `Google Books a répondu 503` pendant ce clic - et un appel
direct à `/api/metadata/volumes` rendait **59 tomes, le 30 compris**. La
jaquette manquante existe chez le fournisseur ; c'est l'écran qui a conclu à sa
place.

**Même défaut que le Lot 50, un cran plus bas.** Là-bas, un scan sans réponse
disait « Rien trouvé » ; ici, une recherche de tomes sans réponse dit « aucun
tome ». La cause est commune : un vide qui ne distingue pas « la source a
répondu, il n'y a rien » de « la source n'a rien dit ».

#### Le chemin exact

`GoogleBooksHttpClient.get` rendait `null` sur tout statut autre que 200/429 ;
`GoogleBooksVolumeSearchProvider` traduisait ce `null` en liste vide ;
`MetadataSearchService` ne reconnaissait comme transitoire que
`QuotaExceededException`. Un 503 traversait donc les trois étages déguisé en
« cette série n'a aucune édition française ».

Et le pire n'était pas le message : cette liste vide était **mise en cache
durablement** (`volume_search_cache`, où un vide légitime EST mémorisé, voir
Lot 35). Une panne de quelques minutes condamnait la recherche pour de bon - le
bouton serait resté impuissant même une fois Google Books rétabli.

#### Ce qui change

`GoogleBooksHttpClient.get` ne rend plus jamais `null` : il **lève**
`SourceUnavailableException` (nouvelle, sœur de `QuotaExceededException`) sur un
statut inattendu, un délai dépassé ou une coupure réseau. L'appelant ne peut
plus confondre les deux cas, parce que le type ne le permet plus.

En amont, `searchVolumes` agrège les sources muettes comme il agrégeait déjà les
quotas, et ne relève l'échec que si le résultat final est vide - un mot-clé en
panne sur huit ne condamne pas les sept autres. `MetadataSearchService` traite
les deux exceptions ensemble : rien n'est mis en cache, et le drapeau remonte au
client.

**Un seul drapeau pour les deux causes**, renommé `providerUnavailable` côté
serveur : quota dépassé et source muette appellent la même conduite (ne rien
mémoriser, réessayer plus tard) - les distinguer n'aurait ajouté qu'un mot dans
un message. Le champ JSON garde son nom `quotaExceeded` : le client iOS le
décode tel quel (`APIClient+Collections.swift`), et le renommer aurait cassé sa
lecture pour un gain cosmétique.

Côté écran, trois messages cessent d'accuser le quota d'une panne qui n'est pas
la sienne : « Le fournisseur n'a pas répondu - réessaie plus tard. »

#### Les trois autres appelants, vérifiés avant de changer le contrat

Changer un `return null` en `throw` touche tout le monde. Les trois autres
fournisseurs Google Books (code-barres, titre français, recherche par titre)
enveloppaient déjà leur appel dans un `catch (Exception)` : leur comportement est
identique à la ligne près, seul le test `body == null` devenu mort a été retiré.
Le lookup par code-barres, lui, y gagne - une 503 y produit désormais
`BarcodeLookup.unavailable()`, exactement le chemin construit au Lot 50.

#### Vérifications

Trois tests de non-régression, dont deux confrontés à l'ancien code : le service
qui n'attrape que le quota laisse échapper l'exception (`SourceUnavailable 503`
au lieu d'un drapeau), et le client qui rend `null` ne lève rien. Le troisième
vérifie qu'une deuxième recherche rappelle bien le fournisseur au lieu d'être
servie par un vide mémorisé.

**Vérifié** : suite backend complète, 1023 tests, 0 échec ; `typecheck`,
`lint`, `check:contrast`, `build`.

### Lot 57 — recharger les jaquettes quand on en a besoin

« Il faudrait pouvoir recharger quand on a besoin. » Le rattrapage existait,
mais uniquement sur TOUTE la collection et rangé dans « Plus d'outils ». Or
c'est sur une fiche qu'on constate le manque - après un ajout d'un clic, ou
après une panne de quota chez le fournisseur.

La fiche gagne donc « Retrouver N jaquettes » dans l'espace « Éditer » - la
jaquette d'un tome est une donnée de catalogue. Le bouton n'apparaît que s'il
y a vraiment quelque chose à retrouver, et annonce combien.

**Une seule implémentation, deux appelants** : le travail d'UNE série -
appariement, seconde tentative, lecture du quota - vivait dans la boucle de Ma
collection. Extrait en `rattraperJaquettes` ; Ma collection le déroule sur la
bibliothèque, la fiche l'appelle pour la série regardée. Deux copies auraient
fini par diverger, comme les deux listes de navigation du Lot 39.

La seconde recherche (celle qui force le rafraîchissement du cache, donc un
vrai appel au fournisseur) reste conditionnelle : la faire d'emblée gaspillerait
le quota sur les séries que le cache servait déjà.

#### Le bloc emportait sa propre confirmation

Premier essai : j'ai cliqué, les deux jaquettes ont bien été retrouvées en base
- et **rien ne s'est affiché**. Le message vivait dans le bloc conditionné par
« il reste des jaquettes à trouver » : au succès ce compte tombe à zéro, le
bloc disparaît, et la confirmation avec lui. On cliquait, tout s'évanouissait,
sans un mot. Le bloc reste maintenant tant qu'il y a un résultat à annoncer.

#### Vérifications

`typecheck`, `lint`, `check:contrast`, `build`. En direct : sur Death Note, les
deux tomes sans image (ajoutés d'un clic) ont été retrouvés - vérifié en base ;
sur Chainsaw Man, « 1 retrouvée. » s'affiche bien. Plus une seule variante sans
jaquette dans toute la base.

### Lot 56 — la valeur de la collection se compte au prix NEUF

« La valeur de collection sera calculée par rapport à la valeur neuf, pas la
valeur qu'on l'a acheté. »

Ce total sommait les prix d'ACHAT des possessions. Deux raisons de changer :
ce que vaut une collection ne dépend pas de ce qu'elle a coûté - un tome trouvé
d'occasion à 2 € vaut ce que vaut ce tome - et depuis le Lot 53 plus aucune
surface ne saisit de prix d'achat : l'écran n'avait plus **aucune** source.

Le prix neuf vit sur l'ÉDITION (`MangaEdition.retailPriceNewPerVolume`), se
renseigne depuis l'écran Éditions, et se multiplie par le nombre de tomes
possédés de cette édition. Le comptage passe par `CollectionProgressService` -
source unique de la progression - plutôt que par les Ownership une à une : les
tomes catalogués sans édition précisée rejoignent ainsi leur édition, comme
partout ailleurs (voir Lots 49 et 51, où refaire ce calcul de son côté avait
déjà mal tourné deux fois).

Un type sans source de prix neuf - jeu vidéo, jeu de société - compte dans le
total des possessions et jamais dans la valeur connue. La couverture reste
affichée : « prix neuf connu sur X/Y ».

**Mesuré en direct après redéploiement** : 44,70 € sur 3/13 - les trois tomes de
Death Note à 14,90 € l'unité - contre 0,00 € auparavant, faute de prix d'achat.

#### Un tome ajouté d'un clic naissait sans jaquette

Signalé dans la foulée : « sur Death Note il manque des jaquettes ».
`quickAdd` n'enregistre une image que si l'appelant lui en donne. Un tome venu
d'une proposition en avait une ; un tome ajouté d'un clic sur la grille, non -
et le Lot 55 venait de retirer l'éditeur de jaquette du tome avec le panneau.

L'ajout va donc la chercher lui-même, avec le même appariement que le
rattrapage groupé de Ma collection (`findBestCoverMatch`, jamais un nouvel
algorithme). Best-effort assumé : quota dépassé, fournisseur muet ou aucune
correspondance laissent le tome sans image - jamais une erreur à l'écran pour
un ajout qui, lui, a réussi.

`findBestCoverMatch` ne prend plus un `VariantDto` complet mais ses seuls
attributs : un tome qu'on vient de créer n'a pas d'objet complet à offrir, et
n'a pas à en fabriquer un faux à coups de `as`.

#### Vérifications

Suite backend complète : **1020 tests**, 0 échec. Le test de la valeur décrit
la nouvelle règle et pose un prix d'achat volontairement absurde (2 € sur un
tome à 14,90 €) pour vérifier qu'il n'entre dans aucun total. `typecheck`,
`lint`, `check:contrast`, `build`.

### Lot 55 — le panneau du tome disparaît, la note remonte au groupe

Décision utilisateur : « je veux plus voir de prix payé, vendu, perdu, on garde
juste les notes (associé au groupe) et le possédé ou envie ».

**Un tome n'a plus que trois états et deux gestes.** Cliquer une tuile la fait
entrer dans la collection ou en sortir ; le menu au survol garde « Je l'ai » et
« Je le veux ». Plus aucune surface intermédiaire.

**Ce qui part** : `VolumeInteractionPanel`, `OwnershipDetails`,
`VariantNumberEditor` et l'éditeur de jaquette du tome - donc le prix payé, la
note d'exemplaire, « marquer vendu », « marquer perdu », « supprimer cet
exemplaire », les exemplaires passés, et les deux corrections catalogue du
tome. **Vérifié avant de supprimer** : zéro note, zéro prix et zéro exemplaire
vendu ou perdu en base - rien de réel n'est perdu.

Sortir un tome de la collection SUPPRIME son Ownership au lieu de la marquer
vendue : « vendu » et « perdu » sont partis, il ne reste donc qu'un sens à ce
geste - je ne l'ai plus.

**Ce qui reste** : la note, mais portée par le GROUPE. Elle vivait sur chaque
exemplaire, alors que ce qu'on écrit d'une série n'a presque jamais trait à un
exemplaire précis. Elle apparaît en « Mes remarques » dans la colonne
Personnel, à côté du classement, de la note et des tags - au même endroit et
avec le même geste que les autres relevés (voir Lot 42). Stockée dans les
attributs de l'Entity : pas de migration pour un texte libre.

#### Conséquence à connaître

Plus aucune surface ne SAISIT de prix d'achat (le lot 53 avait déjà retiré les
champs, celui-ci retire le dernier). « Valeur de la collection », sur
Statistiques, ne pourra donc plus afficher que **0,00 €** - elle le dit
honnêtement (« prix connu sur 0/12 possessions »), mais c'est un écran devenu
inerte. `StatsService` et l'export CSV lisent toujours la colonne, qui reste en
base. À trancher à part : retirer l'écran, ou lui rendre une source.

#### Vérifications

`typecheck`, `lint`, `check:contrast`, `build`. En direct sur Death Note : clic
sur un tome possédé → il repasse manquant, **aucun panneau** ; re-clic → il
revient possédé. « Mes remarques » s'ouvre parmi les cinq relevés personnels,
et le texte saisi se retrouve bien dans `entity.attributes.note`. Remarque
d'essai retirée, base revenue à l'identique.

### Lot 54 — le panneau du tome quitte le chemin d'ajout

« Retire le sidepanel du coup ». Le « du coup » désigne le lot précédent : ce
panneau n'existait sur un tome MANQUANT que pour porter le formulaire d'état et
de prix. Ce formulaire a disparu, donc la surface aussi.

**Un tome manquant s'ajoute d'un clic** - le clic sur la tuile comme
« Je l'ai » du menu font maintenant la même chose, sans détour. `quickAdd`
retrouve ou crée le tome par (titre, numéro, édition), comme partout ailleurs.
`AddOwnershipForm` est supprimé.

**Le panneau survit sur un tome POSSÉDÉ**, et je le laisse : il y gère un
exemplaire réel - prix payé, note, marquer vendu, marquer perdu, supprimer,
exemplaires passés - plus les corrections catalogue du tome (jaquette, numéro).
Le retirer là aussi supprimerait ces sept actions sans leur donner de nouveau
domicile ; c'est une décision à part, pas une conséquence du clic unique.

#### Deux fausses alertes de ma sonde

`« Tome 3, dans mes envies »` est apparu pendant l'essai : une envie créée par
un de mes propres clics, pas un défaut. Supprimée.

Et le panneau d'un tome possédé semblait avoir perdu la gestion de
l'exemplaire : mon relevé ne listait que les boutons **nommés**, or ces sept
actions vivent derrière un bouton « … » sans texte. Ouvrir le menu les montre
toutes. Relever le `innerText` du conteneur avant de conclure à une disparition.

#### Vérifications

`typecheck`, `lint`, `check:contrast`, `build`. En direct : clic sur le tome 4
de Death Note → ajouté, **aucun panneau** ; clic sur le tome 1 (possédé) →
panneau, et son menu rend bien les sept actions. Données d'essai retirées
(possession, tome catalogué au passage, et l'envie), base revenue à l'identique.

### Lot 53 — ajouter tient en un clic

« Lorsque j'ajoute un item à ma collection je veux pas de "neuf / abîmé, etc"
ou de prix, je veux juste l'ajouter en un clic sans rien d'autre. »

Cinq surfaces demandaient l'état et le prix **avant** de laisser ajouter :
l'ajout direct d'une œuvre sans tome, la barre de sélection de tomes, le
panneau d'un tome, l'ajout manuel, et le scan (qui posait la question tout en
haut, avant même d'avoir scanné quoi que ce soit). Toutes passent à un bouton.

**Ce qui NE change pas** : `OwnershipDetails`, où l'on corrige un exemplaire
existant - c'est là que l'état et le prix décrivent quelque chose de réel,
plutôt qu'un formulaire à remplir d'avance ; et l'analyse d'annonce, dont
l'« état déclaré » est celui du VENDEUR, pas un ajout à la collection.

**La valeur stockée reste `NEW`.** `ownership.condition` est NOT NULL et
l'énumération n'a que NEW / USED / DAMAGED : il n'existe pas de « non
renseigné ». `NEW` était déjà la valeur pré-sélectionnée de tous ces
formulaires, donc rien ne change en base - on cesse simplement de poser la
question. Rendre la colonne nullable aurait touché le moteur d'analyse,
l'export et le domaine entier pour une question de formulaire : hors de
proportion.

#### Vérifications

`typecheck`, `lint`, `check:contrast`, `build`. En direct sur les cinq
surfaces : plus une seule mention de « Neuf / Occasion / Abîmé » ni de « Prix
d'achat ». Chaîne complète depuis le panneau d'un tome - un clic, tome 3 de
Death Note passe à « possédé », et la possession créée porte bien
`condition=NEW`, `purchasePrice=null`. Retirée ensuite, base revenue à
l'identique.

### Lot 52 — un jeu ne pouvait pas être ajouté

Épreuve demandée par l'utilisateur : « tester l'ajout des jeux de société » -
le type où l'œuvre EST l'objet collectionnable, donc celui qui exerce toutes
les branches « sans variante ». Deux défauts, dont un bloquant.

#### 1. La recherche BGG enterrait le jeu cherché

« Carcassonne » rendait **144 résultats** dans l'ordre de BGG - alphabétique -
ouverts par treize extensions amateurs (« Am Pranger », « Angler &
Fischfarm »…), le jeu lui-même en **quatorzième** position. Le fournisseur
manga plafonnait déjà à dix (`limit=10` demandé à Jikan) ; BGG ne triait ni ne
plafonnait rien.

Quatre rangs, l'ordre de BGG conservé dans chacun : titre exact, titre qui
COMMENCE par la recherche, titre qui la contient, le reste. Accents ignorés.
Dix résultats. Pas de score continu - il serait plus dur à expliquer qu'à
calculer. **Vérifié en direct : Carcassonne en premier, dix lignes.**

Une assertion de mon test a d'ailleurs échoué à juste titre : j'attendais que
« New Carcassonne » passe devant une extension amateur. Les deux sont au rang
« contient », donc l'ordre de BGG les départage. Les distinguer demanderait de
deviner ce qu'est une extension - ce dépôt ne devine pas. C'est l'assertion qui
était fausse, pas le classement.

#### 2. Une œuvre sans tome était impossible à ajouter

Plus grave. L'aperçu d'un jeu affichait :

> « coche les **tomes** que tu possèdes » · « Aucun **tome** trouvé » · un seul
> bouton, « **Ajouter un tome** à la main »

Vocabulaire manga devant un objet qui n'a pas de tome - et **aucun chemin
d'ajout** : le seul bouton en créait un. Confirmé sur Carcassonne (jeu de
société) ET Hollow Knight (jeu vidéo) : ce n'était pas propre à BGG, c'était
tout type sans variante. Même famille que le défaut du Lot 36 (« l'assistant
parlait manga devant un jeu vidéo »), corrigé là et pas ici.

`usePropositionTomes` reconnaît désormais ces types (`lib/typeDeCollection`) et
rend un ajout DIRECT : état, prix, « Ajouter à ma collection » - sans grille,
sans édition, et sans interroger un fournisseur de tomes pour une œuvre qui
n'en a pas. La phrase d'accueil de l'aperçu suit.

`AjoutDirect` est un bloc à part de `BarreAjoutTomes` à dessein : celle-là
accompagne une sélection et n'apparaît qu'une fois des tomes cochés ; ici il
n'y a rien à cocher, donc rien à attendre - le bouton est là dès l'arrivée.

#### 3. « Aucun tome connu » sur un jeu vidéo

Trouvé en enchaînant sur l'ajout d'un jeu vidéo, comme demandé. La recherche
IGDB classe bien - « Hollow Knight » sort premier - mais le résultat portait le
badge « **Aucun tome connu — à saisir à la main** ».

Ce signal vient du Lot 35 : il prévient qu'une série manga n'a aucun tome
indexable. Sur un jeu, il se lit comme un manque alors que l'œuvre EST l'objet.
La requête qui l'alimente n'était gardée par aucun test de type ; elle l'est
maintenant - ce qui évite au passage un appel qui ne pouvait rien rendre.

#### Vérifications

Suite backend complète : **1020 tests**, 0 échec (trois ajoutés sur le
classement BGG). `typecheck`, `lint`, `check:contrast`, `build`.

Chaîne complète en direct, sur les DEUX types sans tome. Jeu de société :
recherche « Carcassonne » → aperçu sans une seule
mention de « tome » → « Ajouter à ma collection » → fiche créée → Ma
collection ouvre une section « Jeu de société · Carcassonne · Possédé »,
groupée comme dégroupée, compteurs passés à 7. Jeu vidéo : « Hollow Knight »
ajouté en « Occasion » à 12,50 € - vérifié en base, l'Ownership porte bien
`condition=USED`, `purchasePrice=12.5` et **aucun variantId** (elle se rattache
à l'Entity), avec les attributs recopiés d'IGDB (plateforme, jaquette, igdbId).
Les deux jeux supprimés ensuite, base revenue à l'identique (9 œuvres, 14
tomes, 12 possessions, 6 éditions).

### Lot 51 — les endpoints sans appelant, traités

Reprise de la dette signalée au Lot 36. **Première correction : ils étaient
trois, pas quatre.**

`GET /wishlist/lookup` **a un appelant** - le client **iOS**, suivi par git,
l'appelle dans `APIClient.swift`. L'audit du Lot 36 n'avait balayé que
`web/src`. Conservé tel quel. Leçon : ce dépôt a deux clients, un balayage
d'appelants qui n'en regarde qu'un déclare mort du code vivant.

`GET` et `PATCH /purchase-analysis/preferences` : ce n'est **pas du code mort**.
Le moteur de scoring lit `service.preferences()` à chaque analyse ; il manque
seulement l'écran pour les éditer. Conservés - c'est un écran non construit,
pas une dette à supprimer.

#### `GET /insights/progress` : branché, et il enlève une duplication

Son résumé dit « source unique, à consommer plutôt qu'à recalculer » - et Ma
collection recalculait. Elle dérivait sa progression d'un référentiel
d'éditions (`indexEditionTotals`) et d'un `singleNamedEdition` maison, avec une
règle en moins : un tome catalogué SANS édition précisée ne rejoignait pas
l'unique édition nommée de la série.

C'est exactement la règle dont l'absence a produit les deux divergences déjà
consignées : une série annoncée 2/72 ici et 3/72 là (Lot 31), puis une analyse
d'achat conseillant de racheter un tome possédé (Lot 49). Trois calculs pour
une seule question ; il n'en reste qu'un.

`shelfTiles` perd `indexEditionTotals`, `editionTotalFor`, `singleNamedEdition`
et `editionTotalKey`, et `buildShelfTile` n'a plus besoin de `owned` - le
décompte ne se dérive plus des variantes.

**Piège évité** : la progression étant désormais une requête à elle, ajouter un
tome ne l'invalidait plus. Sans ça, Ma collection aurait gardé l'ancien
décompte après un ajout. `queryKeys.insights.progress` est invalidée partout où
une possession change - formulaire du tome, ajout manuel, détails d'un
exemplaire, proposition de tomes, scan.

#### Vérifications

`typecheck`, `lint`, `check:contrast`, `build`. En direct, mêmes valeurs
qu'avant le branchement (Naruto 3/72, Death Note 2/6, Raw Hero « Plus que 2
tomes », Zelda « Possédé »), puis chaîne complète : ajout du tome 3 de Death
Note depuis la fiche → Ma collection passe de **2/6 à 3/6 sans rechargement**.
Ajout retiré ensuite, base revenue à l'identique (9 œuvres, 14 tomes, 12
possessions, 6 éditions, 0 envie).

### Lot 50 — « rien trouvé » quand une source était en panne

Épreuve du parcours Scan. La caméra est honnêtement déclarée non supportée ici,
avec la saisie ISBN en repli - rien à redire. Mais quatre ISBN ont rendu
« Rien trouvé » alors que **Google Books limitait le débit** (429 depuis l'hôte
comme depuis le conteneur, 503 dans le journal de l'API) et qu'Open Library ne
connaît pas ces codes.

Le service faisait déjà la différence - `BarcodeLookup.conclusive()` dit si
chaque base a répondu, et une panne n'est jamais mise en cache - mais il la
gardait pour lui : le contrôleur rendait un 404 plat. Désormais **404** quand
les bases ont répondu et ne connaissent pas le code, **503** quand l'une n'a pas
répondu. L'écran dit alors « Une source n'a pas répondu pour … - réessaie » au
lieu de « Rien trouvé » : le geste utile n'est pas le même (réessayer, contre
chercher par titre).

À noter : la formulation vague était un choix DÉLIBÉRÉ, déjà commenté dans
ScanPage (« un scan sans résultat n'est pas forcément une absence »). Ce lot ne
le corrige pas, il le précise : l'information existait, elle n'était pas
transmise.

#### Le test qui a cassé avait raison

`MetadataHttpContractTest` est passé au rouge : 503 là où il attendait 404. Le
défaut de `BarcodeMetadataProvider.lookupDetailed` est **prudent à dessein** -
un fournisseur qui ne sait pas distinguer ne conclut rien d'un vide, pour que
rien ne soit mis en cache. Mon changement transformait cette prudence interne en
un « source indisponible » annoncé à l'utilisateur.

Les deux vrais fournisseurs (Google Books, Open Library) redéfinissent
`lookupDetailed` ; seul le double de test s'appuyait sur le défaut. C'est donc
le DOUBLE qui était sous-spécifié : il sait maintenant dire « absent » et
« indisponible » comme les vrais, et le test gagne une assertion sur le cas
panne. Le corriger en assouplissant l'assertion aurait été l'erreur inverse.

**Vérifié** : suite backend complète, 1017 tests, 0 échec ; `typecheck`, `lint`,
`check:contrast`, `build`.

### Lot 49 — l'analyse d'un lot conseillait de racheter ce qu'on a déjà

Épreuve du parcours « Analyser une annonce » (§12 de l'étude), la seule entrée
de navigation que rien n'avait touchée depuis sa promotion au premier plan.

#### Ce qui tient

Le modèle du §12 est en place : le lien est explicitement facultatif, les
photos ont leur propre chemin (« IozyCore y lit les séries et les tomes, puis
vous confirmez »), et **l'édition est déduite du catalogue sans jamais être
demandée** - taper « Naruto » + « 1-5 » suffit à remplir « Naruto · Kana · 5
tomes ». Le panneau « Éléments détectés » groupe par série parce que l'édition
est une propriété de la série. Et l'incertitude est assumée, comme l'exige la
règle 7 : « Référence insuffisante », « Livraison non incluse : ce total est
incomplet », « Confiance Haute · basée sur 8/10 critères disponibles ».

#### Ce qui ne tenait pas

L'analyse a répondu « 5 éléments · **5 manquants** » sur un lot Naruto 1-5,
alors que le tome 1 est possédé - la fiche l'affiche comme tel dans l'édition
Kana, et Ma collection compte 3/72. L'écran conseillait donc de **racheter un
tome déjà en rayon**, l'inverse de ce à quoi il sert.

Cause : `findOwnedVolumeNumbers` exigeait que l'attribut `edition` du tome
corresponde EXACTEMENT. Un tome catalogué sans édition précisée - ce que laisse
tout ajout ancien - n'appartenait alors à aucune édition. Partout ailleurs il
rejoint l'unique édition nommée de la série.

**Le plus instructif** : ce défaut est déjà décrit dans ce fichier même. Un
commentaire quarante lignes plus haut explique qu'au Lot 31 les suggestions ont
été rebranchées sur `CollectionProgressService` parce qu'elles « ignoraient les
tomes sans édition précisée, d'où une série annoncée 2/72 ici et 3/72 sur Ma
collection ». Corrigé pour une méthode, pas pour sa voisine. Quand on rebranche
un calcul sur une source unique, chercher **tous** ses jumeaux dans le fichier.

#### Vérifications

Suite backend complète : **1017 tests**, 0 échec. Le test ajouté a été confronté
à l'ancien code avant d'être gardé - **rouge sans le correctif, vert avec** :
un test qui passerait dans les deux cas ne protégerait rien.

Donnée de test nettoyée : l'analyse créée pour l'épreuve a été supprimée via
`DELETE /purchase-analysis/history/{id}`, l'historique est revenu à 9.

### Lot 48 — revenir à la recherche la retrouve

« Quand je retourne sur la recherche depuis les détails je perds le résultat et
ma recherche précédente. »

Le type et le titre cherchés vivaient dans un `useState` : un état local meurt
avec le composant, donc revenir rendait une page vierge. Ils vivent désormais
dans l'URL - `/add?type=…&q=Naruto` - ce qui les fait survivre à l'aller-retour,
au F5 **et** au partage. C'est la règle que ce dépôt s'était donnée au Lot 31
(« quand un écran mérite d'être revu ou envoyé, lui donner une vraie URL »),
simplement pas encore appliquée ici.

**La frappe reste locale** : l'URL ne suit qu'après la même temporisation que la
requête, et en `replace`. Sans ça, chaque lettre laisserait une entrée
d'historique et le bouton Précédent remonterait le mot caractère par caractère.

**Le lien de retour porte l'URL complète**, `search` compris - une constante
`/add` ramenait bien à l'écran, mais vidé de ce qu'on y avait tapé. Il voyage
aussi jusqu'à l'aperçu, qui le relaie à la fiche après un ajout : les trois
chemins (résultat local → fiche, candidat externe → aperçu, aperçu → fiche
créée) rendent la même recherche. `retourDepuis` valide déjà la forme du lien
et refuse une URL absolue : une chaîne de requête ne change rien à ce garde.

**Vérifié** sur les trois chemins, plus le bouton Précédent du navigateur :
`/add?type=…&q=Naruto`, champ « Naruto » et résultats retrouvés.

**Piège de mesure** : ma première sonde cherchait un lien contenant
« Recherche » et tombait sur « **Recherche**r », l'entrée de NAVIGATION - qui
pointe légitimement vers `/add` nu. J'ai failli conclure à une régression sur
l'aperçu alors que son lien était juste. Filtrer sur `closest('nav, header')`
avant de mesurer un lien de page.

### Lot 47 — ne rien affirmer tant que l'appel n'a pas répondu

« Il faut revoir le chargement des données pour ne pas afficher "pas de
données" alors que l'appel API est toujours en cours. »

**Reproduit en gelant l'API** (`docker pause` sur le conteneur, puis
`unpause`) : Ma collection annonçait « **0 possédé ou voulu** » et des filtres
à **0 / 0 / 0**, pendant que « Chargement... » s'affichait juste en dessous.
Deux messages contradictoires à l'écran, dont l'un ment.

La cause est un `data ?? []` : un décompte calculé sur un tableau vide vaut
zéro, et rien ne distingue « je n'ai rien » de « je ne sais pas encore ».

**Balayage** : les cartes d'état vide, elles, étaient déjà correctement gardées
partout (`query.isSuccess && liste.length === 0` — Opportunités, Éditions,
Types, Historique d'analyses ; `stillLoading` sur l'aperçu Tier Lists ;
`proposes.enCours` sur la proposition de tomes). Ce qui fuyait, ce sont les
CHIFFRES dérivés, sur Ma collection et la vue d'une catégorie.

Correctif : un seul prédicat `donneesPretes` par écran, vrai quand **tout** ce
dont un chiffre dépend est arrivé - œuvres, possessions, envies **et le
référentiel d'éditions**, qui décide de la complétude donc du filtre
Complètes/Incomplètes. Tant qu'il est faux, le sous-titre dit « Chargement... »
sur la même ligne (rien ne saute quand le vrai décompte arrive) et les
compteurs de filtre n'affichent **aucun** nombre : un chiffre absent se lit
« pas encore su », un zéro se lit comme un fait.

#### Un compteur doit compter ce qu'il montre

Défatut voisin, trouvé en vérifiant le premier : en vue dégroupée, le filtre
annonçait « Possédés 6 » au-dessus de **douze** tuiles. Il comptait toujours
les groupes, quelle que soit la vue - et il ignorait aussi le filtre d'état.
Il emprunte désormais le MÊME chemin que l'affichage (`retenuesPour` puis, en
vue dégroupée, `aplatirEnElements`), si bien qu'il ne peut plus le contredire.

**Vérifié** : API gelée → « Chargement... », filtres sans nombre, aucun « 0 » ;
API rendue → groupée 6/6 pour 6 tuiles, dégroupée 12/12 pour 12 tuiles.

### Lot 46 — la barre de défilement des rangées

« Le scroll horizontal est moche ». La barre native de Windows est épaisse (15
px mesurés), opaque et toujours visible : posée sous chaque rangée d'univers,
elle attirait l'œil plus que les jaquettes qu'elle sert. Le défaut existait
avant, mais dégrouper l'a rendu criant - une rangée de cinq séries ne défilait
pas, une rangée de onze tomes si.

Un utilitaire `defilement-discret` (dans `index.css`, avec les autres règles de
base) la réduit à un filet de **10 px** aux tons de l'interface, qui suit le
thème clair/sombre comme le reste. `scrollbar-width`/`scrollbar-color` pour
Firefox, `::-webkit-scrollbar` pour Chrome/Safari : les deux syntaxes coexistent
sans se gêner, et un navigateur qui n'en comprend aucune garde sa barre
d'origine.

**Jamais `display: none`** : une barre invisible ôte le seul indice qu'il reste
du contenu à droite. Une rangée qui ne défile pas n'en affiche déjà aucune
(mesuré : 0 px perdu sur la rangée à une tuile), et au doigt la barre est en
surimpression, donc sans coût de place.

Appliqué aux quatre zones qui défilent latéralement, pas seulement aux rangées :
Ma collection, les onglets de Découvrir en dessous de 1100 px, les vignettes
d'une annonce et la frise des Statistiques.

### Lot 45 — dégrouper déliait aussi les TYPES

« On voit plus que les mangas quand on dégroupe ». Reproduit : le jeu vidéo
était bel et bien là, en **quatrième position sur douze**. Ce n'est donc pas un
filtrage qui l'écartait - c'est la structure qui manquait. Onze tuiles de manga
et une de jeu, jetées dans une grille unique : le type peu fourni se noie.

La page promet **une section par catégorie** depuis le Lot 3, et dégrouper ne
doit pas revenir dessus. Ce qui change en dégroupant, c'est le CONTENU d'une
section - des éléments au lieu de groupes - pas son existence. L'ordre des
types est désormais partagé par les deux vues (`trierTypes`, extrait de
`groupByEntityType`) : basculer d'une vue à l'autre ne rebat pas les univers.

Conséquence heureuse : le badge de type disparaît des tuiles. Il valait quand
tout était mélangé ; répété sur les onze tuiles d'une rangée qui l'annonce
déjà, il n'apprend plus rien.

**Deuxième passe** : j'avais donné à la vue dégroupée sa PROPRE mise en forme -
en-tête sobre, grille dense de petites tuiles. « Il faut garder le même
affichage que la vue groupe en fait », et c'est plus juste : ce que dégrouper
change, c'est le CONTENU d'une rangée, pas sa présentation. Les deux vues
passent donc par le même `CategorySection` - même halo teinté par univers,
même en-tête cliquable avec « Tout voir », même défilement horizontal - et le
composant séparé `GrilleElements` disparaît. Une seconde mise en forme n'aurait
fait que dériver de la première. Même principe sur la vue d'une catégorie, qui
garde sa grille pleine dans les deux vues.

**Vérifié** à 1280 et 375 px : groupée → Manga 5 · Jeu vidéo 1 ; dégroupée →
Manga 11 · Jeu vidéo 1 ; halo, « Tout voir » et format de tuile identiques dans
les deux vues ; zéro badge de type ; vue catégorie à 11 tuiles dans sa grille
habituelle ; aucun débordement.

**Piège de mesure** : ma première sonde a capturé DEUX FOIS le même état - elle
cliquait « Dégrouper » alors que la vue était déjà dégroupée par une
préférence mémorisée, le bouton disait donc « Grouper » et rien ne bougeait.
Depuis qu'un réglage est persisté, une sonde doit POSER l'état qu'elle mesure,
jamais supposer celui de départ.

### Lot 44 — « Grouper / Dégrouper », parce que le tome est un mot de manga

Remarque de l'utilisateur : « faut pas "grouper par tome", c'est trop
spécifique aux mangas [...] il peut y avoir des groupes pour chaque type de
collection ». La bascule disait « Voir les tomes » / « Regrouper » et
supposait donc que tout groupe contienne des tomes.

Elle dit maintenant **« Dégrouper » / « Grouper »**, et le nom accessible suit
(« Dégrouper : afficher les éléments un par un »). Le décompte de la vue
dégroupée perd son nom d'objet plutôt que d'en inventer un : « 12 possédés »
et non « 12 tomes possédés » ni « 12 éléments possédés », qui sonne comme un
mot de développeur. Le contraste avec « 6 titres possédés » de la vue groupée
dit déjà ce qu'on compte.

Le code suit, sans quoi la supposition serait revenue à la première retouche :
`aplatirEnTomes` → `aplatirEnElements`, `TuileTome` → `TuileElement`,
`GrilleTomesCollection` → `GrilleElements`, `libelleDuTome` →
`libelleDeLElement`, et les commentaires avec.

**Ce qui garde « tome », délibérément** : tout ce qui touche aux ÉDITIONS de
manga - `formatTomeCount`, `indexEditionTotals`, « Plus que 2 tomes », le
sous-titre « 3/72 tomes » d'une carte de série. Ces calculs lisent
`MangaEditionDto` et l'attribut `edition` d'une variante : ils ne s'appliquent
qu'à un manga, et les rendre neutres n'aurait rien généralisé, seulement
brouillé ce qu'ils font. La fiche et sa grille de tomes non plus ne changent
pas de vocabulaire : elles montrent bien des tomes.

### Lot 43 — l'en-tête de la grille de tomes tient sur une ligne

Remarque de l'utilisateur en testant : « ça prend trop de place pour des infos
non nécessaires », en désignant « Kurokawa / 1 tome possédé / Tous · Manquants
· Possédés ».

Il avait raison deux fois. **La place** : titre, sous-titre et rangée de
filtres s'empilaient sur trois niveaux avant la première jaquette - **142 px
mesurés** à 1280. Ils tiennent maintenant sur UNE rangée (ce qu'on regarde à
gauche, comment on le filtre à droite), en plus petit, avec des pastilles de
filtre resserrées : **62 px**, soit 56 % de moins. À 375 px la rangée se replie
d'elle-même sur deux lignes (91 px), sans débordement.

**L'utilité** : première passe, j'avais gardé l'en-tête en petit corps, « comme
repère ». L'utilisateur a recollé son écran, et le repère était une pure
redite : la carte d'édition juste au-dessus dit déjà « Kurokawa · Détails à
renseigner · 1 tome · 1 tome possédé », jauge comprise.

L'en-tête ne survit donc que là où il lève une **ambiguïté** : quand l'œuvre a
PLUSIEURS éditions, il faut redire laquelle la grille montre. Avec une seule,
il disparaît, et il ne reste que les filtres. Et il ne porte plus que le NOM :
l'avancement est sur la carte.

Le résumé disparait avec lui - il commençait d'ailleurs par l'ÉDITEUR, alors
qu'une édition porte souvent le nom de son éditeur : « Kurokawa · Kurokawa · 1
tome possédé ».

L'écran d'ajout reçoit la même rangée : les deux montrent la même chose, ils
doivent l'annoncer de la même façon.

#### La forme du filtre : du texte, pas des pastilles

« J'aime pas la forme du sous-menu ». Le groupe de pastilles dans un conteneur
arrondi cède la place à trois libellés nus séparés par des points, l'actif en
encre pleine - **choix utilisateur parmi trois formes proposées** (texte,
onglets soulignés, menu déroulant).

Chaque libellé porte son NOMBRE : « Tous 72 · Manquants 69 · Possédés 3 ». La
rangée informe donc au lieu de seulement occuper - on voit combien il manque
sans avoir à cliquer. Les compteurs se calculent sur TOUS les tomes et non sur
ceux déjà filtrés, sans quoi le compteur de la vue courante afficherait
toujours son propre total.

L'apparence change, la sémantique non : c'est toujours un `radiogroup` de trois
`radio`, parce que les trois vues s'excluent - `aria-pressed` annoncerait trois
interrupteurs indépendants dont deux « inactifs ». Le nom accessible reste
explicite (« Manquants : 69 tomes ») : « Manquants 69 » seul laisserait le
nombre sans unité.

**Vérifié** en restaurant la version précédente pour comparer (142 → 62 px), et
sur les deux branches : œuvre à une édition, aucun en-tête ; œuvre à deux
éditions - fabriquée jetable puis supprimée, aucune série réelle n'en ayant deux
- le nom de l'édition regardée s'affiche bien, sur la même ligne que les
filtres.

### Lot 42 — « Éditer » contenait ce qui n'est pas du catalogue

Remarque de l'utilisateur en testant : « y'a pas trop de choses sous l'édition ?
normalement on devrait juste modifier les infos qui sont affichées ». Elle
pointe une contradiction avec l'étude elle-même.

« Éditer » ouvrait cinq éditeurs : classements, tags, expériences, informations
de la série, relations. Or le §2 range « **juger** » - noter, enregistrer une
lecture, classer en Tier List - dans les intentions de l'utilisateur NORMAL, et
« éditer le catalogue » dans celles de l'administrateur. Trois actions
ordinaires étaient donc enfermées derrière une porte d'admin. Et l'inspecteur
AFFICHAIT déjà ces informations dans sa colonne « Personnel » : elles se
lisaient à un endroit et se modifiaient à un autre.

**Décision utilisateur : on modifie l'information là où elle s'affiche.** Chaque
relevé de la colonne « Personnel » porte son propre « Modifier », qui ouvre
SON éditeur - un seul à la fois, en pleine largeur sous l'inspecteur, parce
qu'une colonne de 240 px ne peut pas accueillir un formulaire. « Ma note » et
« Lectures » partagent le même : la note vit sur une expérience, deux points
d'entrée pour la même donnée en inventeraient une seconde. Les tags, qui
flottaient sans intitulé sous les trois relevés, en reçoivent un.

« Éditer » ne garde que le catalogue : informations de l'œuvre et de
l'édition, relations, renommer, jaquette, ajouter édition/tome, zone sensible.

**Toujours visible, jamais révélé au survol.** Le premier jet cachait le bouton
sous `md:opacity-0`. Deviner « cet appareil a un survol » à partir d'une
largeur d'écran est le mauvais signal - un écran tactile large n'en a pas, un
petit écran avec souris en a un - et un contrôle invisible ET cliquable est le
pire des deux mondes. Il reste donc là, petit et calme.

#### Vérifications

`typecheck`, `lint`, `check:contrast`, `build` verts. En direct : les quatre
points d'entrée apparaissent, chacun n'ouvre que son éditeur (« Mes
classements », « Tags »), un seul à la fois ; « Éditer » ne montre plus que
« Série », « Édition » et « Relations » ; aucun débordement à 1280 ni à 375 px.

**Piège rencontré** : une mesure d'opacité prise juste après l'édition a rendu
`0` sur une page que le rechargement à chaud n'avait pas mise à jour, et j'ai
failli en conclure un défaut de point de rupture qui n'existait pas. Recharger
avant de mesurer un style qu'on vient de changer.

### Lot 41 — revérification : deux défauts que le lot C avait introduits

Relecture demandée après coup. Les deux défauts viennent du même geste : la
variable `entities` de Ma collection signifiait « tout ce qui est possédé », et
le lot C lui a fait signifier « ce qui est à l'écran ».

**1. Un outil de maintenance devenu dépendant de la vue.** « Retrouver les
jaquettes manquantes » lisait `entities` : passer le filtre sur « Envies » lui
faisait traiter trois séries en annonçant le faire pour la collection, et son
compteur chutait sans raison visible. Il repart de la collection possédée,
comme avant le lot C. Vérifié : 3 sous les trois filtres, là où il donnait 4 / 3
/ 3 selon la vue.

**2. Un contrôle qui ne faisait rien.** La vue d'une catégorie offrait
« Récents d'abord » sans pouvoir l'honorer : elle ne triait qu'à l'alphabétique
et passait des dates VIDES à sa grille de tomes. Un contrôle inerte est pire
que pas de contrôle - il enseigne que le réglage ne sert à rien.

La cause est la même que celle du lot 39 : la logique des dates de venue vivait
dans `ShelfPage`, donc l'autre écran ne pouvait pas s'en servir. Extraite en
`routes/Shelf/venues.ts` (index des venues, « dernière venue » d'une œuvre, tri
des œuvres), lue par les deux.

#### Vérifications (lots 39 et 40)

`typecheck`, `lint`, `check:contrast`, `build` verts. Balayage en direct de
**20 routes** : un `<h1>` chacune, aucune erreur console, aucun débordement
horizontal — ni à 1280, ni à 375 px sur les sept écrans principaux. Les quatre
entrées s'allument correctement (`aria-current` sur « Annonce » depuis
`/purchase-analysis`). Sur la fiche : en lecture, « Éditer » est la SEULE
action de catalogue visible ; en édition apparaissent « Terminer », « Ajouter
une édition », « Ajouter un tome », « Renommer la série » et la zone sensible.

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

- Un faux dépôt qui rend `List.of()` avec « non exercé par ce test » est une bombe à retardement : le jour où le code l'appelle, le test échoue en accusant le CODE. Quand une correction fait tomber un test unitaire, regarder d'abord si le faux dit la vérité (Lot 113).
- Corriger un N+1 ne clôt pas le sujet : chercher le même APPEL ailleurs, pas seulement dans le même fichier. `progressService.compute(id)` dans une boucle vivait dans deux services, corrigé dans l'un au Lot 101 et dans l'autre douze lots plus tard (Lot 113).
- Avant de décider du sort d'une fonctionnalité, COMPTER ce qu'elle contient en base : les tags avaient un écran, une API, un filtre - et zéro ligne. Le fait le plus décisif du lot n'était dans aucun fichier (Lot 112).
- Une table sans `owner_id` dans une application cloisonnée est un choix, jamais un oubli à corriger machinalement : `tag` est partagée parce qu'un tag décrit l'ŒUVRE. La bonne question n'est pas « faut-il la cloisonner » mais « de quoi cette donnée parle-t-elle » - et la réponse décide ensuite qui a le droit d'écrire (Lot 112).
- Un `if (liste.length === 0) return null` transforme un écran de gestion en écran fantôme là où l'on en a le plus besoin : le bloc des prix relevés disparaissait exactement sur les éditions qui n'en avaient aucun. Avant de masquer un bloc vide, se demander s'il porte le geste qui le remplirait (Lot 110).
- Un réglage se propose DEPUIS la surface qu'il gouverne, pas seulement depuis Paramètres : l'ordre des langues de titre décidait de chaque ligne d'une liste sans que rien n'y indique que c'était un choix. Et conditionné à cette surface, il ne devient jamais du bruit permanent (Lot 110).
- Le bouton Précédent du navigateur n'existe pas dans une app installée (`display: standalone`) : dès qu'une PWA devient installable, tout écran sans lien de retour devient un cul-de-sac. Le défaut n'existait pas avant le lot PWA, et rien ne l'a signalé (Lot 109).
- Un écran de réglages se range par ce que le réglage CONCERNE (mon compte / cet appareil / ma collection / cette instance), jamais par « à quel point c'est technique » : la seconde échelle est une impression, et c'est elle qui avait mis l'export à côté des catégories de collection (Lot 108).
- Un réglage qui vit dans le `localStorage` doit le DIRE : rien à l'écran ne distingue un interrupteur qui suit le compte d'un interrupteur qui reste sur la machine, et la personne qui ouvre l'app sur son téléphone conclut à une perte de réglage (Lot 108).
- Une capacité qui doit voir PAR-DESSUS le cloisonnement ne s'écrit pas avec les dépôts ordinaires : `@TenantId` les filtre sur le propriétaire courant, en silence. Elle se pose dans un port séparé, en SQL, avec un seul appelant et une garde devant - visible, plutôt que glissée dans un dépôt qu'on croit ordinaire (Lot 107).
- La liste des tables d'une suppression définitive s'écrit à la MAIN, jamais déduite du schéma : déduite, une table ajoutée demain serait effacée sans que personne ne l'ait décidé, et une table renommée disparaîtrait de la liste sans un mot (Lot 107).
- Un repli « au cas où » sur une donnée INCONNUE produit une affirmation fausse et crédible : `totalVolumes ?? cataloguedVolumeNumbers.length` annonçait une collection complète à qui n'a jamais renseigné son édition. Quand un champ documente « null tant qu'aucune source ne le connaît », le repli est le bug (Lot 106).
- Un parcours de bout en bout qui affirme un TOTAL de collection dépend de l'ordre des fichiers de test : ils partagent une pile. Compter ce que le test vient lui-même de créer, jamais l'état global (Lot 106).
- Une aide de saisie posée DANS le `<label>` devient une partie du NOM du champ : le lecteur d'écran annonce « Mot de passe Au moins 10 caractères » d'une traite, et `getByLabelText('Mot de passe')` ne trouve plus rien. Les règles se relient par `aria-describedby`, hors du label - et ce lien-là se teste (`toHaveAccessibleDescription`), sinon rien ne le garde (Lot 105).
- Un champ FACULTATIF qui se replie sur une autre donnée finit par l'afficher là où elle n'a rien à faire : `display_name` vide valait l'adresse e-mail, qui s'est retrouvée sur l'avatar du menu. Avant d'ajouter un repli, regarder où la valeur sera LUE (Lot 105).
- Après un changement STRUCTUREL, chercher la phrase qui le nie plutôt que les fichiers modifiés : `grep -rn "mono-utilisateur" --include=*.md` a trouvé trois documents intacts deux lots après la fin du cloisonnement, dont celui qu'on lit en premier. Le code a le compilateur, les tests ont leur échec ; une phrase fausse, elle, s'affiche comme une vraie (Lot 104).
- Une donnée que l'utilisateur SAISIT et que personne ne relit est pire qu'une fonctionnalité absente : elle demande du travail en échange de rien. Chercher, pour chaque chose qu'un écran fait poser (tag, note, classement), l'écran qui s'en sert — `tagId` traversait `searchEntities` et les clés de cache sans un seul appelant, et rien dans le typage ne pouvait le dire (Lot 103).
- Un contrôle qui n'existe qu'en **HTTP réel** (type MIME, en-tête de cache, code de refus d'une route ouverte) ne peut pas être un test : il dépend du serveur, pas du fichier. Un script de GET, sans compte et sans écriture, se lance sur la production comme sur la pile locale — et c'est la seule chose qui distingue un déploiement sain d'un conteneur périmé qui affiche exactement la même page (Lot 102).
- Un test de performance doit mesurer la **pente**, pas un nombre : sur une base d'intégration partagée, un seuil absolu de requêtes se périme au premier test voisin ajouté, tandis que « le même appel coûte autant avec 11 séries qu'avec 5 » reste vrai quoi qu'on ajoute autour. Et il se vérifie comme les autres, en le confrontant au code d'avant (Lot 101).
- Une méthode de LECTURE qui appelle un helper partagé hérite de ses ÉCRITURES : `findEdition` rattache au passage une édition à sa série, ce qu'un écran de suggestions n'a aucune raison de faire. Avant de grouper des appels, lire ce que chacun faisait d'autre que rendre une valeur (Lot 101).

- **Ne jamais sonder des POST à l’aveugle sur des données réelles** : `POST /share` avec un corps VIDE répond 201 et crée un lien public vers la collection. Un corps vide n’est pas une requête inoffensive - certaines routes n’attendent rien parce que le geste EST la requête. Lien révoqué aussitôt, URL publique repassée en 404 (Lot 85).
- Retirer un champ d’un corps de requête ne casse pas les clients restés en arrière : Jackson ignore une propriété inconnue, donc un corps qui porte encore le champ retiré passe en 200 et le champ ne fait plus rien - ce qu’il faisait déjà. Garder le test qui l’envoie, en retournant son assertion : le champ doit être ABSENT de la réponse (Lot 84).
- `npm run dev` et le conteneur `web` ne tombent pas dans la même branche d’erreur : en dev l’appel à une API éteinte échoue AVANT d’aboutir (réseau), déployé il traverse nginx qui répond **502**. Un statut non traduit ne se voit donc que dans le mode qu’on ne teste pas (Lot 83).
- Un « Annuler » à l’écran n’est pas forcément le vôtre : celui d’une CONFIRMATION porte le même mot. Une sonde a cru avoir supprimé puis annulé une Tier List alors qu’elle avait seulement ouvert et refermé la confirmation - le journal réseau, où aucun `DELETE` n’était parti, l’a tranché. Vérifier qu’une requête a eu lieu avant de conclure sur son effet (Lot 82).
- Une annulation qui abîme ce qu’elle restaure ne restaure rien : rajouter un tome retiré le datait d’aujourd’hui, donc le remède refaisait le mal. Avant de proposer « Annuler », vérifier que le chemin inverse rend VRAIMENT l’objet d’avant - ici il a fallu ouvrir `quick-add` à une date d’acquisition (Lot 81).
- **Vérifier sur le serveur de développement (5173) ne dit rien de ce que l’utilisateur voit** : le conteneur `web` de docker-compose (8081) datait de vingt-cinq lots plus tôt et servait une interface d’un autre âge, d’où un défaut signalé introuvable dans le code actuel. Reconstruire `web` fait partie de la livraison, au même titre qu’`iozycore-api` - et le navigateur garde en plus l’ancien HTML en cache (Lot 80).
- `mvn test-compile` peut passer sur des classes PÉRIMÉES (`target/` vit dans le répertoire monté) : ajouter une méthode à un port a laissé un faux repository de test sans implémentation sans que rien ne le signale. Seule la construction de l’image Docker, qui compile depuis zéro, l’a levée - donc **ne jamais avaler la sortie de `docker compose build`** : elle disait « failed to solve » pendant que `up -d` répondait « Started » sur l’ANCIENNE image (Lot 79).
- Deux Maven en même temps sur le même `target/` monté se marchent dessus : une suite en tâche de fond et un `clean test` simultané ont rendu un `BUILD FAILURE` sans une seule ligne de test, vert au relancement seul (Lot 79).
- La touche Échap envoyée par le pilote du navigateur n’atteint PAS un `document.addEventListener('keydown')` : le panneau reste ouvert et ça ressemble à un défaut. Distribuer un vrai `KeyboardEvent` depuis la page pour vérifier un raccourci clavier (Lot 78).
- Une surface `role="dialog"` NON modale (pas d’`aria-modal`, pas de voile) ne doit pas recevoir le piège à focus de `useModalA11y` - mais elle doit quand même faire entrer le focus chez elle, surtout quand elle est rendue AVANT son déclencheur dans le DOM : Tab emmène alors ailleurs, et le panneau ne s’atteint qu’en Maj+Tab (Lot 78).
- Ne JAMAIS déclencher des gestes en masse par correspondance de libellé sur des données réelles : au Lot 77 une sonde a cliqué tous les boutons « Modifier / Éditer / Ajouter » d’une fiche pour déplier ses panneaux. Rien n’a été écrit - vérifié après coup sur les six tables - mais un « Ajouter » peut être une bascule qui écrit (Lot 77).
- Un bouton-icône sans classe de taille FAIT la taille de son icône : 13 x 13 px pour un `size={13}`. Le défaut ne se voit ni au typecheck ni à l’œil sur un grand écran, seulement en mesurant `getBoundingClientRect` à 375 px. La convention existait déjà dans deux autres boutons (`h-11 w-11` autour de la même icône) - chercher le patron maison avant d’inventer une taille (Lot 77).
- Fermer une écriture peut OUVRIR un coût ailleurs : le Lot 75 a supprimé le relevé automatique, et comme l’avis de l’IA n’est demandé qu’en l’absence de relevé, chaque analyse s’est mise à rappeler le modèle. Après avoir retiré une donnée, chercher qui s’appuyait sur son EXISTENCE, pas seulement qui la lisait (Lot 76).
- Un test peut GARANTIR une règle sur un chemin que l’application n’emprunte jamais : les quinze tests d’ingestion des relevés passent tous une URL et un `externalId`, si bien que « une annonce réanalysée ne se compare pas à son propre prix » était vrai en test et faux en production, où les annonces se saisissent à la main. Quand une règle dépend d’une donnée OPTIONNELLE, écrire le test qui l’omet (Lot 75).
- **Une analyse d’achat jetable N’EST PAS sans trace** : `releverLePrixDemande` écrit le prix demandé comme observation de marché, et supprimer l’analyse ne supprime pas l’observation. Vérifier un lot en créant des analyses exige donc de compter AUSSI `market_price_observation` avant/après, et de nettoyer par `DELETE /market-observations/{id}`. Six lignes s’étaient accumulées sur les lots 71-74 et faussaient déjà une mesure : elles se servaient de comparables les unes aux autres (Lot 74).
- Une règle branchée sur UN seul de ses lecteurs laisse l’autre affirmer le contraire, dans le même écran : `MarketComparableSelector` filtrait la référence du bloc Prix, pendant que le facteur `REAL_MARKET_ALIGNMENT` comptait n’importe quel relevé. Quand une classe dit dans son en-tête quel défaut elle supprime, chercher TOUS les endroits où ce défaut vivait (Lot 74).
- Un réglage inerte se branche sans rien inventer QUAND sa règle est déjà écrite ailleurs : `conditionImportance` avait son sens dans son propre enum, son intention dans le profil par défaut, et un point de branchement existant (la majoration coffret). Les cinq autres préférences mortes n’ont aucune règle écrite : les brancher serait en inventer cinq, les retirer effacerait des données - ça se décide, ça ne se glisse pas dans un lot (Lot 73).
- Un `getOrDefault(clé, 0)` sur une carte de POIDS transforme « non configuré » en « neutralisé », et le repli « rien n’était calculable » en dessous le masque : dix facteurs calculés, affichés, et une note constante à 50 pour toutes les annonces. Un défaut de CONFIGURATION ne se voit ni au typecheck ni aux tests, qui passent tous le profil par défaut - il faut lire ce que la base contient VRAIMENT. Et seul un champ dont le vide est ininterprétable (liste, carte) peut se replier ainsi : un booléen à `false` ou un entier à `0` sont des choix légitimes (Lot 72).
- Une valeur d’enum qui recouvre DEUX situations finit par les rendre indistinguables chez son lecteur : `SKIP_LISTING` disait à la fois « trop cher » et « je ne sais rien du prix », et l’écran conseillait de passer une annonce sur la foi d’un vide. Le drapeau qui les séparait existait, mais la même fabrique servait aux deux cas - donc il mentait, et aucune interface ne le lisait. Même figure qu’au Lot 58, un étage plus haut (Lot 71).
- Un enum du serveur qui gagne une valeur ne casse rien tout de suite : il casse les traductions écrites AVANT lui, et d’abord chez les surfaces qui ne peuvent pas encore la recevoir - donc silencieusement. Compter les valeurs traitées à chaque endroit qui le traduit, puis vérifier lesquelles de ces surfaces peuvent réellement la recevoir : c’est ce qui sépare un mensonge à l’écran d’une dette (Lot 70).
- Quand deux écrans lisent la même donnée, c'est le CHARGEMENT qu'on partage, pas l'affichage : le hook rend les données et leur état, chaque écran garde son filtrage, son tri et sa mise en page. Factoriser plus loin les aurait fondus en un composant à options, et c'est ce que le Lot 28 avait justement démonté (Lot 66).
- Une liste de caches à invalider recopiée dans cinq écrans est cinq occasions d'en oublier un - et le coût d'un oubli est invisible : l'écran affiche simplement l'état d'avant. Quand les clés sont hiérarchiques, un préfixe remplace une énumération, et il n'y a plus rien à tenir à jour (Lot 65).
- Un sac d'attributs non typé se lit à un seul endroit, sinon chaque lecteur invente sa tolérance : quatre copies de « lire le numéro d'un tome », dont une acceptait `"12"` quand les trois autres l'ignoraient. Le défaut ne se voit pas tant que la donnée est propre - il attend (Lot 62).
- « Sans appelant » ne veut pas dire « à supprimer ». Deux questions le tranchent : un client peut-il encore faire le geste INVERSE (alors la route est une porte de sortie - `restore` face à `sell`/`lose` sur iOS), et existe-t-il un autre recours (renuméroter, non : supprimer et rajouter suffit) ? Compter les appelants ne suffit jamais (Lot 61).
- Retirer un écran laisse trois strates derrière lui : la fonction cliente, la route serveur, et la DOC qui le décrit encore. Les lots 27 et 53-55 n'avaient nettoyé que l'écran ; six mentions d'écrans morts sont restées dans USER_JOURNEYS pendant des jours (Lot 61).
- Remplacer un calcul SYNCHRONE par une requête crée un état qui n'existait pas : « je ne sais pas encore ». Chercher tous ses lecteurs, y compris ceux qui tournent pendant le vol - les Hooks s'exécutent avant le retour anticipé, et une condition du type « si la liste est vide » y devient vraie à tort (Lot 60).
- Un endpoint peut porter un filtre qui rend une question IMPOSSIBLE à poser : `/metadata/search` écarte ce qu'on possède déjà, donc une fiche existante n'y trouvait jamais sa propre œuvre - zéro correspondance par construction, et un message d'écran parfaitement plausible pour le masquer. Avant de rapprocher deux données, vérifier que la source peut seulement rendre la bonne (Lot 59).
- Rapprocher une œuvre d'un candidat par le TITRE est un piège quand la source indexe aussi les dérivés : Naruto rend huit spin-offs, Zelda rend un bundle en premier. L'identifiant externe est déjà stocké depuis l'ajout - s'en servir d'abord (Lot 59).
- Un `return null` qui veut dire « ça n'a pas marché » finit toujours par vouloir dire « il n'y a rien » : deux étages plus haut, plus personne ne sait lequel des deux. Quand un échec et un vide légitime mènent à des conduites différentes (ici : mettre en cache, ou pas), c'est le TYPE qui doit les séparer, pas une convention (Lot 58).
- Ce dépôt a DEUX clients (web et iOS, tous deux suivis par git). Un balayage d'appelants qui ne regarde que `web/src` déclare mort du code vivant : `/wishlist/lookup` a été listé à tort comme sans appelant au Lot 36 (Lot 51).
- Un défaut d'interface « prudent » (ici : ne rien conclure d'un vide) sert un usage INTERNE précis - le cache. Le remonter tel quel à l'utilisateur lui fait dire autre chose. Vérifier qui s'appuie sur le défaut avant de lui donner un sens visible (Lot 50).
- Un test de non-régression doit être confronté à l'ANCIEN code avant d'être gardé (`git checkout` du fichier corrigé, lancer le seul test, restaurer) : sinon rien ne dit qu'il protège quoi que ce soit (Lot 49).
- Quand un calcul est rebranché sur une source unique, chercher TOUS ses jumeaux dans le même fichier : au Lot 31 les suggestions ont été corrigées et `findOwnedVolumeNumbers`, quarante lignes plus bas, a gardé le même défaut six jours de plus (Lot 49).
- Pour voir ce qu'un écran affiche PENDANT un appel : `docker pause` sur le conteneur de l'API, naviguer, mesurer, puis `unpause`. Plus fiable que de retarder `fetch` dans la page, que le rechargement emporte (Lot 47).
- Une sonde qui teste une vue pilotée par une PRÉFÉRENCE MÉMORISÉE doit poser l'état qu'elle mesure (écrire `localStorage` puis recharger), jamais cliquer une bascule en supposant l'état de départ : au Lot 45 elle a relevé deux fois la même vue sans que rien ne le signale.
- **`document.documentElement.clientWidth` peut valoir 0 dans ce navigateur de test** quand aucun viewport n'est émulé : toute sonde de débordement rapporte alors un faux positif, et `elementFromPoint` rend `null`. Appeler `resize_window` avec une taille EXPLICITE avant de mesurer, et se méfier d'un `deborde: true` accompagné d'un viewport nul (Lot 41).
- Quand une variable change de SENS (`entities` : « tout ce qui est possédé » → « ce qui est à l'écran »), relire tous ses lecteurs, pas seulement ceux qu'on modifie : un outil de maintenance s'était mis à dépendre du filtre d'affichage (Lot 41).
- Deux listes « gardées manuellement synchronisées » sont deux listes vouées à diverger : `DesktopHeader.PRIMARY` et `TabBar.TABS` le disaient dans leurs propres commentaires. Extraire AVANT d'ajouter la quatrième entrée, pas après avoir oublié une des deux (Lot 39).
- Un bouton est annoncé SEUL par un lecteur d'écran : le titre de section au-dessus ne le désambiguïse pas. Trois « Ajouter » nus vivaient sous « Tags », « Expériences » et « Relations » (Lot 40).
- Une nappe d'actions au survol (`absolute inset-0` + `group-hover:pointer-events-auto`) doit être gardée sur son CONTENEUR, pas seulement sur ses boutons : vide, elle couvre quand même sa cible et avale le clic. Se détecte avec `elementFromPoint` au centre de chaque tuile, jamais par `typecheck`/`lint`/`build` (Lot 37).
- Le fanal d'une règle produit se pose à UN endroit : « pas de cœur sur un groupe » vit dans `WishlistToggle` lui-même (via `lib/typeDeCollection`), pas dans ses trois appelants - un quatrième appelant l'aurait reposé (Lot 37).
- Un test peut CONSIGNER un comportement sans le protéger : `WishlistWithoutOwnershipIntegrationTest` affirmait « rien ne retire automatiquement une envie à l'achat, ce comportement est inchangé ». Lire l'intention du commentaire avant de conclure qu'un test bloque un changement produit (Lot 36).
- Un audit d'exports morts doit compter les usages DANS le fichier lui-même : `isComplete` paraissait mort alors que `matchesCompletionFilter`, deux fonctions plus bas, s'en sert (Lot 36).
- Savoir si une œuvre a des tomes coûte huit requêtes Google Books (recherche de tomes, `GoogleBooksVolumeSearchProvider`) : toute fonctionnalité qui voudrait le savoir POUR UNE LISTE doit passer par le seul cache durable (`volume_search_cache`, où une liste vide est mémorisée), jamais par un appel par ligne. Et `totalVolumes` n'est pas un substitut - il vient du catalogue japonais, pas des éditions françaises indexées (Lot 35).
- L'ajout d'un tome EST réversible, contrairement à ce que deux lots ont affirmé : `DELETE /api/ownerships/{id}`, puis `DELETE /api/entities/{id}/variants/{id}`, et `VariantDeletionService` cascade jusqu'à supprimer l'Édition orpheline puis la Série vide. Vérifier un chemin d'écriture en direct est donc possible - lire la règle de suppression avant de renoncer (Lot 32).
- Un écran dont une partie ne dépend que d'un identifiant faible (ici le titre) peut devenir actionnable AVANT que le reste de ses données soit chargé. L'aperçu proposait ses tomes avant de connaître l'œuvre, et l'ajout persistait un sac d'attributs vide. Retenir l'action, pas seulement afficher un chargement (Lot 32).
- Un hook qui doit alimenter deux endroits d'une même page (ici les cartes d'édition dans le hero, la grille dans le corps) renvoie DEUX nœuds ; il ne remonte jamais un morceau à l'appelant par un rappel pendant le rendu - c'est modifier l'état d'un composant pendant le rendu d'un autre, et React le refuse (Lot 31).
- Distinguer les deux usages de `location.state` : une DÉPENDANCE (l'écran n'existe pas sans lui - l'ancien `/add/draft`, cassé au F5) et un RACCOURCI (il évite une requête, son absence ne coûte rien - l'aperçu du Lot 31). Le second est légitime, le premier presque jamais : mettre l'identité dans l'URL.
- `candidateDisplayTitle` compose « Titre (Autre titre) » pour une LISTE ; ce qu'on persiste est toujours `resolvePrimaryTitle` (Lot 29). Deux chemins d'écriture s'étaient trompés, dont un depuis longtemps - et l'erreur ne se voit qu'au moment où un second chemin résout la même œuvre par son titre, et crée un doublon.
- Un écran qui ne vit que par `location.state` (l'ancien `/add/draft`) n'est ni partageable ni rechargeable : F5 y affichait « Aucune sélection en cours ». Quand un écran mérite d'être revu ou envoyé, lui donner une vraie URL - ici, la fiche.
- Avant de conclure « ces deux composants ne se factorisent pas », écrire la signature commune : au Lot 28 j'ai d'abord recommandé de ne partager que la coquille d'une tuile, et la fusion complète s'est révélée propre - une seule prop (`onEnvies`) est propre à un mode, tout le reste est commun. Le bon test n'est pas « les gestes diffèrent-ils ? » mais « la liste de props commune est-elle entière ? ».
- Avant de retirer une fonctionnalité qui « ne sert à rien », TRACER ses lecteurs réels (`grep -rln` sur le dépôt du domaine, en excluant son propre paquet) : au Lot 27, `EditionUpgradeWish` n'était lu que par sa propre page et l'export, alors que `WishlistEntry` l'est par quatre modules dont Analyse d'achat. La comparaison chiffrée tranche mieux qu'une impression, et distingue « inutile » de « pas encore branché ».
- Retirer une route sans page de repli laisse un `<main>` VIDE, pas une erreur : l'application n'avait aucun `Route path="*"` avant le Lot 27. Vérifier ce point à chaque suppression d'écran.
- **Le nom d'un fichier de maquette n'est pas une date** (Lot 26) : `Fiche série - IozyCore v4.dc.html` n'était PAS la planche à suivre, malgré son « v4 » - c'est `Fiche série - Naruto (multi-éditions).dc.html`. Toutes les dates de fichier d'un zip d'export sont identiques (heure d'export), donc rien dans le zip ne dit laquelle fait foi. Quand un handoff contient plusieurs planches du même écran, DEMANDER avant d'écrire une ligne : ici la mauvaise supposition a coûté une refonte complète.
- Une bande pleine largeur dans un conteneur centré se fait par une GRILLE de page (`1fr | contenu | 1fr` sur `<main>`, enfant en `col-span-full`), jamais par `100vw`/`50vw` - ces unités comptent la barre de défilement et rouvrent le débordement du Lot 10. La règle qui range les enfants dans la colonne du milieu doit vivre dans `@layer base` (un sélecteur de parent bat la classe d'un enfant) et porter `min-width: 0` (un élément de grille vaut `min-width: auto` et refuse de descendre sous son contenu).
- Échantillonner la couleur d'une jaquette externe : toujours sur une image SÉPARÉE en `crossOrigin = 'anonymous'`, jamais celle affichée. Sans en-têtes CORS l'échantillonnage échoue seul et on retombe sur une teinte de repli, tandis que la jaquette visible continue de s'afficher normalement.
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
