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

## Lots

Un lot = un commit. Ce journal ne garde que les lots récents (148 et suivants).
Les lots 0 à 147 ont été retirés le 2026-10-13 pour alléger le fichier ; ils
restent dans git :

```bash
git show be4e322:docs/DESIGN_MIGRATION_V1.2.md
```

Chaque nouveau lot s'ajoute à la fin du fichier.

### Lot 148 — La finition : ce que chaque écran montrait de travers

« Il y a plein de petits problèmes UX/UI à améliorer » (2026-09-22). Pas de
liste fournie : le lot commence par un relevé. Trente-quatre écrans photographiés
sur la pile jetable, connecté, avec une collection semée par l'API pour
ressembler à une vraie (neuf séries AniList avec jaquettes et éditions, quatre
jeux de société, trois jeux vidéo, envies, suivis, tier list, partage, tags,
expériences) - à 390 px et à 1 280 px, en sombre et en clair - et, sur chaque
page, une sonde qui mesure ce que l'œil ne voit pas : débordement horizontal,
cibles de moins de 40 px, textes tronqués, contrôles sans nom, images cassées,
anglais résiduel, erreurs de console. Puis les captures lues une à une.

**Ce qui débordait.** Sur téléphone, l'accueil et chaque rayon faisaient
défiler la page de côté : les quatre filtres « Tout · Possédés · Suivies ·
Envies », posés à leur largeur naturelle avec leurs comptes, dépassaient 390 px,
et le navigateur mobile élargissait la fenêtre de rendu à 430 px - la barre du
pouce sortait de l'écran avec elle (mesuré : le bouton Scan à 422 px sur 390).
Les quatre filtres prennent désormais toute la largeur, chacun sa part, en
12 px sous 640 px ; leur forme compacte reste celle du desktop.

**Ce qui ne répondait pas au doigt.** Le relevé a compté une vingtaine de
cibles sous 44 px, dont quatre sous 25 : les lignes du Catalogue (le bouton ne
mesurait que sa ligne de texte, 24 px, le reste de la carte était inerte),
« Relever ce prix comme observation de marché » (16 px), les liens de retour
écrits à la main du rayon et du classement général (20 px, remplacés par
`LienRetour`), les quatre boutons de l'en-tête (36 px -> 44 px), les nuanciers
du formulaire de type, le sélecteur d'année du bilan, les filtres de tomes de la
fiche, les liens d'export. Les flèches de la langue des titres sont la même
question sous un autre angle : le glisser-déposer HTML n'existe pas au doigt, et
sur un téléphone l'ordre ne pouvait pas changer.

**Ce qui était écrit de travers.** Les montants s'écrivaient « 901.65 € » à
vingt-quatre endroits - point décimal, pas de séparateur de milliers - et les
notes « 4.7/10 » : `common/lib/formats` (`Intl.NumberFormat` en `fr-FR`) les
écrit « 901,65 € », « 1 234,50 € », « 4,7 ». Côté serveur, le conseil de
négociation concaténait un BigDecimal brut (« la valeur estimée (20.8000) »),
et trois phrases disaient « tome(s) manquant(s) » ; elles se déclinent au
pluriel. L'éditeur d'expériences affichait les codes de la base - « READ »,
« IN_PROGRESS », « ABANDONED » - en pastilles au milieu d'un écran français :
`common/lib/experiences` les dit (« Lu », « En cours », « Abandonné »), et la
rangée de la fiche ne s'appelle plus « Lectures » devant un jeu vidéo
(« Parties »), ni « Série entière » pour une œuvre qui n'a pas de tomes ;
« Auteur » coiffait le studio d'un jeu vidéo. L'accueil vide renvoyait à
l'onglet « Rechercher », renommé Catalogue depuis le lot 139 ; l'import BGG
aussi. Le hero du profil disait « tomes possédés » là où Statistiques dit
« exemplaires » - c'est un écran du cœur. Le bilan annuel écrivait « 4 jeu de
société » (le libellé du type après un nombre ne se met pas au pluriel tout
seul : le nombre passe après) et « séries commencées » pour des jeux. Le champ
de fichier de la restauration disait « Choose File / No file chosen », en
anglais quel que soit le navigateur : un libellé habillé en bouton l'ouvre.

**Ce qui se lisait mal.** Sur le Catalogue à 390 px, les titres des jeux
étaient coupés à dix caractères (« Les Aventurie… », « The Legend o… ») par
les deux pastilles à droite : le titre peut prendre deux lignes, le cœur
« envies » ne montre que son icône sous 640 px, et il disparaît sur ce qu'on
possède déjà - vouloir un jeu qu'on a n'a pas de sens. Sur un rayon à trois
colonnes, le sous-titre d'une série était coupé après l'éditeur (« Glénat ·
4/43… ») : le décompte passe en premier. Le badge de verdict de l'historique
se pliait sur trois lignes (« Prix / correct · / 55/100 »). Le bouton de tri
disait l'état (« Récents d'abord ») pendant que son nom accessible disait
l'action (« Trier par titre ») : il nomme l'action, comme son voisin
« Dégrouper ». L'onglet du navigateur restait « … · IozyCore » sur un rayon :
le titre d'attente n'est plus pris pour un titre, et l'observateur suit
désormais le texte du h1, pas seulement ses nœuds. Les éditions de référence
répétaient dix-neuf fois la même phrase d'explication sous chaque édition sans
prix relevé ; elle est dite une fois, en tête.

Vérifié par une seconde passe de captures et de sondes : plus aucun
débordement, plus aucune cible sous 36 px hors cases à cocher (dont le libellé
est la cible), et les cinquante-six fichiers de tests web plus les tests du
moteur d'achat au vert. Quatre tests de plus : les formats, les libellés
d'expériences, le titre d'onglet qui suit un h1 dont le texte change, l'ordre
des langues aux flèches.

Reste noté, hors de ce lot : le scan par caméra n'existe pas sur iPhone
(`BarcodeDetector` absent de Safari) - l'écran le dit et propose la saisie du
code, mais c'est le geste le plus fréquent d'un ajout au téléphone.

**Seconde passe (même jour) : ce qui ne se voit qu'en agissant.** « C'est
tout ? » - non. La première passe photographiait des écrans au repos ; celle-ci
ouvre les panneaux et les modales, entre en mode édition, remplit les
formulaires, sort du compte, et regarde la largeur tablette (820 px). Le script
`captures2.mjs` enchaîne ces gestes avec la même sonde. Trouvé et corrigé :

- **au doigt, encore** : les liens du mode édition de la fiche (« Toutes mes
  Tier Lists », « Ajouter une expérience », « Ajouter une relation »,
  « Renommer », 20 px), le menu d'une expérience (28 px), les puces d'univers
  de la modale « Nouvelle Tier List » (32 px), les boutons du relevé de prix
  (28 px), « Chercher par titre » du scan (16 px), et sur la porte « Créer un
  compte avec une invitation » / « J'ai déjà un compte » (20 px) ;
- **le survol qui restait collé** : un écran tactile n'a pas de survol, il a
  un dernier élément touché, et le navigateur y laisse `:hover` jusqu'au
  toucher suivant - les deux règles maison d'index.css (fond et éclaircissement
  au survol) éclairaient donc chaque bouton après le tap, comme resté enfoncé.
  Elles passent sous `@media (hover: hover)`, comme les variantes `hover:` de
  Tailwind le font déjà ;
- **les plus petits textes** : 9 px sous le bouton Scan, 10 px sur les badges
  des tuiles, la tuile « ajouter un tome », le « +N » du calendrier et l'axe de
  la frise - remontés d'un point ;
- **encore des mots** : « 7.2 €/tome neuf » dans la fiche d'édition de
  l'analyse, « ANILIST » et « GOOGLE_BOOKS » en capitales dans les suggestions
  du Catalogue (`common/lib/sources` écrit AniList, Google Books,
  BoardGameGeek), « Renommer la série » et « efface la série » sur la fiche
  d'un jeu vidéo (« l'œuvre »), l'espace fine insécable de `fr-FR` que les
  polices de l'interface rendent invisible (« 1695,10 € » se lisait sans
  séparateur) remplacée par une insécable ordinaire ;
- **ce qui se tassait ou se coupait** : « Cette œuvre n'est classée nulle
  part » sur quatre lignes de deux mots à côté de son bouton ; le message du
  scan « Une source n'a pas répondu… » coupé derrière « Chercher par titre » ;
- **le visiteur** : la colonne « Personnel » de la fiche lui annonçait « Pas
  encore notée », « Aucune enregistrée », « Non classée » - rien à noter,
  personne. Elle disparaît hors compte.

**Tranché (même jour, « tranche toi-même »)** : sur la fiche, toucher un tome
possédé le retirait aussitôt - retrait réel de l'exemplaire, date d'acquisition
comprise, rattrapable six secondes par « Annuler ». L'ajout, lui, ne détruit
rien. Le retrait demande donc un second geste, sans boîte de dialogue : le
premier tap arme la tuile, qui pose la question sur place (« Retirer » /
« Garder »), le second retire, et « Annuler » reste. Toucher un autre tome
désarme. À la souris c'est un clic de plus ; au doigt c'est la différence
entre un geste voulu et un geste qui part en défilant. Cinq tests
(`GrilleVolumes.test.tsx`).

### Lot 149 — Le rendu : un système, pas des retouches

« Ça a changé visuellement ? Je veux vraiment un rendu hyper pro et moderne »
(2026-09-22, après le lot 148). Non, le lot 148 corrigeait des défauts sans
toucher au style. Et le style, lui, n'avait pas de système : cinquante boutons
primaires écrits de quatorze façons (`py-1.5`, `py-2`, `py-2.5`, `py-3`,
`rounded-lg`, `rounded-xl`, `rounded-[14px]`…), cent soixante-cinq
`rounded-lg` à côté de cent dix-sept `rounded-xl`, des champs de 36 px, vingt-
neuf « Chargement... » en gris, des états vides écrits à chaque fois autrement.
Aucun n'était faux ; ensemble ils faisaient une interface qui hésite - et c'est
l'hésitation qui se lit comme « pas pro ». L'identité (terracotta, Space
Grotesk et Inter, sombre chaud) ne bouge pas : c'est la cohérence qui manquait.

**Le système** (`index.css`, utilitaires Tailwind v4 nommés, chacun dit une
chose une fois) :

- **`btn-primaire` / `btn-secondaire` / `btn-discret` / `btn-danger`** :
  44 px, rayon 12, `font-semibold`, contraction de 2 % à la pression, état
  désactivé commun ; le primaire porte l'ombre teintée, le secondaire une
  surface, un filet (`ring-line`) et une ombre douce ;
- **`champ`** : 44 px, rayon 12, filet intérieur, anneau d'accent au focus,
  placeholder en `faint` ;
- **`barre-verre`** : les trois barres de navigation (en-tête mobile, en-tête
  desktop, barre du pouce) deviennent translucides et floutées, avec un filet
  `line` - le contenu passe dessous ;
- **`squelette`** et le composant `Squelette` (lignes, rail d'accueil, grille,
  liste, fiche) : la forme de ce qui vient, annoncée une fois aux lecteurs
  d'écran, à la place des « Chargement... » - vingt-quatre remplacés par
  signature, l'accueil reçoit deux rails, un rayon sa grille, la fiche sa
  jaquette et sa grille ;
- **`EtatVide`** : une pastille teintée avec l'icône, un titre en police de
  titrage, la phrase qui dit par où sortir, l'action - accueil (avec « Ouvrir
  le Catalogue »), rayon, Tier Lists, calendrier, historique d'analyses, et une
  forme compacte pour « Aucun résultat » du Catalogue ;
- **`compteur`** (chiffres tabulaires) et le respect de
  `prefers-reduced-motion`.

**Appliqué par signature de classes** (`systeme.mjs`, scratchpad) : un
`className` qui contient `bg-accent` + `text-accentInk` + une graisse est un
bouton primaire, `bg-surface(2)` + `text-textPrimary` + une hauteur un
secondaire, `focus:ring-2 focus:ring-accent` sans graisse un champ - 40, 23 et
42 remplacements dans cinquante-sept fichiers, en gardant les modificateurs de
mise en page (`w-full`, `shrink-0`, `self-start`…). Puis à la main : les
barres, les tuiles (filet + ombre + pression), les cartes (`border-line` au
lieu de `border-surface2`, invisible en sombre), les puces inactives (filet),
le message éphémère (filet), la pastille active de la barre desktop, les
boutons « Filtres » et « … » alignés sur le secondaire, la porte (lueur
d'accent en haut, mot-marque en 36 px avec « Core » en accent, champs et
bouton du système).

Vérifié : 423 tests web, 18 parcours Playwright, typecheck, lint, contraste
(116 combinaisons), build ; captures des écrans clés en sombre et en clair,
mobile et desktop, et le squelette de l'accueil sous une API ralentie.

### Lot 150 — Les conventions de commit et le numéro de version

Pas d'écran touché : le lot met d'accord les règles de commit et le numéro
affiché dans le pied de page, qui est déduit du type des commits
(`web/scripts/version.mjs`).

- **Portée facultative, absente par défaut** : le skill `commit` et `CLAUDE.md`
  écrivent `type: subject`. La liste de portées est supprimée (elle était longue
  à tenir à jour et le calcul de version ne lit que le type). L'historique
  mélangeait déjà des variantes (`sortie`/`sorties`, `nav`/`navigation`).
- **Règle de version écrite** : section « Numéro de version » dans
  `docs/DEPLOIEMENT.md` (`feat` = mineur, `!` ou `BREAKING CHANGE:` = majeur, le
  reste = patch ; départ au dernier tag `vX.Y.Z` ; tag posé après la
  publication ; échec volontaire sans tag). Les tags `version-379` à `381`
  restent en place, ignorés par le calcul.
- **À savoir** : un commit `docs:` déployé monte quand même le patch, donc le
  numéro lu sur le site. Le type se choisit avec soin.

- **Skills de lot** : `debut-de-lot` (cadrer, explorer, planifier, valider) est ajouté ;
  `fin-de-lot` gagne la revue de code et le push, qui déclenche le déploiement
  quand il part de `main`.

Vérifié : `node scripts/version.mjs` donne 1.32.5 avant et après, 10 tests de
`version.test.mjs` verts. Pas d'e2e ni de vérification en direct : ni `web/` ni
l'API n'ont changé.

### Lot 151 — Les README remis d'accord avec le code

Pas d'écran touché : seuls des `.md` bougent. Le README backend décrivait encore
l'ancien découpage par couches (`domain/`, `application/`, `infrastructure/`,
`api/`) alors que le code est un modulith (`core`, `manga`, `videogame`,
`boardgame`, `custom`). Un audit des quatre README contre le code a trouvé
d'autres écarts.

- **`backend/README.md`** : « Le projet » et « Architecture » décrivent les cinq
  modules, leurs frontières et les points d'extension ; la section sur les types
  devient « Types de collection dynamiques » (module `custom`) ; la liste des
  fournisseurs est complète ; la convention de langue est corrigée (code en
  anglais). Chiffres périmés retirés (69 fichiers, 92 routes, 3 types du MVP).
  Les guides BGG/IGDB/MAL et les sections « Comptes et session » et
  « L'isolation » sont gardés (d'autres documents y renvoient).
- **`README.md`** : flux de test web réécrit pour la navigation à trois entrées,
  Node 24, chemin de `CorsConfig`, fichiers compose `nas` et `e2e`, variables
  `GEMINI_*`, `GOOGLE_BOOKS_API_KEY`, `SESSION_COOKIE_SECURE`, scénario iOS marqué
  historique.
- **`web/README.md`** : « État actuel » réécrit (le scan caméra n'y était plus
  « pas construit »), liste des pages, scripts (`check:frontieres`, mise en garde
  sur `tsc --noEmit`), chiffre de tests retiré (il se périme à chaque lot).
- **`ios/README.md`** : titre, chemins (`cd ios`), zip du backend, « pas de JWT »,
  `Settings/`, scénario marqué historique.
- **`backend/CLAUDE.md`** : la phrase qui disait le README backend périmé est
  remplacée par un renvoi vers sa section « Architecture ».

Hors périmètre, signalé : `backend/requests.http` (en anglais, ne couvre que
l'ancien parcours de base) ; le dossier non suivi `ios/IozyCore/{Models,Networking,Features/`.

Vérifié : un script a contrôlé chaque chemin, fichier, script npm et variable
cités dans les quatre README (14 faux positifs examinés : routes, URL, types
MIME) ; les classes de test citées et les sections visées par `docs/` existent.
Pas d'e2e ni de vérification en direct : ni `web/` ni l'API n'ont changé. Le
scénario web du README racine n'a pas été rejoué à l'écran.

### Lot 152 — « Dernières sorties » : les 10 dernières, sans période, et un batch qui se souvient

Onglet Découvrir > Sorties. Le panneau montrait les 3 premières sorties des 3
mois à venir et restait vide en local : le batch de nuit (04h30) ne tourne pas
quand la machine est éteinte, et aucune œuvre n'était « suivie ».

- **Les 10 dernières, sans période** : `GET /api/insights/releases/latest?limit=10`
  (1 à 50). `ReleaseCalendarService.latest` ouvre la période en grand côté
  serveur (les sources ne s'en servent que comme filtre) ; la limite d'un an ne
  vaut plus que pour le calendrier à l'écran. Passé et futur mélangés, date
  décroissante, sorties « au mois » comprises (elles se rangent au 1er du mois).
  Côté web, un seul appel : plus de fenêtres par années.
- **Possessions et envies au calendrier** : une œuvre entre au calendrier si elle
  est suivie, possédée (possession active) ou voulue. C'est un revirement du lot
  de V35 (« seule l'œuvre suivie entre ») : tomes possédés et aucun suivi
  donnaient un calendrier vide. La relation affichée suit : Possédé, Envie
  (envie de l'œuvre entière) ou À acheter (suivie seulement). Textes de
  `/releases` et du panneau mis d'accord (« ta collection et tes envies »).
- **Le batch se souvient** : table `release_refresh_run` (migration V36, cœur,
  sans propriétaire). `ReleaseRefreshService` (cœur) lance les
  `ReleaseRefreshSource` (point d'extension ; `MangaReleaseRefresh` l'implémente),
  à 04h30 et sur demande, et enregistre chaque passage (début, fin, origine,
  séries à relire, relues, arrêt sur source muette, erreur). Un seul passage à la
  fois. `RELEASES_REFRESH_ENABLED=false` coupe seulement la nuit.
  `GET/POST /api/insights/releases/refresh` : état et lancement en arrière-plan
  (202, 409 si déjà en cours ; refusé au visiteur comme toute écriture).
- **Écran** : le panneau dit « Sorties mises à jour il y a 3 jours » (ou jamais),
  combien de séries restent à relire, et si une source s'est tue ; bouton
  « Mettre à jour maintenant », qui recharge le panneau à la fin du passage.
  Pas de rattrapage automatique au démarrage : on choisit de lancer ou non.
- **Densité** : variante `dense` de `ReleaseRow` (jaquette 40×28, filet fin, plus
  de carte) ; la liste passe sur deux colonnes dès 768 px (5 + 5), car les
  lignes pleine largeur laissaient un grand vide entre titre et relation.

Vérifié : 18 parcours e2e verts (`releases.spec.ts` étendu : l'œuvre est
seulement possédée, pas suivie ; le panneau dit « jamais mises à jour » puis le
bouton laisse une date). Mesure en direct sur la pile jetable (12 œuvres datées
de −200 à +40 jours plus une de 2099 et une au mois) : au bureau, 2 colonnes
de 5 lignes de 53 px, soit environ 265 px de haut ; sur mobile 390 px, une
colonne de 10 × 53 px, aucun débordement horizontal ; ordre décroissant ; thèmes
clair et sombre relus. Backend : tests du service de calendrier, du service de
rafraîchissement, de la persistance (Testcontainers), du contrat HTTP et
`ModulesTest`. Web : 429+ tests, `typecheck`, `check:frontieres`,
`check:contrast`, `build`.

Pièges : (1) l'API de la pile de dev tournait sur une image de deux semaines :
« No static resource api/insights/releases/latest » veut dire qu'il faut
`docker compose build iozycore-api` puis `up -d --no-deps --force-recreate
iozycore-api` (sessions perdues, V36 appliquée à la base de dev). (2) Playwright
1.63 demandait un Chromium absent : `npx playwright install chromium`. (3) Le
batch ne relit que 10 séries par passage : sur une grande collection, plusieurs
lancements manuels sont nécessaires, la ligne dit combien il en reste.

### Lot 153 — La validation photo s'enregistre à chaque tome, et se quitte quand on veut

Import de la bibliothèque depuis une photo (lot 147). Retour du propriétaire :
« ça me saoule de pas pouvoir finir l'étape de validation quand je le veux. Si ma
photo montre 80 mangas, je devrais faire les 80. Et il faut pas gérer ceux déjà
dans ma collection. » Puis : « je voudrais que ça enregistre à chaque fois que je
valide un tome, ça permet de quitter à tout moment ».

- **« C'est bien ça » écrit tout de suite** : ce seul tome part à
  `POST /api/shelf-import/apply` (même déduplication serveur que le
  récapitulatif), l'extrait suivant n'arrive qu'une fois le tome enregistré, et un
  échec laisse sur l'extrait avec « L'ajout a échoué : rien n'a été écrit ».
  « Écarter » n'écrit rien. C'est un revirement de la règle du lot 147 (« un écran
  qui relit avant d'écrire ») : la validation un par un EST la relecture. Le
  récapitulatif et sa relecture restent pour ce qui n'est pas encore décidé.
  Quitter la page ne perd rien : relire la même photo montre ces tomes comme
  « déjà possédés » (règle serveur du lot 147).
- **Les possédés ne se gèrent pas** : retirés des groupes, des pastilles et du
  compteur du récapitulatif, qui les compte en une phrase (« dont N déjà dans ta
  collection ignorés », « N ajoutés à l'instant »). Ils n'étaient déjà plus dans
  la validation. Limite connue : un tome possédé dont le numéro n'est pas lu, ou
  dont la série n'est pas rattachée au catalogue, ne peut pas être reconnu côté
  serveur et reste proposé.
- **Reprise au premier extrait non décidé** : le bouton du récapitulatif disait
  toujours « Valider un par un (N) » et repartait de 0. Il dit maintenant
  « Reprendre la validation (47 restants sur 60) » et reprend là où on s'était
  arrêté ; « Passer » laisse un extrait ouvert.
- **Une édition a toujours un nom** : plus de « Je ne sais pas ». Choix dans une
  liste déroulante (`ChoixEdition`), présélectionné quand il n'y a qu'un choix,
  vide sinon ; rien ne s'écrit pour une série qui n'est pas rattachée au catalogue
  tant que l'édition n'est pas choisie (la série rattachée garde l'édition que le
  catalogue résout). La liste d'une série nouvelle vient du catalogue et des
  sources (`useEditionsDesSeries` : mêmes appel et clé de cache que la fiche
  d'une œuvre, `searchVolumes`), **une série à la fois, celle de l'extrait en
  cours** — une recherche par série au récapitulatif ferait bloquer l'IP par la
  BnF. Aucune édition trouvée, ou source muette : le seul choix est « Édition
  standard ». Noms dédoublonnés sans casse ni accents (« Édition Originale » =
  « Édition originale »).
- **La mention lue sur la photo ne sert que de repli** : une tranche montre
  souvent l'éditeur (« Glénat »), que le moteur renvoie comme édition ; elle
  s'affichait à côté de la vraie (One Piece : « Glénat » + « Édition originale »
  pour une seule édition). Elle n'entre plus dans la liste que si le catalogue et
  les sources n'en connaissent aucune. Contrepartie : une vraie édition distincte
  lue sur la photo (« Masked ») n'est plus proposée quand le catalogue en connaît
  déjà une. Si le cas se présente, resserrer le prompt de lecture plutôt que
  d'ajouter un champ libre.
- **Contrôles natifs aux couleurs de l'app** : `color-scheme` suivait le système
  (`light dark`), pas le thème choisi dans l'app, donc la liste déroulante
  s'ouvrait en couleurs claires avec le texte clair de l'app. `html` = `light`,
  `html[data-theme="dark"]` = `dark`, et les `option` prennent la surface et le texte
  de l'app. Le réglage est global : les autres contrôles natifs (défilement,
  dates) suivent aussi le thème de l'app. La surbrillance de l'option survolée est
  dessinée par le navigateur ; si elle reste illisible, il faudra une liste
  dessinée par l'app.

Vérifié : `import-photo.spec.ts` étendu, 19 parcours e2e verts. Le nouveau parcours
fait lire la photo par une réponse simulée (la pile n'a pas de moteur) et laisse
tout le reste réel : la liste d'éditions (aucune clé de source, donc « Édition
standard » présélectionnée), l'écriture au clic (réponse `apply` : 1 tome ajouté,
édition « Édition standard »), puis, la page quittée sur le deuxième extrait, la
possession relue par `/api/ownerships` (1). Pile jetable détruite ensuite.
Web : 440 tests (dont reprise, échec d'écriture, numéro corrigé, édition à
choisir, liste unique avec éditeur lu et deux orthographes), mutations vérifiées
(reprise, possédés, présélection, repli, source muette, dédoublonnage),
`typecheck`, `lint` propre sur `import-photo`, `check:frontieres`,
`check:contrast`, `build`. Pas touché au backend. **Non vérifié** : la lecture avec
le vrai moteur (clé Gemini) et le rendu de la liste ouverte dans un vrai
navigateur — le navigateur de l'app ne compose aucune image. Piège rencontré :
dans un script Bash, les antislashs d'une expression régulière arrivent perdus
(`\p{M}` devient `p{M}`) ; écrire ces fichiers avec l'outil d'édition.


Revue du lot : deux défauts de correction trouvés et corrigés. (1) « Précédent » et « Passer » restaient actifs pendant l'enregistrement : un clic juste après « C'est bien ça » détachait le rappel, le tome était écrit mais pas marqué ; ils sont grisés tant que l'ajout est en route. (2) Quand seules les éditions manquaient, le récapitulatif disait « Rien de coché à ajouter » ; il dit « Choisis une édition pour ajouter ». 442 tests web.

### Lot 154 — Le mode visiteur consulte un catalogue, pas une collection vide

Test exploratoire du mode visiteur (agent-browser, 1440×900 puis 390×844) : cinq
défauts reproduits. Le fil conducteur : un visiteur n'a ni collection, ni envies,
ni lectures. La fiche le traitait comme un compte qui possède zéro tome.

- **ISBN trouvé, puis perdu** : le scan menait à `/apercu`, route réservée aux
  comptes ; le garde renvoyait aussitôt vers `/add`, sans un mot. `/apercu` sort
  de `accesInvite`. L'aperçu bascule déjà sur la fiche du catalogue quand le
  titre y existe ; sinon il s'affiche en lecture seule : pas de proposition de
  tomes (une recherche par édition chez les fournisseurs, qui ne sert qu'à
  ajouter), pas de phrase sur « ta collection », et pas de nouvelle recherche
  quand le candidat arrive avec la navigation.
- **Scan sous Manga seulement** : la recherche par code-barres ne connaît que
  les livres. Sous « Jeu vidéo », il partait avec le mauvais type et répondait
  « Aucune correspondance » pour un ISBN valide. Le libellé perd
  « (mangas uniquement) », devenu inutile.
- **Liste vide** : le catalogue dit maintenant « Aucune œuvre ne correspond à
  cette recherche. », « Aucune œuvre de ce type dans le catalogue. » ou « Aucune
  œuvre ne correspond à ces filtres. ». Le message n'apparaît qu'une fois la
  requête répondue pour le titre tapé (pas pendant le délai de frappe ni le
  chargement), et seulement quand aucune recherche externe ne parle déjà.
- **Fiche visiteur** : `GrilleVolumes` gagne un mode `consultation` (tuiles non
  grisées, pas de filtres Tous/Manquants/Possédés, aucun geste, « Tome N »), et
  `CartesEditions` un drapeau `consultation` (éditeur et nombre de tomes, pas de
  jauge ; « Nombre de tomes non renseigné » au lieu de « Détails à renseigner »).
  « Suivre cette édition », l'état « Possédée / Suivie » et la proposition de
  tomes d'une fiche sans tome sont masqués au visiteur.
- **Aide** : en visiteur, des questions sur l'œuvre, présentes seulement si la
  donnée existe (« Combien de tomes compte cette édition ? », « Cette série
  est-elle terminée ? », « Quelles éditions sont connues ? », « Qui est le
  mangaka ? »), calculées sur les mêmes tuiles et cartes que la page. Pour un
  compte, « Que me manque-t-il ? » avec un total inconnu répond les mêmes tomes
  que le filtre « Manquants » de la grille, au lieu de dire qu'il ne peut rien
  dire à côté d'un compteur.
- **Navigation** : le lien de retour vers le Catalogue s'appelle « Catalogue »
  (il disait « Recherche ») ; la page introuvable mène un visiteur « Retour au
  catalogue », vers `/add`.
- **Statut source** : `libelleStatutSerie` traduit à l'affichage les mots des
  trois sources (FINISHED → Terminée, RELEASING/Publishing → En cours, on_hiatus →
  En pause, discontinued → Arrêtée, not_yet_released → À paraître) ; la valeur
  stockée ne change pas. `isSeriesOngoing` lit aussi le RELEASING d'AniList,
  comme `SeriesStatus` côté serveur.
- **Aide sur mobile** : le bouton flottant couvrait le bas de la carte Source.
  Une marge en fin de fiche (mobile seulement), une cible de 44 px, et une
  position qui suit la zone de sécurité comme la barre du bas.

Vérifié en direct (visiteur, desktop et 390×844) : filtres, recherche trouvée et
vide, catégorie vide, ISBN 9782723488525 → aperçu conservé, rechargement direct de
l'aperçu, fiche, aide, retour, 404, thème, aucun débordement, aucune requête
d'écriture, aucune erreur console. Web : 460 tests, mutations vérifiées (scan
Manga, filtres en consultation, aide alignée), `typecheck`, `build`,
`check:contrast`, `check:frontieres` ; `lint` sans nouvel avertissement (19 déjà
présents). Pas touché au backend. **Non vérifié en direct** : la fiche d'un
compte connecté (aucun compte de test sur l'instance de dev) ; la règle de
l'aide est couverte par un test. e2e : `visite.spec.ts` réécrit pour la nouvelle
règle (trois tomes en consultation, aucun « manquant » ni « possédé », pas de
« J'ai le tome 2 », aide sur l'œuvre) ; le refus côté serveur (403) reste vérifié.
19 parcours verts sur 19 (sur `main`, avec la correction de `releases.spec.ts`
du lot 155, qui échouait sans lien avec ce lot).

Piège : sous Node 26, `localStorage` natif masque celui de jsdom et 38 tests
tombent avant même ce lot. `NODE_OPTIONS=--no-experimental-webstorage npm test`
rend la suite verte.

### Lot 155 — Le parcours « sorties » retrouve son titre de mois

`releases.spec.ts` échouait depuis le lot 152 : sur `/releases?mois=`, « Novembre
2026 » est à la fois le titre du mois de la grille (niveau 2) et un intertitre du
panneau « À venir » (niveau 3, sous son propre titre « À venir »). Le sélecteur
`getByRole('heading', { name })` trouvait donc deux titres.

**Décision : le test, pas l'écran.** Le plan des titres est juste : deux titres
de niveau 2 (le mois affiché, « À venir »), et sous « À venir » un niveau 3 par
mois, dans un `aside` nommé. Un lecteur d'écran qui parcourt les titres entend
deux fois « Novembre 2026 », mais à deux niveaux et dans deux zones différentes,
ce qui est le comportement attendu. Retirer les intertitres du panneau lui
ferait perdre sa navigation par mois. Le sélecteur demande maintenant le niveau
2, comme le fait déjà la ligne suivante pour le jour (niveau 3).

**Vérification** : e2e 19 parcours verts sur 19, `typecheck` propre, `lint` sans
nouvel avertissement (19 déjà présents), 460 tests unitaires verts (avec
`NODE_OPTIONS=--no-experimental-webstorage`). Aucun code de l'app touché.

### Lot 156 — Un tome scanné rejoint sa série

Trouvé par un test exploratoire sur la pile e2e : sur `/scan`, l'ISBN
9782723488525 puis « Ajouter à ma collection » créait une œuvre « One Piece -
Édition originale Tome 01 », avec un tome 1 en édition « Shônen Manga ». Le tome 2
aurait créé une autre série. Open Library décrit **un tome** : son titre est
celui du tome, et sa liste d'éditeurs commence par le label de collection
(« Shônen Manga », puis « GLENAT », « Glénat Manga »). Le même titre partait
aussi vers l'aperçu (`/apercu?titre=…`) et vers la recherche « déjà connu ».

**Décision : le backend lit le titre du livre, une seule fois.** Les deux
fournisseurs ISBN (Google Books, Open Library) passent par `IsbnBookTitle`, qui
applique les règles de `ListingTextParser`, déjà utilisées pour les codes-barres
d'une photo de pile et le titre d'une annonce. Le candidat garde la série comme
titre (« One Piece ») et dit à part, dans `volume`, le tome décrit : titre de la
source, numéro (1), édition nommée dans le titre telle qu'elle est écrite
(« Édition originale », pas « Originale Edition »). `volume` est hors des
`attributes`, car ceux-ci sont copiés sur la fiche de l'œuvre : un numéro de
tome y aurait atterri sur la série.

- Un nom fait **seulement** de mots de collection (shōnen, seinen, shōjo, josei,
  kodomo, manga, collection) n'est ni un éditeur ni une édition : on prend le
  premier éditeur qui n'en est pas un. « Glénat Manga » reste un éditeur.
- Pas de numéro dans le titre : pas de numéro. Plusieurs numéros (un coffret) :
  pas de numéro non plus. Un titre que les règles videraient reste tel quel.
- Le scan lit `volume.number` et `volume.edition` (repli sur l'éditeur comme
  avant). L'ajout rapide déduplique déjà par titre : le tome rejoint la série
  « One Piece » si elle existe.
- La photo de pile reçoit toujours le titre de la source : c'est là qu'elle
  relit le numéro.

**Vérification** : un test Open Library sur la vraie réponse de cet ISBN (série,
numéro, édition, éditeur), un test de `ScanPage` (l'ajout envoie « One Piece »,
tome 1, « Édition originale » ; deux mutations attrapées). Backend : 1220 tests
verts. Web : 461 tests verts, `typecheck` propre, `lint` sans nouvel
avertissement (19 déjà présents). e2e : 19 parcours verts. En direct sur la pile
e2e (API :8090) : l'ISBN du tome 1 puis celui de « One Piece, tome 3 » donnent une
seule œuvre « One Piece » avec « Tome 1 — Édition originale » et « Tome 3 —
Glénat » ; l'écran `/scan` affiche « One Piece », « Tome 1 · Édition originale »
et « Déjà connu d'IozyCore ». Pile jetable, laissée en place.

### Lot 157 — Le résultat d'une analyse d'achat ne dit plus qu'une chose sur le prix

Test exploratoire du 2026-10-13 : un compte possède Pluto 1 à 6 sur 8 (édition
« Standard », prix neuf connu), l'annonce saisie à la main vend les tomes 7 et 8
pour 12 € plus 4 € de port, sans aucun prix relevé. Le même écran disait :
« Utile pour toi — prix impossible à situer » et « Référence insuffisante »,
un badge « Cher · 39/100 » avec « Confiance Haute », « Le prix demandé se situe
déjà dans une fourchette correcte », puis « 2/8 volumes · 6 manquants » et
« 6/8 tomes manquants pour compléter cette édition » pour un lot qui complète
justement l'édition. Et le port tapé par l'utilisateur s'affichait « 4,00 € estimés ».

**D'où venait chaque phrase.** Trois calculs jugeaient le prix, chacun sur sa
source : la section Prix sur les seuls prix relevés comparables
(`MarketReference`), la négociation sur une valeur estimée (prix neuf décoté,
ou estimation IA), le badge sur la note globale du moteur (`VerdictScorer`),
dont les libellés « Prix correct » et « Cher » sont des mots de prix alors que la
note mêle prix, état, édition et complétude. La complétude, elle, ne comptait
que les tomes du lot : 39/100 venait surtout de ces « 6 manquants » et de leur
coût pour compléter.

**Décision : la section Prix est le seul juge du prix.** Les estimations restent
utiles, mais elles ne prononcent plus de verdict.

- **Négociation** (`NegotiationEngine`) : sans référence utilisable, les trois
  montants restent (offre, cible, maximum), avec une seule phrase qui dit leur
  base : « un repère pour négocier, pas un avis sur le prix demandé ». Plus de
  « fourchette correcte », plus de « passer l'annonce » tirés d'un prix neuf.
  Conséquence voulue : sans référence, le moteur ne rabaisse plus la note en
  « Cher » sur la foi d'une estimation ; l'écart à la valeur estimée reste
  compté dans la note par son propre critère.
- **Note globale** : quand l'évaluation personnalisée existe, l'écran affiche
  « Note globale 53/100 · prix, état, édition et complétude réunis », sans mot de
  prix. Une analyse ancienne sans évaluation garde son badge : c'était son seul
  verdict. L'historique (liste) garde aussi ses badges.
- **Confiance** : plafonnée à « Moyenne » tant qu'aucun prix comparable n'est
  relevé. Dix critères calculés ne sont pas dix critères connus.
- **Complétude** : comptée sur ce que l'utilisateur tiendrait après l'achat, le
  lot plus ses tomes déjà possédés. La ligne dit « Édition complète avec ce lot
  (2 dans le lot + 6 déjà possédés) », ou « 5/8 volumes avec ce lot et ta
  collection · 3 manquants » ; l'avertissement ajoute « en comptant ceux que tu
  possèdes ». Les critères complétude et coût pour compléter de la note lisent
  le même calcul. Une analyse enregistrée avant ce lot s'affiche comme avant.
- **Port saisi** : « 4,00 € (montant saisi) » au lieu de « estimés ».
- Au passage, la fin anglaise « cost unknown » de l'avertissement de complétude
  devient « coût inconnu ».

**Vérification** : en direct sur une pile e2e à part (API :8091, web :5175, la
pile :8090 servait à une autre session), même scénario : un seul verdict de prix
(« Référence insuffisante »), note 53/100 confiance moyenne, phrase de
négociation neutre, « Édition complète avec ce lot (2 dans le lot + 6 déjà
possédés) », port « 4,00 € (montant saisi) ». `market_price_observation` : 0
avant, 0 après ; pile détruite ensuite. Tests : 5 nouveaux tests web (4 tombent
sur l'ancien code), 3 tests moteur ; 465 tests unitaires verts (avec
`NODE_OPTIONS=--no-experimental-webstorage`), `typecheck` propre, `lint` sans
nouvel avertissement (19 déjà présents), suite backend complète verte.

### Lot 158 — Douze petits défauts du test exploratoire du 13 octobre

Le parcours complet à l'agent-browser (bureau et 390×844) a relevé douze défauts
visibles, chacun petit. Ce lot les corrige tous ; deux plus gros (le scan ISBN qui
crée une série par tome, les verdicts de l'analyse d'achat) ont leur propre lot.

- **Profil, « Titres »** : le chiffre était `totalEntities`, la taille du
  catalogue **partagé** (14), à côté de la valeur du compte (13 œuvres dans Ma
  collection). Il s'appelle maintenant « Œuvres au catalogue », comme sur l'écran
  Statistiques. Afficher les titres du compte demanderait un champ de plus côté
  serveur ; le nom juste suffit.
- **Suppression bloquée** : le message du serveur montrait l'identifiant et des
  mots anglais (« 6 ownership(s) »). Il dit maintenant « Impossible de supprimer
  cette fiche : elle a encore 6 exemplaires, 1 expérience et 1 édition. », sans
  nommer ce qui vaut zéro. Même forme pour un tome.
- **Mode Éditer, colonne SOURCE** : les six champs n'avaient pas de nom
  accessible, et le premier libellé était la clé brute « malId ». Chaque champ
  porte le libellé de sa ligne ; « malId » devient « Identifiant MyAnimeList »
  (et « Identifiant IGDB », « Identifiant BGG »).
- **Import BGG** : BGG répond 200 avec `<errors>` pour un pseudo inconnu, lu
  comme une collection vide (« 0 créé(s) … sur 0 trouvé(s) »). Le serveur en fait
  une erreur claire (« Ce pseudo n'existe pas sur BoardGameGeek. ») ; une vraie
  collection vide se dit « aucun jeu marqué « possédé » sur ce compte », et le
  compte final s'écrit en français (« 2 jeux ajoutés, 1 déjà présent »).
- **Découvrir, suggestions** : un fournisseur en panne renvoie une liste vide,
  comme « rien trouvé ». Le serveur ne sait pas encore les distinguer : le
  panneau nomme donc les deux causes (« soit rien ne donne de piste, soit la
  source n'a pas répondu ») et propose « Réessayer ». Distinguer vraiment les deux
  demande de changer le contrat `DiscoverySource` dans le cœur et les trois
  univers : c'est une suite, pas ce lot.
- **Aide « Où en suis-je ? »** : elle renvoyait vers « Expériences », dans « Mon
  suivi », qui n'existe plus. Elle dit « avec « Éditer », en haut de la fiche ».
- **Note moyenne** : « 7.0/10 » devient « 7,0/10 » (`formaterDecimal`).
- **Jaquettes manquantes** : après une panne, le compte était remis au total,
  d'où « 9/9 séries traitées, réessaie plus tard pour les autres ». Il ne compte
  que les séries finies avant la panne : « Le fournisseur a cessé de répondre
  après 8 séries sur 9 : réessaie plus tard pour l'autre. »
- **Mise à jour des sorties** : l'interrogation toutes les 2 s s'arrêtait quand
  l'onglet perdait le focus (`refetchIntervalInBackground` vaut faux par défaut),
  et la ligne restait sur « en cours » jusqu'au rechargement. Elle continue
  maintenant en arrière-plan, seulement pendant une passe.
- **/scan** : un lien de retour vers le Catalogue, comme `/import-bgg` et
  `/import-photo`.
- **Tutoiement** : « puis vous confirmez » et trois autres « vous » (analyse
  d'annonce, envies) passent au « tu ». Un test lit toutes les sources à la
  recherche de « vous », « votre », « vos », sauf le message écrit au vendeur.
- **Valeur par type** : un type sans aucun prix connu affichait « 0,00 € (0/1) ».
  Il dit « prix neuf inconnu (1 possession) ».
- **Tier list sur mobile** : le titre d'une tuile sans jaquette était coupé au
  milieu d'un mot par le bord. Il se coupe dans les mots si besoin et finit par
  des points de suspension (5 lignes au plus) ; le titre complet reste dans le
  nom du bouton.

**Vérification** : web 71 fichiers de tests verts (`NODE_OPTIONS=--no-experimental-webstorage`),
mutations vérifiées sur six règles, `typecheck` propre, `lint` sans avertissement
dans les fichiers du lot. Serveur : suite complète verte (1 222 tests). e2e : 19
parcours sur 19 (`suggestions.spec.ts` suit la nouvelle phrase). En direct sur la
pile e2e (web :5174) : message de suppression (409), héros du Profil, noms des six
champs SOURCE, aide sans lecture, note « 7,5/10 », lien retour de `/scan`, aucun
« vous » sur l'analyse d'annonce, valeur par type, pseudo BGG inconnu (vrai appel
à BGG), tuile de tier list à 390 px sans débordement. **Pas vu en direct** : une
longue passe de sorties (elle finit en 30 ms sur la pile e2e) et la panne du
fournisseur de jaquettes ; les deux sont couverts par un test qui échouait avant
la correction. Pile jetable démontée ensuite.

### Lot 159 — Découvrir distingue « la source n'a pas répondu » de « rien à proposer »

Suite du lot 158. Un fournisseur en panne renvoyait une liste vide, comme « rien
trouvé », et `GET /api/insights/discover` renvoyait une liste nue : le panneau
Découvertes devait nommer les deux causes à la fois. Le serveur dit maintenant
laquelle.

- **Point d'extension** : `DiscoverySource.discover` renvoie un `Discovery`
  (cœur) : les suggestions, `sourceAnswered` (faux dès qu'un appel à la source
  est resté sans réponse) et `emptyReason` quand l'univers n'a rien eu à
  demander : `NOTHING_OWNED`, `NO_RATED_WORK`, `NO_KNOWN_AUTHOR`,
  `NOT_LINKED_TO_SOURCE`. Les univers dépendent toujours du cœur seul
  (`ModulesTest` vert).
- **Réponse HTTP** : `{ candidates, sourceAnswered, emptyReason }` au lieu d'une
  liste. Seul le web la lit (iOS est hors service).
- **Manga** : `MetadataProvider` gagne `searchOrThrow`, qui lève
  `SourceUnavailableException` au lieu de rendre une liste vide. Jikan,
  MyAnimeList, AniList et la recherche par titre de Google Books l'implémentent ;
  leur `search` garde son comportement (liste vide et `WARN`). Une recherche par
  auteur compte comme répondue si un fournisseur a répondu, même à vide. Le
  cache d'une demi-heure ne garde qu'un résultat non vide **et complet**.
- **Jeux vidéo et jeux de société** : `IgdbSimilarGamesFetcher`,
  `BggThingFetcher` et `BggHotListFetcher` (utilisés seulement par Découvrir)
  lèvent `SourceUnavailableException` sur une panne. Un jeu sans réponse est
  sauté et le résultat le dit. Sans liste « hot » de BGG, rien n'est proposable.
- **Panneau** : liste vide et source muette → « Manga : la source n'a pas
  répondu. » avec « Réessayer ». Liste vide et source qui a répondu → « Manga :
  rien à proposer. » suivi de la raison (« Aucune œuvre notée : note celles que
  tu aimes, leurs auteurs serviront de piste. », etc.), sans bouton. Liste non
  vide mais incomplète → « Liste incomplète : la source n'a pas toujours
  répondu. » avec « Réessayer ».

**Vérification** : serveur, suite complète verte (1 238 tests), dont 22 tests de
découverte sans réseau (faux écrits à la main, nouveau `BoardGameDiscoveryTest`).
Web : 71 fichiers de tests verts (`NODE_OPTIONS=--no-experimental-webstorage`),
dont les deux phrases et la liste incomplète ; `typecheck` propre ; `lint` sans
avertissement dans les fichiers du lot. e2e : `suggestions.spec.ts` vert sur la
vraie API (aucune note sur le compte e2e → « rien à proposer », raison
`NO_RATED_WORK`, aucune annonce de panne).

### Lot 160 — Un jeu de société ajouté reçoit sa jaquette et ses détails BGG

Vu en semant des données de test : tout jeu de société arrivait sans jaquette.
La recherche BGG (`/xmlapi2/search`) ne donne qu'un identifiant, un titre et une
année. Carcassonne ajouté depuis la recherche n'avait que `bggId: 822` et
`yearPublished: 2000`. Le reste (image, joueurs, durée, auteurs) demande un
second appel par jeu à `/xmlapi2/thing`, que seul Découvrir faisait.

- **Point d'extension** : `MetadataProvider.details(attributes)` (cœur), vide
  par défaut. La source retrouve son propre identifiant dans les attributs
  (`bggId` pour BGG) et rend des clés d'attributs. `MetadataDetailsService` les
  demande aux sources du type ; une source muette ne donne rien (`WARN`) et
  n'interrompt jamais l'ajout. Ce qui est déjà dans les attributs l'emporte
  toujours : un détail ne remplit qu'une clé absente.
- **Quand** : une fois par jeu ajouté (`POST /entities/quick-add`,
  `POST /wishlist` pour une œuvre sans fiche), à l'ouverture de l'aperçu et sur
  « Recharger depuis la source ». Jamais pour chaque résultat de recherche : ce
  serait dix appels par frappe. L'appel se fait avant la transaction, pour
  qu'une source lente ne tienne pas une connexion à la base.
- **BGG** : `BggThingFetcher.fetchThing` lit l'image (la grande, pas la
  vignette 200×150), les joueurs, la durée et les auteurs. Les réponses sont
  gardées un jour, pas les silences : aperçu, ajout puis rechargement coûtent un
  seul appel. Découvrir profite du même cache. Un champ que BGG laisse à `0` ou
  un auteur `(Uncredited)` ne compte pas comme une réponse. L'absence de jeton
  (`bgg.application-token`) est signalée une fois au premier appel.
- **Clés** : la jaquette sous `coverImageUrl`, la clé commune que lisent la
  collection, les envies et la page de partage. Les joueurs et la durée sous les
  clés que le type déclarait déjà sans que rien ne les remplisse : `minPlayers`,
  `maxPlayers`, `averageDurationMinutes`. Les auteurs sous `designers`, repris
  comme ligne « Auteur » de la fiche et de l'aperçu.
- **Route** : `GET /api/metadata/details?entityTypeId=…&bggId=822`. Elle répond
  `{}` quand la source n'a rien de plus ou s'est tue : l'écran garde le résultat
  de la recherche. En `GET`, elle reste ouverte au visiteur, en lecture seule.
- **Web** : l'aperçu demande les détails de l'œuvre ouverte et les montre ;
  « Recharger depuis la source » complète le candidat trouvé avant de calculer
  ce qu'il faut écrire. Les règles de rechargement ne changent pas : la jaquette
  ne s'écrit que si elle manque, les champs saisis à la main restent intacts.
  Libellés français des nouvelles clés dans l'inspecteur.

**Hors lot** : l'import d'une collection BGG ne passe pas par ces routes et
n'appelle pas `/thing` pour chaque jeu importé (des centaines d'appels d'un
coup). La réponse de `/collection` contient déjà l'image : la lire serait le
bon chemin.

**Vérification** : serveur, suite complète verte (1 254 tests), dont des tests
de contrat HTTP sans réseau (faux fournisseur) pour l'ajout, l'envie, la source
muette et la priorité des attributs déjà fournis. Web : 486 tests verts,
`typecheck` propre, `lint` sans avertissement dans les fichiers du lot. En
direct, sur une pile jetable (base vide, port 8095, vrai jeton BGG) ensuite
supprimée : la recherche « Carcassonne » rend 10 résultats sans appel `/thing` ;
l'ajout donne jaquette, 2 à 5 joueurs, 45 min et Klaus-Jürgen Wrede ; Azul ajouté
en envie reçoit les siens ; l'aperçu fait un seul appel `/details` et affiche
l'auteur ; sur un Catan privé de ses détails, « Recharger depuis la source »
annonce « 5 informations mises à jour » et rend jaquette, joueurs, durée et
auteur.

### Lot 161 — Un jeu importé depuis BGG reçoit sa jaquette sans appel par jeu

Suite du lot 160, resté « hors lot » : l'import d'une collection BGG créait des
jeux sans jaquette. Appeler `/xmlapi2/thing` pour chaque jeu importé ferait des
centaines d'appels d'un coup. Or la réponse de `/xmlapi2/collection` contient
déjà l'image de chaque jeu.

- **Lecture** : `BggCollectionFetcher` lit `<image>` (la grande, pas
  `<thumbnail>`). La requête passe à `stats=1` : chaque jeu porte alors
  `<stats minplayers maxplayers playingtime>`, lus au passage. Toujours un seul
  appel pour toute la collection. Un champ que BGG laisse à `0` ne compte pas.
- **Clés** : les mêmes que le lot 160, pour qu'un jeu importé ressemble à un jeu
  ajouté à la main : `coverImageUrl`, `minPlayers`, `maxPlayers`,
  `averageDurationMinutes`, en plus de `bggId` et `yearPublished`.
- **Sans image** : le jeu est importé quand même, sans ces clés. Aucun échec
  d'import n'en dépend.
- **Réimport** : une fiche déjà présente ne reçoit que les clés qui lui
  manquent (règle existante de `CatalogEntityResolver`). Réimporter la même
  collection donne donc une jaquette aux jeux importés avant ce lot, sans
  toucher à ce qui a été saisi à la main.
- `BggCollectionItem` gagne ces champs ; un constructeur à trois arguments reste
  pour la liste « hot », qui n'a ni image ni statistiques.

**Vérification** : serveur, suite complète verte (1 257 tests), dont la lecture
d'une réponse `/collection` inline (image, joueurs, durée ; jeu sans image ni
statistiques gardé avec des champs vides), l'import qui range la jaquette sous
`coverImageUrl` et importe un jeu sans image, et le réimport qui complète la
jaquette d'un jeu existant. Pas de vérification en direct contre BGG dans ce
lot.

### Lot 162 — Cinq corrections issues de la revue UI/UX du 2026-10-13

Une revue d'ensemble, faite en direct sur l'instance locale (connexion, mode
visiteur, Ma collection, fiche, Découvrir ; bureau 1280 px et mobile 375 px,
thèmes clair et sombre), a donné cinq priorités. Un commit par point.

1. **Tuiles de tomes** (`GrilleVolumes`). Sans jaquette, un tome possédé et un
   tome manquant étaient deux blocs gris. Possédé : tuile pleine (`surface2`),
   chiffre `textPrimary`. Manquant : emplacement vide à bord pointillé, chiffre
   `faint`. Voulu : pointillé `accent`, chiffre `accentText`. Le chiffre blanc
   à 90 % sur `handle` tombait à environ 1,6:1 en thème clair ; il passe à
   environ 14:1. Seule la jaquette d'un tome manquant est encore atténuée, plus
   la tuile entière. `check:contrast` ne voyait pas le défaut : il ne teste pas
   les couleurs semi-transparentes.
2. **Barre de Ma collection** (`BarreVues`, `CollectionFilters`, `ShelfPage`,
   `CategoryPage`). Huit contrôles sur trois lignes, environ 40 % d'un écran de
   téléphone avant la première jaquette. Il reste le segment Tout / Possédés /
   Suivies / Envies, « Affichage » et « ⋯ ». Grouper et Trier passent en tête
   du panneau, renommé « Affichage » ; « Valeur de la collection » passe dans
   le menu « ⋯ ». Le bouton du panneau devient « Effacer les filtres » : il
   portait le même nom que celui de l'écran vide.
3. **Fiche** (`InspecteurFiche`, `FicheHero`, `EntityDetailPage`). En lecture,
   la colonne Personnel ne montre que les relevés qui ont une valeur ; sans
   aucun, une phrase et un bouton qui ouvre le mode édition. La colonne Source
   devient une ligne repliée « Détails techniques » ; en mode édition, elle
   redevient une colonne ouverte. « Évaluer » devient un bouton secondaire,
   « Évaluer une annonce ».
4. **Découvrir** (`DiscoverTierPreview`, `DiscoverySection`,
   `ReleaseRefreshLine`). Une carte d'univers n'apparaît que si quelque chose
   y est classé : « Rien de classé » ne se répète plus trois fois. Le panneau
   Tier Lists gagne un en-tête et « Tout voir », comme ses voisins (Découvrir
   ne menait pas à `/tier-lists`). Les découvertes en attente deviennent une
   carte avec son bouton. La ligne des sorties dit « Les sources de sorties
   n'ont pas encore été consultées » : l'ancienne phrase contredisait une
   sortie listée juste dessous. L'ordre de la page ne change pas (choix
   documenté dans `DiscoverPage`).
5. **Accrocs** (`navItems`, `TabBar`, `DesktopHeader`, `AideFlottante`). En
   visiteur, l'onglet Catalogue s'allume sur une fiche ; les deux barres lisent
   une seule fonction, `destinationsPour`. Le bouton « Aide » est un rond de
   44 px sur téléphone (le mot reste lu par les lecteurs d'écran), et la fiche
   lui garde de la place en bas à toutes les largeurs.

**Constats de la revue écartés à la vérification** : les lignes du catalogue
et le logo ont bien un nom accessible (l'outil de lecture le tronquait), et les
jaquettes « cassées » étaient en cours de chargement.

**Hors lot** : la carte d'édition affiche encore « Détails à renseigner » avec
une jauge vide alors que des tomes sont possédés. Et sous Node 26, 38 tests web
échouent avant ce lot : le `localStorage` propre à Node masque celui de jsdom.
Contournement : `NODE_OPTIONS=--no-experimental-webstorage npm test`.

**Vérification** : web, 491 tests verts avec ce contournement (dont de
nouveaux tests pour le regroupement dans le panneau, la Source repliée et
l'onglet du visiteur ; mutation vérifiée sur ce dernier), `typecheck` propre,
`lint` sans nouvel avertissement, `check:contrast` et `check:frontieres` verts.
En direct sur l'instance locale, en lecture seule (thème et regroupement remis
comme avant) : Berserk et Monster en clair et en sombre, Ma collection et
Découvrir à 1280 px et 375 px, sans débordement horizontal. L'onglet du
visiteur n'a été vérifié que par test. Pas de test e2e lancé.

### Lot 163 — Le cache durable des tomes se périme

Défaut : une ligne de `volume_search_cache` écrite une fois était servie pour
toujours, même après un changement de fournisseur ou de parseur. Chaque
correction demandait une migration qui vidait la table (V33, V34) ou des lignes
supprimées à la main. Ça contredisait « ne jamais montrer un chiffre qu'on ne
croit pas ».

- **Une ligne a un âge et une version**. `fetched_at` existait depuis V3 ; V37
  ajoute `chain_version`. `TomeSearchService` ne sert une ligne que si elle a
  moins de **30 jours** et qu'elle a été écrite par la chaîne actuelle
  (`CHAIN_VERSION`, 1). Sinon les fournisseurs sont relus. Les 30 jours : la passe
  de nuit relit déjà les séries en cours au bout de 7 jours (lot 146), les
  30 jours rattrapent le reste pour environ une recherche par série et par mois.
- **Changer la chaîne = augmenter `CHAIN_VERSION`**, plus de migration qui vide la
  table. Les lignes d'avant V37 ont la version 0 : chacune est relue à la
  prochaine ouverture de sa série.
- **Une ligne périmée n'est jamais resservie.** Si les fournisseurs se taisent,
  la réponse est vide avec le drapeau « réessaie plus tard » (`providerUnavailable`,
  `quotaExceeded` côté API), comme pour une série jamais cherchée. Le brief
  demandait de lever `SourceUnavailableException` ; rien ne l'attrape au-dessus du
  service, ce serait une 500 et une panne ferait échouer la recherche. Le drapeau
  existant dit la même chose sans casser l'écran.
- Une ligne périmée compte comme « on ne sait pas » pour la mention « aucune
  édition française » (`isVolumeSearchKnownEmpty`).
- **Recherche approfondie** : sans base fraîche, elle relance d'abord la recherche
  rapide (avec `totalVolumes`, donc avec les sondes du lot 125), sinon la ligne ne
  garderait que les éditions rares pendant 30 jours. Elle n'écrit plus de ligne
  durable sans auteur (règle du lot 126, qu'elle oubliait).

Vérifié : test rouge d'abord (une ligne de 31 jours servie sans appel), puis
`TomeSearchServiceTest` (21), `ModulesTest`, suite backend complète (1223 verts)
et 19 parcours e2e. En direct sur la pile e2e jetable : V37 appliquée (colonne à
0 par défaut), trois lignes semées ; la fraîche est servie telle quelle, celle de
31 jours et celle de version 0 sont refusées (`quotaExceeded: true`, la pile n'a
pas de clé) et restent intactes en base. Pile détruite ensuite (`down -v`).

Pas vérifié : la relecture réussie avec une vraie clé (couverte par les tests
unitaires seulement), V37 sur une base qui a des données réelles.

Laissé de côté, à reprendre si besoin :
- le calendrier (`MangaReleases`) lit `volume_search_cache` sans regarder l'âge
  ni la version : il peut montrer des dates d'une ligne que la fiche refuse ;
- la passe de nuit choisit par `fetched_at` seul, sans priorité aux lignes d'une
  ancienne version ;
- après le déploiement, toutes les lignes sont en version 0 : la mention
  « aucune édition française » disparaît jusqu'à ce que la série soit rouverte ;
- pendant une panne, une ligne périmée relance les fournisseurs à chaque
  ouverture (un résultat vide n'entre pas dans le cache partiel d'une heure) ;
- le cache mémoire de 24 h peut prolonger une ligne lue à 29 jours jusqu'à
  31 jours.


### Lot 164 — Les contrôleurs n'appellent plus de dépôt

Chaque contrôleur appelle un cas d'usage (`application/` du module) ; `LayersTest`
tient la règle. Lombok hors domaine. Doubles de test partagés dans `core/testing`.

Vérifié : suite backend (1305), 17 parcours e2e, erreurs 400/404/409 lues sur la
pile jetable.

À reprendre : `releases.spec.ts` et `suggestions.spec.ts` échouent, déjà sur
`main` ; les paquets `manga/deals` et `core/insights` mélangent encore domaine et
services.


### Lot 165 — Le client web lit la charte IozyKit

Les couleurs, ombres et polices des deux thèmes viennent du dépôt voisin
IozyKit, copié dans `web/vendor/iozykit/` par `npm run kit:sync` (`VERSION`
note le commit copié, 2fe29b8). `index.css` n'a plus de valeur de charte : le
bloc `@theme inline` relie les noms de l'app (`bg-surface`, `text-textDim`…)
aux variables `--iozy-*`, et seuls les rôles que le kit n'a pas (univers,
rangs, voiles) gardent leurs deux thèmes sur place. Les trois CSS du kit entrent
dans les couches Tailwind (`theme`, `base`, `components`) : hors couche, le
`h1 { font-weight: 700 }` du kit l'emporterait sur `font-semibold` de chaque
titre. Les règles que le kit apporte (curseur, survol par luminosité, anneau de
focus, `select option`, `prefers-reduced-motion`) quittent `index.css`.
`index.html` part en `data-theme="dark"` pour ne pas voir le clair avant le
premier script. `check:contrast` résout les alias via `tokens.json` du kit.

Les 30 valeurs (26 couleurs, 4 ombres) étaient déjà identiques au kit dans les
deux thèmes : rien ne change à l'écran. Retirés faute de consommateur : le
miroir `colors` de `tokens.ts`, `--color-violet`, `--color-pink`. Ajouté :
Inter 700, graisse que le kit demande. Corrigé au passage : l'anneau de focus
ne ramenait plus un bouton arrondi à 4 px de rayon (règle passée en `@layer base`).

Vérifié : `npm test`, `typecheck`, `lint`, `check:contrast` (116 paires et
6 avatars), `build` ; les deux thèmes dans le navigateur de l'app.

À reprendre : les `meta theme-color` d'`index.html` et le manifeste gardent
leurs couleurs en dur (pas de variable CSS possible là) ; le README du kit note
encore IozyCore « à faire ».


### Lot 166 — La charte IozyKit devient une dépendance épinglée

Le kit est public : la copie `web/vendor/iozykit/` et `npm run kit:sync`
disparaissent. `package.json` déclare `iozykit` en dépendance git épinglée sur
le commit 2fe29b8 (`github:RomainCharpentier/IozyKit#<sha>`) ; le commit
installé se lit dans `package-lock.json`, qui tient le rôle de `VERSION`.
`index.css` importe `iozykit/css/{tokens,base,components}.css` dans les mêmes
couches Tailwind (Tailwind v4 résout un paquet de `node_modules`), et
`check:contrast` lit `node_modules/iozykit/tokens.json`. Mettre le kit à jour :
avancer le sha dans `package.json`, puis `npm install`.

Le Dockerfile garde `node:24-alpine`, qui n'a pas git : avec le commit épinglé
dans le lockfile, `npm ci` télécharge l'archive GitHub du commit sans appeler
git (image construite pour le vérifier, les deux thèmes du kit dans le CSS
servi). Rien ne change à l'écran.

Vérifié : `npm test` (491), `typecheck`, `lint`, `check:contrast` (116 paires et
6 avatars), `build`, `docker build` de `web/`.

À reprendre : `check:deploiement` n'a pas tourné (il veut l'API derrière nginx ;
seul un commentaire du Dockerfile change) ; IozyPlay garde sa copie du kit et
son script de synchronisation ; le README du kit note encore IozyCore « à faire ».

### Lot 167 — Les deux parcours e2e de Découvrir repassent

Rouges depuis le 13 octobre (5e77bc09) : le panneau Tier Lists avait gagné un
bouton « Tout voir » placé avant celui des opportunités, et le parcours
suggestions cliquait le premier bouton de ce nom ; la ligne de mise à jour des
sorties avait changé de phrase, et le parcours sorties attendait l'ancienne.

Les deux boutons deviennent des liens, comme celui du panneau des sorties : ils
ne font qu'aller quelque part. Chaque parcours cherche « Tout voir » sous le
titre de son panneau, et le parcours sorties lit la phrase actuelle.

Vérifié : `npm test` (491), `typecheck`, `lint`, `test:e2e` (19).

### Lot 168 — Le lint ne dit plus rien

`web/CLAUDE.md` promettait un lint muet ; `main` affichait dix-huit
avertissements des règles React (refs lues au rendu, horloge lue au rendu,
`setState` synchrone dans un effet). Chacun est repris à la cause, aucune règle
n'est désactivée : la capture du déclencheur des dialogues passe dans un effet
de layout ; `useNow` (common) lit l'horloge une fois par écran, pour le
calendrier, l'étagère, le bilan annuel et la ligne de mise à jour ; les titres
français de la recherche, la teinte de jaquette et l'aperçu d'annonce sont
dérivés de ce qu'ils décrivent au lieu d'être remis à zéro dans un effet ; la
file du classement rapide vit dans un état ; le formulaire de type naît avec les
valeurs du type chargé, et garde un seul lien retour dans ses deux états.

Vérifié : `npm test` (491), `typecheck`, `lint` (zéro ligne),
`check:frontieres`, `test:e2e` (19).

### Lot 169 — Le calendrier ne montre plus une date que la fiche refuse

Le calendrier des sorties lisait `volume_search_cache` sans regarder l'âge de
la ligne ni la version de la chaîne : il pouvait afficher une date que la fiche
de la série, elle, refuse de servir. Il saute désormais les lignes que
`TomeSearchService` ne servirait pas (même règle `isFresh`). Correctif écrit le
14 octobre sur la branche `fix/calendar-stale-cache`, jamais fusionné et devenu
inapplicable après les lots d'architecture : porté sur `main`.

Vérifié : suite backend (1306).

### Lot 170 — `core/insights` et `manga/deals` suivent la découpe commune

Les deux paquets que le lot 164 laissait mêler domaine et services sont rangés
comme le reste du modulith, sans changer une ligne de comportement, de route ni
de colonne. `core/insights` devient `core/domain/insights` (valeurs, règles,
port `ReleaseRefreshRunRepository`) et `core/application/insights` (cas d'usage
et points d'extension `DiscoverySource`, `ReleaseSource`…, à côté
d'`EntityDeletionGuard`). `manga/deals` devient `manga/domain/deals` (moteur,
calculs, ports), `manga/application/deals` (`PurchaseAnalysisService`) et
`manga/infrastructure/deals/gemini` (les deux adaptateurs Gemini).
`ConfidenceLevel`, que seule l'analyse d'achat lisait, quitte le cœur pour
`manga/domain/deals`. `LayersTest` tient une règle de plus : le domaine ne
dépend d'aucune couche extérieure (`application`, `api`, `infrastructure`).

Vérifié : suite backend (1306), `LayersTest` (5 règles), `ModulesTest`.

À reprendre : `PurchaseAnalysisService` reste un seul cas d'usage de 760
lignes ; `manga/insights` (`CollectionProgressService`) et le port
`VolumeSearchCacheRepository` de `manga/metadata` gardent l'ancienne forme.

### Lot 171 — IozyPlay à la même adresse, sous `/play`

Le navigateur voit une seule origine pour la famille : nginx (conteneur `web`)
achemine `/play/` vers un conteneur `iozyplay`, WebSocket compris (`map`
d'upgrade, délai de lecture long). Le conteneur est facultatif : l'amont est
une variable, comme pour `/api`, donc sans lui seul `/play` répond 502. Côté
IozyPlay (dépôt blindtest-webapp), un seul conteneur sert le front construit,
l'API et Socket.IO sous `IOZYPLAY_BASE_PATH` ; le front est compilé avec le
même préfixe, le service worker et le manifeste sont relatifs, et sa CI publie
`ghcr.io/…/iozyplay`. `docker-compose.nas.yml` tire cette image (Watchtower la
suit) ; `docker-compose.yml` la construit depuis le dépôt voisin derrière le
profil `play`, pour ne pas bloquer une machine qui ne l'a pas.

Vérifié : image seule puis pile locale complète derrière nginx (`/`, `/api`,
`/play/`, `/play/username`, `/play/api/health`, poignée de main Socket.IO),
`check:deploiement` sur `http://localhost:8081`, une partie créée dans le
navigateur à travers nginx.

### Lot 172 — Un seul dépôt pour la famille

IozyPlay (ex-dépôt blindtest-webapp) et IozyKit entrent dans ce dépôt sous
`iozyplay/` et `iozykit/`, historique réécrit sous ces préfixes
(`git filter-repo`) puis fusionné : `git log` et `blame` suivent chaque
fichier jusqu'à son origine. Le reste du dépôt ne bouge pas (URL, images,
NAS inchangés). Le kit devient une dépendance locale `file:../iozykit` des deux
apps (lien dans `node_modules`, en `devDependencies`) ; les images web et
IozyPlay se construisent depuis la racine pour le voir, les compose suivent, le
profil `play` disparaît. Le workflow de déploiement teste le kit et IozyPlay
avant de publier trois images ; `iozyplay-checks.yml` garde les branches ;
le numéro de version d'IozyCore ignore les commits d'`iozyplay/`. Reliquats
d'IozyPlay retirés (`~/.bash_profile`, `start.sh`…), config de lancement
réunie dans `.claude/launch.json`.

Vérifié : contrôles web, IozyPlay et kit, images construites depuis la racine,
pile locale derrière nginx (`/`, `/api`, `/play/`), `check:deploiement`.

### Lot 173 — La page de la famille

`/famille/` présente les deux apps et mène à chacune : une seconde entrée Vite
du web (`web/famille/`), qui n'appartient à aucune app et n'utilise que la
charte (tokens, règles, `iozy-card`, mot-marque « Iozy » en encre et suffixe en
accent, marques de `iozykit/brand`). Elle suit le thème mémorisé par IozyCore.
nginx la sert avant le repli SPA (`$uri/`), les deux pieds de page y renvoient
(IozyPlay seulement quand il vit sous `/play`), et `check:deploiement` la
compte (quatorze contrôles).

Vérifié : contrôles web (491 tests, lint muet, build à deux pages), IozyPlay,
page servie par Vite en dev et par nginx en local, `check:deploiement`.

### Lot 174 — La famille à la racine, IozyCore sous `/core`

`/` est la page de la famille, IozyCore vit sous `/core/`, IozyPlay sous
`/play/`. L'app suit un chemin de base (`IOZYCORE_BASE_PATH`, vide en dev et
dans la pile e2e, `/core` dans l'image) : routeur, enregistrement et chemins
du service worker, manifeste (relatif, générateur compris), lien de partage
lisent `BASE_URL` ; `/api` reste à la racine. nginx sert la page de la
famille à `/`, l'app sous `/core/`, et redirige toute ancienne adresse de
l'app sous `/core` avec le même chemin (favoris, liens de partage, PWA
installée), en relatif pour tenir derrière le TLS du NAS. `check:deploiement`
compte quinze contrôles, dont la redirection.

Vérifié : contrôles web et `check:pwa`, 19 parcours e2e (racine), build sous
`/core/` inspecté, pile locale derrière nginx (`/`, `/core/`,
`/core/tier-lists`, `/tier-lists` → 301, manifeste et `sw.js` sous `/core/`,
`/play/`, `/api`), `check:deploiement http://localhost:8081`.

### Lot 175 — Naviguer dans la famille depuis l'en-tête

La marque en haut à gauche de chaque app ouvre un menu : IozyCore, IozyPlay
(marques du kit, app courante marquée) ; la page de la famille reste la porte
d'entrée à la racine. Un composant de la charte (`.iozy-famille`, un `details` sans script,
documenté dans `CHARTE.md`), rendu par `FamilySwitcher` dans les en-têtes
bureau et mobile des deux apps ; un effet ferme le menu au clic ailleurs ou
sur Échap. Le menu n'existe que sous un préfixe (`/core`, `/play`) : seule à
la racine, la marque reste le lien vers l'accueil de l'app, et les parcours
e2e ne changent pas.

Vérifié : contrôles web (491 tests, lint muet, contraste, frontières),
IozyPlay (typecheck, lint, 166 tests), kit (86 paires), pile locale derrière
nginx : menu ouvert et fermé dans les deux apps, liens `/core/` et `/play/`.

### Lot 176 — Le dépôt `iozy` : trois dossiers de même rang

Le dépôt s'appelle `iozy` et sa racine se lit comme un monorepo : `iozycore/`
(backend, web, ios, maquettes, son README et son CLAUDE.md), `iozyplay/`,
`iozykit/`, et `docs/` au niveau de la famille. Un README et un CLAUDE.md de
racine disent ce qu'est la famille et portent les règles communes ; celui
d'IozyCore ne garde que ce qui lui est propre. Tout ce qui nommait un chemin
suit (`git mv`, l'historique avec) : workflows (contextes, dossiers de
travail, chemin du script de version), Dockerfiles et compose (contexte
`../..`), `.dockerignore`, `.gitignore`, skills et règles de `.claude/`,
config de lancement, lien du kit (`file:../../iozykit`), docs. Les images
GHCR gardent leurs noms (`iozycore-api`, `iozycore-web`, `iozyplay`), écrits
en clair dans le workflow : le NAS ne change pas d'images, seul le chemin de
son compose devient `iozycore/backend/`.

Vérifié : contrôles web et `check:pwa`, IozyPlay, 19 parcours e2e, compilation
backend en Docker au nouveau chemin, images construites depuis la racine,
pile locale derrière nginx, `check:deploiement` (15).
