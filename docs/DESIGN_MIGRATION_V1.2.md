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
