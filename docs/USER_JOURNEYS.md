# IozyCore — Cartographie des parcours utilisateurs réels

> Audit du **2026-08-21**, établi en inspectant le routage, chaque écran, chaque
> dialogue et panneau, le client API, les mutations TanStack Query et les
> endpoints backend réellement appelés — puis en **exerçant l'application en
> direct** (données réelles : 3 types, 6 œuvres, 12 tomes, 9 possessions,
> 5 éditions de référence, 2 classements, 6 analyses).
>
> Ce document décrit **ce que l'utilisateur peut faire aujourd'hui**, pas ce que
> les maquettes, le README ou les routes déclarées laissent penser. Aucun
> comportement n'a été modifié pour l'écrire.
>
> Méthode de preuve : un parcours n'est marqué `COMPLET` que si son action
> aboutit réellement (mutation qui écrit, écran qui se met à jour). Les
> capacités sans chemin d'interface sont reléguées en fin de document.

---

## 1. Architecture réelle des points d'entrée

La navigation ne compte que **trois destinations**, identiques en desktop et en
mobile (`DesktopHeader.PRIMARY` et `TabBar.TABS`, maintenues en miroir) :

| Destination | Route | Couvre aussi |
|---|---|---|
| **Ma collection** | `/` | `/entity/:id` |
| **Rechercher** | `/add` | `/scan`, `/purchase-analysis*` |
| **Découvrir** | `/discover` | — |

Tout le reste est atteint par des **raccourcis** ou depuis l'espace auquel il
appartient :

- **Envies** — vue « Envies » de Ma collection, dans sa barre de vues, avec le
  décompte à côté du libellé. Le cœur de l'en-tête a été **retiré le
  2026-08-28** : depuis que les envies sont une lecture de la collection
  (Lot 38), il se contentait de poser le filtre avant d'y naviguer - un
  raccourci qui doublait, sur tous les écrans, un bouton déjà visible sur
  celui-là.
- **Profil** — avatar « IO », même en-tête, mêmes deux plateformes. Ces deux
  accès n'existaient que sur desktop jusqu'au 2026-08-21 ; `MobileHeader` les
  rétablit sans toucher à la barre du pouce, qui garde ses trois destinations.
- **Scan** et **Import BGG** — en tête de Rechercher, les deux plateformes (le
  scan a aussi son bouton dédié dans la barre du pouce, en mobile). Les trois
  façons d'ajouter à sa collection sont réunies là : taper un titre, scanner,
  importer. L'import a vécu sous Administration jusqu'au 2026-08-29 — il n'a
  jamais rien eu d'administratif.
- **Administration** → son **propre bouton** dans l'en-tête (icône clé), à
  côté de l'avatar et pas dedans — elle n'accueille QUE ce qui décrit la
  collection (catégories, éditions de référence) et l'instance (comptes).
  **Mon profil** → l'avatar (le bouton aux
  initiales), d'un clic. **Paramètres** → depuis Profil, le seul autre écran
  qui parle de la même personne. Deux boutons dans l'en-tête, parce que ce sont
  deux choses : l'administration a été une sous-partie de Paramètres, puis un
  lien de Profil, puis une entrée d'un menu déroulant de l'avatar — trois fois
  rangée derrière quelque chose qui appartient à l'utilisateur, alors que
  déclarer les catégories de sa collection n'est pas un réglage personnel. Les
  deux écrans de réglages sont rangés par **ce que le réglage concerne** : Paramètres porte « Mon compte » (pseudo, adresse, export,
  déconnexion) et « Cet appareil » (thème, langue des titres — dans le
  `localStorage`, ils ne suivent pas le compte, et l'écran le dit) ;
  Administration porte « Ma collection » (catégories, éditions de référence,
  import) et « Cette instance » (comptes, pour un administrateur).
- **Catégories de collection** → deux chemins : Ma collection ▸ Plus d'outils,
  et Administration. (Nommées « Types de collection » jusqu'au 2026-08-29.)

Les deux routes `/public/*` vivent **hors** de `AppShell` : un visiteur d'un
lien de partage ne voit jamais la navigation privée.

---

## 2. Parcours — Ma collection

### 01. Consulter sa collection
**Point de départ** : Ma collection (`/`)
**Préconditions** : au moins une possession active.
**Étapes** : 1. Ouvrir l'app. 2. Lire l'en-tête et parcourir les rails.
**Résultat** : un rail par type de collection possédé, une tuile par œuvre avec
sa jaquette, son édition dominante et sa progression « X/Y tomes » ; en-tête
« N titres possédés · N ajouts ce mois ». Un signal « Plus que N tomes »
apparaît quand il reste ≤ 3 tomes.
**Branches** : collection vide → « Rien ici pour l'instant » + renvoi vers
Rechercher ; un type sans possession active n'affiche aucun rail ; une œuvre
entièrement revendue disparaît de l'écran (le catalogue, lui, la conserve).
**Écrans** : `ShelfPage`, `CategorySection`, `shelfTiles.ts`, `ownership.ts`
**Backend** : `GET /entities/search`, `GET /ownerships`, `GET /entity-types`,
`GET /purchase-analysis/editions/all`
**Statut** : `COMPLET`

### 02. Filtrer sa collection par complétude
**Point de départ** : Ma collection ▸ Filtres
**Étapes** : 1. Ouvrir Filtres. 2. Choisir Toutes / Incomplètes / Complètes.
**Résultat** : la grille se réduit, le bouton Filtres porte un badge, les
compteurs d'en-tête suivent le filtre.
**Branches** : aucun résultat → message + « Réinitialiser les filtres ».
Une œuvre dont le total d'édition est inconnu n'est ni complète ni incomplète et
sort des deux filtres.
**Écrans** : `CollectionFilters`, `ShelfPage`
**Statut** : `COMPLET` — **Desktop** popover / **Mobile** bottom-sheet.

### 03. Ouvrir le rayon d'un type
**Point de départ** : Ma collection ▸ « Tout voir » d'un rail
**Résultat** : `/collection/:entityTypeId`, toutes les œuvres possédées de ce
type, avec le même filtre de complétude et un retour « Ma collection ».
**Écrans** : `CategoryPage`, `CategorySection`
**Statut** : `COMPLET`

### 04. Retrouver les jaquettes manquantes
**Point de départ** : Ma collection ▸ Plus d'outils
**Préconditions** : au moins une œuvre sans jaquette (le bouton est désactivé
sinon, avec le compte affiché).
**Étapes** : 1. Ouvrir Plus d'outils. 2. Cliquer « Retrouver les jaquettes
manquantes ».
**Résultat** : recherche en deux passes (cache gratuit, puis `forceRefresh` pour
les seules séries restées sans jaquette) ; compte-rendu « N jaquettes
retrouvées » ou « Aucune jaquette retrouvée cette fois ».
**Branches** : quota Google Books dépassé → message explicite « N/M séries
traitées, réessaie plus tard ».
**Écrans** : `ShelfPage`, `backfillCovers.ts`
**Backend** : `GET /metadata/volumes`, `PATCH /entities/{id}/variants/{vid}`
**Statut** : `COMPLET`

### 05. Ouvrir la valeur de la collection
**Point de départ** : Ma collection ▸ Valeur → `/stats`
**Résultat** : total des prix d'achat connus, **toujours accompagné du taux de
couverture** (« Prix connu sur 0/9 possessions — valeur réelle probablement plus
élevée »), répartition par type, chronologie mensuelle, statistiques par type.
**Branches** : aucun prix renseigné → « Pas encore de prix renseigné /
Indisponible » sur Profil, et 0,00 € explicitement qualifié sur `/stats`.
**Écrans** : `StatsPage`, `CollectionValueSection`, `CollectionTimelineSection`
**Backend** : `GET /insights/value`, `/insights/stats`, `/insights/timeline`
**Statut** : `COMPLET` — données réelles, jamais simulées.

### 06. Importer une collection BoardGameGeek
**Point de départ** : Ma collection ▸ Import (ou Administration)
**Étapes** : 1. Saisir un pseudo BGG. 2. Importer.
**Résultat** : les jeux marqués « possédés » sur BGG sont ajoutés ; un jeu déjà
présent (même titre) est retrouvé, jamais dupliqué.
**Branches** : pseudo inconnu / BGG indisponible → bannière d'erreur.
**Écrans** : `ImportBggPage`
**Backend** : `POST /metadata/bgg/import`
**Statut** : `COMPLET` (import réel, non exercé pendant cet audit — appel
réseau externe sur un compte tiers).

### 07. Ouvrir une œuvre
**Point de départ** : une tuile de Ma collection ou d'un rayon
**Résultat** : `/entity/:id`. Depuis Ma collection, l'URL peut porter
`?variant=…` : la fiche fait alors défiler et surligne le tome concerné.
**Écrans** : `CategorySection`, `EntityDetailPage`
**Statut** : `COMPLET`

---

## 3. Parcours — Fiche d'une œuvre

### 08. Consulter la progression d'une édition
**Résultat** : « X / Y tomes possédés », pourcentage et barre, nom de l'édition
et son nombre total de tomes ; avertissements « Cette édition est épuisée » et
« Nouvelle édition annoncée » quand la fiche de référence les porte.
**Branches** : total inconnu → « N tomes possédés » sans dénominateur ni barre,
**jamais un total deviné**.
**Écrans** : `EditionProgressSection`
**Backend** : `GET /purchase-analysis/completeness`, `/purchase-analysis/editions`
**Statut** : `COMPLET`

### 09. Changer d'édition affichée
**Préconditions** : la série a **2 éditions nommées ou plus**. Une seule édition
nommée plus des tomes sans édition précisée sont fusionnés — aucun sélecteur.
La fusion est décidée **par le serveur** depuis le 2026-08-27 (Lot 60,
`CollectionProgressService`) : `lib/editionGroups.ts`, qui la refaisait côté
client, n'existe plus.
**Étapes** : choisir une puce d'édition.
**Résultat** : progression, grille de tomes et avertissements suivent l'édition.
**Écrans** : `CartesEditions`, `GrilleTomes`
**Statut** : `COMPLET`

### 10. Renseigner ou corriger l'édition de référence
**Point de départ** : fiche ▸ « Modifier l'édition »
**Étapes** : éditeur, nombre de tomes, prix neuf, épuisée, meilleure édition
annoncée → Enregistrer.
**Résultat** : la fiche de référence est créée ou mise à jour ; la progression
« X/Y » de toute l'app en dépend.
**Branches** : Annuler ; création d'une édition dont le couple (série, nom)
existe déjà → **409 lisible** (« Une édition « X » existe déjà pour la série
« Y » »).
**Écrans** : `EditionCorrectionSection`
**Backend** : `POST` / `PATCH /purchase-analysis/editions`
**Statut** : `COMPLET`

### 11. ~~Signaler une envie d'amélioration d'édition~~ — supprimé du produit (2026-08-27)
« Je possède celle-ci, j'en veux une meilleure » a quitté l'interface le
2026-08-25 (Lot 27) : `EditionUpgradeWishToggle` et `EditionUpgradesPage`
n'existent plus.
**Backend supprimé le 2026-08-27** : `EditionUpgradeWishController`, les DTO,
l'agrégat, le repository, l'entité JPA et la table `edition_upgrade_wish`
(`V22__drop_edition_upgrade_wish.sql`, qui défait `V6` sans la réécrire), ainsi
que le fichier `edition-upgrade-wishes.csv` de l'export, toujours vide. Vérifié
avant suppression, en croisant les 99 routes du backend avec les deux clients :
aucun appel web, aucun appel iOS, et **zéro ligne** dans la table.
**À ne pas confondre** avec « suivre une édition » (§10bis, `FollowedEdition`),
bien vivante : déclarer l'édition qu'on tient n'est pas vouloir en changer.
**Statut** : `SUPPRIMÉ`

### 12. Parcourir les tomes d'une édition
**Résultat** : grille de tuiles, chacune « Possédé » ou « Manquant » ; les
premiers tomes seulement, puis « Voir tout (N) » déplie la totalité et le même
bouton la replie.
**Branches** : tome catalogué manquant, tome purement virtuel (déduit du total
de l'édition), tome possédé en plusieurs exemplaires.
**Écrans** : `TomesGridSection`, `VirtualVolumeCard`
**Statut** : `COMPLET`

### 13. Ajouter un tome manquant
**Point de départ** : fiche ▸ tuile d'un tome manquant
**Préconditions** : aucune possession active pour ce tome.
**Étapes** : 1. Ouvrir le tome. 2. Choisir l'état. 3. Prix d'achat (facultatif).
4. « Ajouter à ma collection ».
**Résultat** : possession créée, tome affiché possédé, progression et Ma
collection actualisées.
**Branches** : un exemplaire **passé** (vendu/perdu) du même tome s'affiche sous
« Exemplaires passés », sous le formulaire d'ajout ; mutation en erreur →
bannière.
**Écrans** : la grille elle-même (`GrilleTomes`) — voir la mise à jour du
2026-08-26 en tête de §13.
**Backend** : `POST /entities/quick-add`
**Statut** : `COMPLET`

### 14. Ajouter un tome à la main
**Point de départ** : fiche ▸ « + Ajouter un tome »
**Étapes** : numéro(s) de tome, édition, état, prix → Ajouter.
**Résultat** : un ou plusieurs tomes ajoutés d'un coup ; message distinguant les
tomes réellement ajoutés de ceux déjà possédés.
**Écrans** : `AddVolumeSection`
**Statut** : `COMPLET`

### 15. ~~Gérer un exemplaire possédé (prix, note)~~ — supprimé du produit (2026-08-27)
Le prix payé et la note d'exemplaire ont quitté l'interface les 2026-08-26/27
(Lots 53 à 55) : ajouter un tome tient en un clic, et la note qui reste est
celle de l'ŒUVRE, pas celle d'un exemplaire. La valeur de la collection se
calcule depuis le prix NEUF de l'édition (Lot 56), plus depuis ce qu'on a payé.
**Backend supprimé le 2026-08-27** : `PATCH /ownerships/{id}/purchase-price` et
`PATCH /ownerships/{id}/note` n'avaient plus aucun appelant, ni web ni iOS. Les
colonnes, elles, restent : l'export les lit, et `POST /entities/quick-add`
accepte toujours un prix d'achat facultatif. Vérifié avant suppression :
**zéro prix et zéro note** enregistrés.
**Statut** : `SUPPRIMÉ`

### 16. ~~Prêter un exemplaire~~ — supprimé du produit (2026-08-23)
La gestion des prêts ne fait plus partie du périmètre. « Prêter », « Marquer
rendu » et l'écran `/loans` avaient été retirés de l'interface le 2026-08-21.
**À savoir** : `/loans` n'était de toute façon **lié depuis aucun écran** — la
page existait sans chemin d'accès, et la première version de cet audit la
présentait à tort comme atteignable depuis Profil.
**Backend supprimé le 2026-08-23** : `LoanController`, les DTO, l'agrégat, le
repository, l'entité JPA et la table `loan` n'existent plus (`V19__drop_loan.sql`,
qui défait `V5__loan.sql` sans la réécrire). Vérifié avant suppression : aucun
appel côté web, aucun côté iOS, aucun script, et **zéro ligne** dans la table.
**Conséquence** : `OwnershipDeletionService` ne consulte plus rien — supprimer
un exemplaire n'est plus refusable pour cause de prêt (voir §18).
**Statut** : `SUPPRIMÉ`

### 17. Marquer un exemplaire vendu ou perdu
**Étapes** : menu « … » ▸ « Marquer vendu » ou « Marquer perdu ».
**Résultat** : l'exemplaire quitte le décompte des possessions ; le tome
redevient « Manquant » ; l'exemplaire reste visible sous « Exemplaires passés »
avec sa pastille **Vendu** ou **Perdu**.
**Branches** : **aucun retour arrière** — aucun endpoint ne redonne le statut
`OWNED` (voir §Undo).
**Écrans** : **client iOS uniquement** depuis le 2026-08-27 — le web n'a plus
de surface pour ces deux gestes (voir §15).
**Backend** : `POST /ownerships/{id}/sell`, `/lose`, et `/restore` qui les
annule. Cette dernière n'a aujourd'hui **aucun appelant** et est conservée à
dessein : sans elle, « vendu » et « perdu » seraient des allers simples depuis
l'iPhone. C'est un écran qui manque, pas du code mort.
**Statut** : `COMPLET`

### 18. Supprimer définitivement un exemplaire
**Étapes** : menu « … » ▸ « Supprimer cet exemplaire » → confirmation explicite.
**Branches** : aucune — la suppression aboutit toujours (204), y compris sur un
identifiant inconnu ou déjà supprimé : la route est **idempotente**. Le refus
en 409 « exemplaire encore prêté » a disparu avec la fonctionnalité de prêt
(voir §16).
**Invariant** : supprimer un exemplaire **ne supprime jamais le tome catalogué**
qu'il référence — le Variant et l'œuvre survivent (« Classer ≠ Posséder »).
**Statut** : `COMPLET`

### 19. Corriger la jaquette d'un tome
**Point de départ** : panneau d'un tome ▸ « Ajouter une couverture »
**Étapes** : saisir une URL, **ou** « Rechercher automatiquement sur Google
Books » (recherche ciblée sur ce seul tome, `forceRefresh`).
**Branches** : rien trouvé → « Aucune jaquette trouvée » — un constat honnête,
pas une erreur.
**Statut** : `COMPLET`

### 20. ~~Corriger le numéro d'un tome~~ — supprimé du produit (2026-08-27)
`VariantNumberEditor` a disparu avec le panneau du tome (Lot 55).
**Backend supprimé le 2026-08-27** : `PATCH /entities/{id}/variants/{id}/volume-number`
et `Entity.renumberVariant` n'avaient plus aucun appelant, ni web ni iOS.
**Recours** : un tome mal numéroté se supprime et se rajoute — la grille
continue d'afficher les numéros au-delà du total de l'édition plutôt que de les
escamoter, précisément pour qu'ils restent rattrapables (voir `lib/tomeTiles`).
**Statut** : `SUPPRIMÉ`

### 21. Classer une œuvre au classement général
**Point de départ** : fiche ▸ « Classer cette œuvre »
**Étapes** : choisir un rang S→F (clic, ou touche S-F au clavier).
**Résultat** : rang affiché sous « Mes classements » ; visible sur le board
général et sur Découvrir.
**Branches** : « Retirer le classement » remet l'œuvre en non classée.
**Écrans** : `TomesGridSection`, `TierPicker`
**Backend** : `PUT /tier-lists/general/entities/{entityId}`
**Statut** : `COMPLET`

### 22. Interroger l'assistant de la fiche
**Étapes** : « Que me manque-t-il dans cette série ? » / « Où en suis-je dans
mes lectures ? »
**Résultat** : réponses calculées **à partir de la seule collection** — tomes
manquants et coût estimé pour compléter, dernières lectures et note moyenne.
**Branches** : sans donnée, la question répond qu'elle ne peut pas conclure ;
un lien « Évaluer une annonce » part de là.
**Écrans** : `AssistantSection`
**Statut** : `COMPLET` — aucune IA, aucun appel externe.

### 23. Modifier les informations de l'œuvre
**Point de départ** : fiche ▸ bloc « L'œuvre » ▸ Modifier
**Étapes** : éditer les attributs (mangaka, statut, année…), replier/déplier
« Champs techniques (N) », retirer un attribut.
**Résultat** : attributs fusionnés sans écraser ceux déjà renseignés ; une
valeur vide est **retirée**, jamais stockée telle quelle.
**Écrans** : `EntityInfoSection`
**Backend** : `PATCH /entities/{id}`, `DELETE /entities/{id}/attributes/{key}`
**Statut** : `COMPLET`

### 24. Renommer la série / changer sa couverture
**Étapes** : icônes dédiées en tête de fiche.
**Branches** : titre vide refusé en 400 lisible. Le renommage ne casse jamais le
lien avec les éditions (rattachement par identifiant).
**Statut** : `COMPLET`

### 25. Tags, expériences et relations
**Point de départ** : fiche ▸ « Plus d'options » (replié par défaut)
**Étapes** : créer/attacher un tag ; ajouter une expérience (type, date, note,
commentaire, **tome concerné** si la série en a) ; ajouter une relation typée
vers une autre œuvre.

**Corriger et retirer** (depuis le 2026-08-21) — menu « … » sur la ligne
concernée, même patron qu'un exemplaire possédé :
- **Expérience** ▸ *Modifier la note et le commentaire* / *Supprimer*. Seuls
  ces deux champs sont modifiables : le type, la date et le tome concerné sont
  immuables côté domaine — s'être trompé de tome, c'est avoir enregistré une
  AUTRE expérience, qu'on supprime. La note peut redevenir *absente*, pas
  seulement changer de valeur. La suppression propose **Annuler**, qui
  réenregistre l'expérience à l'identique.
- **Relation** ▸ *Modifier le type* / *Supprimer*. Les relations s'affichent
  désormais comme une vraie liste, chacune avec son **type** et son **sens**
  (« Adapté en — depuis cette œuvre »), au lieu d'une rangée de jaquettes qui
  taisait les deux. Changer une extrémité n'est pas proposé : ce ne serait pas
  corriger cette relation mais en décrire une autre. Supprimer un lien ne
  touche à aucune des deux œuvres.

**Se servir de ses tags** (depuis le 2026-08-29) — **Ma collection ▸ Filtres ▸
Tag**, et de même dans la vue d'une catégorie. Jusque-là, un tag se posait et ne
se relisait nulle part : le classement existait, il n'avait aucun lecteur. Un
seul tag à la fois, comme le paramètre du serveur, et la section n'apparaît que
si des tags existent.

**Qui peut poser un tag** (depuis le 2026-08-30) : **un administrateur, et lui
seul**. Un tag décrit l'ŒUVRE — « seinen », « one-shot » — au même titre que sa
catégorie ou son édition de référence, et vit donc dans le catalogue partagé :
le poser engage tous les comptes. Un compte ordinaire les **voit** sur la fiche
(ils décrivent l'œuvre, et ils lui servent à filtrer) sans pouvoir y toucher,
et l'écran le dit. Corollaire assumé : un tag n'est pas l'endroit où noter
« prêté à Marc » — c'est personnel, et rien ici ne l'accueille.
**Les gérer** : Administration ▸ Ma collection ▸ **Tags** — renommer, supprimer,
et voir sur combien d'œuvres chacun est posé. Renommer ne détache rien.

**Branches** : type d'expérience non autorisé pour ce type de collection → 400 ;
relation vers une œuvre inexistante → 400 ; note hors de 0-10 → 400 ; type de
relation vide → 400. Les deux suppressions sont idempotentes.
**Écrans** : `MoreOptionsSection`, `TagsSection`, `ExperiencesSection`,
`ExperienceRow`, `RelationshipsSection`, `RelationshipRow`, `CollectionFilters`
**Backend** : `PATCH`/`DELETE /experiences/{id}`, `PATCH`/`DELETE /relationships/{id}`
**Statut** : `COMPLET`

### 26. Supprimer la fiche d'une œuvre
**Point de départ** : fiche ▸ Plus d'options ▸ « Supprimer cette fiche »
**Branches** : bloqué en 409 lisible tant qu'il reste une possession, une
expérience ou une édition de référence. Une œuvre ayant connu une lecture
devient **définitivement indélébile**.
**Statut** : `COMPLET` (le refus est le comportement voulu, et il est expliqué).

---

## 4. Parcours — Rechercher

### 27. Rechercher une œuvre par titre
**Point de départ** : Rechercher (`/add`)
**Étapes** : choisir un type, saisir ≥ 3 caractères.
**Résultat** : suggestions externes (Jikan/MyAnimeList pour le manga, BGG,
IGDB), avec jaquette, année, auteur.
**Branches** : recherche externe en échec → « La recherche de métadonnées a
échoué » ; aucun résultat → « Aucun résultat pour ce titre » ; type **sans
fournisseur** → aucune recherche externe, message dédié annoncé **avant** la
saisie ; **« Tout » sélectionné** → seul le catalogue est parcouru, et l'écran
le dit (« choisis une catégorie pour chercher aussi chez une source externe ») ;
**moins de trois caractères** → même chose, dit aussi (Lot 116 — ces deux
silences se lisaient comme des pannes).
**Écrans** : `SearchPage`
**Backend** : `GET /metadata/search`
**Statut** : `COMPLET`

### 28. Constater qu'un titre est déjà connu d'IozyCore
**Résultat** : un bloc « Déjà dans IozyCore » s'affiche **au-dessus** des
suggestions, avec un accès direct à la fiche et une pastille qui distingue deux
états bien réels : **« Possédé »** (au moins un exemplaire) et **« Pas encore
possédé »** (l'œuvre a une fiche mais aucun exemplaire — typiquement parce
qu'elle est en envies).
**Pourquoi ça compte** : la recherche externe exclut délibérément les titres
**déjà catalogués** — sans ce bloc, chercher « Death Note » ne renverrait que
des spin-offs sans explication. Et depuis qu'une œuvre peut être cataloguée sans
être possédée (parcours 52), une pastille « Possédé » universelle serait
devenue un mensonge sur ses propres envies.
**Ce que la recherche locale tolère** (Lot 116) : la casse, les **accents**
(« pokemon » trouve « Pokémon »), la **ponctuation** (« l attaque » trouve
« L'Attaque des Titans »), les **mots dans le désordre** (« attaque titans »),
et l'**auteur** (« isayama » trouve la série — `mangaka`, `author`, `studio`,
`designer`, `developer`, `publisher`). L'ordre dit la pertinence : les titres
qui commencent par la saisie, puis ceux qui la contiennent, puis les mots
épars, puis l'auteur. La même règle (`TexteRecherche`) sert à exclure les
titres déjà catalogués des suggestions externes et de Découvrir.
**Écrans** : `SearchPage`
**Backend** : `GET /entities/search`, `GET /ownerships`
**Statut** : `COMPLET` (y compris sur les types sans fournisseur externe).

### 29. Rechercher par code-barres depuis Rechercher
**Étapes** : « Scanner un code-barres / ISBN » → saisir l'ISBN.
**Branches** : masqué pour un type sans fournisseur.
**Écrans** : `BarcodeLookupField`
**Backend** : `GET /metadata/lookup-barcode`
**Statut** : `COMPLET`

### 30. Ajouter une œuvre depuis un résultat de recherche
**Étapes** : 1. Choisir un résultat → `/add/draft`. 2. La page rejoue la
résolution du titre français et la correspondance des jaquettes. 3. Sélectionner
les tomes (grille), ou en saisir à la main. 4. Choisir l'état, le prix.
5. Ajouter.
**Résultat** : œuvre et tomes créés, possessions créées, retour vers Rechercher.
**Branches** : quota de recherche de tomes dépassé → message ; aucun tome trouvé
→ saisie manuelle ; ouverture directe de `/add/draft` sans état de navigation →
message + retour vers Rechercher.
**Autre issue possible** : « Ajouter aux envies », directement sur la ligne du
résultat, sans passer par la saisie des tomes — voir le parcours 52.
**Écrans** : `AddDraftPage`, `VolumeSelectionGrid`, `draftState.ts`
**Backend** : `GET /metadata/volumes`, `/metadata/french-title`,
`POST /entities/quick-add`
**Statut** : `COMPLET`

### 31. Ajouter un titre à la main (type sans fournisseur)
**Étapes** : saisir un titre → « Ajouter « X » » → écran de brouillon en saisie
libre.
**Statut** : `COMPLET`

---

## 5. Parcours — Scan

### 32. Scanner un code-barres à la caméra
**Point de départ** : barre du pouce ▸ Scan, ou Rechercher ▸ Scanner
**Préconditions** : navigateur exposant `BarcodeDetector` (Chrome/Edge desktop
et Android) **et** autorisation caméra.
**Étapes** : Démarrer le scan → présenter le code-barres.
**Branches** : navigateur non supporté (Safari, Firefox) → message explicite et
**repli sur la saisie manuelle présente sur le même écran** ; caméra refusée →
message d'erreur.
**Écrans** : `ScanPage`, `CameraBarcodeScanner`
**Statut** : `COMPLET` (mécanique caméra non exerçable dans l'environnement
d'audit — aucune caméra, `BarcodeDetector` absent).

### 33. Saisir un code-barres à la main sur l'écran de scan
**Étapes** : saisir l'ISBN → Chercher.
**Résultat** : exactement le même chemin que la caméra, menu contextuel compris.
**Statut** : `COMPLET` (vérifié en direct).

### 34. Décider quoi faire d'un tome scanné
**Point de départ** : tout scan reconnu
**Résultat** : un menu contextuel affiche ce qui a été identifié — titre,
jaquette, tome détecté ou non, édition devinée, mention « Déjà connu
d'IozyCore » — puis propose : **Ajouter à ma collection** (avec l'état choisi en
haut d'écran), **Choisir l'édition et les tomes** (bascule vers l'ajout
détaillé), **Ajouter aux envies** (pour **tout** livre scanné, connu ou non —
scanner en boutique une œuvre qu'on ne prend pas aujourd'hui est justement le
cas d'usage), **Ouvrir la fiche** (seulement si l'œuvre en a déjà une),
**Passer ce tome**. **Rien n'est écrit tant que rien n'est choisi.**
**Branches** : code non reconnu → « Rien trouvé pour X » + « Chercher par
titre » ; échec réseau → « Échec de la recherche » + même issue ; un scan
pendant qu'un menu est ouvert est ignoré ; Échap = Passer.
**Écrans** : `ScanActionMenu`, `ScanPage`
**Statut** : `COMPLET` — **Desktop** boîte centrée / **Mobile** bottom-sheet.

---

## 6. Parcours — Analyse d'achat

### 35. Analyser une annonce d'occasion
**Point de départ** : Ma collection ▸ « Évaluer un achat », Découvrir ▸
Opportunités ▸ « Évaluer une annonce », Rechercher, Profil, ou fiche ▸
« Évaluer une annonce de cette série » (série pré-remplie).
**Étapes** *(refondues le 2026-08-24)* :

```
je colle une annonce (ou je saisis à la main)
↓
IozyCore récupère ce qu'il peut          → carte résumé, pas un formulaire
↓
IozyCore détecte ce qu'il peut           → Contenu du lot déjà pré-rempli
↓
je corrige uniquement ce qui manque
↓
Évaluer ce lot
```

**L'annonce lue devient un résumé, pas six champs ouverts.** Plateforme, prix,
port, protection, titre et description sont déjà connus : ils s'affichent en
trois lignes avec le coût total, derrière un bouton « Modifier ». Sans URL, le
formulaire manuel s'affiche normalement — c'est le même écran, pas un mode
dégradé.
**La plateforme n'est plus à choisir** quand l'URL la désigne : elle est
constatée. Les boutons Vinted / Leboncoin / Rakuten / Autre ne servent qu'à la
saisie manuelle ou à une correction explicite.
**L'ordre suit l'usage** : source → résumé de l'annonce → **contenu du lot** →
état déclaré → évaluer. L'état déclaré coupait auparavant l'annonce de ce qui
est réellement acheté.
**Le bouton porte ce qu'il va évaluer** : « 5 tomes · coût minimum 51,73 € »
juste au-dessus d'« Évaluer ce lot ».
**« Contenu du lot » est la liste qui part à l'analyse** *(2026-08-24)* : elle
s'affiche en tête de la section, avec son décompte en tomes. Les propositions
détectées et le formulaire manuel sont deux façons de l'alimenter, présentées
**sous** elle — il n'existe pas deux lots parallèles. Confirmer des propositions
affiche « N éléments ajoutés au lot », amène l'utilisateur à la liste si elle
est hors champ, et marque les lignes concernées « Ajouté au lot » sans
possibilité de les ajouter deux fois. Retirer un élément le rend de nouveau
proposable. Une fois dans le lot, un tome détecté et un tome saisi à la main
sont strictement la même ligne : la provenance a servi à décider, elle ne
structure pas la liste finale.
**Le « + » n'est plus un passage obligé** *(2026-08-24)* : la série en cours de
saisie compte dans le lot telle quelle. Le bouton ne sert qu'à en ajouter une
**autre**, pour un lot multi-séries. Auparavant, remplir les trois champs puis
viser « ANALYSER LE LOT » laissait le bouton grisé sans un mot d'explication —
un cul-de-sac silencieux. Le bouton dit désormais ce qui lui manque.
**L'édition n'est plus une question posée à l'utilisateur** *(2026-08-24)* :
elle ne figure plus dans le formulaire, entre la série et les tomes. L'ordre
s'inverse — on saisit **série** et **tomes**, puis IozyCore cherche l'édition et
affiche ce qu'il a trouvé, sous la ligne :

| État | Affichage |
|---|---|
| Une seule édition connue | « Édition · Black Édition » + **Modifier** — retenue pour de bon, pas seulement affichée |
| Plusieurs candidates | « Édition à confirmer », proposées sans qu'aucune soit choisie d'office |
| Rien au catalogue | « Édition · non déterminée » + **Préciser** — l'analyse reste possible |

**L'édition ne bloque jamais l'évaluation**, et le message de blocage ne la
mentionne jamais. Les éditions du catalogue restent proposées d'un clic, et
« Je ne sais pas » est toujours offert. C'était le seul endroit du produit où l'on obligeait à
inventer — et une étiquette inventée pouvait correspondre **par accident** à
une autre édition, faussant la référence marché sans que rien ne le signale.
Déclarer son ignorance donne une analyse honnête : elle tourne, mais sans la
complétude ni la valeur neuve, et le dit.
**Résultat** : le verdict personnalisé en trois dimensions séparées (ce que le
lot apporte, où se situe son prix, ce qui mérite vigilance), puis le score
global, le coût d'acquisition, la valeur neuve, la décote, l'offre conseillée /
fourchette / prix maximum, et le détail par série (complétude, doublons, base
de prix, avertissements). Une analyse enregistrée dont l'édition et la
composition sont identifiées ajoute son **prix demandé** aux prix relevés de
cette édition (voir 14 et `docs/LISTING_SOURCES.md`), sans notification ni
changement d'écran.
**Le total change de nom selon ce qu'on sait de la livraison** : « Coût
d'acquisition estimé » quand elle est connue, « Coût minimum estimé » quand
c'est un « à partir de », « Sous-total connu » assorti de « livraison non
incluse » quand elle est inconnue. Jamais « coût réel » : aucun de ces montants
n'est facturé.
**Branches** : aucune donnée de prix → « Non calculable » plutôt qu'un chiffre
inventé ; référence marché insuffisante → l'écran dit ce qui manque plutôt
qu'un prix ; prix très au-dessus → conseil de passer son tour ; lot sans série →
400 lisible ; lot multi-séries ou édition non identifiée → l'analyse fonctionne
normalement, seule la création automatique d'un prix relevé est refusée ;
analyse antérieure aux règles actuelles → son verdict est conservé tel quel,
mais son chiffre de référence est présenté comme « estimation utilisée lors de
cette analyse », jamais comme un marché observé.
**Écrans** : `PurchaseAnalysisPage`, `PurchaseAnalysisResultCard`,
`SeriesBreakdownItem`, `VerdictBadge`
**Backend** : `POST /purchase-analysis/analyze`
**Statut** : `COMPLET` — arithmétique re-dérivée indépendamment et vérifiée
juste (Lot 36).

### 35 bis. Pré-remplir l'analyse depuis le lien de l'annonce
*(2026-08-21 — voir `docs/LISTING_SOURCES.md` pour la source, la sécurité et les limites)*

**Point de départ** : le champ « Lien de l'annonce », désormais en tête de
l'écran d'analyse.
**Parcours** :

```
lien collé
→ détection de la source (« Détection : Vinted »)
→ « Récupération de l'annonce… »
→ titre, prix, description et photos pré-remplis
→ l'utilisateur vérifie et corrige
→ il déclare le contenu du lot
→ analyse habituelle
```

**Ce que le lien faisait avant** : rien, sinon être conservé pour retrouver
l'annonce. Il était même rangé derrière « Ajouter l'URL et le titre ». Il est
maintenant lu.

**Ce qui est récupéré chez Vinted** : titre, description et URL canonique
(balises OpenGraph — un contrat publié, donc solide) ; prix et photos (données
embarquées dans la page, donc lues au mieux). Rien sur le vendeur : pseudo,
avatar et localisation n'entrent dans aucun calcul et ne sont pas collectés.

**Trois règles** :
- **rien n'est inventé** — un champ que la source ne donne pas reste vide, jamais
  supposé ni rempli d'une valeur de démonstration ;
- **rien n'est écrasé** — une valeur déjà saisie est conservée, et l'écart avec
  l'annonce est affiché (« Tes saisies ont été conservées pour : le prix ») ;
- **rien ne bloque** — la saisie manuelle est le parcours normal, pas un repli.

**Branches**, toutes menant au formulaire manuel avec le lien conservé :
- lien manifestement invalide → « Lien invalide », dit en local, **sans appel
  serveur** ;
- autre plateforme → « Cette plateforme n'est pas encore récupérée
  automatiquement » ;
- annonce supprimée → « Cette annonce n'est plus accessible » ;
- source indisponible ou page illisible → « Impossible de récupérer
  automatiquement cette annonce pour le moment » ;
- **récupération partielle** → ce qui a été lu est pré-rempli, et l'écran dit
  quoi (« Complété : titre · prix ») ainsi que ce qui reste à compléter. Ce
  n'est pas une erreur.

**Sécurité** : le serveur ne va chercher que ce qu'un provider déclaré reconnaît
— liste blanche d'hôtes exacts, HTTPS seul, refus des adresses internes,
redirections revalidées une par une, délai, taille et nombre de photos
plafonnés. Il n'existe aucun endpoint de récupération d'URL arbitraire.

**Snapshot** : l'analyse enregistrée fige le titre, le prix, les photos et
l'URL au moment de la lecture. Si le vendeur modifie ou retire son annonce, elle
ne bouge pas — et « Voir l'annonce sur Vinted » reste affiché sur l'analyse
passée, même si le lien ne mène plus nulle part. Aucune synchronisation, aucun
suivi de prix.

**Les photos sont désormais lisibles** : voir 35 ter. Jusqu'au 2026-08-23,
elles étaient affichées et conservées mais **analysées par rien** — seul leur
nombre entrait dans les points de vigilance.

### 35 ter. Détecter le contenu du lot
*(2026-08-23 — voir `docs/LISTING_RECOGNITION.md` pour l'architecture, la sécurité et les limites)*

**Point de départ** : le bloc « Éléments détectés », sous les informations de
l'annonce.

```
annonce lue (titre, description, photos)
→ le TEXTE est analysé aussitôt, localement et gratuitement
→ « Éléments détectés » se remplit déjà
→ [Analyser les photos]   (geste explicite, seulement s'il y a des photos)
→ la MÊME liste s'enrichit : éditions précisées, tomes vus, éléments en plus
→ l'utilisateur coche, corrige un tome, choisit une édition, retire, complète
→ « Confirmer N éléments »
→ les éléments rejoignent le lot de l'analyse habituelle
→ ANALYSER LE LOT (verdict, CollectionFit, doublons, manquants — inchangés)
```

**Le gratuit d'abord.** « Platinum End intégrale tomes 1 à 14 » est compris
sans le moindre appel externe : des règles écrites suffisent. Payer un modèle
pour retrouver ce que le vendeur a écrit noir sur blanc serait absurde.

**Les photos, seulement sur clic.** L'appel est lent, il a un coût, et il
envoie les images à un service externe : trois raisons de ne pas le faire dans
le dos de l'utilisateur. Charger une annonce ne déclenche **jamais** d'appel
payant.

**Une seule liste.** Jamais « résultats du texte » d'un côté et « résultats des
photos » de l'autre : les deux sources alimentent les mêmes propositions, et
une ligne indique d'où elle vient (« annonce », « photos », « annonce +
photos »). Le libellé parle de la donnée, jamais du fournisseur d'IA.

**Les photos enrichissent, elles ne remplacent pas.** Si le titre annonce 14
tomes et que les photos n'en montrent que 12, les deux derniers restent
proposés : une photo qui ne montre pas un livre ne prouve pas son absence.
Inversement, une photo qui lit « Perfect Edition » complète un tome dont le
texte ne disait rien de l'édition.

**Vos corrections ne sont jamais écrasées.** Corriger un tome, choisir une
édition ou retirer une ligne survit à une nouvelle analyse — que celle-ci vienne
d'une modification du titre ou d'un clic sur « Analyser les photos ».

**Ce que « Confirmer » veut dire** : « voilà ce que contient l'annonce ». Pas
« j'ai acheté ces mangas ». **Aucun exemplaire n'est ajouté à la collection**,
et la phrase est écrite sous le bouton. Aucune fiche catalogue, aucune édition,
aucun tome n'est créé non plus : une reconnaissance ne devient jamais une
donnée de catalogue toute seule.

**Ce que l'écran distingue**, parce que confondre ces états serait mentir :

| Affichage | Sens |
|---|---|
| « Confiance élevée » + série connue | Lu nettement, retrouvé au catalogue — seul cas pré-coché |
| « Confiance moyenne » / « Piste incertaine » | Proposition à regarder, jamais pré-cochée |
| « Édition à confirmer » | La série est connue, l'édition n'a pas été lue. Les éditions du catalogue sont proposées, **aucune n'est choisie d'office** |
| « Reconnu, mais pas encore dans votre catalogue » | Rien n'a été créé ; le parcours d'ajout habituel reste à disposition |
| « N éléments visibles mais non identifiés » | À ajouter à la main — sans quoi le lot paraîtrait plus petit qu'il n'est |
| « Lu sur la photo : « … » » | L'écart entre la lecture et le titre du catalogue reste visible |
| « Vu sur 3 photos (1, 2, 3) » | Le même tome vu plusieurs fois compte **une** fois, mais on voit d'où il vient |

**L'utilisateur garde la main** : décocher, corriger le numéro de tome, choisir
une autre édition, retirer une ligne, ajouter un élément que la reconnaissance
a manqué. Une ligne cochée mais incomplète dit ce qui lui manque
(« Choisissez l'édition pour pouvoir le confirmer ») plutôt que de disparaître
silencieusement du compteur.

**Branches**, toutes menant au formulaire manuel intact — et toutes laissant
**les propositions du texte en place** :
- **aucun moteur configuré** → « L'analyse des photos n'est pas configurée sur
  cette instance. » ;
- **moteur indisponible** → « L'analyse des photos n'a pas pu aboutir. Vous
  pouvez réessayer. » ;
- **rien de lisible sur les photos** → « Les photos n'ont rien ajouté de
  lisible. » — ce n'est pas une panne, et cela ne se réessaie pas ;
- **aucune photo exploitable** → même issue ;
- **annonce vague** (« beau lot de mangas divers ») → aucune proposition plutôt
  qu'une série inventée ; les photos ou la saisie manuelle prennent le relais ;
- **annonce sans photo** → le texte suffit, le bouton n'apparaît même pas.

**Une panne ne bloque jamais l'analyse.** C'est la règle du projet : l'IA
améliore IozyCore, IozyCore ne dépend pas de l'IA — et depuis la V2, une
annonce bien rédigée n'en a même pas besoin.

**Sécurité** : le serveur ne télécharge que des photos servies par un hôte
qu'un provider déclare explicitement (liste distincte de celle des pages),
HTTPS seul, refus des adresses internes, aucune redirection suivie, type MIME
image vérifié, 8 photos, 3 Mo par photo, 12 Mo cumulés. Il n'existe aucun
endpoint de récupération d'image arbitraire. Aucun cookie Vinted, aucune API
privée.

**Confidentialité** : le moteur retenu pour la V1 est externe — **les images
sont envoyées au fournisseur**. Rien n'est archivé côté IozyCore, et aucun
octet d'image n'entre dans les journaux.

**Limite connue** : la V1 n'est validée que sur le **manga**. L'architecture
accepte d'autres univers, mais le moteur décline poliment ce qui n'a pas été
vérifié plutôt que de répondre au hasard.

**Écrans** : `ListingDetectionPanel`, dans `PurchaseAnalysisPage`
**Backend** : `POST /api/recognition/analyze`
**Statut** : `COMPLET (Manga)`

### 35 ter. Comprendre si l'annonce est intéressante POUR MOI
*(2026-08-22 — voir `docs/LISTING_SOURCES.md` §8)*

Le résultat d'une analyse répond désormais à **trois questions distinctes**,
présentées dans l'ordre où elles décident, sans jamais être fondues :

1. **Intérêt pour ta collection** — éléments détectés, déjà possédés, manquants,
   dans les envies. Et surtout le chiffre différenciant : **prix par élément
   réellement utile**. Un lot de 6 tomes à 30 € affiche 5 €/tome ; si un tome
   est déjà possédé, il coûte **6 €/tome utile**. Quand tout est déjà possédé,
   ce prix n'est pas affiché — « 0 € le tome utile » ferait passer un lot
   inutile pour une aubaine.
2. **Prix** — catégorie nommée (très bon prix → trop cher), avec la référence,
   l'écart en pourcentage et sa confiance. Référence trop faible → « référence
   insuffisante » et **aucune offre précise recommandée**, plutôt qu'un nombre
   rassurant tiré de rien.
3. **Points à vérifier** — photos absentes ou trop peu nombreuses, description
   trop courte, mention de paiement hors plateforme, prix très bas. Quatre
   paliers nommés, **jamais une note sur 100**.

**Deux règles visibles à l'écran** : beaucoup de photos ne donne aucun bonus de
confiance, et un prix très bas apparaît en vigilance **tout en restant un très
bon prix** — les deux lectures coexistent, l'écran le dit.

**Ce que l'analyse ne prétend pas** : la référence vient des **prix relevés dans
IozyCore**, pas de ventes conclues ni d'une recherche de comparables externes.
Pour un lot, c'est la somme des références par série — approximation dont la
confiance est plafonnée, et nulle dès qu'une série manque.

**Fonctionne sans Vinted** : une annonce entièrement saisie à la main produit
exactement la même évaluation.

**Écrans** : `ListingAssessmentCard`, `PurchaseAnalysisResultCard`
**Backend** : `CollectionFit`, `PricePosition`, `DealAssessmentPolicy`,
`ListingTrustAssessment`, `ListingAssessment`, `ListingTextParser`
**Statut** : `COMPLET` — vérifié en direct (doublon détecté → 5 €/élément
contre 6 €/élément utile ; mention PayPal/WhatsApp relevée).

**Écrans** : `ListingUrlField`, `ListingPhotos`, `PurchaseAnalysisPage`
**Backend** : `POST /listing-metadata/resolve`, `ListingSourceResolver`,
`VintedListingProvider`, `ListingUrlGuard`
**Statut** : `COMPLET` pour Vinted — vérifié en direct sur une annonce publique
réelle (titre, prix, description et photos récupérés, analyse menée jusqu'au
verdict, snapshot relu en base).

### 36. Renseigner une édition inconnue pendant l'analyse
**Résultat** : quand l'édition n'est pas connue, un formulaire s'ouvre en ligne
pour la créer sans quitter l'analyse.
**Écrans** : `EditionReferenceLookup`
**Statut** : `COMPLET`

### 37. Pré-remplir une fiche d'édition avec l'IA
**Étapes** : « Pré-remplir avec l'IA ».
**Résultat** : les champs sont **proposés**, jamais enregistrés : l'utilisateur
relit puis valide. Confiance et justification affichées.
**Branches** : aucune clé Gemini configurée ou rien à proposer → 204, le bouton
ne produit rien d'affirmatif.
**Statut** : `COMPLET`

### 38. Relever un prix comme observation de marché
**Point de départ** : résultat d'analyse ▸ détail d'une série
**Préconditions** : l'édition est reconnue **et** les tomes du lot sont
contigus (sinon le prix/tome serait faux — le bouton n'apparaît pas).
**Résultat** : le prix relevé alimente les analyses suivantes de cette édition
(bascule de « estimation théorique » vers « prix observé »).

**Relire et retirer** (depuis le 2026-08-21) : les relevés d'une édition
s'affichent sous elle dans **Éditions de référence**, avec prix, portée,
plateforme, état et date — jusque-là ils étaient invisibles une fois
enregistrés. Chacun peut être supprimé, avec **Annuler** (le relevé est
réenregistré à l'identique).

**Aucune modification n'est offerte, volontairement** : un relevé est un fait
constaté à une date, pas un champ qu'on ajuste. Le corriger après coup
réécrirait une observation passée, et donc les analyses qui s'appuient dessus ;
on retire le faux et on enregistre le juste. Les analyses **déjà enregistrées**
ne bougent pas — chacune fige ses chiffres au moment du calcul ; ce sont les
suivantes qui cesseront de compter le relevé retiré.

**Branches** : retirer le dernier relevé d'une édition la rend à nouveau
supprimable (voir le garde-fou de `deleteEdition`). Suppression idempotente.
**Écrans** : `SeriesBreakdownItem` (enregistrer), `EditionObservations` (relire, retirer)
**Backend** : `GET`/`DELETE /purchase-analysis/market-observations`
**Statut** : `COMPLET`

### 39. Préparer une offre à envoyer
**Étapes** : « Faire une offre » → un texte prêt à coller, bouton Copier.
**Branches** : désactivé si aucun montant n'est calculable ; presse-papier
refusé → le texte reste sélectionnable. **Aucune intégration de messagerie** —
c'est écrit à l'écran.
**Statut** : `COMPLET`

### 40. Ajouter les séries d'un lot à la wishlist
**Étapes** : « Ajouter à ma wishlist ».
**Branches** : désactivé si aucune série du lot n'est déjà une œuvre connue.
**Ajoute toutes les séries connues du lot d'un coup, sans confirmation ni
retour visible** (voir §UX-4).
**Statut** : `COMPLET`

### 41. Consulter et rouvrir une analyse passée
**Étapes** : Historique → une ligne → le résultat complet est rejoué à
l'identique, avec retour vers l'historique.
**Supprimer une analyse** (depuis le 2026-08-21) : depuis l'historique, avec
une **confirmation légère** — et non un « Annuler » après coup, qui ne
restaurerait rien : relancer l'analyse donnerait un autre résultat, les prix
relevés et éditions ayant pu changer entre-temps. La suppression **ne touche ni
aux prix relevés ni aux éditions** renseignés au fil de cette analyse : ce sont
des données de référence, qui servent toutes les analyses suivantes.

**Aucune modification n'est offerte, volontairement** : une analyse est le
résultat figé d'un calcul ; en corriger un chiffre produirait un verdict qui n'a
jamais été calculé.

**Branches** : les analyses **antérieures au 2026-08-21** portent des textes en
anglais figés — ce sont des instantanés stockés, pas des calculs rejoués.
Suppression idempotente.
**Écrans** : `AnalysisHistoryPage`, `AnalysisHistoryDetailPage`
**Backend** : `DELETE /purchase-analysis/history/{id}`
**Statut** : `COMPLET`

---

## 7. Parcours — Découvrir

### 42. Parcourir Découvrir
**Résultat** : trois panneaux — Tier Lists, Opportunités, Prochaines sorties.
**Desktop** les trois côte à côte au-delà de 1100 px ; **Mobile** un onglet à la
fois.
**Nature** : c'est un **hub d'aperçus**, pas une page interactive — chaque
panneau montre un résumé et renvoie vers l'écran dédié.
**Écrans** : `DiscoverPage`, `DiscoverTierPreview`, `DiscoverOpportunitiesPreview`
**Statut** : `COMPLET`

### 43. Ouvrir les opportunités
**Étapes** : panneau Opportunités → une série, ou « Tout voir » → `/suggestions`.
**Résultat** : séries dont il ne manque que quelques tomes, avec le nombre de
tomes manquants et le coût estimé pour compléter quand un prix est connu.
**Données** : **réelles**, calculées par le moteur de complétude — rien de
codé en dur.
**Statut** : `COMPLET`

### 44. Consulter les prochaines sorties
**Résultat** : « Pas encore de calendrier de sorties. » avec la raison — aucune
source ne fournit de date fiable par tome, et la section arrivera quand une
vraie donnée existera.
**Statut** : `PARTIEL` — vide **assumé et expliqué**, sans donnée inventée ;
aucune action possible depuis ce panneau.

---

## 8. Parcours — Tier Lists

### 45. Ouvrir l'écran Tier Lists
**Point de départ** : Découvrir ▸ panneau Tier Lists, fiche ▸ « Toutes mes Tier
Lists », ou Profil ▸ Tout voir
**Résultat** : par univers, le classement général et les listes personnalisées,
avec « N classés · N à classer ».
**Écrans** : `TierListsScreen`
**Statut** : `COMPLET`

### 46. Créer une Tier List personnalisée
**Étapes** : « Nouvelle Tier List » → nom, univers (ou « Toutes catégories »),
rangs actifs, description → Créer.
**Écrans** : `CreateTierListModal`
**Statut** : `COMPLET`

### 47. Classer une œuvre depuis un board
**Étapes** : cliquer une tuile → sélecteur de rang → choisir S→F.

**Classer n'est pas posséder** (vérifié et corrigé le 2026-08-21). Un
classement dit ce que l'utilisateur pense d'une œuvre : la revendre, la perdre
ou ne l'avoir jamais achetée ne change pas cet avis.
- Le **modèle** le permettait déjà : `EntityRank` ne référence qu'une Entity,
  jamais une Ownership ; aucune suppression de possession ne le met en cascade ;
  l'API de classement n'exige que l'existence de l'œuvre.
- C'était la **lecture du board** qui rompait la règle : elle ne partait que des
  œuvres possédées, si bien que vendre un manga classé S le faisait disparaître
  de la ligne S alors que son rang existait toujours en base. Le board affiche
  désormais **toutes** les œuvres classées de l'univers.
- La file **« à classer »** reste, elle, volontairement adossée à la
  possession : proposer de classer tout ce qui a une fiche la noierait sous les
  œuvres seulement mises en envies. **Pouvoir être classée** et **devoir
  apparaître dans « à classer »** sont deux questions distinctes.
- Conséquence sur la fiche : « Mes classements » s'affiche désormais pour
  **toute** œuvre. Il était réservé aux séries manga dont une édition est
  affichée — un jeu vidéo, un type personnalisé ou une série seulement souhaitée
  n'avaient aucun accès au classement depuis leur fiche.

**Branches** : « Retirer le classement » (l'œuvre reste dans la liste, non
classée) ; touches S-F au clavier ; Échap ferme sans changement.
**Écrans** : `TierBoard`, `TierPicker`, `TierSummarySection`
**Statut** : `COMPLET` — **Desktop** popover centré **+ glisser-déposer d'une
tuile vers une ligne de rang** / **Mobile** bottom-sheet, **pas de
glisser-déposer**.

### 48. Classer rapidement une file d'œuvres
**Étapes** : « Classer rapidement (N) » → le sélecteur enchaîne les œuvres non
classées une par une, avec compteur de progression et « Passer cette œuvre ».
**Écrans** : `useQuickRank`, `TierPicker`
**Statut** : `COMPLET`

### 49. Gérer une Tier List personnalisée
**Étapes** : « Ajouter » (sélection multiple parmi les œuvres possédées) ;
menu « … » ▸ **Renommer** ; menu « … » ▸ **Supprimer cette Tier List** (avec
confirmation) ; depuis le sélecteur de rang, **« Retirer de cette Tier List »**.
**Branches** : ajouter une œuvre inconnue → 400 ; une œuvre déjà présente est
silencieusement ignorée (idempotence voulue).
**Écrans** : `CustomTierBoardPage`, `AddTierListItemsPanel`, `TierPicker`
**Statut** : `COMPLET`

### 50. Partager ses Tier Lists
**Réalité** : il n'existe **aucun partage propre aux Tier Lists**. Elles sortent
uniquement avec la section Collection de l'espace partagé, via une case dédiée
et décochée par défaut (voir 53). Décocher la collection les retire du même
geste : un classement accompagne l'inventaire, il ne se partage pas seul.
**Statut** : `PARTIEL` — la capacité existe, mais pas là où on la chercherait.

---

## 9. Parcours — Envies

### 51. Consulter et gérer ses envies
**Point de départ** : Ma collection ▸ vue « Envies » (depuis le 2026-08-26,
Lot 38 : les envies ne sont plus un écran à part, elles sont un filtre de la
collection — `WishlistPage` a été supprimée).
**Étapes** : consulter la liste ; ouvrir la fiche d'une envie ; retirer une
envie.
**Écrans** : `ShelfPage` ▸ `BarreVues`
**Backend** : `GET /wishlist`, `DELETE /wishlist/{id}`
**Statut** : `COMPLET`

### 52. Ajouter une œuvre à ses envies
**Points de départ** (depuis le 2026-08-21) :
- **fiche d'une œuvre**, quel que soit son type et qu'elle soit possédée ou non
  — là où la décision « je le veux » se prend. Le bouton vivait jusqu'au
  2026-08-21 dans la branche « manga avec une édition affichée », si bien qu'il
  manquait exactement là où on le cherche : sur la fiche d'une œuvre justement
  SOUHAITÉE (aucun tome, donc aucune édition affichée) et sur toute fiche
  non-manga. Une œuvre en envies pouvait ainsi ouvrir sa fiche sans que rien
  n'indique qu'elle y était, ni ne permette de l'en retirer ;
- **résultat de recherche local** (bloc « Déjà dans IozyCore »), possédé ou non ;
- **suggestion externe d'une recherche**, même si l'œuvre est totalement
  inconnue d'IozyCore ;
- **menu du scan**, y compris pour un livre scanné dont aucune fiche n'existe ;
- **résultat d'une analyse d'achat**, qui ajoute d'un coup toutes les séries
  connues du lot.

**Résultat** : le bouton passe à « Dans vos envies », le badge de l'en-tête
s'incrémente, et un message « Ajouté aux envies » propose **Annuler**.
**Réversibilité** : réelle dans les deux sens — annuler un ajout supprime
l'entrée créée, annuler un retrait la recrée.

**Vouloir n'est pas posséder** (levé le 2026-08-21). Une œuvre venue d'une
source externe n'avait aucun moyen d'entrer dans les envies : le seul chemin qui
faisait exister une fiche (`QuickAddService`) créait toujours une possession
dans la foulée. Une œuvre externe est désormais envoyée par sa **référence**
(type de collection + titre + attributs déjà connus) ; le backend résout ou crée
sa **fiche catalogue seule**, sans aucune `Ownership`, et renvoie son identité
interne. Le catalogue n'est pas la collection : l'œuvre n'apparaît donc ni dans
« Ma collection », ni dans les Tier Lists, ni dans les statistiques — seulement
dans les Envies, où elle a sa place.
**Déduplication** : la règle est celle de l'ajout rapide, partagée dans
`CatalogEntityResolver` — la même œuvre atteinte par la recherche, par le scan
ou par un achat retombe sur la même fiche. Ajouter deux fois la même œuvre ne
crée ni seconde fiche ni seconde envie ; l'acheter plus tard réutilise sa fiche
et lui ajoute une possession, sans retirer l'envie (ce comportement-là est
inchangé).
**Cohérence d'affichage** : créer une fiche invalide les caches de recherche
locale et de métadonnées — l'œuvre quitte aussitôt les suggestions externes pour
le bloc « Déjà dans IozyCore », marquée « Pas encore possédé ».
**Branches** : requête sans identité exploitable (ni `entityId`, ni type + titre)
→ 400 ; type de collection ou œuvre introuvable → 400 lisible, jamais un 500 de
contrainte. Les Opportunités n'ont pas ce bouton : ce sont par définition des
séries déjà possédées.
**Écrans** : `WishlistToggle`, `useWishlist` (source unique), `Toast`
**Backend** : `POST /wishlist` (par `entityId` **ou** par référence externe),
`DELETE /wishlist/{id}`, `CatalogEntityResolver`
**Statut** : `COMPLET`

### 53. Partager son espace — collection, envies, ou les deux
*(unifié le 2026-08-21 ; remplace les parcours « Partager ma collection » et
« Partager ma liste d'envies », qui étaient deux systèmes séparés)*

**Ce qu'il y avait avant** : deux partages parallèles, chacun avec sa table,
son jeton, son contrôleur public, sa page et sa section de réglages. Entrer par
« Ma collection » ou par « Mes envies » donnait **deux URL différentes pour le
même espace personnel**, et la personne qui les recevait devait jongler entre
deux pages. Or collection et envies sont deux **vues** du même espace, pas deux
espaces.

**Points de départ**, tous les trois pilotant le **même** partage et le **même**
jeton :
- Profil ▸ Partage (sa maison principale) ;
- Mes envies ▸ Partage (envies mises en avant dans la liste des cases) ;
- Ma collection ▸ « … » ▸ Partager ma collection (mène à Profil, sur le partage).

**Parcours** :

```
Générer un lien
→ cocher Ma collection et/ou Mes envies
→ (Mes Tier Lists, sous la collection)
→ Copier
→ l'envoyer
→ ouverture sans compte
```

**Résultat** : une seule URL, `/public/share/:token`. La page publique affiche
des onglets **Collection / Envies** uniquement si les deux sections sont
partagées — un onglet inaccessible dirait déjà quelque chose du propriétaire.

**Au moins une section visible** : décocher la dernière est refusé côté domaine
ET désactivé dans le formulaire, avec la raison affichée. Un lien qui n'expose
rien n'est pas un partage discret, c'est une URL vers une page vide.

**Ce qui sort** : titres, jaquettes, éditions réellement possédées, progression
X/Y, et pour les envies la date d'ajout. **Ce qui ne sort jamais** : prix payé,
valeur estimée, date d'acquisition, note ou commentaire personnel, tag,
relation, analyse d'achat, prix relevé, identifiant interne, lien profond. Le
filtrage est **backend** : une section non partagée n'est pas masquée à
l'affichage, elle n'est pas calculée et ne figure pas dans la réponse.

**Vue vivante, pas photographie** : ajouter un tome ou une envie apparaît dans
le lien déjà distribué, sans rien à régénérer.

**Révocation** : « Désactiver le partage » efface le jeton — l'ancienne URL
répond aussitôt un 404 neutre, jamais un détail qui laisserait deviner qu'elle a
existé. « Régénérer » crée un nouveau jeton et invalide l'ancien du même geste,
avec l'avertissement affiché.

**Lecture stricte** : la page publique vit hors de l'AppShell privé — pas
d'onglets de navigation, pas de cœur, pas d'avatar, **aucune carte cliquable**.
Il n'existe pas de fiche publique, et envoyer un visiteur anonyme vers une fiche
privée l'exposerait aux prix et aux notes.

**Identité** : aucune. Le modèle n'a ni pseudo ni avatar, et cette passe n'en a
pas inventé — la page ne montre que le nom de l'application.

**Branches** : jeton inconnu, vide ou révoqué → 404 neutre ; section vide →
« Cette collection est vide » / « Rien dans cette liste ».
**Écrans** : `ShareSection` (unique, monté depuis Profil et Envies),
`SharedSpacePage`
**Backend** : `GET/POST/PATCH/DELETE /share`, `GET /public/share/{token}`
**Statut** : `COMPLET` — vérifié en direct, y compris dans un onglet neuf
n'appelant que l'endpoint public.

---

## 10. Parcours — Profil, Paramètres, Administration

### 54. Consulter son profil
**Résultat** : valeur estimée (ou « Pas encore de prix renseigné »), nombre de
titres et de tomes possédés, aperçu des Tier Lists, partage de collection, et
l'entrée Paramètres. (« Évaluer un achat » et « Bilan annuel » en sont
partis le 2026-08-29 : le premier est une destination de la barre de
navigation, le second une lecture qui a rejoint Découvrir.)
**Écrans** : `ProfilePage`, `ProfileValueHero`, `ProfileTierListsSection`
**Statut** : `COMPLET`

### 55. Partager sa collection
**Fusionné dans le parcours 53** le 2026-08-21 : la collection est devenue une
**section** de l'espace partagé, plus un partage à part avec son propre lien.
Profil ▸ Partage reste le point d'entrée principal ; « Ma collection ▸ … ▸
Partager ma collection » y mène, sans créer de second jeton.

### 56. Générer le bilan annuel
**Étapes** : Découvrir ▸ Bilan annuel → choisir l'année → « Télécharger l'image ».
*(Sous Profil jusqu'au 2026-08-29 : c'est une lecture de la collection, pas un
réglage — et un lien plutôt qu'un quatrième onglet, la composition éditoriale
de Découvrir n'en attend pas.)*
**Résultat** : carte rendue en `<canvas>` puis téléchargée en PNG — acquisitions
et répartition par type, séries commencées, expériences et note moyenne,
auteur le plus présent.
**Écrans** : `CollectionRecapPage`
**Statut** : `COMPLET` — export statique, **aucun lien public**.

### 57. Changer l'apparence et l'ordre des titres
**Étapes** : Paramètres ▸ interrupteur **Thème sombre** ; cocher/ordonner
(glisser-déposer) les langues de titre (français, romaji, anglais).
**Résultat** : thème appliqué immédiatement et persisté ; l'ordre des langues
décide du titre affiché partout.
**Écrans** : `SettingsPage`, `titleLanguage.ts`
**Statut** : `COMPLET`

### 58. Gérer les types de collection
**Point de départ** : Ma collection ▸ Plus d'outils, **ou** Administration
**Étapes** : créer un type (code, libellé, couleur, icône, format de jaquette,
champs personnalisés, types d'expérience), le modifier, le supprimer.
**Branches** : suppression refusée en 409 tant qu'une œuvre l'utilise ; un type
créé à la main n'a **aucune source externe** (ni recherche, ni scan) — annoncé
à l'écran.
**Écrans** : `EntityTypesPage`, `EntityTypeFormPage`
**Statut** : `COMPLET`

### 59. Consulter et nettoyer les éditions de référence
**Point de départ** : Administration ▸ Éditions de référence
**Étapes** : parcourir par série, ouvrir la série, supprimer une édition.
**Branches** : suppression refusée en 409 lisible si des tomes ou des prix
relevés s'y réfèrent encore. **Écran de lecture et de suppression seulement** —
renseigner se fait depuis la fiche.
**Écrans** : `EditionsPage`
**Statut** : `COMPLET`

### 60. Exporter sa collection
**Étapes** : Paramètres ▸ **Mon compte** ▸ « Emporter ma collection » →
Télécharger en JSON ou en CSV (.zip). *(Sous Administration jusqu'au
2026-08-29, à côté des catégories de collection — comme si emporter ses
données était de la configuration technique. C'est le contraire : c'est la
garantie de pouvoir partir, et elle appartient au compte qui possède ces
données.)*
**Résultat** : œuvres, tomes, possessions, expériences, envies, relations, tags,
**éditions de référence, classements, Tier Lists**, et depuis le Lot 79 **prix
relevés, édition suivie, types de collection et profil de collectionneur** —
14 fichiers dans le ZIP.
**Hors périmètre, volontairement** : historique d'analyses (une histoire
calculée, instantané du moteur de son jour), caches, et jetons de partage (un
secret vivant : l'exporter recopierait une URL-capacité dans un fichier).
**Écrans** : `SettingsPage`
**Statut** : `COMPLET`

---

## 11. Parcours — Pages publiques (visiteur sans compte)

### 61. Consulter une collection partagée
**Résultat** : univers, œuvres, éditions possédées, progression X/Y, et les Tier
Lists **si et seulement si** le propriétaire a activé l'interrupteur.
**Branches** : jeton inconnu, malformé, révoqué ou d'une autre fonctionnalité →
**404 identique dans tous les cas**, sans jamais laisser deviner qu'un lien a
existé.
**Statut** : `COMPLET`

### 62. Consulter une liste d'envies partagée
**Résultat** : titre et jaquette seulement. Mêmes garanties de jeton.
**Statut** : `COMPLET`

---

## 18 bis. Parcours — Entrer et sortir (ajoutés le 2026-08-29, Lot 94)

Ces trois parcours précèdent tous les autres : sans session, chaque écran de
l'application privée est remplacé par la porte, et chaque appel d'API répond
401. Vérifiés en direct sur l'app réelle (création du premier compte,
déconnexion, reconnexion), pas seulement en test.

### 63. Créer le premier compte
**Point de départ** : ouvrir l'app sur une instance où personne n'a de compte
**Résultat** : l'écran annonce que *« le premier créé reprend la collection
déjà enregistrée »*, et c'est exactement ce qui se passe : le compte adopte
l'identifiant du propriétaire par défaut, donc la collection existante est la
sienne — vérifié, 6 titres et 12 tomes retrouvés après création. Créer connecte
du même geste : redemander ce qu'on vient de taper deux fois n'apprendrait rien.
**Le pseudo** (depuis le 2026-08-29) : obligatoire, unique sur l'instance,
3 à 24 caractères sans espace ni arobase. La règle est écrite **sous le champ**,
pas rendue en refus après coup. C'est le seul nom sous lequel on apparaît :
l'adresse e-mail sert à se connecter, jamais à se montrer. Il se **fixe à
l'inscription** et ne change plus : décision produit du 2026-08-29, pas un
écran qui manque. Un pseudo qu'on peut reprendre est un pseudo qui désigne
quelqu'un d'autre demain — dans un espace partagé, dans une capture, dans la
mémoire de celui qui l'a lu.
**Branches** : mot de passe sous 10 caractères → refus avec la raison ; adresse
mal formée → refus ; pseudo mal formé → refus avec la règle ; **pseudo déjà
pris → refus explicite**, contrairement à un échec de connexion : un pseudo est
public par destination, le taire n'empêcherait que la personne concernée d'en
choisir un autre. Une instance qui a déjà un compte demande un **code
d'invitation**, et n'offre même pas l'écran si aucun code n'est configuré.
**Écrans** : `AuthPage`, `App.PorteFermee`
**Backend** : `GET /api/auth/etat`, `POST /api/auth/register`
**Statut** : `COMPLET`

### 64. Se connecter
**Point de départ** : ouvrir l'app sans session
**Résultat** : la collection, à l'endroit où on l'avait laissée.
**Branches** : adresse inconnue et mot de passe faux rendent **le même**
message — distinguer offrirait un test d'existence de compte. Session perdue en
cours de route (serveur redémarré, expiration) : le premier appel qui reçoit un
401 ramène la porte, sans qu'aucun écran n'ait à s'en occuper.
**Écrans** : `AuthPage`, `lib/useAuth`
**Backend** : `POST /api/auth/login`, `GET /api/auth/me`
**Statut** : `COMPLET`

### 64 bis. Savoir au nom de qui on travaille
**Point de départ** : n'importe quel écran de l'app
**Résultat** : l'avatar en haut à droite porte les **initiales du pseudo**
(« jean-dupont » → JD, « kenshin » → KE) et s'annonce « Mon profil — kenshin »
à un lecteur d'écran. Il affichait « IO » en dur jusqu'au 2026-08-29 : les
initiales de l'application, sur le bouton qui mène au compte de quelqu'un.
**Branches** : tant que le compte n'est pas arrivé (une requête, donc un
instant), l'avatar affiche « IO » — deux lettres stables plutôt qu'un trou qui
se remplit.
**Écrans** : `GlobalShortcuts` (les deux en-têtes), `lib/initiales`
**Backend** : `GET /api/auth/me`
**Statut** : `COMPLET`

### 64 ter. Administrer les comptes de l'instance
*(2026-08-29 — réservé aux administrateurs)*

**Point de départ** : bouton **Administration** de l'en-tête ▸ **Comptes**
(l'entrée n'apparaît que pour un administrateur ; le lien masqué ne protège
rien, c'est le serveur qui répond 403)
**Résultat** : la liste des comptes, du plus ancien au plus récent — pseudo,
adresse, date d'inscription, et **ce que chaque compte pèse** (« 412
possessions · 7 envies · 2 classements », ou « Aucune donnée »). Rien du
**contenu** d'une collection n'apparaît : l'isolation par propriétaire est
entière, et l'administration porte sur l'instance, pas sur les données.

**Supprimer un compte** — confirmation en deux temps, même patron que la
suppression d'une fiche. La phrase nomme ce qui part et ce qui reste : les
œuvres du **catalogue** sont partagées et ne bougent pas. Définitif : ni
corbeille, ni annulation.

**Branches** : son propre compte → aucun bouton, et 409 si la requête est
forgée — c'est ce qui garantit qu'il reste toujours un administrateur ; compte
inconnu → 404 ; compte ordinaire sur ces routes → **403**.

**Qui est administrateur** : le premier compte de l'instance l'est d'office.
Les suivants ne le deviennent qu'en SQL — un geste rare, dont un bouton
demanderait de décider qui peut appuyer dessus.
**Écrans** : `ComptesPage`, `AdministrationPage`
**Backend** : `GET`/`DELETE /api/admin/comptes`
**Statut** : `COMPLET`

### 65. Se déconnecter
**Point de départ** : Profil ▸ Compte
**Résultat** : la session est invalidée côté serveur, le cache client vidé, la
porte revient. Sur Profil et nulle part ailleurs : un bouton posé dans un
en-tête permanent se cliquerait par erreur plus souvent qu'à dessein.
**Écrans** : `ProfilePage` (section Compte)
**Backend** : `POST /api/auth/logout`
**Statut** : `COMPLET`

---

## 12. Différences de parcours desktop / mobile

Le point de bascule est **768 px** (`AppShell.NAV_BREAKPOINT_PX`). Les deux navigations ne coexistent jamais.

| Parcours | Desktop (≥ 768 px) | Mobile (< 768 px) |
|---|---|---|
| Panneau d'un tome | Drawer droit **non modal** — on peut cliquer un autre tome sans le fermer | Bottom-sheet **modal**, overlay cliquable |
| Filtres de collection | Popover ancré | Bottom-sheet |
| Sélecteur de rang | Boîte centrée 320 px | Bottom-sheet |
| Menu du scan | Boîte centrée 360 px | Bottom-sheet pleine largeur |
| Classer sur un board | Clic **ou glisser-déposer** vers une ligne de rang | Clic uniquement — **pas de glisser-déposer** |
| Découvrir | Les 3 panneaux côte à côte au-delà de 1100 px | Un onglet à la fois |
| Accès à Administration | Bouton dédié de l'en-tête (icône clé) | Le même, dans `MobileHeader` |
| Accès à Profil | Avatar de l'en-tête, aux **initiales du pseudo** | Le même, dans `MobileHeader` |
| Accès à Envies | Cœur du header, avec badge | Cœur de `MobileHeader`, même badge |

### 12.1. Accès mobile — rétabli le 2026-08-21

`/profile` et `/wishlist` n'étaient liés que depuis `DesktopHeader`
(`hidden md:block`) : sous 768 px, dix parcours n'avaient **aucun chemin
d'accès**, alors que les écrans existaient et fonctionnaient.

`MobileHeader` (nom de l'app + cœur + avatar) rétablit ces deux accès, et avec
eux Paramètres, Administration, l'export, le bilan annuel, les éditions de
référence et le partage d'espace. *(Le cœur en est reparti le 2026-08-28, voir
plus haut : Ma collection est dans la barre du pouce et porte le filtre. Le
profil, lui, n'a pas d'autre chemin - c'est ce qui justifie qu'il reste.)* La navigation globale n'a pas bougé :
la barre du pouce garde **strictement** ses trois destinations plus le
raccourci Scan — Envies et Profil ne sont pas des destinations pairs.

Vérifié à **375, 390 et 430 px** : avatar présent (et cœur, à l'époque), chaîne
complète parcourue (Cœur → Envies → retour ; Avatar → Profil → Paramètres →
Administration → liens d'export ; ces deux derniers écrans ont été réorganisés
le 2026-08-29 — l'export vit désormais dans Paramètres, et Administration est
une sœur de Paramètres, plus une sous-partie), les deux « Générer un lien » atteignables,
aucun débordement horizontal. Desktop inchangé.

---

## 13. États d'erreur réellement traités

| Situation | Traitement |
|---|---|
| API injoignable / requête en échec | `ErrorBanner` avec le message du serveur, sur chaque écran qui charge |
| Œuvre introuvable (404) | Message traduit dédié — le message serveur d'un 404 ne nomme qu'un identifiant |
| Refus métier (409) | Message du serveur affiché tel quel : « 3 tome(s) y sont encore rattachés » |
| Corps de requête invalide | 400 lisible ; un identifiant absent ne produit plus de 500 |
| Conflit de données (unicité, clé étrangère) | 409 générique — **aucune trace SQL ne peut atteindre l'écran** |
| Recherche externe en échec | « La recherche de métadonnées a échoué » |
| Recherche sans résultat | « Aucun résultat pour ce titre » |
| Scan non reconnu **ou** fournisseur muet | « Rien trouvé pour X » + « Chercher par titre » — les deux cas sont volontairement indistincts, le fournisseur pouvant simplement n'avoir pas répondu |
| Jaquette absente | Bloc gris à la place, jamais d'image cassée |
| Quota Google Books dépassé | Message chiffré : « N/M séries traitées, réessaie plus tard » |
| Presse-papier refusé | Silencieux — le texte reste sélectionnable |
| Formulaire incomplet | Bouton désactivé (jamais un envoi voué à échouer) |
| Type sans fournisseur externe | Annoncé **avant** la saisie, pas après un échec |
| Caméra non supportée | Message + repli sur la saisie manuelle du même écran |

**Non traité** : un panneau vide reste indiscernable d'une source indisponible (Découvrir ▸ Opportunités et Tier Lists n'ont pas d'état « source en panne »).

---

## 14. Annulation et retour arrière

**Annuler un formulaire** (aucune écriture n'a eu lieu) : correction d'édition, prix payé, note, renommage de Tier List, suppression d'un exemplaire, suppression d'une Tier List, suppression d'une œuvre, menu du scan (« Passer » ou Échap).

**Défaire une action déjà écrite** :

| Action | Réversible ? |
|---|---|
| Ajouter un tome | Oui — recliquer la tuile le retire |
| Classer une œuvre | Oui — « Retirer le classement » |
| Ajouter à une Tier List | Oui — « Retirer de cette Tier List », et ce retrait propose lui-même « Annuler », rang compris (Lot 82) |
| Ajouter aux envies | Oui — retirer depuis Envies |
| Retirer un tome possédé | **Oui** — « Annuler » dans le message qui suit, qui rend la date d'acquisition d'origine et non celle du jour (Lot 81) |
| Lien de partage | Oui — désactiver le partage, ou régénérer (l'ancien jeton cesse aussitôt) |
| Marquer vendu / perdu | **Oui** — « Annuler » dans le message qui suit l'action (`POST /ownerships/{id}/restore`, ajouté le 2026-08-21) ; réversible aussi ensuite, l'exemplaire restant visible sous « Exemplaires passés » |
| Expérience enregistrée | **Oui** — note et commentaire modifiables, suppression avec « Annuler » (2026-08-21) |
| Relation créée | **Oui** — type modifiable, suppression avec « Annuler » (Lot 82) ; ne touche à aucune des deux œuvres |
| Analyse d'achat | **Oui** — suppression avec confirmation (2026-08-21). Pas de modification : un résultat figé ne se corrige pas |
| Prix relevé (observation) | **Oui** — suppression avec « Annuler » (2026-08-21). Pas de modification : un fait constaté ne se réécrit pas |
| **Tag créé** | **Non** — détachable d'une œuvre, jamais supprimable |

Aucune action n'offre d'annulation *différée* : pas de « Annuler » après coup, pas de corbeille.

**Modifier ou supprimer, selon ce que la donnée est.** Une donnée éditable se
corrige dans son contexte ; un résultat calculé ou un fait daté se supprime et
se refait. Aucun PATCH n'a été créé là où le domaine n'en avait pas besoin — et
aucun « Annuler » n'est proposé là où il ne restaurerait rien.

---

## 15. Parcours morts / faux-finis

Cet audit n'a trouvé **aucun bouton décoratif** : pas de « À venir », pas de `toast` explicatif à la place d'une action, pas de donnée codée en dur présentée comme réelle, pas de route morte.

Les seuls écrans sans action sont des **vides honnêtes** :

| Écran | Comportement actuel | Nature |
|---|---|---|
| Découvrir ▸ Prochaines sorties | Explique qu'aucune source ne fournit de date fiable par tome | Vide assumé et motivé — pas un faux-fini |
| Envies | Vide tant qu'aucune œuvre n'a été souhaitée | État vide normal depuis la résolution d'UX-2 : cinq points d'entrée la remplissent, y compris pour une œuvre qu'on ne possède pas |

---

## 16. Capacités existantes mais difficiles à découvrir

> **Revue du 2026-08-29** : les huit constats relus **un par un dans le code**,
> pas de mémoire. Deux étaient caducs, trois ont été corrigés, un est
> délibéré, deux restent ouverts.

1. **Relever un prix de marché** — ~~n'apparaît que dans le détail d'une série
   d'un résultat d'analyse~~ — **RÉSOLU (2026-08-29)**. C'est la seule source
   de prix réellement constatés, dont dépend la qualité de toutes les analyses
   suivantes : la capacité la plus déterminante était la plus cachée. Elle
   exigeait d'analyser une annonce, d'ouvrir le détail d'une de ses séries, et
   seulement si l'édition était reconnue *et* les tomes contigus. Pire : quand
   une édition n'avait aucun relevé, le bloc qui les liste **ne s'affichait pas
   du tout** — rien ne disait que ces prix existaient. **Éditions de
   référence** porte désormais « Relever un prix » sur chaque édition, et
   annonce le vide plutôt que de le taire. La portée reste facultative, et
   l'écran dit ce que le prix décrira avant qu'on l'enregistre.
2. **~~Exemplaires passés~~ — CADUC (vérifié le 2026-08-29).** Vérifié dans le
   code, pas déduit : **aucun composant** ne rend « SOLD » ni « LOST », et le
   panneau de tome qui les montrait n'existe plus. Retirer un tome le
   **supprime** depuis le Lot 55 — il n'y a plus d'exemplaire passé à
   découvrir. Seul le type du DTO porte encore ces statuts, parce que le
   serveur les expose.
3. **Catégories de collection** — deux chemins ; le second est passé de trois
   niveaux à **zéro** le 2026-08-29 : Administration a son bouton dans
   l'en-tête.
4. **Éditions de référence** — seul écran d'ensemble du référentiel qui produit
   tous les « X/Y » de l'app, rangé sous Administration — à un clic de
   l'en-tête depuis le 2026-08-29, contre trois niveaux auparavant.
5. **Bilan annuel** — sous Découvrir depuis le 2026-08-29 (il était sous
   Profil, dans une liste de liens), toujours **sans rappel saisonnier**. Reste
   ouvert : un écran qu'on ne pense à ouvrir qu'une fois par an ne se trouve
   pas, il se rappelle.
6. **Classement rapide** — n'apparaît que s'il existe au moins une œuvre non
   classée. **Délibéré, pas un défaut** : proposer « classer ce qui n'est pas
   classé » quand tout l'est ouvrirait un écran vide. C'est la même règle que
   les rails vides de Ma collection.
7. **Ordre des langues de titre** — ~~rangé dans Paramètres sans lien depuis
   les écrans concernés~~ — **RÉSOLU (2026-08-29)**. On voyait un titre en
   romaji sans savoir que c'était un choix, encore moins où le changer. La
   liste des **Suggestions** de Rechercher — la seule surface que ce réglage
   gouverne — porte désormais « Langue des titres » à côté de son titre, et
   passe son origine pour que le retour ramène à Rechercher.
8. **~~Analyse d'achat depuis une fiche~~ — CADUC (vérifié le 2026-08-29).**
   « Évaluer » n'est pas en bas du bloc d'identité : c'est un **bouton
   principal** de la bande haute (FicheHero), à côté d'« Éditer », en aplat
   d'accent. Une seconde entrée, contextuelle, existe dans l'assistant de
   fiche.

---

## 17. Capacités backend sans aucun parcours utilisateur

Vérifié en confrontant l'OpenAPI de l'application (`/v3/api-docs`) à l'intégralité de `web/src`.

| Endpoint | Ce qu'il permettrait | Pourquoi c'est notable |
|---|---|---|
| `GET` / `PATCH /purchase-analysis/preferences` | Régler le profil de collectionneur qui pilote le verdict et la négociation | **Six des dix préférences ne sont lues par aucune ligne du moteur** — un écran ferait dix interrupteurs dont six inertes |
| `GET /wishlist/lookup` | Vérifier avant achat si une œuvre est possédée ou déjà en envies | Couvert autrement par le bloc « Déjà dans IozyCore », qui distingue désormais possédé et seulement catalogué |
| `GET /purchase-analysis/editions/search` | Lister toutes les éditions d'une série | Couvert par l'écran Éditions de référence |
| `GET /entities?entityTypeId=` | Lister les œuvres d'un type | Remplacé par `/entities/search` |

---

## 18. Carte globale des parcours

```text
IozyCore
│
├── Ma collection  (/)                                     [mobile : OK]
│   ├── 01 Consulter · 02 Filtrer · 03 Ouvrir un rayon
│   ├── 04 Retrouver les jaquettes · 05 Valeur · 06 Import BGG
│   └── 07 Ouvrir une oeuvre
│       └── Fiche (/entity/:id)
│           ├── 08 Progression · 09 Changer d'édition
│           ├── 10 Édition de référence
│           ├── 12 Parcourir les tomes · 13 Ajouter un tome · 14 Ajouter à la main
│           ├── 15 Prix/note · 17 Vendu/perdu · 18 Supprimer un exemplaire
│           ├── 19 Jaquette · 20 Numéro de tome
│           ├── 21 Classer · 22 Assistant · 23-24 Informations · 25 Tags/expériences/relations
│           └── 26 Supprimer la fiche
│
├── Rechercher  (/add)                                     [mobile : OK]
│   ├── 27 Recherche titre · 28 Déjà possédé · 29 Code-barres
│   ├── 30 Ajouter depuis un résultat · 31 Ajouter à la main
│   ├── Scan (/scan)                  → 32 caméra · 33 saisie · 34 menu contextuel
│   └── Analyse (/purchase-analysis)  → 35 analyser · 36 édition inconnue · 37 IA
│                                       38 relever un prix · 39 offre · 40 wishlist
│                                       41 historique
│
├── Découvrir  (/discover)                                 [mobile : OK]
│   ├── 42 Hub d'aperçus · 43 Opportunités · 44 Prochaines sorties (vide assumé)
│   └── Tier Lists (/tier-lists) → 45 écran · 46 créer · 47 classer
│                                  48 classement rapide · 49 gérer · 50 partager
│
├── Envies  (/wishlist)                                    [mobile : OK]
│   └── 51 Consulter/retirer · 52 Ajouter (1 seul point d'entrée) · 53 Partager
│
├── Profil  (/profile)                                     [mobile : OK]
│   ├── 54 Profil · 55 Partager la collection · 56 Bilan annuel
│   └── Paramètres (/settings)                             [mobile : OK]
│       ├── 57 Thème et langues
│       └── Administration (/administration)               [mobile : OK]
│           └── 58 Types (aussi via Ma collection) · 59 Éditions · 60 Export
│
└── Pages publiques (hors AppShell)   → 61 collection partagée · 62 envies partagées
```

---

## 19. Tableau récapitulatif

| # | Parcours | Point d'entrée | Statut | Desktop | Mobile |
|---|---|---|---|---|---|
| 01 | Consulter sa collection | Ma collection | COMPLET | oui | oui |
| 02 | Filtrer sa collection par complétude | Ma collection | COMPLET | Popover | Sheet |
| 03 | Ouvrir le rayon d'un type | Ma collection | COMPLET | oui | oui |
| 04 | Retrouver les jaquettes manquantes | Ma collection | COMPLET | oui | oui |
| 05 | Ouvrir la valeur de la collection | Ma collection | COMPLET | oui | oui |
| 06 | Importer une collection BoardGameGeek | Ma collection | COMPLET | oui | oui |
| 07 | Ouvrir une œuvre | Ma collection | COMPLET | oui | oui |
| 08 | Consulter la progression d'une édition | Fiche d'une œuvre | COMPLET | oui | oui |
| 09 | Changer d'édition affichée | Fiche d'une œuvre | COMPLET | oui | oui |
| 10 | Renseigner ou corriger l'édition de référence | Fiche d'une œuvre | COMPLET | oui | oui |
| 11 | ~~Signaler une envie d'amélioration d'édition~~ | — | **RETIRÉ** | — | — |
| 12 | Parcourir les tomes d'une édition | Fiche d'une œuvre | COMPLET | oui | oui |
| 13 | Ajouter un tome manquant | Fiche d'une œuvre | COMPLET | Drawer | Sheet |
| 14 | Ajouter un tome à la main | Fiche d'une œuvre | COMPLET | oui | oui |
| 15 | Gérer un exemplaire possédé (prix, note) | Fiche d'une œuvre | COMPLET | oui | oui |
| 16 | ~~Prêter un exemplaire~~ | — | **RETIRÉ** | — | — |
| 17 | Marquer un exemplaire vendu ou perdu | Fiche d'une œuvre | COMPLET | oui | oui |
| 18 | Supprimer définitivement un exemplaire | Fiche d'une œuvre | COMPLET | oui | oui |
| 19 | Corriger la jaquette d'un tome | Fiche d'une œuvre | COMPLET | oui | oui |
| 20 | Corriger le numéro d'un tome | Fiche d'une œuvre | COMPLET | oui | oui |
| 21 | Classer une œuvre au classement général | Fiche d'une œuvre | COMPLET | oui | oui |
| 22 | Interroger l'assistant de la fiche | Fiche d'une œuvre | COMPLET | oui | oui |
| 23 | Modifier les informations de l'œuvre | Fiche d'une œuvre | COMPLET | oui | oui |
| 24 | Renommer la série / changer sa couverture | Fiche d'une œuvre | COMPLET | oui | oui |
| 25 | Tags, expériences et relations | Fiche d'une œuvre | COMPLET | oui | oui |
| 26 | Supprimer la fiche d'une œuvre | Fiche d'une œuvre | COMPLET | oui | oui |
| 27 | Rechercher une œuvre par titre | Rechercher | COMPLET | oui | oui |
| 28 | Constater qu'un titre est déjà possédé | Rechercher | COMPLET | oui | oui |
| 29 | Rechercher par code-barres depuis Rechercher | Rechercher | COMPLET | oui | oui |
| 30 | Ajouter une œuvre depuis un résultat de recherche | Rechercher | COMPLET | oui | oui |
| 31 | Ajouter un titre à la main (type sans fournisseur) | Rechercher | COMPLET | oui | oui |
| 32 | Scanner un code-barres à la caméra | Scan | COMPLET | oui | oui |
| 33 | Saisir un code-barres à la main sur l'écran de scan | Scan | COMPLET | oui | oui |
| 34 | Décider quoi faire d'un tome scanné | Scan | COMPLET | Boîte centrée | Sheet |
| 35 | Analyser une annonce d'occasion | Analyse d'achat | COMPLET | oui | oui |
| 36 | Renseigner une édition inconnue pendant l'analyse | Analyse d'achat | COMPLET | oui | oui |
| 37 | Pré-remplir une fiche d'édition avec l'IA | Analyse d'achat | COMPLET | oui | oui |
| 38 | Relever un prix comme observation de marché | Analyse d'achat | COMPLET | oui | oui |
| 39 | Préparer une offre à envoyer | Analyse d'achat | COMPLET | oui | oui |
| 40 | Ajouter les séries d'un lot à la wishlist | Analyse d'achat | COMPLET | oui | oui |
| 41 | Consulter et rouvrir une analyse passée | Analyse d'achat | COMPLET | oui | oui |
| 42 | Parcourir Découvrir | Découvrir | COMPLET | 3 colonnes | Onglets |
| 43 | Ouvrir les opportunités | Découvrir | COMPLET | oui | oui |
| 44 | Consulter les prochaines sorties | Découvrir | PARTIEL | oui | oui |
| 45 | Ouvrir l'écran Tier Lists | Tier Lists | COMPLET | oui | oui |
| 46 | Créer une Tier List personnalisée | Tier Lists | COMPLET | oui | oui |
| 47 | Classer une œuvre depuis un board | Tier Lists | COMPLET | Clic + glisser-déposer | Clic seul |
| 48 | Classer rapidement une file d'œuvres | Tier Lists | COMPLET | oui | oui |
| 49 | Gérer une Tier List personnalisée | Tier Lists | COMPLET | oui | oui |
| 50 | Partager ses Tier Lists | Tier Lists | PARTIEL | oui | oui |
| 51 | Consulter et gérer ses envies | Envies | COMPLET | oui | oui |
| 52 | Ajouter une œuvre à ses envies | Envies | COMPLET | oui | oui |
| 53 | Partager sa liste d'envies | Envies | COMPLET | oui | oui |
| 54 | Consulter son profil | Profil | COMPLET | oui | oui |
| 55 | Partager sa collection | Profil | COMPLET | oui | oui |
| 56 | Générer le bilan annuel | Profil | COMPLET | oui | oui |
| 57 | Changer l'apparence et l'ordre des titres | Paramètres / Administration | COMPLET | oui | oui |
| 58 | Gérer les types de collection | Paramètres / Administration | COMPLET | oui | oui |
| 59 | Consulter et nettoyer les éditions de référence | Paramètres / Administration | COMPLET | oui | oui |
| 60 | Exporter sa collection | Paramètres ▸ Mon compte | COMPLET | oui | oui |
| 61 | Consulter une collection partagée | Lien public | COMPLET | oui | oui |
| 62 | Consulter une liste d'envies partagée | Lien public | COMPLET | oui | oui |
| 63 | Créer le premier compte | Porte (hors AppShell) | COMPLET | oui | oui |
| 64 | Se connecter | Porte (hors AppShell) | COMPLET | oui | oui |
| 65 | Se déconnecter | Profil ▸ Compte | COMPLET | oui | oui |

---

## 20. Statistiques

```text
Nombre total de parcours identifiés : 64   (65 lignes, dont 1 retirée du produit)
Parcours COMPLETS                   : 62
Parcours PARTIELS                   :  2   (44 Prochaines sorties, 50 Partage des Tier Lists)
Parcours CASSÉS                     :  0
Parcours MOCK / DÉMO                :  0

Parcours principaux                 : 26   (atteints en 2 gestes au plus depuis une des
                                            3 destinations ou de l'avatar)
Parcours secondaires                : 38

Parcours sans aucun accès en mobile :  0   (10 avant le 2026-08-21, voir §12.1)
```

> Évolution depuis la première version de cet audit : la gestion des prêts a été
> retirée du produit (elle n'était de toute façon liée depuis aucun écran), les
> dix parcours inaccessibles en mobile ont été rétablis, et « Ajouter à ses
> envies » est passé de PARTIEL à COMPLET avec quatre points d'entrée.

---

## 21. Les dix parcours structurants

Ceux qui portent l'usage réel, pas les plus complexes techniquement.

1. **Consulter sa collection** et voir d'un coup d'œil où en est chaque série.
2. **Ouvrir une œuvre et lire sa progression** « X/Y tomes ».
3. **Ajouter un tome manquant** depuis la grille des tomes.
4. **Ajouter une œuvre entière** depuis Rechercher, en choisissant ses tomes.
5. **Scanner un tome** et décider quoi en faire.
6. **Évaluer une annonce d'occasion** avant d'acheter.
7. **Voir les séries presque complètes** et ce qu'il en coûterait de les finir.
8. **Renseigner l'édition de référence** — c'est elle qui rend tous les « X/Y » possibles.
9. **Classer ses œuvres** (classement général et Tier Lists).
10. **Partager sa collection** par un lien révocable.

---

## 22. Incohérences entre parcours

> **État au 2026-08-29 : plus aucune incohérence ouverte.** Onze constats :
> **sept** résolus par du code, **trois devenus caducs** (UX-3, UX-9, UX-10 -
> leur prémisse a disparu avec des lots ultérieurs, et chacun a été VÉRIFIÉ
> plutôt que supposé : deux dans le code, un dans la base réelle), et UX-5,
> délibéré et documenté comme tel. Un constat qui cesse d'être vrai doit le
> dire : cette liste sert à décider, pas à impressionner.

**UX-1 — ~~Deux navigations aux périmètres différents~~ — RÉSOLU (2026-08-21).** Le header desktop portait cinq accès, la barre du pouce trois : dix parcours disparaissaient en mobile. `MobileHeader` porte désormais les mêmes cœur et avatar, via un composant partagé (`GlobalShortcuts`), sans toucher aux trois destinations de la barre du pouce.

**UX-2 — ~~Une wishlist qu'on ne peut presque pas remplir~~ — RÉSOLU (2026-08-21).** `addToWishlist` n'avait qu'un seul appelant. Cinq points d'entrée désormais (fiche, résultat de recherche local, suggestion externe, menu du scan, résultat d'analyse), tous branchés sur le même `useWishlist`. La limite métier qui subsistait — une œuvre absente de la collection ne pouvait pas être mise en envies, faute de pouvoir exister au catalogue sans possession — a été levée le 2026-08-21 : voir le parcours 52.

**UX-3 — ~~Le Scan demande, l'ajout par recherche ne demande pas~~ — CADUC (constaté le 2026-08-29).** L'écran de brouillon dont parlait ce constat n'existe plus : les deux chemins mènent désormais au MÊME aperçu (`/apercu`), avec le même bouton « Ajouter à ma collection », et rien n'est écrit avant ce clic. Ce qui reste au scan — un menu qui demande quoi faire — n'est plus une incohérence mais une conséquence : le scan DEVINE le numéro de tome à partir du titre, la recherche non. Le menu existe pour ce doute-là, et propose justement « l'ajout détaillé » qui rejoint l'aperçu commun.

**UX-4 — ~~« Ajouter à ma wishlist » agit en masse et en silence~~ — RÉSOLU (2026-08-21).** L'ajout groupé passe par `addMany` : un seul message annonçant le nombre de séries ajoutées, avec Annuler, et rien n'est ajouté deux fois.

**UX-5 — Deux chemins vers les catégories de collection.** Ma collection ▸ Plus d'outils, et le bouton Administration de l'en-tête. C'est délibéré et documenté, mais c'est le seul écran de l'app dans ce cas.

**UX-6 — ~~Trois libellés pour la même idée de valeur~~ — RÉSOLU (2026-08-29).** Un seul nom, « **Valeur de la collection** » : c'est celui de la section, celui que le hero du Profil affiche désormais (il disait « Valeur estimée »), et celui que le bouton de Ma collection abrège. Et les deux contrôles qui le nomment **emmènent à la section**, au lieu de déposer en haut d'un écran intitulé « Statistiques » où il fallait ensuite la chercher — même patron que Ma collection ▸ Partager, qui déroule jusqu'au partage. Ce que « estimée » disait — une valeur partielle — est déjà porté par la pastille de couverture juste sous le montant.

**UX-7 — ~~« Envies » et « Wishlist » cohabitent~~ — RÉSOLU (2026-08-21).** Tout ce qui est visible à l'écran dit désormais « Envies » : le titre de l'écran, la carte des statistiques, le bouton du résultat d'analyse et son infobulle. Le mot « wishlist » ne subsiste que dans des identifiants techniques (routes, clés de cache, noms de types), jamais sous les yeux de l'utilisateur. « Envies d'amélioration » désigne toujours autre chose (les éditions) - c'est un troisième objet, pas une variante de nom.

**UX-8 — ~~Retours arrière hétérogènes~~ puis ~~absents~~ — RÉSOLU (2026-08-29, complété le même jour).** Dix écrans n'avaient **aucun** retour : Paramètres, Administration ▸ Comptes, Éditions de référence, Catégories de collection (et son formulaire), Import BGG, Statistiques, Suggestions d'achats, Bilan annuel, Historique des analyses. Tous s'ouvrent depuis un endroit précis et depuis nulle part ailleurs, et la seule sortie était le bouton Précédent du navigateur — **qui n'existe pas dans une app installée** (`display: standalone`). Le composant `LienRetour` les porte désormais tous, avec le parent naturel par défaut et l'origine nommée quand elle est passée. Il apporte aussi les 44 px de cible tactile que les copies manuelles n'avaient pas. Le mécanisme que la fiche employait déjà — l'origine voyage dans `location.state`, le lien NOMME sa destination, et disparaît s'il ne la connaît pas — est devenu celui de toute l'application (`lib/retour`). Un board ouvert depuis Découvrir revient à Découvrir, depuis le Profil au Profil, depuis Tier Lists à Tier Lists ; vérifié en direct sur les trois chemins. Le défaut, quand personne n'a nommé d'origine (lien reçu, rechargement), reste le parent naturel de l'écran. Toujours pas de `navigate(-1)` : un « Retour » sans destination ment une fois sur deux, et le bouton Précédent du navigateur continue de faire son travail à côté.

**UX-9 — ~~Le panneau d'un tome mélange deux intentions~~ — CADUC (constaté le 2026-08-29).** Les deux moitiés du constat ont disparu séparément. Le formulaire d'ajout a quitté le panneau (« Je l'ai » est un clic, rien à remplir), et le panneau ne s'ouvre plus du tout sur un tome manquant. Quant au « passé » d'un tome non possédé, il ne peut plus exister : retirer un tome SUPPRIME la possession depuis le Lot 55 — ni « vendu » ni « perdu » ne subsistent, donc rien n'en garde trace, et la section « Exemplaires passés » n'existe plus dans le code.

**UX-10 — ~~Les analyses anciennes parlent anglais~~ — CADUC (mesuré le 2026-08-29).** Vérifié dans la base réelle plutôt que déduit : les neuf analyses enregistrées portent en tout **un seul** message d'avertissement distinct, et il est en français (« Aucun prix relevé ni prix neuf connu pour ce lot… »). Tout le reste de ce qui s'affiche est un enum, traduit à l'affichage — donc jamais figé dans une langue. Les analyses antérieures à la francisation du moteur (Lot 30) ne sont plus en base. Le principe reste : un instantané ne se réécrit pas ; s'il en réapparaît un jour, c'est un fait daté, pas un défaut.

**UX-11 — ~~La suppression reste asymétrique~~ — RÉSOLU (2026-08-21).** Marquer vendu ou perdu est devenu réversible (« Annuler », `POST /ownerships/{id}/restore`). Les quatre écritures qui restaient sans reprise le sont désormais toutes, chacune selon ce que la donnée est : **expérience** (modifier note/commentaire, supprimer avec Annuler), **relation** (modifier le type, supprimer), **analyse d'achat** (supprimer avec confirmation — un résultat figé ne se corrige pas), **prix relevé** (supprimer avec Annuler — un fait daté ne se réécrit pas). Un tag se détache de l'œuvre où il s'affiche.

---

## 23. Classement des fonctionnalités historiques

Établi le 2026-08-21 en croisant le code, la navigation réelle, les maquettes
V1.2 et l'usage constaté sur les données. **Aucune suppression arbitraire** :
seule une fonctionnalité clairement remplacée ou abandonnée perd son accès.

| Fonctionnalité | Classement | Justification |
|---|---|---|
| **Éditions de référence** (`/editions`) | `ACTIVE` | Porte le nombre de tomes de chaque édition — **toute** progression « X/Y » de l'app en dépend, sur tous les écrans. Reste un écran de maintenance sous Administration, pas une destination : renseigner se fait depuis la fiche, là où le manque se constate. |
| **Bilan annuel** (`/recap`) | `SECONDARY` | Fonctionne sur données réelles, produit un PNG téléchargeable. Usage saisonnier. Déplacé sous **Découvrir** (Lot 108) : c'est une lecture de la collection, au même titre que les trois panneaux de cet écran. |
| **Export JSON / CSV** | `SECONDARY` | Sert la promesse d'« absence d'enfermement ». Étendu aux éditions, classements et Tier Lists (Lot 33), puis aux prix relevés, à l'édition suivie, aux types de collection et au profil de collectionneur (Lot 79) — 14 fichiers. Déplacé sous **Paramètres ▸ Mon compte** (Lot 108) : emporter ses données n'est pas de la configuration technique. |
| **Expériences** | `ACTIVE` | Consommées par l'assistant de la fiche (« Où en suis-je dans mes lectures »), les statistiques par type, la note moyenne et le bilan annuel. Modifiables (note, commentaire) et supprimables depuis la fiche depuis le 2026-08-21. |
| **Tags** | `SECONDARY` | Attachables et détachables depuis la fiche, remontés dans les statistiques (`topTags`). Le backend sait filtrer par tag (`GET /entities/search?tagId=`) mais **aucun écran ne l'expose** — sous-employés, pas abandonnés. Rien ne les a remplacés : les retirer serait arbitraire. |
| **Relations entre œuvres** | `SECONDARY` | Créées et affichées sur la fiche avec leur type et leur sens, exportées, corrigeables et supprimables depuis le 2026-08-21. Purement descriptives, aucun autre écran ne s'en sert. |
| **Prêts** | `LEGACY` → **retiré** | Hors périmètre produit. Ses surfaces d'interface ont été retirées le 2026-08-21, son backend le 2026-08-23 (`V19`). Voir le parcours 16. |
| **Envies d'amélioration d'édition** | `LEGACY` → **retiré** | Hors périmètre produit. Interface retirée le 2026-08-25, backend et table le 2026-08-27 (`V22`). Voir le parcours 11. |

**Rien d'autre n'a été retiré.** Les écrans jugés `SECONDARY` gardent leur accès
actuel sans devenir des destinations de navigation.

---

## 24. Où retrouver l'implémentation

```text
Navigation      web/src/App.tsx
                web/src/components/layout/{AppShell,DesktopHeader,TabBar}.tsx

Collection      web/src/routes/Shelf/{ShelfPage,CategoryPage,CategorySection,
                                      CollectionFilters,BarreVues,shelfTiles.ts,
                                      venues.ts,ownership.ts,backfillCovers.ts}

Fiche œuvre     web/src/routes/EntityDetail/*.tsx
                (EntityDetailPage, FicheHero, CartesEditions, GrilleTomes,
                 AddVolumeSection, AssistantSection, EntityInfoSection,
                 EditionCorrectionSection, rechargerSource.ts)

Recherche/Scan  web/src/routes/QuickAdd/{SearchPage,AddDraftPage,
                                         VolumeSelectionGrid,BarcodeLookupField}.tsx
                web/src/routes/Scan/{ScanPage,ScanActionMenu,CameraBarcodeScanner}.tsx

Analyse d'achat web/src/routes/PurchaseAnalysis/*.tsx
                backend .../purchaseanalysis/{PurchaseAnalysisEngine,VerdictScorer,
                                              NegotiationEngine,CompletenessCalculator,
                                              MarketPriceCalculator,DuplicateDetector}.java

Tier Lists      web/src/routes/TierLists/*.tsx
Profil/Admin    web/src/routes/Profile/*.tsx, routes/Settings/SettingsPage.tsx
                web/src/routes/{Editions,EntityTypes,Recap,
                                Suggestions,Stats,Discover}/*.tsx

Client API      web/src/api/*.ts          Clés de cache : web/src/lib/queryKeys.ts
Progression     backend .../insights/CollectionProgressService.java  (source unique)
                GET /insights/progress (toute la collection) et
                GET /insights/progress/{entityId} (une fiche) - aucun client
                ne recalcule (Lots 51 et 60)
Envies          web/src/lib/useWishlist.ts (source unique) + components/WishlistToggle.tsx
Tests           backend/src/test/java/**  (1057 tests)
                web/src/**/*.test.ts(x)   (292 tests, Vitest - voir web/README)
                web/e2e/*.spec.ts         (9 parcours, Playwright)
```

**À noter pour la suite** : le web a désormais un filet, amorcé le 2026-08-29 — **292 tests Vitest** sur trente-sept modules. Ils couvrent les règles qui décident de ce qui s'affiche (`shelfTiles`, `ownership`, `tomeTiles`, `venues`, `attributsTome`), ce que l'utilisateur lit quand ça rate (`api/client` : les erreurs traduites), ce que les boutons « Envies » promettent (`useWishlist`), les réglages qui survivent à un `localStorage` corrompu (`preferencesCollection`, `titleLanguage`), le quota du fournisseur de jaquettes (`backfillCovers`), le garde-fou de l'IA (`basePrix`), les invalidations de cache, et le clavier — Échap, le piège à Tab et le focus rendu au déclencheur (`useModalA11y`), le titre d'onglet qui annonce une navigation à un lecteur d'écran (`useDocumentTitle`), le surlignage de la barre de navigation (`navItems`) et l'identité visuelle d'un univers (`entityTypeVisuals`) ; enfin le seul module qui peut écraser des données de l'utilisateur (`rechargerSource`) et les « jamais deviné » du catalogue (`seriesInfo`, `indicesOeuvre`, `theme`). Et depuis le 2026-08-29, **des parcours de bout en bout** (Playwright, **14**) : la porte (créer le premier compte, se connecter, un mot de passe faux qui ne dit rien, se déconnecter pour de bon), créer un univers puis y ajouter une œuvre et la retrouver plutôt que la dupliquer, le lien de partage — généré, lu **sans aucune session**, puis repris —, la progression « X/Y tomes » d'une édition et le tome coché depuis la grille, une Tier List créée puis remplie puis classée, **renseigner l'édition de référence et voir « X/Y » apparaître**, **repérer une série presque complète depuis Découvrir**, et **évaluer une annonce dont deux tomes sont déjà possédés**. Ils tournent sur une **pile jetable** (base et API à eux, `backend/docker-compose.e2e.yml`) : jamais sur les vraies données. **Neuf des dix** parcours structurants de la §21 sont couverts ; ne manque que le **scan**, qui demande une caméra.
