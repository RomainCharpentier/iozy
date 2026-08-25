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
`editionupgrade`, `share`, `shared`) · **16 contrôleurs** ·
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

### C2 — couverture HTTP des contrôleurs · **RISQUE TRAITÉ**

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

| | départ | p1 | p2 | p3 | p4 | p5 | p6 | p7 |
|---|---|---|---|---|---|---|---|---|
| Contrôleurs couverts | 0/17 | 2/17 | 5/17 | 8/17 | 11/17 | 12/17 | 14/17 | **15/16** |
| Endpoints couverts | 0/96 | 18/96 | 34/96 | 47/96 | 60/96 | 78/96 | 84/96 | **86/92** |
| Contrôleurs restants | 17 | 15 | 12 | 9 | 6 | 5 | 3 | **1** |
| Endpoints restants | 96 | 78 | 62 | 49 | 36 | 18 | 12 | **6** |

Le dénominateur passe de 17 à 16 contrôleurs et de 96 à 92 endpoints à la
passe 7 : `LoanController` et ses 4 routes ont été **supprimés**, pas couverts.
Un dénominateur qui bouge doit s'expliquer, sans quoi le ratio s'améliore tout
seul.

**Passe 1** — `OwnershipController` (7/7) et `EntityController` (11/11).
**Passe 2** — `TierListController` (11/11), `ShareController` (4/4),
`PublicShareController` (1/1).
**Passe 3** — `RelationshipController` (5/5), `ExperienceController` (4/4),
`WishlistController` (4/4).
**Passe 4** — `EntityTypeController` (5/5), `TagController` (4/4),
`EditionUpgradeWishController` (4/4).
**Passe 5** — `PurchaseAnalysisController` (18/18).
**Passe 6** — `MetadataController` (5/5), `ListingMetadataController` (1/1).
**Passe 7** — `ExportController` (2/2) ; `LoanController` supprimé ;
`InsightsController` explicitement non couvert.

#### Ce que la couverture HTTP a effectivement trouvé

Six bugs de production, tous invisibles depuis un test appelant le
contrôleur en Java, tous sur des gestes utilisateur ordinaires :

| Passe | Symptôme | Cause |
|---|---|---|
| 2 | `POST /tier-lists` sur un univers inconnu → **409** « conflit » | contrôle d'existence qui ne validait rien ; la clé étrangère tranchait |
| 3 | `POST /experiences` sans date → **409** « conflit » | colonne `NOT NULL` sans garde ; `PropertyValueException` d'Hibernate |
| 4 | `POST /edition-upgrade-wishes` sans édition actuelle → **500** | `trim()` évalué comme ARGUMENT du constructeur, donc avant la garde |
| 4 | attacher un tag inexistant → **409** « conflit » | tag non validé ; la clé étrangère tranchait |
| 5 | `POST /analyze` **et** `POST /editions` sans titre de série → **500** | `SeriesMatcher.match()` appelait `trim()` sans garde — deux portes, une seule racine |
| 5 | `POST /editions` vers une Série absente → **409** « conflit » | clé étrangère `manga_edition_entity_id_fkey` laissée arbitre |

Quatre des six partagent la même racine : **une contrainte de base de données
laissée arbitre du contrat HTTP**. Deux autres partagent la seconde : **un
`trim()` évalué avant la garde `null` censée le protéger** — une fois comme
argument de constructeur, une fois en tête de méthode. Le message générique du filet
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

#### Le lot 5 : PurchaseAnalysis, deux couvertures à ne pas confondre

Cette surface avait déjà **plus de cent cinquante tests** de domaine et
d'intégration — verdicts, médianes, comparabilité marché, sémantique de
livraison, ingestion d'observations. Sa couverture **fonctionnelle** était la
plus forte du dépôt ; sa couverture **formelle de la frontière HTTP** était
nulle.

Ce sont deux couches différentes, et la seconde ne remplace pas la première :
les tests ajoutés ici ne rejouent aucun calcul. Ils protègent le passage —
routage, désérialisation, liaison, traduction des exceptions — et surtout
**l'absence d'effet partiel** : un lot dont un seul élément est invalide ne
laisse rien en base, ce qui est désormais affirmé par un compteur avant/après
et pas seulement par un status.

Deux bugs de production y ont malgré tout été trouvés, tous deux invisibles
depuis un test de domaine parce qu'ils vivent avant lui.

#### Ressource absente **désignée dans le corps** : 400, et pourquoi

Le lot 5 avait d'abord mappé ce cas en 404, via une exception de domaine dédiée.
Le lot 6 est revenu à **400**, et l'exception a été retirée.

La raison n'est pas théorique — le 404 reste défendable en REST — elle est
observable dans le client. `web/src/api/client.ts:61` :

```ts
const utile = raison && raison !== 'No message available' && response.status !== 404
```

Tout 404 voit **son message serveur remplacé** par un texte générique. Un
« Série introuvable : *id* » renvoyé en 404 n'atteint donc jamais l'écran ; le
même message renvoyé en 400 y arrive intact. Pour une référence portée par le
**corps** de la requête, où l'utilisateur ne peut pas deviner lequel des champs
est en cause, perdre ce message est une régression d'usage réelle.

**Portée de la règle, à ne pas élargir** :

| Cas | Status | Motif |
|---|---|---|
| Ressource **de l'URL** absente — `GET/PUT/DELETE /x/{id}` | **404** | La ressource adressée n'existe pas ; c'est le sens même du code |
| Ressource **désignée dans le corps** absente — `entityId`, `tagId`… | **400** | Corps invalide ; le message nomme le champ fautif et doit survivre |

Cette seconde ligne aligne `POST /purchase-analysis/editions` sur quatre routes
sœurs qui rendaient déjà 400 dans ce cas (`/experiences`, `/wishlist`,
`/relationships`, `/edition-upgrade-wishes`). **La politique globale des 404 est
inchangée** : aucune route adressant une ressource par son URL n'a été touchée.

#### Le lot 6 : tester une frontière qui parle au monde extérieur

Ces six endpoints étaient les derniers non couverts pour une raison précise :
ils dépendent de Jikan, Google Books, Open Library, BGG, IGDB et Vinted. Le
lot 4 les avait laissés en notant « stratégie de stub à trancher ».

La stratégie retenue **n'ajoute aucune infrastructure**. Les services
n'injectent pas un fournisseur mais une **liste** de fournisseurs, chacun
décidant par `supports(...)` s'il traite une demande. Cette liste est déjà la
couture : cinq faux fournisseurs de vingt lignes, déclarés dans un
`@TestConfiguration`, répondent à un univers de test (`ZZFAKE`) et à un hôte de
test (`source-de-test.invalid`). Les vrais fournisseurs déclinent **par leur
propre prédicat** — pas par une désactivation qu'il faudrait maintenir.

Pas de MockWebServer ni de WireMock : le point à protéger est le passage HTTP
**entrant**, pas le dialogue sortant. Un serveur simulé aurait ajouté une
dépendance et un port à gérer pour tester ce que ces classes disent mieux.
`@TestConfiguration` garantit par ailleurs qu'aucun scan de composants ni aucun
profil applicatif ne peut charger ces faux hors des classes qui les importent.

#### Le piège : un test qui viole l'invariant qu'il protège

Un test devait prouver qu'un univers **sans aucun fournisseur** rend 404 plutôt
qu'une erreur serveur. Il utilisait *Manga* comme univers « sans faux ».

Or Manga est justement couvert par de **vrais** fournisseurs. Le test partait
donc réellement sur le réseau — pour démontrer qu'il n'y allait pas. Il a
d'ailleurs échoué en rendant 200 : Google Books avait répondu.

Le correctif n'est pas de neutraliser les vrais fournisseurs, mais de créer un
second univers de test (`ZZAUCUN`) qu'aucune implémentation, vraie ou fausse,
ne prend en charge. La branche « personne ne répond » devient atteignable sans
qu'une seule connexion s'ouvre. La leçon vaut au-delà de ce cas : **un test
d'isolation réseau doit prouver son isolation, pas la supposer** — ici, c'est
son propre échec qui l'a révélée.

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

**Passe 6** : **46 scénarios** sur les six endpoints du lot — **0 réponse 500**.
Tous choisis pour être tranchés **avant** le moindre appel réseau (univers
inconnu, paramètre requis vide, UUID malformé, URL hors liste blanche, corps
cassé) : ces routes sont le seul endroit du projet où l'exhaustivité d'un probe
live aurait un coût externe, et elle n'aurait rien prouvé de plus.

**Passe 5**, en deux familles séparées — c'est l'apport méthodologique du lot :

| Famille | Scénarios | 500 avant | 500 après |
|---|---|---|---|
| Superficiel (id inconnu, corps vide, JSON cassé, enum invalide) | 47 | 1 | 0 |
| Stateful (données réelles construites puis nettoyées) | 16 | 1 | 0 |

Les deux familles ne trouvent pas les mêmes choses : le superficiel exerce les
chemins d'erreur les plus courts, le stateful atteint ce qui vit **derrière les
premières gardes**. Et ni l'un ni l'autre n'est une couverture — un probe
constate un comportement à un instant, un test le rejoue à chaque build. Les
lots 4 et 5 le démontrent : deux des quatre bugs récents n'étaient atteignables
que par des tests construisant l'état.

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

Les six routes du lot 6 sont **conformes** : toutes rendent un objet, dont
springdoc déduit correctement 200. `POST /listing-metadata/resolve` documente en
outre explicitement dans son `@Operation` pourquoi il répond **toujours** 200 —
annonce supprimée, plateforme non couverte ou lecture partielle sont des issues
normales du parcours, distinguées par un champ `status`, pas par un code HTTP
qui les confondrait toutes dans un bandeau rouge.

#### Le lot 7 : clore par décision, pas par ratio

Les douze endpoints restants ne se ressemblaient pas. Les couvrir tous aurait
produit un beau 100 % et une fausse information : on n'aurait pas su lesquels
méritaient d'exister. Chacun a donc été **tranché**, pas testé par défaut.

**`LoanController` → SUPPRIMÉ.** Les prêts avaient été retirés de l'interface
lors d'une passe antérieure, mais le backend gardait contrôleur, DTO, agrégat,
repository, entité JPA, table et tests. Audit : **0 appel côté web**, **0 côté
iOS**, aucun client généré, aucun script — et **0 ligne dans `loan`**. Aucune
donnée à préserver, aucune fonctionnalité à soutenir.

La dépendance qui rendait la décision nécessaire vivait dans
`OwnershipDeletionService` : il refusait de supprimer une possession
référencée par un prêt, pour qu'un historique ne pointe jamais vers une
possession disparue. Cette garde n'a pas été *affaiblie* — elle est devenue
**sans objet**, le concept qu'elle protégeait n'existant plus. Le retrait est
affirmé par des tests plutôt que constaté plus tard :
`OwnershipDeletionServiceTest` dit désormais explicitement qu'une possession
se supprime sur demande, que la route reste idempotente, et que supprimer un
exemplaire n'en touche aucun autre. `V5__loan.sql` n'est pas réécrite ;
`V19__drop_loan.sql` la défait, avec un garde-fou qui **échoue bruyamment** si
la table n'est pas vide — une migration destructrice ne doit jamais effacer en
silence un historique que personne n'a exporté.

**`ExportController` → COUVERT** (2/2). Le seul des trois à mériter des tests,
pour une raison précise : `ExportCsvWriter` est déjà testé, mais le contrôleur
fait lui-même deux choses que personne ne vérifiait — il construit l'en-tête
`Content-Disposition` qui **nomme le fichier téléchargé**, et il assemble le
ZIP à la main dans sa méthode. Les tests ajoutés **ouvrent réellement
l'archive** et lisent un CSV à l'intérieur ; ils ne se contentent pas d'un
`GET → 200`. L'export est la garantie anti-enfermement du produit
(docs/CONCEPTION.md §19) : un export corrompu est un défaut grave et
silencieux, exactement le genre qu'un status 200 ne révèle pas.

**`InsightsController` → RISQUE ACCEPTÉ** (0/6). Six `GET`, **aucune
mutation**, aucun corps de requête à désérialiser, un seul paramètre validé
(`entityTypeCode`, déjà en 400 explicite). Les services derrière sont
fortement couverts (`StatsServiceTest`, `DiscoveryServiceTest`,
`CollectionProgressServiceTest`). Six tests « appeler la route, obtenir 200 »
auraient amélioré le ratio sans protéger quoi que ce soit : sur une lecture
sans écriture, le pire défaut est un écran vide, pas une donnée corrompue.
C'est le seul trou assumé de la campagne, et il est nommé.

#### Couverture brute ≠ risque restant

Le chiffre seul ne raconte plus l'état du système. Les deux lectures :

| Couverture HTTP brute | |
|---|---|
| Contrôleurs | **15 / 16** |
| Endpoints | **86 / 92** |
| Tests de contrat HTTP | **180**, en 9 classes |

| Risque HTTP restant | Statut |
|---|---|
| Surfaces d'**écriture** actives | **aucune sans contrat HTTP** |
| Intégrations externes (Metadata, Vinted) | couvertes, **sans réseau réel** |
| `InsightsController` — 6 `GET`, 0 mutation | **risque accepté**, explicitement |
| `LoanController` | **n'existe plus** |

C2 est clos en **RISQUE TRAITÉ**, pas en « 100 % de couverture » — 6 endpoints
restent sans test HTTP, et le dire est le seul moyen de garder le chiffre
utile.

#### Bilan de la campagne C2

| | Départ | Arrivée |
|---|---|---|
| Contrôleurs avec couverture HTTP | 0 / 17 | **15 / 16** |
| Endpoints avec couverture HTTP | 0 / 96 | **86 / 92** |
| Tests de contrat HTTP | 0 | **180** |
| Bugs de production trouvés | — | **6** |

Racines des six défauts, et de deux familles voisines trouvées en chemin :

| Racine | Occurrences | Ce qu'elle produisait |
|---|---|---|
| Contrainte de base de données utilisée comme validation | 4 | Un **409 « conflit »** là où la donnée était absente, pas conflictuelle |
| `trim()` / déréférencement avant la garde `null` | 2 | Un **500** sur un champ obligatoire simplement oublié |
| Status HTTP mal choisi pour le client réel | 1 | Un message d'erreur utile **effacé** avant l'écran (404 → 400) |
| OpenAPI divergent du runtime | 4 routes | Contrat publié annonçant 200 pour un 204 — *documentation*, pas exécution |
| Réseau réel accidentel dans un test | 1 | Un test d'isolation qui **partait sur Internet** pour prouver qu'il n'y allait pas |

Les deux dernières lignes ne sont pas des bugs de production : une divergence
de documentation et un défaut de test. Elles sont comptées séparément pour que
le « 6 » reste un chiffre honnête.

Ce que la campagne a réellement apporté n'est pas le ratio : c'est que **quatre
gestes utilisateur ordinaires** — créer une tier list, dater une expérience,
attacher un tag, enregistrer une édition — échouaient avec un message faux ou
une erreur serveur, et qu'aucun des quelque 550 tests existants ne pouvait le
voir, parce qu'ils appelaient les contrôleurs en Java plutôt que par HTTP.

### C3 — Quatre exports frontend morts · **traité**

| Fichier | Export | Sort |
|---|---|---|
| `lib/editionGroups.ts` | `hasMixedEditions` | Supprimé. `resolveEditionView` réexprimait déjà la règle en ligne ; son commentaire, qui renvoyait à la fonction, la formule désormais lui-même |
| `types/entityTypes.ts` | `findEntityTypeByCode` | Supprimé — avec sa javadoc, qui décrivait des usages inexistants |
| `types/entityTypes.ts` | `OWNERSHIP_STATUS_LABELS` | Supprimé, ainsi que sa mention dans l'en-tête du fichier |
| `types/purchaseAnalysis.ts` | `VERDICT_FACTOR_LABELS` | Supprimé — seul le *nombre* de facteurs est affiché, jamais leur détail |

Le cas gênant était le deuxième : un commentaire qui décrit des usages
imaginaires coûte plus cher qu'une fonction morte silencieuse. Il partait avec
la fonction ; l'import d'`EntityTypeDto` devenu orphelin aussi.

*(Les ~35 autres « exports orphelins » détectés sont des faux positifs : des
types composés à l'intérieur de leur propre fichier.)*

### C4 — Le client iOS reste en arrière · **à décider**

Dernier commit le 2026-08-10. Il couvre 8 écrans et ignore entièrement :
Tier Lists, Analyse d'achat, lecture d'annonce, partage, envies d'amélioration.
Son dossier `Wishlist/` n'appelle que `/wishlist/lookup` — il sait dire si une
œuvre est souhaitée, pas en ajouter ni en lister.

**Vérifié depuis** : aucun des endpoints modifiés par les passes de
reconnaissance n'est appelé par iOS. Il consomme `entities`, `entity-types`,
`metadata`, `tags`, `relationships`, `experiences`, `ownerships` et
`insights` — tous inchangés. Le client n'est donc **pas cassé**, seulement en
retrait : envoi de photos, lecture de codes-barres et lecture d'édition
n'existent que côté web.

Ce n'est pas un défaut : rien ne dit que l'iOS doit suivre le web pas à pas.
Mais l'écart grandit à chaque passe, et il vaut mieux le nommer que le
découvrir. À noter pour qui s'y attellera : la chaîne de reconnaissance est
entièrement côté serveur, et le client iOS scanne déjà des codes-barres — le
rapprochement demanderait moins de travail qu'il n'y paraît.

### C6 — Cibles tactiles et un token fantôme · **traité**

Balayage automatisé des 17 routes en 375 px puis 320 px, mesurant pour chacune
le débordement horizontal, la taille des cibles, les noms accessibles, les
étiquettes de champs et les `alt` d'images.

**La base était saine** : aucun débordement, aucun bouton sans nom accessible,
aucun champ sans étiquette, aucune image sans `alt`. Un seul défaut, mais
systématique.

**Les cibles tactiles.** Le dépôt applique 44 px à 41 endroits — c'est sa
convention. Trente-cinq contrôles y dérogeaient, répartis en trois familles :

| Famille | Exemple | Mesure |
|---|---|---|
| Liens-boutons d'en-tête | « Historique », « Voir la série » | 16 à 20 px de haut |
| Boutons-icônes | « Supprimer l'analyse », « Fermer » | 32 × 32 |
| Boutons `min-h-9` / `min-h-10` | « Tout voir », « Chercher » | 36 à 40 px |

Les plus gênants n'étaient pas les plus petits mais les **destructifs** : quatre
suppressions (analyse, édition, prix relevé, type) tenaient dans 32 × 32.

L'interrupteur de thème demandait un autre traitement : son rail fait 26 px, et
l'agrandir lui donnerait l'air d'un bouton. C'est la **zone tactile** qui passe
à 44 px, le rail restant à 26.

**Un token qui n'existait pas.** `text-warningText` était utilisé à quatre
endroits — quatre avertissements rendus en couleur de texte ordinaire. La
palette porte bien une famille `warning`/`warningTint`/`warningInk`, mais pas de
`warningText` : la classe avait été écrite par analogie avec `dangerText`. Aucun
token n'a été ajouté, `--color-warning` tenant déjà AA comme texte sur les trois
fonds des deux thèmes (5,34 à 9,53) — les quatre usages pointent désormais
dessus, comme les seize autres du dépôt.

### C7 — « Évaluer un achat » : 2,2 écrans avant d'avoir rien saisi · **traité**

Signalé à l'usage : l'écran est trop chargé. Mesuré sur un formulaire vierge, en
375 px :

| | Avant | Après |
|---|---|---|
| Hauteur | **2,2 écrans** | **1,3** |
| Contrôles | **25** | **10** |
| Champs de saisie | 10 | 4 |

Le coupable n'était pas la quantité d'information mais le **moment** où elle
s'affiche.

**Le repli existait déjà, mais s'ouvrait après coup.** Les six champs
techniques — plateforme, prix, port, protection, titre, description — se
repliaient *dès qu'une URL avait été lue*. Ce qui ne réglait que la moitié du
problème : sur un formulaire vierge, ils restaient tous ouverts. Or aucun n'est
requis sauf le prix, et tous se remplissent seuls quand un lien est collé — le
parcours prévu. Les garder ouverts au cas où faisait payer à tout le monde le
confort du parcours manuel. Ils sont désormais **fermés d'entrée**, rouverts
d'un tap.

**Le résumé énumérait des absences.** Une fois replié sur un formulaire vide, il
affichait « Annonce sans titre », « Prix non renseigné », « Port non
communiqué » : trois reproches avant que l'utilisateur ait commencé. Il cède la
place à une invitation, et ne reparaît qu'une fois qu'il a quelque chose à
résumer.

**L'état déclaré est replié sur sa valeur.** Six pastilles et une case à cocher
coûtaient 244 px pour un champ dont le défaut convient huit fois sur dix. Le
choix reste **lu** — « État déclaré : Très bon état » — donc vérifiable d'un
coup d'œil : ce n'est pas l'information qui disparaît, seulement les six façons
d'en changer.

**Trois paragraphes explicatifs raccourcis**, dont deux écrits dans les passes
précédentes de cette même session. Une explication utile une fois est du bruit
les cent fois suivantes.

Vérifié : le parcours au lien remplit tout et affiche un vrai résumé, la
détection rend toujours ses cinq tomes, les six champs et les six pastilles
reviennent d'un tap.

### C8 — Aucun bouton ne changeait le curseur · **traité**

Signalé à l'usage — « le cœur dans la barre ne change pas le pointeur ». Le
symptôme désignait un bouton ; la cause les concernait **tous**.

Tailwind v3 posait `cursor: pointer` sur les boutons via son Preflight. La v4 a
aligné le sien sur le défaut du navigateur (`cursor: default`). La montée de
version a donc retiré l'affordance de **tous les `<button>` de
l'application**, en silence, sans rien casser de visible et sans qu'aucun test
puisse le voir. Les liens, eux, tiennent la leur du navigateur : d'où un dépôt
où la moitié des contrôles changeait le curseur et l'autre non — exactement ce
qui rend le défaut difficile à nommer quand on le vit.

La règle est posée une fois dans `index.css`, aux côtés du `button:disabled {
cursor: not-allowed }` qui, lui, avait bien été écrit à la main — preuve que le
sujet avait été pensé, et que seule la gratuité de la v3 avait masqué le trou.

**Vérifié sur les 12 routes** : plus aucun contrôle avec le mauvais curseur.

#### Et le survol disait le contraire de ce qu'il voulait dire

Suggestion faite dans la foulée — « si on changeait la couleur au survol ? ».
Elle touchait un défaut plus profond que l'esthétique.

Le survol global posait `opacity: 0.85`. Or **`disabled` s'écrit `opacity-50`**
dans tout le dépôt : l'application disait « moins opaque » à la fois pour « tu
peux interagir » et pour « tu ne peux pas », et ne les distinguait que par la
*quantité*. Survoler un bouton le faisait pâlir — le geste exact qui doit le
faire avancer. S'y ajoutait un cumul : une centaine de contrôles déclarent déjà
leur propre survol (`hover:bg-rowHover` ×30, `hover:text-textPrimary` ×29), et
l'opacité globale se posait par-dessus, si bien qu'ils changeaient de couleur
**et** pâlissaient.

Le remplaçant est `filter: brightness()`, et le choix mérite d'être expliqué :
toute propriété **unique** finit par écraser celle d'un composant. Un voile en
`background-image` — la première tentative — aurait effacé le dégradé de
l'avatar de profil ; un `box-shadow: inset` aurait effacé les vingt-six
`shadow-token-*` du dépôt. `filter` n'entre en collision avec rien, n'étant
utilisé nulle part ailleurs, et agit sur le rendu entier : un fond plein
s'assombrit, un dégradé s'assombrit sans se défaire, un bouton sans fond voit
son texte foncer.

Le sens s'inverse avec le thème, et `filter` a été ajouté à la liste des
transitions, sans quoi il aurait été le seul changement d'état instantané de
l'application. Vérifié aussi qu'aucun contrôle ne contient de descendant
`position: fixed`, que `filter` aurait recadré.

**Une seconde passe a été nécessaire** : l'effet ne se voyait pas assez. La
mesure a dit pourquoi — sur l'accueil, **seize contrôles sur dix-neuf n'ont
aucun fond**. Ce sont des boutons de barre, des liens d'en-tête, des icônes :
`filter` n'y peint que le texte, déjà presque noir. L'effet marchait sur les
trois boutons pleins et manquait les seize autres.

D'où un second effet : un **fond** au survol, `--color-hoverSurface`, posé en
`@layer base` à dessein.

**Appliqué à tous, il était laid.** Signalé aussitôt : sur le titre
« IozyCore » — un lien de texte nu, sans marge ni rayon — il dessinait un
rectangle collé aux lettres. Ce qui ressemble à un survol sur un bouton
ressemble à une erreur sur un mot. Le fond est donc réservé à ce qui a **déjà
une forme de surface**, via `[class*="rounded"]` : sur les dix-neuf contrôles
de l'accueil, la présence de cette classe prédit exactement celle d'un rayon
calculé, sans exception. Les onze autres — le logo, les cartes, les onglets —
gardent le seul assombrissement, qui porte chez eux sur une vignette ou une
icône, pas sur du texte nu. Les utilitaires
Tailwind vivent dans une couche supérieure et l'emportent, si bien qu'un bouton
plein garde sa couleur ; un bouton sans fond n'a aucun utilitaire à opposer et
reçoit celui-ci. Le tri se fait seul, sans lister qui a un fond et qui n'en a
pas — vérifié dans le CSS **compilé**, la règle atterrissant bien dans `base`,
juste après le Preflight.

*Réserve* : le rendu du survol n'a pas pu être constaté dans cette session — le
panneau navigateur ne composant pas d'images, `:hover` ne se déclenche pas et
les styles calculés y sont inertes (un `filter: brightness(0.5)` posé en inline
y calcule `brightness(1)`). Les deux réglages sont des tokens nommés,
`--color-hoverSurface` et `--hover-brightness`, précisément pour rester
ajustables à l'œil.

**Le reste de la famille est sain**, contrôlé dans la foulée plutôt que
supposé : l'anneau de focus clavier apparaît bien (2 px accent, offset 2 px,
`:focus-visible`), les modales se ferment à Échap et piègent le focus via le
hook partagé `useModalA11y`, les boutons désactivés portent `not-allowed` et
une opacité réduite. Les huit `onClick` posés sur des `<div>` sont tous des
voiles de modale — un motif légitime, doublé du clavier par le hook.

### C9 — Le contraste est bon, et rien ne le gardait · **traité**

Balayage étendu à ce qui n'avait jamais été regardé : **1280 px** (les mises en
page `md:` n'avaient jamais été rendues) et le **thème clair**. Les deux sont
conformes — aucun débordement, aucune cible sous 44 px, aucun mauvais curseur.

Le contraste, lui, se calcule sans navigateur. Résultat sur **116 combinaisons**
(16 couleurs de texte × 3 fonds, les encres posées sur remplissage, les sept
pastilles de rang — le tout dans les deux thèmes) : **aucune sous 4.5:1**. Les
dizaines de commentaires d'`index.css` qui racontent des teintes assombries d'un
cheveu pour passer AA décrivent un travail réel et abouti.

Mais rien ne le gardait. Un token ajouté demain pouvait le défaire en silence —
et c'est déjà arrivé dans l'autre sens : `text-warningText` a été écrit pendant
des mois sans que le token existe (§C6). D'où `npm run check:contrast`, un
script Node **sans aucune dépendance** : le dépôt web n'a pas de lanceur de
tests, et en introduire un pour cette seule vérification aurait été
disproportionné.

Le script porte une connaissance que le CSS ne dit pas : **une couleur est un
texte ou un remplissage**, et le seuil ne se calcule pas pareil. Les
`--color-rank-*` en sont l'exemple — des pastilles sur lesquelles on écrit une
lettre. Les tester comme du texte sur le fond de la page a d'abord produit un
faux positif (`rank-a` à 4,32), corrigé en lisant `TierBadge.tsx`.

**Le contrôle sait échouer**, ce qui a été vérifié plutôt que supposé : une
teinte éclaircie sort en code 1 avec les trois fonds fautifs nommés, un token
renommé sort en code 2.

### C10 — Les dix-sept routes portaient le même titre · **traité**

Constaté en balayant : chaque route affiche un `<h1>` distinct, et **toutes
avaient pour titre de document « IozyCore »**. Trois conséquences, dont une
d'accessibilité :

- l'historique du navigateur devenait illisible — dix entrées identiques ne
  permettent de revenir nulle part ;
- un onglet gardé ouvert ne disait pas sur quoi ;
- **une navigation SPA n'annonce rien** à un lecteur d'écran : la page ne se
  recharge pas, il n'y a donc aucun événement à annoncer. Mettre à jour le
  titre est le remède conventionnel.

Le titre est **dérivé du `h1`** plutôt que déclaré dans une table
« route → libellé ». Ce dépôt s'est déjà fait mordre plusieurs fois par deux
listes qui divergent, et le `h1` *est* le titre de la page au sens sémantique.
Bénéfice inattendu : les routes dynamiques suivent gratuitement — la fiche
d'une série affiche « Naruto · IozyCore » sans qu'aucune table ne connaisse le
catalogue.

Un `MutationObserver` attend le `h1` des pages qui chargent leurs données
d'abord, se débranche dès qu'il l'a trouvé, et abandonne après cinq secondes
plutôt que d'observer indéfiniment.

### C11 — Le partage public tient ses promesses, sauf une phrase · **traité**

La route `/api/public/share/{token}` est **la seule de l'application conçue
pour être ouverte par quelqu'un d'autre que le propriétaire**, et elle n'avait
jamais été vérifiée en marche. Trois garanties annoncées, mesurées une à une.

**Le jeton fait office de mot de passe** — vérifié. Jeton inconnu, UUID nul,
vide, tentative de traversée (`../../api/entities`) : tous rendent un `404` au
message générique « Lien introuvable », sans jamais laisser deviner qu'un jeton
a existé.

**Rien ne sort au-delà du nécessaire** — vérifié. Un élément partagé porte
exactement `title`, `coverImageUrl`, `editions`, `ownedVolumeCount`,
`totalVolumes`. Aucun identifiant, aucun prix, aucune date d'acquisition,
aucune analyse.

**Les sections non partagées ne figurent pas dans la réponse** — *faux*, et
c'est la seule chose à corriger. Le fil porte bien `"tierLists":null`. La
garantie de fond tient (la section n'est pas calculée, aucune donnée ne sort),
mais la phrase promettait une absence que le format ne réalise pas.

Trois écrits se contredisaient : le javadoc du contrôleur disait « ne figurent
pas », le DTO disait « absentes (null) », et le test disait `doesNotExist()`.
Ils disent désormais tous la même chose — `null`, jamais `[]`, parce que la
nuance porte de l'information : `[]` dirait « partagée, mais il n'a rien
dedans », un fait sur la personne, là où `null` dit seulement « tu n'y as pas
accès ».

L'assertion du test a été renforcée en conséquence : `doesNotExist()` est vrai
pour une clé absente **comme** pour une clé à `null`, et ne pouvait donc pas
dire lequel des deux est le contrat. `value(nullValue())` le dit. Vérifié en
faisant volontairement rendre une liste vide : deux tests tombent.

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

## 4 bis. La suite de tests : 948 tests, et où passait le temps

Une suite lente ne se contente pas d'être pénible : on finit par ne plus la
lancer, et c'est là qu'elle cesse de protéger. Voici la mesure et ce qu'elle a
donné.

### La mesure d'abord

| | Classes | Temps cumulé |
|---|---|---|
| Tests unitaires | 77 | **3,3 s** |
| Tests d'intégration | 29 | **341,6 s** |

Tout le temps était d'un seul côté, et **réparti presque uniformément** : à peu
près 13 s par classe d'intégration. Une régularité pareille ne décrit pas du
travail utile — elle décrit un coût fixe payé encore et encore.

### Le coupable : quinze bases pour une suite

Quinze classes déclaraient chacune **leur propre** `PostgreSQLContainer` avec
son propre `@DynamicPropertySource`. Chacune démarrait donc un Postgres et
rejouait Flyway V1→V19.

Mais le vrai coût était ailleurs, et il est contre-intuitif : Spring met les
contextes de test en cache, **et la clé de ce cache inclut les valeurs des
propriétés**. Quinze conteneurs, c'est quinze URLs JDBC, donc quinze clés, donc
**zéro réutilisation**. Un cache présent, configuré, et qui ne servait jamais.

Un socle commun — `PostgresIntegrationTest` — porte désormais le conteneur, le
`@DynamicPropertySource` et `@SpringBootTest`. Résultat : **seules quatre
classes dépassent encore 5 s**, et ce sont exactement les quatre constructions
de contexte restantes (le contexte de base, celui des tests HTTP avec
`MockMvc`, et les deux qui importent des faux providers). Tout le reste est
passé sous la seconde.

### Le coupable suivant : Maven recompilait tout, à chaque fois

Une fois les tests rapides, le plancher est devenu visible : **52 s avant le
moindre test**. La décomposition est sans appel — `mvn -o test-compile` sans
avoir rien modifié prenait **51 s, deux fois de suite**.

En cause, un nom trompeur. `maven.compiler.useIncrementalCompilation` à `true`
— le défaut — ne signifie pas « ne recompiler que ce qui a changé » mais **« si
quelque chose a changé, tout recompiler »**. Et sa détection se trompe
volontiers quand les sources vivent sur un montage lié, ce qui est le cas ici
(projet Windows monté dans un conteneur Maven) : elle concluait toujours au
changement.

À `false`, javac fait la vraie comparaison fichier par fichier : **15 s**, et
15 s à vide. C'est le réglage le plus rentable de cette passe, parce qu'il est
payé à *chaque* invocation.

### Le parallélisme, essayé puis retiré

Les classes ont été exécutées en parallèle un temps (`junit-platform.properties`),
au grain de la **classe** et non de la méthode. Gain mesuré : **12 s**. Modeste,
parce qu'il ne reste plus grand-chose à paralléliser une fois le cache de
contexte réparé.

Il a été **retiré**, pour une raison qui n'était pas prévue : Surefire
mésattribue ses décomptes quand les classes tournent en parallèle. Deux classes
de dix tests étaient rapportées « 19 » et « 1 ». Le total restait juste, et un
échec restait nommé correctement — mais des décomptes par classe faux rendent
tout raisonnement sur la couverture suspect, et ce sont ces chiffres qu'on lit
pour se rassurer.

Douze secondes ne valent pas un rapport auquel on ne peut plus se fier. Les
vrais gains — 260 s sur le cache de contexte, 36 s sur la compilation — ne
dépendaient de toute façon pas de lui.

### Le bilan

| | |
|---|---|
| Suite complète, avant la passe compilation | 142 s |
| Suite complète, après | **~107 s** (95 s avec le parallélisme, retiré depuis) |
| Plancher sans compilation (`-o surefire:test`) | **4 s** |

Le dernier chiffre est celui qui change la façon de travailler : quand les
classes sont déjà compilées, relancer un sous-ensemble de tests coûte quatre
secondes, pas cinquante-deux.

```bash
mvn -o surefire:test -Dtest='ListingTextParserTest'
```

---

## 5. Ce que cet audit n'a pas couvert

- la qualité interne et les tests du client iOS (seule sa surface d'API a été vérifiée) ;
- l'arithmétique du moteur d'analyse d'achat (re-dérivée indépendamment au Lot 36) ;
- le comportement réel des fournisseurs de métadonnées contre leurs API en ligne ;
- la compatibilité navigateur au-delà de celui utilisé pour les vérifications ;
- la performance sous charge réelle : toutes les mesures portent sur un jeu de
  6 séries, 12 tomes, 9 possessions. C'est assez pour révéler un N+1 par
  comptage de requêtes, pas pour conclure sur des temps de réponse.
