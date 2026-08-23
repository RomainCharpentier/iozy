# Audit technique — IozyCore

Établi le 2026-08-22, sur le code réel et l'application en marche. Complète
`USER_JOURNEYS.md`, qui audite les **parcours** ; celui-ci audite la **matière**
— intégrité des données, code mort, couverture de tests, performance,
accessibilité, sécurité, cohérence des clients.

Chaque constat ci-dessous est **mesuré**, jamais déduit. Les mesures qui se sont
révélées fausses sont signalées à la fin, parce qu'elles se reproduiront.

---

## 1. Volumétrie

| | fichiers | lignes |
|---|---|---|
| backend `src/main` | 225 | 17 577 |
| backend `src/test` | 69 | 10 884 |
| web `src` | 125 | 15 625 |
| iOS | 24 | 4 166 |
| migrations Flyway | 17 | — |
| docs | 5 | ~3 300 |

**9 contextes** (`catalog`, `ownership`, `wishlist`, `experience`, `tierlist`,
`editionupgrade`, `share`, `loan`, `shared`) · **17 contrôleurs** ·
**96 endpoints** · **21 tables** · **27 routes web** · **458 tests**.

Le rapport test/production est de **0,62 ligne de test par ligne de production**
côté backend — élevé, et concentré sur le domaine et l'intégration.

---

## 2. Ce qui est sain

### Intégrité des données — 11 liens vérifiés, 0 orphelin

`entity_rank`, `tier_list_item`, `wishlist_entry`, `experience`,
`relationship`, `ownership`, `variant` vers `entity` ; `entity` vers
`entity_type` ; `variant` vers `manga_edition` ; `ownership` vers `variant` ;
`market_price_observation` vers `manga_edition`. **Aucune ligne orpheline.**

**21 contraintes de clé étrangère** déclarées. Les seules colonnes en `_id`
sans FK sont les `owner_id` — attendu : il n'existe pas de table `users`,
l'application est mono-utilisateur (`DefaultOwner.ID`). Ce n'est pas un oubli,
c'est le modèle.

### Robustesse de l'API — 96 endpoints sondés

Corps vides, identifiants inconnus, identifiants malformés :

| Sonde | Résultat |
|---|---|
| 36 `GET` sans paramètre | aucun 500 |
| 8 `GET` paramétrés | 404 sur inconnu, 400 sur malformé |
| 36 `POST`/`PATCH`/`PUT`, corps `{}` | aucun 500 *(un seul existait, corrigé le 2026-08-21)* |
| 16 `DELETE`, id inconnu | 204 ou 404, aucun 500 |

### Accessibilité — 18 écrans

Zéro élément interactif sans nom accessible. Zéro image sans `alt`. Exactement
un `h1` par écran. Aucun saut de niveau de titre. Aucun débordement horizontal
à 375 px. Contraste : **aucun texte sous le seuil**, en clair comme en sombre.

Deux réserves, toutes deux hors du travail récent :
- une quinzaine de boutons-texte mesurent 13–20 px de haut, sous le minimum de
  24 px de WCAG 2.2 (2.5.8). C'est un patron de maison homogène, pas une
  dérive ponctuelle ;
- le champ « Nouveau tag » n'a qu'un `placeholder`, sans `<label>` ni
  `aria-label`. Seul champ de l'application dans ce cas.

### Sécurité

Aucun secret en dur dans les sources suivies. `.env` non suivi et couvert par
`.gitignore`. La récupération d'annonce externe est bornée par une liste
blanche d'hôtes, HTTPS seul, refus des adresses internes et redirections
revalidées (voir `LISTING_SOURCES.md`). La seule surface publique non
authentifiée est `GET /public/share/{token}`, dont le filtrage est fait
côté serveur et couvert par un test qui cherche les données privées dans la
réponse sérialisée.

### Code mort backend

**Aucune méthode de repository sans appelant.** Les ports du domaine sont tous
réellement utilisés.

### Client iOS — non cassé

Les 21 routes appelées par l'application iOS **existent toutes encore**. Les
refontes récentes (suppression des deux contrôleurs de partage séparés, retrait
des endpoints de partage de la wishlist) ne l'ont pas touchée, parce qu'elle ne
les utilisait pas.

---

## 3. Constats

### C1 — N+1 mesuré sur les suggestions d'achat · **important**

`GET /purchase-analysis/near-complete-suggestions` :

| catalogue manga | requêtes SQL |
|---|---|
| 5 séries | **88** |
| 11 séries | **148** |

Soit **~10 requêtes par série supplémentaire**, linéairement. Sur une
collection de 200 séries, l'ordre de grandeur est de **2 000 requêtes par
appel**.

Cause, dans `PurchaseAnalysisService.findNearCompleteSuggestions()` : une
boucle sur toutes les séries qui appelle `progressService.compute(entity.id())`
**une fois par série**, puis `computeCompleteness(...)` une fois par couple
(série × édition). Or `CollectionProgressService.computeAll()` existe — c'est
la version groupée, déjà utilisée par le partage public — et n'est pas employée
ici.

Cet endpoint alimente **Profil ▸ Suggestions d'achats** et le panneau
**Découvrir ▸ Opportunités**. Sur le jeu de données actuel il répond en 29 ms,
donc rien ne se voit ; c'est un problème d'échelle, pas de justesse.

C'est la même famille que les trois N+1 corrigés au Lot 33 ; celui-ci avait
échappé.

### C2 — couverture HTTP des contrôleurs · **PARTIELLEMENT TRAITÉ**

#### Ce que la mesure initiale disait, et ce qu'elle sous-estimait

Le premier relevé comptait « 9 contrôleurs sur 17 dont aucun test ne cite le
nom », soit 42 endpoints. En rouvrant le sujet, la mesure s'est révélée
**trop optimiste** : les 8 contrôleurs réputés « testés » l'étaient par des
tests qui les appellent **en Java** (`controller.delete(id)`), jamais par une
requête. Aucun test du dépôt ne traversait la couche web — ni MockMvc, ni
WebTestClient, ni TestRestTemplate.

La vraie situation de départ était donc : **17 contrôleurs sur 17 sans
couverture HTTP, 96 endpoints sur 96.**

#### Définition — « couverture HTTP »

Une requête passant **réellement par Spring MVC** (MockMvc), et exerçant donc :

- le **routage** ;
- la **désérialisation JSON** du corps ;
- la **validation** ;
- la **conversion des paramètres** de chemin et de requête ;
- le **mapping d'exception** ;
- le **status HTTP** ;
- le **corps de réponse**, lorsqu'il est pertinent.

Un endpoint est **couvert** quand au moins un tel test existe pour son couple
route + verbe, et affirme le status **et** au moins un élément du contrat — un
champ du corps, ou un effet observable en base.

Un test qui appelle la méthode Java du contrôleur (`controller.delete(id)`) ne
compte pas : il saute précisément l'endroit où les défauts survivent. **Ce
chiffre ne doit plus être mélangé avec les tests unitaires ou directs des
contrôleurs**, qui mesurent autre chose.

#### Progression

| | départ | passe 1 | passe 2 | passe 3 | passe 4 |
|---|---|---|---|---|---|
| Contrôleurs couverts | 0/17 | 2/17 | 5/17 | 8/17 | **11/17** |
| Endpoints couverts | 0/96 | 18/96 | 34/96 | 47/96 | **60/96** |
| Contrôleurs restants | 17 | 15 | 12 | 9 | **6** |
| Endpoints restants | 96 | 78 | 62 | 49 | **36** |

**Passe 1** — `OwnershipController` (7/7) et `EntityController` (11/11).
**Passe 2** — `TierListController` (11/11), `ShareController` (4/4),
`PublicShareController` (1/1).
**Passe 3** — `RelationshipController` (5/5), `ExperienceController` (4/4),
`WishlistController` (4/4).
**Passe 4** — `EntityTypeController` (5/5), `TagController` (4/4),
`EditionUpgradeWishController` (4/4).

#### Ce que la couverture HTTP a effectivement trouvé

Quatre bugs de production, tous invisibles depuis un test appelant le
contrôleur en Java, tous sur des gestes utilisateur ordinaires :

| Passe | Symptôme | Cause |
|---|---|---|
| 2 | `POST /tier-lists` sur un univers inconnu → **409** « conflit » | contrôle d'existence qui ne validait rien ; la clé étrangère tranchait |
| 3 | `POST /experiences` sans date → **409** « conflit » | colonne `NOT NULL` sans garde ; `PropertyValueException` d'Hibernate |
| 4 | `POST /edition-upgrade-wishes` sans édition actuelle → **500** | `trim()` évalué comme ARGUMENT du constructeur, donc avant la garde |
| 4 | attacher un tag inexistant → **409** « conflit » | tag non validé ; la clé étrangère tranchait |

Trois des quatre partagent la même racine : **une contrainte de base de données
laissée arbitre du contrat HTTP**. Le message générique du filet
`DataIntegrityViolationException` (« Cette donnée entre en conflit avec une
donnée existante ») est juste pour un vrai conflit, et faux dès qu'il attrape
une référence absente ou un champ manquant.

Tous adossés à `HttpContractTestBase` — même infrastructure que les tests
d'intégration existants (Testcontainers PostgreSQL, `@SpringBootTest`,
`@Transactional`), plus `@AutoConfigureMockMvc`. Le contexte étant celui de
l'application, l'`ObjectMapper` et l'`ApiExceptionHandler` exercés sont ceux de
production. Le conteneur y est un **singleton** et non un `@Container` : cette
annotation lie le conteneur à une seule classe, alors que Spring réutilise son
contexte en cache pour la suivante, qui héritait d'une `DataSource` morte.

#### Le lot 2 a été choisi par risque, pas par volume

`TierListController` concentre le plus de mutations non couvertes (7 sur 11
routes) et orchestre trois agrégats ; il avait déjà été corrigé une fois sur le
fond (« découpler le classement de la possession »).

`PublicShareController` n'a qu'**un** endpoint, mais c'est le seul de
l'application **accessible sans authentification**, et ses 219 lignes de
filtrage de confidentialité vivent **dans le contrôleur** — il n'y a pas de
service derrière sur lequel s'appuyer. C'est aussi la seule surface dont une
régression est **irréversible** : ailleurs un défaut affiche un mauvais chiffre,
ici il expose à un tiers ce que l'utilisateur avait fermé.

`ShareController` gouverne le jeton qui commande le précédent. Les trois
forment une seule question : *ce qui sort de l'application*.

#### Le lot 3 : ce que l'utilisateur écrit lui-même

`RelationshipController`, `ExperienceController` et `WishlistController` ne sont
pas trois modules voisins par hasard : ce sont les trois endroits où
l'utilisateur écrit quelque chose **qui n'existe nulle part ailleurs**. Une
possession se rachète, un catalogue se re-télécharge ; une note de lecture, un
lien qu'on a établi soi-même et une envie notée un soir, non.

Ils partagent aussi le même défaut historique, corrigé au Lot 28 : une référence
vers une œuvre inconnue n'était protégée que par la clé étrangère de Postgres et
remontait en 500 avec la requête SQL. Les tests figent le 400 qui l'a remplacé
sur les trois surfaces — le cas jumeau étant précisément ce qui se retrouve
oublié, comme l'a confirmé le défaut trouvé sur les Tier Lists en passe 2.

#### Le lot 4 : la configuration du catalogue

`EntityTypeController`, `TagController` et `EditionUpgradeWishController`
écrivent des données structurantes ou personnelles **sans aucune intégration
externe**, et chacune référence quelque chose d'autre — un type référencé par
des œuvres, un tag accroché à une œuvre, un souhait rattaché à une série.

Le cas le plus lourd de conséquences y est le refus de supprimer un
`EntityType` encore utilisé : c'est une racine du catalogue (Manga, Jeu vidéo,
Jeu de société, Livre), et le supprimer effacerait une branche entière. Le test
vérifie **l'état après la réponse** — un 409 qui laisserait la base à moitié
modifiée serait pire qu'un 500 franc.

Ce qui est verrouillé au-delà des chemins nominaux : identifiant malformé,
corps vide, JSON illisible, énumération invalide, champ obligatoire absent,
ressource absente, et les conflits d'état (revendre un exemplaire déjà vendu,
restaurer un exemplaire actif, renuméroter sur un numéro pris, supprimer une
série encore possédée).

Plus trois invariants produit, chacun affirmé négativement — un test qui se
contenterait d'un 200 passerait aussi avec la violation :

- **Catalogue ≠ Collection** : une œuvre se lit et se supprime sans aucune
  possession, et rien n'en fabrique au passage ;
- **Classer ≠ posséder** : une œuvre jamais acquise se classe, sans qu'une
  possession apparaisse ;
- **Ce qui n'est pas partagé est absent** de la réponse publique — absent, et
  non vide : une liste vide dirait « il n'a rien dans ses envies », ce qui est
  déjà une information. Et le jeton, qui fait office de mot de passe, ne
  reparaît jamais dans le corps servi au destinataire ;
- **Wishlist ≠ Ownership** : ajouter aux envies ne crée jamais de possession, et
  une œuvre inconnue d'IozyCore y entre en créant sa seule fiche catalogue.

#### Matrice exception → status, pour ces deux surfaces

| Exception | Status | Corps |
|---|---|---|
| `ResponseStatusException(NOT_FOUND)` | 404 | format Spring (`timestamp`/`status`/`error`/`message`/`path`) |
| `IllegalArgumentException` | 400 | `{"error": …}` |
| `IllegalStateException` | 409 | `{"error": …}` |
| `EntityDeletionNotAllowedException` | 409 | `{"error": …}` |
| `VariantDeletionNotAllowedException` | 409 | `{"error": …}` |
| `OwnershipDeletionNotAllowedException` | 409 | `{"error": …}` |
| `DataIntegrityViolationException` | 409 | message générique |
| `InvalidDataAccessApiUsageException` | 400 | message générique |
| conversion de path param (`UUID`) | 400 | `{"error": "Invalid UUID string: …"}` |

Deux formats d'erreur coexistent — celui d'`ApiExceptionHandler` et celui de
Spring pour `ResponseStatusException`. C'est une **convention existante**, pas
une incohérence manifeste : elle est constatée et figée par les tests, pas
corrigée au passage.

#### Probe HTTP live

**39 scénarios ciblés** rejoués contre l'application en fonctionnement sur les
routes Ownership et Entity : **0 réponse HTTP 500.**

Ce n'est **pas une preuve exhaustive** — 39 scénarios ne couvrent pas l'espace
des entrées possibles. Cela confirme en revanche le comportement actuel sur les
familles qui produisaient historiquement des 500 :

- UUID malformé en paramètre de chemin ou de requête ;
- JSON invalide ;
- corps vide ;
- valeur d'énumération inexistante ;
- ressource absente ;
- conflits d'état testés.

Ce que les tests apportent en plus du probe : ils rejouent ces familles à chaque
build, sur une base isolée, y compris les cas qui demandent une ressource
existante dans un état donné — qu'un probe contre la base réelle ne peut pas
provoquer sans la modifier.

**Passe 2** : **38 scénarios** sur Share, PublicShare et TierList —
**0 réponse 500**. Y compris un jeton de partage de 300 caractères, un jeton
contenant une apostrophe SQL et un jeton tentant une traversée de chemin.

**Passe 3** : **40 scénarios** sur Relationship, Experience et Wishlist —
**0 réponse 500**.

**Passe 4** : **32 scénarios** sur EntityType, Tag et EditionUpgradeWish —
**0 réponse 500** au premier passage. Le probe seul n'a cependant **pas suffi** :
les deux défauts de cette passe exigeaient une ressource réelle dans un état
précis (une entité existante avec un champ manquant, un tag absent sur une
entité existante), que les identifiants inexistants du probe n'atteignaient
jamais — les gardes en amont tiraient d'abord. C'est l'écriture des tests qui
les a fait apparaître. Un probe mesure la robustesse des chemins d'erreur les
plus courts ; il ne remplace pas des tests qui construisent l'état.

#### Un défaut trouvé par la passe 3

`POST /api/experiences` sans `occurredAt` rendait **409** et le message
« Cette donnée entre en conflit avec une donnée existante ». Rien n'entrait en
conflit : la colonne `occurred_at` est `NOT NULL` et aucune garde ne le
vérifiait, donc le corps descendait jusqu'à Hibernate, dont la
`PropertyValueException` tombait dans le filet générique des conflits de
données. Enregistrer une lecture est un geste courant, et l'utilisateur ne
pouvait pas deviner quel champ manquait.

Corrigé **dans le domaine** (`Experience`) plutôt que dans le contrôleur, pour
protéger tous les appelants — et surtout **sans déduire la date du jour** : on
relit souvent une œuvre lue il y a des années, et inventer « aujourd'hui »
fausserait silencieusement les statistiques annuelles. Même règle que pour un
prix relevé (`MarketPriceObservation`).

#### Un défaut trouvé par la passe 2

`POST /api/tier-lists` avec un `entityTypeId` inexistant rendait **409** et le
message « Cette donnée entre en conflit avec une donnée existante » — phrase
fausse : la donnée est *absente*, pas conflictuelle. Le contrôleur appelait bien
`entityRepository.findAllByType(...)` en guise de contrôle, mais cette méthode
rend une liste vide pour un type inconnu et ne lève rien ; son propre
commentaire l'admettait. La contrainte de clé étrangère tranchait donc à sa
place, et son message générique remontait à l'écran.

Corrigé en **400** par un `entityTypeRepository.findById(...)` explicite, même
contrôle que `POST /entities/quick-add` — où le problème avait déjà été corrigé
une fois, sans que le cas jumeau soit vu.

#### Divergence OpenAPI corrigée

Trois routes annonçaient un status faux dans le contrat publié :

| Route | Documenté | Réel |
|---|---|---|
| `DELETE /api/entities/{id}` | 200 | **204** |
| `DELETE /api/entities/{entityId}/variants/{variantId}` | 200 | **204** |
| `DELETE /api/ownerships/{id}` | 200 | **204** |

springdoc suppose 200 pour une méthode rendant `ResponseEntity<Void>`. Le code
a raison — 204 No Content est le status juste pour ces suppressions — donc
c'est la **documentation** qui a été corrigée, par des annotations
`@ApiResponse`. **Aucun changement d'exécution** : un client généré à partir du
contrat attendait un corps qui n'arrive jamais.

Les 16 routes du lot 2 et les 13 du lot 3 ont été vérifiées de la même façon :
leur OpenAPI est **conforme**, ces contrôleurs déclarant leurs status par
`@ResponseStatus`, que springdoc reprend correctement.

Le lot 4 a révélé une quatrième occurrence du même écart :
`DELETE /api/entity-types/{id}` documenté 200 alors qu'il rend 204. Corrigé de
la même façon, par annotation — le 409 du refus de suppression y est désormais
documenté lui aussi.

#### Reste ouvert — 6 contrôleurs, 36 endpoints

Aucun ne relève d'un simple « prochain lot » : chacun demande une décision
préalable.

| Contrôleur | Endpoints | Question à trancher avant de tester |
|---|---|---|
| `MetadataController` | 5 | **Stratégie de stub.** Dépend de Google Books, MyAnimeList, IGDB. Aucun test ne doit faire d'appel réseau réel : passe dédiée, avec MockWebServer ou des beans de remplacement |
| `LoanController` | 4 | **Statut produit.** Les prêts ont été retirés de l'interface utilisateur ; l'API reste exposée. Décider KEEP / DEPRECATE / REMOVE avant d'investir dans sa couverture |
| `InsightsController` | 6 | Lectures pures, services fortement couverts — faible rendement |
| `ExportController` | 2 | Idem, `ExportCsvWriter` déjà testé |
| `PurchaseAnalysisController` | 18 | Couverture **fonctionnelle** massive (>150 tests domaine et intégration), couverture **HTTP formelle** nulle. À distinguer : la première protège le calcul, la seconde protègerait le contrat |
| `ListingMetadataController` | 1 | Vinted, lié à la question du stub réseau |

Les quatre lots livrés ont couvert **toutes les surfaces d'écriture sans
dépendance externe**. Ce qui reste est soit une lecture à faible risque, soit
une décision de produit ou d'infrastructure de test.

Leurs services et domaines restent largement testés : ce qui manque est la
frontière HTTP, pas la logique.

### C3 — Quatre exports frontend morts · **mineur**

| Fichier | Export | Remarque |
|---|---|---|
| `lib/editionGroups.ts` | `hasMixedEditions` | aucun appelant |
| `types/entityTypes.ts` | `findEntityTypeByCode` | aucun appelant, **et sa javadoc affirme des usages qui n'existent pas** (« lookup code-barres, import BGG, sections de découverte ») |
| `types/entityTypes.ts` | `OWNERSHIP_STATUS_LABELS` | aucun appelant |
| `types/purchaseAnalysis.ts` | `VERDICT_FACTOR_LABELS` | aucun appelant — le détail par facteur n'est jamais affiché, seul son *nombre* l'est |

Le cas gênant est le deuxième : un commentaire qui décrit des usages
imaginaires coûte plus cher qu'une fonction morte silencieuse.

*(Les ~35 autres « exports orphelins » détectés sont des faux positifs : des
types composés à l'intérieur de leur propre fichier.)*

### C4 — Le client iOS a douze jours de retard · **à décider**

Dernier commit le 2026-08-10. Il couvre 8 écrans et ignore entièrement :
Tier Lists, Analyse d'achat, lecture d'annonce, partage, envies d'amélioration.
Son dossier `Wishlist/` n'appelle que `/wishlist/lookup` — il sait dire si une
œuvre est souhaitée, pas en ajouter ni en lister.

Ce n'est pas un défaut : rien ne dit que l'iOS doit suivre le web pas à pas.
Mais l'écart grandit à chaque passe, et il vaut mieux le nommer que le
découvrir.

### C5 — Deux références mortes dans la documentation · **mineur**

`DESIGN_MIGRATION_V1.2.md` cite `LoansPage` et `PublicCollectionController`,
tous deux supprimés depuis. Ce document est un **journal de migration** : ses
références décrivent un état passé, elles sont donc historiquement exactes. À
laisser tel quel, sauf à vouloir un avertissement en tête de fichier.

---

## 4. Deux pièges de mesure, rencontrés ici

À relire avant de refaire ce genre d'audit — les deux ont produit de fausses
alertes qu'il a fallu réfuter.

**`pg_stat_user_tables` ment.** Il annonçait `entity = 0` alors que la table
contenait 6 lignes, et `wishlist_entry = 1` sur une table vide. Les compteurs
sont approximatifs et retardent. Compter réellement (`count(*)`), toujours.

**Mesurer le contraste sur un conteneur ne veut rien dire.** Un premier
passage a signalé une vingtaine d'échecs à 1,14:1 en thème clair. Faux, pour
deux raisons cumulées : basculer le thème en posant `data-theme` à la main ne
fait pas suivre le fond du `body` (il faut passer par le mécanisme de
l'application), et un élément conteneur porte une couleur héritée que **rien ne
peint** — seules ses feuilles comptent. Mesuré correctement : zéro échec.

---

## 5. Ce que cet audit n'a pas couvert

- la qualité interne et les tests du client iOS (seule sa surface d'API a été vérifiée) ;
- l'arithmétique du moteur d'analyse d'achat (re-dérivée indépendamment au Lot 36) ;
- le comportement réel des fournisseurs de métadonnées contre leurs API en ligne ;
- la compatibilité navigateur au-delà de celui utilisé pour les vérifications ;
- la performance sous charge réelle : toutes les mesures portent sur un jeu de
  6 séries, 12 tomes, 9 possessions. C'est assez pour révéler un N+1 par
  comptage de requêtes, pas pour conclure sur des temps de réponse.
