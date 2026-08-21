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

- **Envies** — icône cœur du header desktop (avec badge de compte). **Aucun
  accès en mobile** : c'est le seul lien de toute l'application vers
  `/wishlist` (voir §12.1).
- **Profil** — avatar « IO » du header desktop. **Aucun accès en mobile** non
  plus, et avec lui disparaissent Paramètres, Administration, le bilan annuel,
  les prêts et les deux partages (voir §12.1).
- **Scan** — bouton dédié dans la barre du pouce (mobile) et lien « Scanner »
  en tête de Rechercher (les deux plateformes).
- **Paramètres** → depuis Profil. **Administration** → depuis Paramètres.
- **Types de collection** → deux chemins : Ma collection ▸ Plus d'outils, et
  Administration.

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
**Étapes** : choisir une puce d'édition.
**Résultat** : progression, grille de tomes et avertissements suivent l'édition.
**Écrans** : `EditionProgressSection`, `TomesGridSection`, `editionGroups.ts`
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

### 11. Signaler une envie d'amélioration d'édition
**Point de départ** : fiche ▸ « Je cherche une meilleure édition »
**Préconditions** : l'édition active porte un nom.
**Étapes** : édition recherchée (facultative), note (facultative) → Enregistrer.
**Résultat** : l'envie apparaît sur la fiche et dans Profil ▸ Envies
d'amélioration. Réversible par « Annuler ».
**Écrans** : `EditionUpgradeWishToggle`, `EditionUpgradesPage`
**Backend** : `POST` / `DELETE /edition-upgrade-wishes`
**Statut** : `COMPLET`

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
**Écrans** : `VolumeInteractionPanel`, `AddOwnershipForm`, `OwnershipDetails`
**Backend** : `POST /entities/quick-add`
**Statut** : `COMPLET` — **Desktop** drawer droit (non modal) / **Mobile**
bottom-sheet (modal, overlay cliquable).

### 14. Ajouter un tome à la main
**Point de départ** : fiche ▸ « + Ajouter un tome »
**Étapes** : numéro(s) de tome, édition, état, prix → Ajouter.
**Résultat** : un ou plusieurs tomes ajoutés d'un coup ; message distinguant les
tomes réellement ajoutés de ceux déjà possédés.
**Écrans** : `AddVolumeSection`
**Statut** : `COMPLET`

### 15. Gérer un exemplaire possédé (prix, note)
**Point de départ** : panneau d'un tome possédé ▸ menu « … »
**Étapes** : « Modifier le prix payé » ou « Ajouter/Modifier ma note » → OK.
**Résultat** : valeur enregistrée, affichée sur la ligne de l'exemplaire ; le
prix alimente la valeur de collection. Vider le champ efface la donnée.
**Écrans** : `OwnershipDetails`
**Backend** : `PATCH /ownerships/{id}/purchase-price`, `/note`
**Statut** : `COMPLET`

### 16. Prêter un exemplaire et le récupérer
**Étapes** : menu « … » ▸ Prêter → nom de l'emprunteur → OK. Plus tard :
« Marquer rendu », depuis la fiche ou depuis Profil ▸ Prêts en cours.
**Résultat** : « Prêté à X depuis le … » sur l'exemplaire ; le prêt apparaît
dans la liste des prêts en cours.
**Écrans** : `OwnershipDetails`, `LoansPage`
**Backend** : `POST /loans`, `POST /loans/{id}/return`, `GET /loans/active`
**Statut** : `COMPLET`

### 17. Marquer un exemplaire vendu ou perdu
**Étapes** : menu « … » ▸ « Marquer vendu » ou « Marquer perdu ».
**Résultat** : l'exemplaire quitte le décompte des possessions ; le tome
redevient « Manquant » ; l'exemplaire reste visible sous « Exemplaires passés »
avec sa pastille **Vendu** ou **Perdu**.
**Branches** : **aucun retour arrière** — aucun endpoint ne redonne le statut
`OWNED` (voir §Undo).
**Écrans** : `OwnershipDetails`, `VolumeInteractionPanel`
**Backend** : `POST /ownerships/{id}/sell`, `/lose`
**Statut** : `COMPLET`

### 18. Supprimer définitivement un exemplaire
**Étapes** : menu « … » ▸ « Supprimer cet exemplaire » → confirmation explicite.
**Branches** : refusé en 409 lisible si un prêt le référence encore, même rendu.
**Statut** : `COMPLET`

### 19. Corriger la jaquette d'un tome
**Point de départ** : panneau d'un tome ▸ « Ajouter une couverture »
**Étapes** : saisir une URL, **ou** « Rechercher automatiquement sur Google
Books » (recherche ciblée sur ce seul tome, `forceRefresh`).
**Branches** : rien trouvé → « Aucune jaquette trouvée » — un constat honnête,
pas une erreur.
**Statut** : `COMPLET`

### 20. Corriger le numéro d'un tome
**Étapes** : panneau d'un tome ▸ « Corriger le numéro de tome » → nouveau numéro.
**Résultat** : numéro **et** libellé mis à jour ensemble.
**Branches** : un autre tome de la même édition porte déjà ce numéro → 409
lisible.
**Écrans** : `VariantNumberEditor`
**Statut** : `COMPLET`

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
**Branches** : type d'expérience non autorisé pour ce type de collection → 400 ;
relation vers une œuvre inexistante → 400.
**Écrans** : `MoreOptionsSection`, `TagsSection`, `ExperiencesSection`,
`RelationshipsSection`
**Statut** : `COMPLET` — **mais** ni une expérience ni une relation ne peuvent
être supprimées (voir §Parcours interrompus).

### 26. Supprimer la fiche d'une œuvre
**Point de départ** : fiche ▸ Plus d'options ▸ « Supprimer cette fiche »
**Branches** : bloqué en 409 lisible tant qu'il reste une possession, une
expérience ou une édition de référence. Une œuvre ayant connu une lecture ou un
prêt devient **définitivement indélébile**.
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
saisie.
**Écrans** : `SearchPage`
**Backend** : `GET /metadata/search`
**Statut** : `COMPLET`

### 28. Constater qu'un titre est déjà possédé
**Résultat** : un bloc « Déjà dans ta collection » s'affiche **au-dessus** des
suggestions, avec la pastille « Possédé » et un accès direct à la fiche.
**Pourquoi ça compte** : la recherche externe exclut délibérément les titres
déjà possédés — sans ce bloc, chercher « Death Note » ne renverrait que des
spin-offs sans explication.
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
jaquette, tome détecté ou non, édition devinée, mention « Déjà dans ta
collection » — puis propose : **Ajouter à ma collection** (avec l'état choisi en
haut d'écran), **Choisir l'édition et les tomes** (bascule vers l'ajout
détaillé), **Ouvrir la fiche** (seulement si l'œuvre existe), **Passer ce tome**.
**Rien n'est écrit tant que rien n'est choisi.**
**Branches** : code non reconnu → « Rien trouvé pour X » + « Chercher par
titre » ; échec réseau → « Échec de la recherche » + même issue ; un scan
pendant qu'un menu est ouvert est ignoré ; Échap = Passer.
**Écrans** : `ScanActionMenu`, `ScanPage`
**Statut** : `COMPLET` — **Desktop** boîte centrée / **Mobile** bottom-sheet.

---

## 6. Parcours — Analyse d'achat

### 35. Analyser une annonce d'occasion
**Point de départ** : Rechercher ▸ Évaluer une annonce, Profil ▸ Évaluer un
achat, ou fiche ▸ « Évaluer une annonce de cette série » (série pré-remplie).
**Étapes** : plateforme, prix demandé, frais de port, frais de protection, état
(et « l'état porte sur un coffret »), URL/titre facultatifs ; puis une ou
plusieurs séries avec leur édition et leurs tomes (« 1-11 ») ; « Ajouter cette
série au lot » pour un lot multi-séries ; **ANALYSER LE LOT**.
**Résultat** : verdict et score, coût réel, valeur neuve, décote, offre
conseillée / fourchette / prix maximum, détail par série (complétude, doublons,
base de prix, avertissements).
**Branches** : aucune donnée de prix → « Non calculable » plutôt qu'un chiffre
inventé ; prix très au-dessus → conseil de passer son tour ; lot sans série →
400 lisible.
**Écrans** : `PurchaseAnalysisPage`, `PurchaseAnalysisResultCard`,
`SeriesBreakdownItem`, `VerdictBadge`
**Backend** : `POST /purchase-analysis/analyze`
**Statut** : `COMPLET` — arithmétique re-dérivée indépendamment et vérifiée
juste (Lot 36).

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
**Branches** : **aucune suppression possible** — aucun endpoint ne retire une
observation.
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
**Branches** : les analyses **antérieures au 2026-08-21** portent des textes en
anglais figés — ce sont des instantanés stockés, pas des calculs rejoués.
**Écrans** : `AnalysisHistoryPage`, `AnalysisHistoryDetailPage`
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
**Branches** : « Retirer le classement » (l'œuvre reste dans la liste, non
classée) ; touches S-F au clavier ; Échap ferme sans changement.
**Écrans** : `TierBoard`, `TierPicker`
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
uniquement à travers le lien de partage de la collection, via un interrupteur
dédié (voir 53).
**Statut** : `PARTIEL` — la capacité existe, mais pas là où on la chercherait.

---

## 9. Parcours — Envies

### 51. Consulter et gérer ses envies
**Point de départ** : header desktop ▸ cœur (badge de compte) ; mobile : Profil.
**Étapes** : consulter la liste ; ouvrir la fiche d'une envie ; retirer une
envie.
**Écrans** : `WishlistPage`
**Backend** : `GET /wishlist`, `DELETE /wishlist/{id}`
**Statut** : `COMPLET`

### 52. Ajouter à ses envies
**Réalité** : **un seul point d'entrée** — le bouton « Ajouter à ma wishlist »
du résultat d'analyse d'achat (parcours 40). Il n'existe **aucun bouton
« ajouter aux envies » depuis la fiche d'une œuvre, depuis la recherche, depuis
le scan ni depuis les opportunités**.
**Statut** : `PARTIEL` — la wishlist est consultable et vidable, mais quasiment
impossible à remplir (voir §UX-2).

### 53. Partager sa liste d'envies
**Étapes** : Envies ▸ Générer un lien → copier → (régénérer) → supprimer.
**Résultat** : URL publique `/public/wishlist/:token`, révocable, montrant
**titre et jaquette seulement**.
**Écrans** : `WishlistShareSection`, `SharedWishlistPage`
**Statut** : `COMPLET`

---

## 10. Parcours — Profil, Paramètres, Administration

### 54. Consulter son profil
**Résultat** : valeur estimée (ou « Pas encore de prix renseigné »), nombre de
titres et de tomes possédés, aperçu des Tier Lists, partage de collection, et
les entrées Évaluer un achat / Envies d'amélioration / Bilan annuel /
Paramètres.
**Écrans** : `ProfilePage`, `ProfileValueHero`, `ProfileTierListsSection`
**Statut** : `COMPLET`

### 55. Partager sa collection
**Étapes** : Générer un lien → copier → **interrupteur « inclure mes Tier
Lists »** → supprimer le lien.
**Résultat** : `/public/collection/:token` — titres, jaquettes, éditions
possédées et progression ; **jamais de prix, de valeur ni d'identifiant**.
**Écrans** : `CollectionShareSection`, `SharedCollectionPage`
**Statut** : `COMPLET`

### 56. Générer le bilan annuel
**Étapes** : Profil ▸ Bilan annuel → choisir l'année → « Télécharger l'image ».
**Résultat** : carte rendue en `<canvas>` puis téléchargée en PNG — acquisitions
et répartition par type, séries commencées, expériences et note moyenne,
auteur le plus présent.
**Écrans** : `CollectionRecapPage`
**Statut** : `COMPLET` — export statique, **aucun lien public**.

### 57. Consulter ses prêts en cours
**Point de départ** : Profil ▸ Prêts en cours
**Étapes** : voir les prêts actifs, ouvrir la fiche, « Marquer rendu ».
**Branches** : aucun prêt → écran vide (aucun contrôle).
**Statut** : `COMPLET`

### 58. Changer l'apparence et l'ordre des titres
**Étapes** : Paramètres ▸ interrupteur **Thème sombre** ; cocher/ordonner
(glisser-déposer) les langues de titre (français, romaji, anglais).
**Résultat** : thème appliqué immédiatement et persisté ; l'ordre des langues
décide du titre affiché partout.
**Écrans** : `SettingsPage`, `titleLanguage.ts`
**Statut** : `COMPLET`

### 59. Gérer les types de collection
**Point de départ** : Ma collection ▸ Plus d'outils, **ou** Administration
**Étapes** : créer un type (code, libellé, couleur, icône, format de jaquette,
champs personnalisés, types d'expérience), le modifier, le supprimer.
**Branches** : suppression refusée en 409 tant qu'une œuvre l'utilise ; un type
créé à la main n'a **aucune source externe** (ni recherche, ni scan) — annoncé
à l'écran.
**Écrans** : `EntityTypesPage`, `EntityTypeFormPage`
**Statut** : `COMPLET`

### 60. Consulter et nettoyer les éditions de référence
**Point de départ** : Administration ▸ Éditions de référence
**Étapes** : parcourir par série, ouvrir la série, supprimer une édition.
**Branches** : suppression refusée en 409 lisible si des tomes ou des prix
relevés s'y réfèrent encore. **Écran de lecture et de suppression seulement** —
renseigner se fait depuis la fiche.
**Écrans** : `EditionsPage`
**Statut** : `COMPLET`

### 61. Exporter sa collection
**Étapes** : Administration ▸ Télécharger en JSON ou en CSV (.zip).
**Résultat** : œuvres, tomes, possessions, expériences, envies, relations, tags,
**éditions de référence, classements, Tier Lists et envies d'amélioration** —
11 fichiers dans le ZIP.
**Hors périmètre, volontairement** : historique d'analyses, préférences de
collectionneur, jetons de partage.
**Écrans** : `AdministrationPage`
**Statut** : `COMPLET`

---

## 11. Parcours — Pages publiques (visiteur sans compte)

### 62. Consulter une collection partagée
**Résultat** : univers, œuvres, éditions possédées, progression X/Y, et les Tier
Lists **si et seulement si** le propriétaire a activé l'interrupteur.
**Branches** : jeton inconnu, malformé, révoqué ou d'une autre fonctionnalité →
**404 identique dans tous les cas**, sans jamais laisser deviner qu'un lien a
existé.
**Statut** : `COMPLET`

### 63. Consulter une liste d'envies partagée
**Résultat** : titre et jaquette seulement. Mêmes garanties de jeton.
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
| **Accès à Profil** | Avatar « IO » du header | **Aucun** |
| **Accès à Envies** | Cœur du header, avec badge | **Aucun** |

### 12.1. Une zone entière inaccessible en mobile — vérifié à 375 px

`/profile` et `/wishlist` ne sont liés **que** depuis `DesktopHeader`, masqué en dessous de 768 px (`hidden md:block`). La barre du pouce ne compte que trois destinations plus le raccourci Scan. Il n'existe aucun autre lien vers ces deux routes dans tout `web/src` (vérifié par recherche exhaustive, puis à l'écran sur cinq routes à 375 px).

**Conséquence** : sur téléphone, tout ce qui suit n'a **aucun chemin d'accès**, alors que les écrans existent et fonctionnent :

`/profile` · `/wishlist` · `/settings` · `/administration` · `/editions` · `/recap` · `/loans` · `/edition-upgrades` · partage de la collection · partage de la liste d'envies · thème et langues de titre · export.

Restent atteignables en mobile : Ma collection et tous les parcours de la fiche, Rechercher, Scan, Analyse d'achat et son historique, Découvrir, Tier Lists, Opportunités, `/stats` (via « Valeur »), `/types` et `/import-bgg` (via la barre d'outils de Ma collection).

C'est l'écart le plus structurant relevé par cet audit, sur une application dont la barre basse est explicitement pensée « pour le pouce ».

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

**Annuler un formulaire** (aucune écriture n'a eu lieu) : correction d'édition, envie d'amélioration, prix payé, note, prêt, renommage de Tier List, suppression d'un exemplaire, suppression d'une Tier List, suppression d'une œuvre, menu du scan (« Passer » ou Échap).

**Défaire une action déjà écrite** :

| Action | Réversible ? |
|---|---|
| Ajouter un tome | Oui — supprimer l'exemplaire |
| Classer une œuvre | Oui — « Retirer le classement » |
| Ajouter à une Tier List | Oui — « Retirer de cette Tier List » |
| Ajouter aux envies | Oui — retirer depuis Envies |
| Envie d'amélioration | Oui — « Annuler » / « Retirer » |
| Prêt | Oui — « Marquer rendu » |
| Lien de partage | Oui — supprimer le lien |
| **Marquer vendu / perdu** | **Non** — aucun endpoint ne restaure `OWNED` |
| **Expérience enregistrée** | **Non** — aucun endpoint de suppression |
| **Relation créée** | **Non** — aucun endpoint de suppression |
| **Analyse d'achat** | **Non** — l'historique ne se supprime pas |
| **Prix relevé (observation)** | **Non** — aucun endpoint de suppression |
| **Tag créé** | **Non** — détachable d'une œuvre, jamais supprimable |

Aucune action n'offre d'annulation *différée* : pas de « Annuler » après coup, pas de corbeille.

---

## 15. Parcours morts / faux-finis

Cet audit n'a trouvé **aucun bouton décoratif** : pas de « À venir », pas de `toast` explicatif à la place d'une action, pas de donnée codée en dur présentée comme réelle, pas de route morte.

Les seuls écrans sans action sont des **vides honnêtes** :

| Écran | Comportement actuel | Nature |
|---|---|---|
| Découvrir ▸ Prochaines sorties | Explique qu'aucune source ne fournit de date fiable par tome | Vide assumé et motivé — pas un faux-fini |
| Profil ▸ Prêts en cours | Vide tant qu'aucun prêt n'existe | État vide normal |
| Profil ▸ Envies d'amélioration | Vide tant qu'aucune envie n'existe | État vide normal |
| Envies | Presque toujours vide, faute de point d'entrée pour la remplir | **Conséquence de UX-2**, pas un état vide normal |

---

## 16. Capacités existantes mais difficiles à découvrir

1. **Relever un prix de marché** — n'apparaît que dans le détail d'une série d'un résultat d'analyse, et seulement si l'édition est reconnue *et* les tomes contigus. C'est pourtant le seul moyen d'alimenter la base de prix observés dont dépend la qualité de toutes les analyses suivantes.
2. **Exemplaires passés** — un tome vendu ou perdu n'est visible qu'en ouvrant le panneau du tome correspondant, qui affiche par ailleurs un formulaire d'ajout.
3. **Types de collection** — deux chemins ; le second est à trois niveaux de profondeur.
4. **Éditions de référence** — seul écran d'ensemble du référentiel qui produit tous les « X/Y » de l'app, rangé sous Administration.
5. **Bilan annuel** — sous Profil, sans aucun rappel saisonnier.
6. **Classement rapide** — n'apparaît que s'il existe au moins une œuvre non classée.
7. **Ordre des langues de titre** — décide du titre affiché partout, rangé dans Paramètres sans lien depuis les écrans concernés.
8. **Analyse d'achat depuis une fiche** — pré-remplit la série, mais l'entrée est en bas du bloc d'identité.

---

## 17. Capacités backend sans aucun parcours utilisateur

Vérifié en confrontant l'OpenAPI de l'application (`/v3/api-docs`) à l'intégralité de `web/src`.

| Endpoint | Ce qu'il permettrait | Pourquoi c'est notable |
|---|---|---|
| `GET` / `PATCH /purchase-analysis/preferences` | Régler le profil de collectionneur qui pilote le verdict et la négociation | **Six des dix préférences ne sont lues par aucune ligne du moteur** — un écran ferait dix interrupteurs dont six inertes |
| `GET /wishlist/lookup` | Vérifier avant achat si une œuvre est possédée ou déjà en envies | Couvert autrement par le bloc « Déjà dans ta collection » |
| `GET /purchase-analysis/editions/search` | Lister toutes les éditions d'une série | Couvert par l'écran Éditions de référence |
| `GET /entities?entityTypeId=` | Lister les œuvres d'un type | Remplacé par `/entities/search` |
| `GET /loans?ownershipId=` | Historique des prêts d'un exemplaire, rendus compris | Seuls les prêts **actifs** sont exposés ; l'historique n'est visible nulle part |

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
│           ├── 10 Édition de référence · 11 Envie d'amélioration
│           ├── 12 Parcourir les tomes · 13 Ajouter un tome · 14 Ajouter à la main
│           ├── 15 Prix/note · 16 Prêt · 17 Vendu/perdu · 18 Supprimer un exemplaire
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
├── Envies  (/wishlist)                                    [mobile : INACCESSIBLE]
│   └── 51 Consulter/retirer · 52 Ajouter (1 seul point d'entrée) · 53 Partager
│
├── Profil  (/profile)                                     [mobile : INACCESSIBLE]
│   ├── 54 Profil · 55 Partager la collection · 56 Bilan annuel · 57 Prêts
│   └── Paramètres (/settings)                             [mobile : INACCESSIBLE]
│       ├── 58 Thème et langues
│       └── Administration (/administration)               [mobile : INACCESSIBLE]
│           └── 59 Types (aussi via Ma collection) · 60 Éditions · 61 Export
│
└── Pages publiques (hors AppShell)   → 62 collection partagée · 63 envies partagées
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
| 11 | Signaler une envie d'amélioration d'édition | Fiche d'une œuvre | COMPLET | oui | oui |
| 12 | Parcourir les tomes d'une édition | Fiche d'une œuvre | COMPLET | oui | oui |
| 13 | Ajouter un tome manquant | Fiche d'une œuvre | COMPLET | Drawer | Sheet |
| 14 | Ajouter un tome à la main | Fiche d'une œuvre | COMPLET | oui | oui |
| 15 | Gérer un exemplaire possédé (prix, note) | Fiche d'une œuvre | COMPLET | oui | oui |
| 16 | Prêter un exemplaire et le récupérer | Fiche d'une œuvre | COMPLET | oui | oui |
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
| 50 | Partager ses Tier Lists | Tier Lists | PARTIEL | oui | **non** |
| 51 | Consulter et gérer ses envies | Envies | COMPLET | oui | **non** |
| 52 | Ajouter à ses envies | Envies | PARTIEL | oui | oui |
| 53 | Partager sa liste d'envies | Envies | COMPLET | oui | **non** |
| 54 | Consulter son profil | Profil | COMPLET | oui | **non** |
| 55 | Partager sa collection | Profil | COMPLET | oui | **non** |
| 56 | Générer le bilan annuel | Profil | COMPLET | oui | **non** |
| 57 | Consulter ses prêts en cours | Profil | COMPLET | oui | **non** |
| 58 | Changer l'apparence et l'ordre des titres | Paramètres / Administration | COMPLET | oui | **non** |
| 59 | Gérer les types de collection | Paramètres / Administration | COMPLET | oui | oui |
| 60 | Consulter et nettoyer les éditions de référence | Paramètres / Administration | COMPLET | oui | **non** |
| 61 | Exporter sa collection | Paramètres / Administration | COMPLET | oui | **non** |
| 62 | Consulter une collection partagée | Lien public | COMPLET | oui | oui |
| 63 | Consulter une liste d'envies partagée | Lien public | COMPLET | oui | oui |

---

## 20. Statistiques

```text
Nombre total de parcours identifiés : 63
Parcours COMPLETS                   : 60
Parcours PARTIELS                   :  3   (44 Prochaines sorties, 50 Partage des Tier Lists,
                                            52 Ajouter à ses envies)
Parcours CASSÉS                     :  0
Parcours MOCK / DÉMO                :  0

Parcours principaux                 : 23   (atteints en 2 gestes au plus depuis une des
                                            3 destinations de navigation)
Parcours secondaires                : 40   (dans un panneau, un menu « … », ou à 3 niveaux ou plus)

Parcours sans aucun accès en mobile : 10   (50, 51, 53, 54, 55, 56, 57, 58, 60, 61)
```

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

**UX-1 — Deux navigations aux périmètres différents.** Le header desktop porte cinq accès (3 destinations + Envies + Profil), la barre du pouce trois plus le Scan. Ce n'est pas une adaptation de taille mais **une amputation fonctionnelle** : dix parcours disparaissent en mobile (§12.1).

**UX-2 — Une wishlist qu'on ne peut presque pas remplir.** `addToWishlist` n'a qu'**un seul appelant** dans toute l'application : le bouton du résultat d'analyse d'achat. Aucun bouton « ajouter aux envies » sur la fiche d'une œuvre, dans les résultats de recherche, après un scan, ni dans les opportunités — alors que l'écran Envies, son badge dans le header et son lien de partage existent tous.

**UX-3 — Le Scan demande, l'ajout par recherche ne demande pas.** Un tome scanné ouvre un menu qui demande quoi en faire ; le même geste depuis Rechercher ▸ un résultat écrit directement à la validation du brouillon. Deux chemins d'identification, deux contrats implicites différents.

**UX-4 — « Ajouter à ma wishlist » agit en masse et en silence.** Le bouton ajoute **toutes** les séries connues du lot d'un coup, sans confirmation, sans message de retour et sans indiquer combien ont été ajoutées.

**UX-5 — Deux chemins vers les types de collection.** Ma collection ▸ Plus d'outils, et Profil ▸ Paramètres ▸ Administration. C'est délibéré et documenté, mais c'est le seul écran de l'app dans ce cas.

**UX-6 — Trois libellés pour la même idée de valeur.** « Valeur » (bouton de Ma collection) mène à `/stats`, intitulé « Statistiques », qui contient une section « Valeur de la collection » ; Profil affiche « Valeur estimée ».

**UX-7 — « Envies » et « Wishlist » cohabitent.** La navigation et Profil disent « Envies » ; le titre de l'écran dit « Wishlist » ; le bouton de l'analyse dit « Ajouter à ma wishlist » ; « Envies d'amélioration » désigne encore autre chose (les éditions).

**UX-8 — Retours arrière hétérogènes.** Les boards Tier Lists reviennent toujours vers `/tier-lists`, même ouverts depuis Découvrir ; le détail d'une analyse revient vers l'historique ; un rayon revient vers Ma collection. Aucun de ces retours n'utilise l'historique du navigateur, ce qui rend le bouton « précédent » parfois incohérent avec le bouton de l'écran.

**UX-9 — Le panneau d'un tome mélange deux intentions.** Pour un tome non possédé mais ayant un passé, il affiche d'abord le formulaire d'ajout, puis l'historique « Exemplaires passés » — deux temporalités dans une même surface.

**UX-10 — Les analyses anciennes parlent anglais.** L'historique mêle des analyses d'avant et d'après la francisation du moteur : ce sont des instantanés stockés, jamais recalculés. Cohérent techniquement, déroutant à la lecture.

**UX-11 — La suppression est asymétrique.** Un exemplaire, une œuvre, une édition, une Tier List, une envie et un prêt se défont. Une expérience, une relation, un tag, une analyse et un prix relevé, **jamais** — sans que l'écran ne le dise au moment de créer.

---

## 23. Où retrouver l'implémentation

```text
Navigation      web/src/App.tsx
                web/src/components/layout/{AppShell,DesktopHeader,TabBar}.tsx

Collection      web/src/routes/Shelf/{ShelfPage,CategoryPage,CategorySection,
                                      CollectionFilters,shelfTiles.ts,ownership.ts,
                                      backfillCovers.ts}
                web/src/lib/editionGroups.ts

Fiche œuvre     web/src/routes/EntityDetail/*.tsx
                (EntityDetailPage, EditionProgressSection, TomesGridSection,
                 VolumeInteractionPanel, OwnershipDetails, AddOwnershipForm,
                 AddVolumeSection, AssistantSection, EntityInfoSection,
                 MoreOptionsSection, EditionCorrectionSection,
                 EditionUpgradeWishToggle, VariantNumberEditor)

Recherche/Scan  web/src/routes/QuickAdd/{SearchPage,AddDraftPage,
                                         VolumeSelectionGrid,BarcodeLookupField}.tsx
                web/src/routes/Scan/{ScanPage,ScanActionMenu,CameraBarcodeScanner}.tsx

Analyse d'achat web/src/routes/PurchaseAnalysis/*.tsx
                backend .../purchaseanalysis/{PurchaseAnalysisEngine,VerdictScorer,
                                              NegotiationEngine,CompletenessCalculator,
                                              MarketPriceCalculator,DuplicateDetector}.java

Tier Lists      web/src/routes/TierLists/*.tsx
Envies          web/src/routes/Wishlist/*.tsx
Profil/Admin    web/src/routes/Profile/*.tsx, routes/Settings/SettingsPage.tsx
                web/src/routes/{Editions,EntityTypes,Recap,Loans,EditionUpgrades,
                                Suggestions,Stats,Discover}/*.tsx

Client API      web/src/api/*.ts          Clés de cache : web/src/lib/queryKeys.ts
Progression     backend .../insights/CollectionProgressService.java  (source unique)
Tests           backend/src/test/java/**  (386 tests)
```

**À noter pour la suite** : il n'existe **aucun test frontend ni end-to-end** dans ce dépôt. Les 386 tests sont tous côté backend (domaine, services, persistance Testcontainers). Ce document peut servir de base pour écrire les premiers scénarios E2E — les dix parcours de la §21 étant les candidats naturels.
