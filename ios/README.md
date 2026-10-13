# IozyCore — client iOS (hors service)

> ## ⚠️ Hors service depuis le 2026-08-29
>
> L'API demande une **session** depuis cette date (comptes, connexion,
> cloisonnement par propriétaire — voir `../backend/README.md`), et ce client
> n'en ouvre aucune : **tous ses appels reçoivent 401**, dès le premier écran.
>
> Ce n'est pas une régression subie : c'est la conséquence assumée d'avoir
> fermé une API qui ne l'était pas du tout. Elle est écrite ici plutôt que
> découverte au prochain lancement.
>
> **Ce qu'il faudrait** — moins qu'il n'y paraît, parce que `URLSession` en
> configuration `.default` gère déjà les cookies (`HTTPCookieStorage.shared`) :
> une fois la session ouverte, elle repart seule à chaque appel.
>
> 1. quatre routes : `GET /auth/etat`, `POST /auth/login`, `GET /auth/me`,
>    `POST /auth/logout` ;
> 2. le cookie `XSRF-TOKEN` renvoyé en en-tête `X-XSRF-TOKEN` sur les
>    écritures — les quatre helpers de `APIClient.swift` (`post`, `patch`,
>    `postEmpty`, `delete`) passent tous au même endroit ;
> 3. un écran de connexion, et une porte dans `IozyCoreApp.swift`.
>
> Trois issues possibles — le rattraper, le geler explicitement, le retirer du
> dépôt — et leurs conséquences respectives sont pesées dans
> Aucune n'a été prise : c'est
> une décision de produit, pas une décision technique.

## Le projet

IozyCore est une base de connaissances personnelle, auto-hébergée, où
**chaque personne a sa collection** (depuis le 2026-08-29 ; le catalogue des
œuvres, lui, est commun) : cataloguer une collection (mangas, jeux vidéo, jeux de
société), suivre ce qu'on possède indépendamment de ce qu'on a vécu (lu,
joué, terminé, avec note et commentaire), enrichi automatiquement via des
API publiques gratuites. Ce dossier est le client iOS ; le backend (Spring
Boot) est dans `../backend`, et le client Web (`../web`) est aujourd'hui le
client vivant.

Document de conception complet : `../docs/CONCEPTION.md`.
Ce README documente l'état du code tel qu'il existe.

### Architecture

SwiftUI + SwiftData (cache local, hors ligne pour Ownership/Experience
uniquement — voir plus bas), organisation par fonctionnalité :

```
IozyCore/
  DesignSystem/       Theme (couleurs/polices/dégradés/icônes), CoverTile, Chip, StatCard
  Models/             EntityTypeRecord (types dynamiques, synchronisés depuis le backend -
                       éditeur de types, voir Features/EntityTypes/), SwiftDataModels (cache local)
  Networking/         APIClient (cœur HTTP) + une extension par domaine
                       (APIClient+Collections, +Insights, +TagsAndRelationships, +EntityTypes)
  Features/           un dossier par écran : Shelf, Search, QuickAdd, EntityDetail, Wishlist,
                       Stats, Settings, EntityTypes (gestion des types - liste + création/édition)
  IozyCoreApp.swift   point d'entrée, TabView racine, thème forcé en sombre
```

Chaque écran suit le même patron : une struct `XxxView` publique (l'écran),
des `private struct` pour ses sheets/sous-vues en bas du même fichier
(voir `EntityDetailView.swift` comme référence la plus complète : sheets
`AddExperienceSheet`, `ManageTagsSheet`, `AddRelationshipSheet`).

### Comment travailler sur ce projet

**Ajouter un appel API** : dans le fichier `APIClient+<Domaine>.swift`
pertinent (ou en créer un nouveau si le domaine n'existe pas encore), pas
directement dans la vue. Les DTO (`XxxDTO`) sont des `struct` Codable dans
le même fichier, un miroir 1:1 des DTO Java du backend (mêmes noms de champs
en camelCase - Jackson et Codable s'accordent nativement dessus, pas de
`CodingKeys` à écrire dans la plupart des cas).

**Ajouter un écran** : nouveau dossier sous `Features/`, réutilise les
composants de `DesignSystem/` (`Theme.xxx` pour les couleurs/polices,
`CoverTile`/`Chip`/`StatCard`) plutôt que des couleurs ou tailles de police
en dur - c'est ce qui permet à un nouvel écran de rester visuellement
cohérent sans copier-coller du style.

**Synchronisation avec le backend** : le patron déjà en place (voir
`EntityDetailView.syncFromServer()`) est fetch au `.task`/`.refreshable`,
puis upsert dans le `ModelContext` SwiftData par id - jamais d'écrasement
silencieux, et le cache local reste affichable si l'appel réseau échoue
(dégradation gracieuse hors ligne, uniquement pour Ownership/Experience -
Stats et Discovery n'ont pas de repli hors ligne, volontairement, une
donnée périmée n'y a pas de sens).

**Piège Swift déjà rencontré deux fois dans ce projet, à ne pas
réintroduire** : les déclarations `private`/`fileprivate` sont invisibles
depuis un autre fichier même dans le même module - toute struct/fonction
partagée entre plusieurs fichiers (DTOs, helpers réseau) doit être `internal`
(pas de modificateur) au minimum. Egalement : ne jamais faire conformer un
type Foundation (`UUID`, etc.) à un protocole qu'il implémente déjà -
conflit de conformance à la compilation.

### État actuel

Construit : les 4 parcours de la conception (ajout rapide avec recherche de
métadonnées - Jikan/BGG/IGDB - et scan ISBN, fiche détail avec sync
serveur, recherche transversale, étagères), Tag/Relationship, import BGG,
statistiques, découverte heuristique (mangas/jeux de société/jeux vidéo),
éditeur de types dynamique (`Features/EntityTypes/`), direction visuelle
dédiée (voir plus bas).

Pas construit : l'authentification (cause de la panne décrite en tête de
fichier : cookie de session et jeton CSRF, rien à voir avec un JWT), et
volontairement pas construit : synchronisation
Tag/Relationship en tant que telle avec le cache local (elles vivent
uniquement en mémoire le temps de la session sur la fiche détail),
validation locale des `customFieldKeys` d'un type contre les attributs
saisis (reste descriptif, comme côté backend).

## Direction visuelle

Fond sombre, accent vert-jaune vif (`#B8FF3C`), grille de couvertures en
dégradé généré (façon Letterboxd/Spotify) plutôt que des listes système,
typographie Space Grotesk (titres) + Inter (texte courant). Système de
design centralisé dans `IozyCore/DesignSystem/` (`Theme.swift`,
`CoverTile.swift`, `Chip.swift`) - toute nouvelle vue doit s'appuyer dessus
plutôt que redéfinir des couleurs en dur.

Les polices custom ne sont pas encore embarquées (fichiers binaires,
impossibles à télécharger depuis l'environnement qui a généré ce projet) -
voir `IozyCore/Fonts/README.md` pour les ajouter en 5 minutes. Sans elles,
l'app tourne normalement avec la police système en repli silencieux.

## Prérequis

- Un Mac avec **Xcode** installé (15+ recommandé, pour iOS 17/SwiftData).
- **XcodeGen** : `brew install xcodegen` (une fois, si tu ne l'as pas déjà).
- Pour le scan de code-barres : un **iPhone physique** (VisionKit ne fonctionne
  pas sur le simulateur, qui n'a pas de caméra - l'app le détecte et affiche
  un message plutôt que de planter).

## Lancer l'app en 2 commandes

> Les commandes ci-dessous restent valables, mais l'app ne peut rien charger
> tant qu'elle n'ouvre pas de session (voir le bandeau en tête de fichier).

```bash
cd ios
xcodegen generate
open IozyCore.xcodeproj
```

Puis dans Xcode : sélectionne un simulateur iPhone (ou ton iPhone en USB pour
tester le scanner) et clique sur **Run** (▶).

**Pour tester le flux complet** (historique : ce parcours reçoit 401 tant que
l'iOS n'ouvre pas de session) :
1. Lance d'abord le backend (`docker compose up --build` dans `../backend`). L'app pointe par défaut sur `http://localhost:8080/api`.
2. Onglet **Ajouter** : tape un titre (ou scanne un code-barres avec l'icône
   à côté du champ Titre - iPhone physique requis), crée l'élément.
3. Onglet **Étagères** : l'élément apparaît immédiatement.
4. Tape dessus → la fiche détail interroge l'API pour ses Ownership/Experience
   réelles (pas seulement le cache local) et les fusionne dans SwiftData.
5. "Ajouter une expérience" dans la fiche détail appelle vraiment
   `POST /api/experiences`, avec le type validé côté serveur contre
   l'`EntityType` (tenter "PLAYED" sur un manga renvoie une erreur affichée
   à l'écran).
6. Onglet **Recherche** : tape le titre → résultat remonté par une vraie
   recherche serveur (pas juste le cache local) → tape dessus pour vérifier
   le statut "Déjà possédé".
7. Dans la fiche détail, "Gérer les tags" : crée un tag ("seinen" par
   exemple), il apparaît en chip. Ajoute un second élément à ta collection,
   puis "Ajouter une relation" pour les lier ("Fait partie d'une série").
8. Onglet **Étagères**, icône d'import (flèche vers le bas) : entre un
   pseudo BoardGameGeek public, lance l'import — les jeux "possédés" de
   cette collection apparaissent dans les Étagères après quelques secondes.
9. Onglet **Stats** : vérifie que les compteurs reflètent ce que tu viens
   d'ajouter (nombre total, par type, note moyenne des mangas notés).
10. Toujours dans Stats, "Voir des suggestions" : des mangas du même auteur
    (si tu en as noté un) ou des jeux tendance BGG (si tu as importé une
    collection) apparaissent — "Ajouter" les intègre directement.

## Renommer l'app

Un seul fichier à modifier : **`Config.xcconfig`**. Change `APP_NAME`
(nom affiché : icône, titre, réglages système) et/ou `APP_BUNDLE_ID`
(identifiant technique), puis relance `xcodegen generate`. Aucun fichier
Swift à toucher — en particulier, le fichier `IozyCoreApp.swift` et le nom
de la struct `IozyCoreApp` peuvent rester tels quels : ce sont des
identifiants Swift internes, invisibles pour l'utilisateur final, complètement
indépendants du nom affiché de l'app.

## Ce qui est couvert

- **Découvertes** (onglet Stats, section dédiée, chargement à la demande) :
  suggestions de mangas du même auteur que tes mieux notés (Jikan), et de
  jeux de société tendance BGG partageant des catégories avec les tiens.
  Chaque suggestion peut être ajoutée en un tap. Nécessite un
  `BGG_APPLICATION_TOKEN` configuré côté backend pour un usage BGG conforme
  (voir README backend).
- **Statistiques** (UC6), nouvel onglet : nombre total d'éléments, possédés,
  wishlist, expériences de l'année en cours, détail par type (dont note
  moyenne), et les 5 tags les plus utilisés. Toujours interrogé en direct
  (pas de cache local pour cet écran, contrairement à Ownership/Experience).


- **Recherche transversale réelle** (UC4) dans l'onglet Recherche : interroge
  désormais `/api/entities/search` (ta vraie collection, tous types
  confondus) plutôt que de filtrer uniquement le cache local. Bascule
  automatiquement sur le cache local si le réseau est indisponible (bandeau
  "Hors ligne" affiché), conformément au parcours 3 qui doit fonctionner
  même sans connexion.


- **Import de collection BGG** : dans l'onglet Étagères, bouton d'import
  qui demande un pseudo BoardGameGeek, importe tous les jeux marqués
  "possédés" (déduplication automatique, comme l'ajout rapide), affiche un
  résumé (trouvés/nouveaux/déjà connus/échecs), puis recharge les Étagères
  pour que les nouveaux jeux apparaissent immédiatement.
- **Tags et Relations** directement depuis la fiche détail : créer/associer/retirer
  des tags (chips visuels), et créer des relations typées vers un autre élément
  de ta collection locale (ex: "Adapté en", "Fait partie d'une série"). Les
  deux se synchronisent avec l'API à l'ouverture de la fiche.
- **Lookup ISBN réel après scan** (mangas uniquement) : le code-barres
  scanné est envoyé à `GET /api/metadata/lookup-barcode` (Open Library,
  aucune clé requise) ; si l'ISBN est reconnu, le titre et les attributs
  sont pré-remplis automatiquement, sinon le code brut reste affiché comme
  avant. Les jeux vidéo/société n'ont pas de source de lookup ISBN
  équivalente (codes-barres UPC/EAN, pas ISBN) — le scan y pré-remplit
  toujours juste le code brut.
- **Recherche automatique de métadonnées** pendant l'ajout rapide : dès 2
  caractères tapés dans le titre, l'app interroge Jikan (mangas) ou BGG
  (jeux de société) et propose des suggestions ; en choisir une pré-remplit
  le titre et transmet ses attributs (auteur, éditeur...) à l'ajout rapide.
- **Modèles SwiftData** : cache local miroir des agrégats backend (`Entity`,
  `Variant`, `Ownership`, `Experience`, `WishlistEntry`).
- **`APIClient` + `APIClient+Collections`** : ajout rapide, vérification
  wishlist, ET DÉSORMAIS lecture/écriture Ownership et Experience
  (`fetchOwnerships`, `fetchExperiences`, `recordExperience`,
  `markOwnershipSold/Lost`).
- **`EntityDetailView`** synchronise réellement avec l'API au premier
  affichage (et via pull-to-refresh) : upsert des Ownership/Experience
  serveur dans le cache local, sans écraser le cache en cas d'échec réseau
  (dégradation gracieuse pour l'usage hors ligne).
- **Scan de code-barres** (`BarcodeScannerView`/`BarcodeScannerSheet`, via
  VisionKit `DataScannerViewController`) : bouton dans l'ajout rapide, gère
  proprement le cas simulateur (message au lieu d'un crash).
- **4 vues, une par parcours utilisateur validé en conception**, plus
  `WishlistView` pour UC5.

## Ce qui n'est pas couvert (volontairement)

- **Lookup produit limité à MANGA** : les jeux vidéo/société n'ont pas de
  source ISBN équivalente branchée (voir plus haut) — le scan y pré-remplit
  toujours juste le code brut, pas de vrai titre.
- La cible d'une relation se choisit parmi les éléments déjà présents dans le
  cache local de l'appareil (pas de recherche serveur dédiée) — suffisant à
  l'usage, mais une Entity jamais ouverte sur cet appareil n'apparaîtra pas
  dans la liste.
- Pas d'authentification sur les appels réseau : c'est ce qui le rend hors
  service (voir le bandeau en tête de fichier).
- Avant un vrai déploiement, remplace `baseURL` dans `APIClient.swift` par
  l'URL de production (reverse proxy HTTPS, `docker-compose.synology.yml`).
