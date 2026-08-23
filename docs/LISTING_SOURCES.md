# Sources d'annonces

Comment IozyCore lit une annonce en ligne pour pré-remplir une analyse d'achat.
Une page par source ne serait pas utile : tout tient ici.

---

## 1. À quoi ça sert, et à quoi ça ne sert pas

Coller le lien d'une annonce remplit le **brouillon** d'analyse : titre, prix,
description, photos. Rien de plus.

Le lien **n'entre dans aucun calcul**. Le verdict, la complétude, les doublons,
le prix conseillé et la comparaison marché restent produits par le moteur
existant, à partir de ce que l'utilisateur a validé. Une source ne fait que
faire gagner de la saisie.

Ce n'est **pas** un marketplace, **pas** un crawler, **pas** une surveillance de
prix. Il n'y a ni parcours périodique, ni file d'attente, ni resynchronisation :
une lecture, déclenchée par un utilisateur qui vient de coller ce lien précis.

---

## 2. Architecture

```
URL collée
   ↓
ListingSourceResolver      détecte la source, ou dit qu'aucune ne la couvre
   ↓
ListingProvider            un par plateforme (VintedListingProvider aujourd'hui)
   ↓
ListingUrlGuard            liste blanche, HTTPS, refus des adresses internes
   ↓
ListingHttpFetcher         un GET borné, redirections revalidées une par une
   ↓
ListingSnapshot            forme normalisée, indépendante de la plateforme
```

Ajouter Leboncoin demain = publier un second `ListingProvider`. Spring l'injecte
dans la liste du résolveur ; ni le résolveur, ni le contrôleur, ni le frontend
ne changent. Rien de spécifique à une plateforme ne vit en dehors de son
provider — pas de `if (url.contains("vinted"))` ailleurs.

**Endpoint** : `POST /api/listing-metadata/resolve`, corps `{"url": "..."}`.
Répond **toujours 200** ; c'est le champ `status` qui distingue les issues
(voir §5). Une annonce supprimée ou une plateforme non couverte ne sont pas des
erreurs d'API : ce sont des situations normales que le formulaire doit
présenter sans se bloquer.

---

## 3. Vinted — ce qui est réellement disponible

Constaté le 2026-08-21 sur une page publique `/items/<id>`.

| Donnée | Source | Fiabilité |
|---|---|---|
| Titre | `og:title` | **Haute** — métadonnée publiée pour être lue |
| Description | `og:description` | **Haute** — idem |
| URL canonique | `og:url` | **Haute** — idem |
| Identifiant de l'annonce | données embarquées, sinon l'URL | Haute |
| **Prix** | données embarquées uniquement | **Moyenne** |
| **Frais de port** | données embarquées uniquement | **Moyenne** |
| **Protection acheteur** | données embarquées uniquement | **Moyenne** |
| **Photos (toutes)** | données embarquées uniquement | **Moyenne** |

Les **frais** méritent trois précisions, parce qu'ils entrent directement dans
le coût réel — et donc dans le verdict :

Le montant seul ne suffit pas : c'est **ce qu'il vaut** qui compte, porté par
`ShippingEstimateKind`.

| Nature | Quand | Montant compté ? | Affichage |
|---|---|---|---|
| `FREE` | `isFreeShipping` | oui, zéro — un vrai zéro | « offerte » |
| `EXACT` | un montant, un seul mode | oui, ferme autant qu'on puisse l'affirmer | « 2,83 € » |
| `FROM` | `areMultipleShippingOptionsAvailable` | oui, mais **plancher** : le réel dépend du point relais | « à partir de 2,83 € » |
| `ESTIMATED` | saisie de l'utilisateur, ou montant reçu sans nature | oui, sans garantie | « 5,90 € estimés » |
| `UNKNOWN` | rien de lisible **et** aucun montant | **non** — surtout pas zéro | « non communiquée » |

Un **zéro sans nature** vaut `UNKNOWN`, pas `ESTIMATED` : il ne se distingue pas
d'un champ laissé vide, et le lire « 0,00 € estimés » affirmerait une livraison
gratuite que personne n'a constatée — une livraison réellement offerte arrive
avec `FREE`. Ce cas concerne surtout la relecture des analyses antérieures à
cette nature, dont le port valait zéro par défaut.

`ESTIMATED` existe pour une raison précise : sans lui, un port saisi à la main
tombait dans `UNKNOWN`, donc l'écran annonçait « livraison non communiquée »
juste après que l'utilisateur venait de la communiquer — tout en comptant le
montant dans le coût. Deux situations différentes portaient le même nom :
*aucun montant connu* et *montant connu mais non garanti*.

D'où l'invariant, tenu dans le constructeur compact de `Listing` : **un
`UNKNOWN` ne porte jamais de montant entrant dans un calcul**. Un montant reçu
avec une nature absente devient `ESTIMATED` (jamais `EXACT` : personne n'a
affirmé que ce tarif serait facturé), et une nature `UNKNOWN` accompagnée d'un
montant est corrigée en `ESTIMATED` — ce qui répare aussi, à la relecture, les
analyses enregistrées avant que ce cas ait un nom. Un snapshot de source ne
porte jamais `ESTIMATED` : celui-là qualifie une saisie, pas une lecture.

- une livraison annoncée gratuite vaut **zéro**, pas « inconnu » — la
  distinction évite de faire ressaisir un montant déjà donné ;
- la protection acheteur est lue sur `finalPrice`, **jamais** `originalPrice` :
  une remise peut s'appliquer, et c'est le montant facturé qui compte.

Sans eux, le formulaire partait de 0 € de frais : sur une annonce à 10 €, le
total affiché était 10 € au lieu de 14,03 €, soit **40 % sous la réalité** — et
tout verdict s'en trouvait trop favorable.

#### Trois grandeurs, jamais confondues

| Notion | Ce que c'est | À quoi elle sert |
|---|---|---|
| **Prix de l'annonce** | l'article seul, hors frais | se compare au **marché** |
| **Coût d'acquisition estimé** | article + protection + livraison | se compare à **ce que ça t'apporte** |
| **Référence marché** | prix demandés relevés, hors frais | sert de repère au premier |

Le piège évité : les prix d'annonces comparables sont **hors frais**. Comparer
14,03 € frais compris à une médiane de 12 € hors frais déclarerait « cher » une
annonce qui ne l'est pas — deux grandeurs différentes. Le positionnement marché
porte donc sur le **prix de l'article**, tandis que le coût par élément utile
porte sur le **coût d'acquisition**. `PriceSemanticsTest` verrouille cette
séparation : les deux bases y produisent volontairement des verdicts opposés.

Et **« minimum » n'est pas « réel »**, ni « partiel » n'est « complet ». Le
total change de nom selon ce que vaut la livraison :

| Nature de la livraison | Nom du total | Coûts par élément |
|---|---|---|
| `FREE` / `EXACT` / `ESTIMATED` | Coût d'acquisition estimé | tels quels |
| `FROM` | **Coût minimum estimé** | « au moins X € / élément » |
| `UNKNOWN` | **Sous-total connu** + « livraison non incluse » | signalés comme sous-évalués |

Jamais « coût réel » : aucun de ces montants n'est facturé. La sémantique est
figée avec l'analyse — un « à partir de » ou un « estimé » enregistré
aujourd'hui se relit à l'identique demain, et ne devient jamais rétroactivement
un tarif ferme.

Deux couches, traitées différemment :

1. **OpenGraph** est un contrat : Vinted publie ces balises pour que d'autres
   les lisent (aperçus de partage). C'est la source principale.
2. Le **prix** et la **liste des photos** ne figurent dans aucune donnée
   structurée publiée — ni JSON-LD, ni microdonnées, vérifié. Ils ne vivent que
   dans le contenu embarqué par le rendu de la page, qui est un détail
   d'implémentation susceptible de changer au prochain déploiement de Vinted.
   Ils sont donc lus **au mieux**, chaque extraction isolée : leur perte dégrade
   le résultat en `PARTIAL`, elle ne le fait pas échouer.

Deux précautions concrètes dans `VintedPageParser` :

- le prix de l'article se distingue des frais de port et de la protection
  acheteur par la casse de sa clé de devise (`currency_code` contre
  `currencyCode`). Prendre « le premier prix trouvé » donnerait un coût faux.
  Les frais, eux, sont discriminés par leur bloc parent (`shippingDetails`,
  `buyerProtection`) — trois montants voisins dans la même page, jamais
  confondus ;
- les photos de l'annonce sont isolées du tableau qui porte `is_main`, puis
  parsées en JSON. La page contient aussi l'avatar du vendeur et les vignettes
  d'articles similaires : ramasser toutes les images en ferait entrer.

### Ce que Vinted empêche, et qu'on ne contourne pas

L'API interne du site exige une session et des jetons. L'utiliser supposerait
de reproduire un mécanisme d'authentification : **ce n'est pas fait et ne doit
pas l'être**. Aucune connexion, aucun cookie de compte, aucune usurpation de
navigateur, aucun contournement de protection anti-robot.

La requête annonce honnêtement `IozyCore/1.0` et ne part que sur action de
l'utilisateur. Le `robots.txt` de Vinted n'interdit pas `/items` aux agents
génériques. Si Vinted décide un jour de bloquer ces lectures, la réponse est
`UNAVAILABLE` et le formulaire manuel — qui n'a jamais cessé d'exister.

### Ce qui n'est pas récupéré, volontairement

Rien sur le vendeur : pseudo, avatar, localisation. Ces données n'entrent dans
aucun calcul de verdict. Les lire et les conserver serait collecter des données
personnelles sans contrepartie produit.

---

## 4. Sécurité de l'URL (SSRF)

Le backend va chercher une URL **saisie par quelqu'un d'autre**. Sans garde-fou,
ce serait un proxy ouvert vers tout ce que le serveur atteint et que l'extérieur
n'atteint pas : `localhost`, le réseau Docker, la base, ou l'endpoint de
métadonnées d'un hébergeur cloud (`169.254.169.254`) qui délivre des
identifiants.

Il n'existe **aucun endpoint de récupération d'URL arbitraire**. Le serveur ne
va chercher que ce qu'un provider déclaré reconnaît :

- **liste blanche d'hôtes exacts**, propre à chaque provider — jamais un motif
  du type « contient vinted », qui accepterait `vinted.fr.attaquant.example` ;
- **HTTPS uniquement** — ni `file://`, ni `ftp://`, ni HTTP en clair ;
- **refus des adresses internes** après résolution DNS (loopback, privées,
  lien-local, multicast). La liste blanche dit « ce nom est attendu », la
  résolution dit « et il ne mène pas chez nous » : il faut les deux, sans quoi
  un DNS détourné suffirait ;
- **redirections suivies à la main**, 4 sauts au maximum, **chacun revalidé** —
  laisser le client HTTP les suivre seul rouvrirait la faille ;
- **délais** : 5 s pour la connexion, 12 s pour la requête ;
- **taille plafonnée** à 4 Mo, en coupant la lecture, pas en mesurant après ;
- **`Content-Type` vérifié** : une page d'annonce est du HTML ;
- **12 photos au maximum** par annonce.

Un hôte qui ne résout pas est traité comme suspect, pas comme inoffensif.

---

## 5. Issues possibles

| `status` | Ce que ça veut dire | Ce que fait le formulaire |
|---|---|---|
| `SUCCESS` | Tout ce que la source sait livrer a été lu | Pré-remplit |
| `PARTIAL` | Une partie seulement | Pré-remplit ce qui existe, dit ce qui manque |
| `UNSUPPORTED_SOURCE` | Aucune source ne couvre cette URL | Saisie manuelle, **lien conservé** |
| `LISTING_NOT_FOUND` | Annonce supprimée ou inexistante | Saisie manuelle |
| `UNAVAILABLE` | Blocage, panne, page illisible | Saisie manuelle |
| `INVALID_URL` | Lien inexploitable | Dit en local, sans appel serveur |

**Un résultat partiel est un succès.** Titre et prix lus mais photos illisibles :
c'est de la saisie en moins, pas une erreur. Aucun de ces cas ne bloque le
parcours — la saisie manuelle est le chemin normal, pas un repli dégradé.

---

## 6. Trois règles qui ne se négocient pas

1. **Rien n'est inventé.** Un champ que la source ne donne pas reste vide. Pas
   de valeur par défaut, pas d'estimation, pas de donnée de démonstration —
   `retrievedFields` dit ce qui a réellement été lu, et le client ne remplit que
   ça. Un prix supposé fausserait un verdict d'achat.
2. **Rien n'est écrasé.** Une valeur déjà saisie par l'utilisateur est
   conservée ; si l'annonce dit autre chose, l'écart est affiché. Jamais de
   conflit invisible.
3. **Un snapshot ne bouge plus.** Une analyse enregistrée fige ce que l'annonce
   disait à l'instant de la lecture. Si le vendeur change son prix ou retire
   l'annonce, l'analyse reste telle quelle et reste consultable. Aucune
   resynchronisation n'existe, et une éventuelle action « réactualiser » devra
   produire un nouvel état plutôt que réécrire l'historique.

---

## 7. Limite connue : les photos ne nourrissent aucune reconnaissance

Les photos de l'annonce sont récupérées, affichées, retirables une à une, et
conservées avec l'analyse. Elles **ne sont pas analysées** — pour une raison
technique simple : **IozyCore n'a pas de moteur de reconnaissance d'images**.

Constaté à l'audit : `Listing.photoUrls` existait déjà en base et dans l'API,
mais aucun code ne le lisait et le frontend ne l'envoyait même pas. Les deux
usages de Gemini (suggestion d'édition, estimation de prix) sont **textuels** et
ne reçoivent aucune image.

Identifier des tomes sur une photo demanderait un moteur multimodal complet,
avec sa déduplication entre photos d'un même lot et sa validation par
l'utilisateur : c'est une fonctionnalité à part entière, pas un branchement. Le
contenu du lot reste donc déclaré à la main, comme avant.

Ce qui est prêt pour ce jour-là : les photos arrivent jusqu'au brouillon, sont
transmises à l'analyse et persistées avec elle. Il n'y aura qu'un consommateur à
brancher.

---

## 8. Évaluer l'annonce : trois dimensions, jamais un score

Lire l'annonce ne suffit pas — encore faut-il en dire quelque chose d'utile.
L'évaluation répond à **trois questions distinctes**, et refuse de les fondre.

| Dimension | Question | Classe |
|---|---|---|
| Intérêt collection | « qu'est-ce que ça m'apporte ? » | `CollectionFit` |
| Prix | « ce prix se tient-il ? » | `PricePosition` + `DealAssessmentPolicy` |
| Vigilance | « cette annonce est-elle nette ? » | `ListingTrustAssessment` |

Puis `ListingAssessment` en tire une synthèse — sans effacer les trois.

**Pourquoi les garder séparées.** Un lot bradé mais entièrement en doublon est
un mauvais achat à bon prix. Un lot cher qui comble exactement les trous peut
valoir la dépense. Un seul chiffre écraserait ces deux cas l'un sur l'autre,
précisément là où il faut voir clair.

### Le chiffre qui décide

Un comparateur sait dire « 18 % sous la médiane ». Aucun ne sait dire « tu en
as déjà quatre ». Un lot de 14 tomes à 70 € affiche 5 € le tome ; si 4 sont des
doublons, il coûte **7 € le tome qui sert**. C'est
`pricePerUsefulItem` — la métrique différenciante d'IozyCore.

Quand tout est déjà possédé, ce prix **n'existe pas** et n'est pas affiché :
« 0 € le tome utile » ferait passer un lot inutile pour une aubaine.

### Référence marché : quand deux offres sont le même produit

Elle est construite à partir des **prix relevés dans IozyCore**
(`MarketPriceObservation`), pas d'une recherche externe de comparables : Vinted
n'expose pas de recherche publique automatisable sans passer par son API privée
(exclu, voir §3).

#### Une seule source produit une référence

Les prix relevés, et rien d'autre. Une **estimation IA** et un **prix neuf
catalogue** restent utiles ailleurs — coût pour compléter, négociation, verdict
global — mais aucune des deux ne devient « le marché ». Les afficher comme
référence donnerait à une supposition l'autorité d'un constat : c'est
exactement ce qui se produisait, une estimation de modèle de langage pouvant
sortir en `referenceConfidence: HIGH` sur zéro observation réelle.

`MarketReferenceSource` : `OBSERVED_COMPARABLES`, `NONE`, ou `NOT_RECORDED`
pour une analyse antérieure à cet enregistrement.

#### Les règles d'appariement (`MarketComparableSelector`)

| # | Règle | Pourquoi |
|---|---|---|
| 1 | **Même édition** (donc même série) | un relevé se rattache à une `MangaEdition` ; une Perfect ne compare pas avec une Standard |
| 2 | **Même forme** (`LotShape`) | tome seul / lot partiel / intégrale sont trois produits, pas trois tailles |
| 3 | **Taille voisine** pour les lots partiels : rapport ≤ 2 | un lot de 10 éclaire un lot de 14 ; un lot de 4, non |
| 4 | **Moins de 24 mois** | au-delà, le relevé décrit un autre marché |

`LotShape` se déduit du nombre de tomes et du total de l'édition :
`SINGLE_VOLUME` (1), `COMPLETE_SET` (couvre l'édition), `PARTIAL_LOT` (le
reste), `INDETERMINATE` (un relevé « sur l'édition entière » quand le total est
inconnu — écarté, jamais deviné).

**Pas** des règles, délibérément : l'**état** et la **plateforme** n'écartent
aucun comparable. Ce sont des modificateurs de prix, pas des différences de
produit, et filtrer dessus viderait des échantillons déjà petits. La dispersion
qui en résulte est mesurée et fait baisser la confiance — la réserve est dite
plutôt que le relevé jeté.

#### Les niveaux (`MarketReferenceConfidence`)

Le point de départ est l'échantillon ; chaque réserve fait descendre d'un cran.

| Niveau | Quand | Positionne un prix ? |
|---|---|---|
| `HIGH` | ≥ 3 comparables, resserrés, récents | oui |
| `MEDIUM` | 2 comparables, ou une réserve sur un échantillon solide | oui |
| `LOW` | 1 seul comparable, ou dispersion > 60 %, ou tous vieux de plus d'un an | **non** |
| `UNAVAILABLE` | aucun comparable retenu | **non** |

Dégradations cumulatives : dispersion forte (−1), tous les comparables au-delà
de 12 mois (−1), total de tomes de l'édition inconnu (plafond `MEDIUM`, car on
ne peut alors pas affirmer qu'un lot n'est pas une intégrale). Un lot
multi-séries ne dépasse jamais `MEDIUM`, et devient `UNAVAILABLE` dès qu'une
seule série manque — additionner ce qu'on connaît en ignorant le reste donnerait
un lot systématiquement « trop cher ».

Sous `MEDIUM`, `referencePrice` et `deviationPercent` sortent à `null` : un
chiffre affiché est un chiffre auquel on croit. Le signal de vigilance « prix
nettement en dessous de la référence » ne se déclenche pas non plus — accuser
une annonce sur la foi d'un repère qu'on refuse par ailleurs d'utiliser serait
deux poids, deux mesures.

#### Dire ce qui manque, pas seulement qu'on ne sait pas

`ReferenceGap` nomme l'absence pour que l'écran conseille : `NO_OBSERVATION`,
`NO_COMPARABLE_SHAPE` (des relevés existent, aucun sur un produit comparable),
`ONLY_STALE_OBSERVATIONS`, `EDITION_NOT_IN_CATALOGUE`,
`INCOMPLETE_LOT_COVERAGE`. `referenceSampleSize` et `examinedCount` permettent
de distinguer « aucune donnée » de « 3 relevés, aucun comparable ».

#### Le cas de référence

*Platinum End 1-14* (intégrale, 14 tomes) face à un T.1 à 8 €, un lot 1-4 à
20 € et un lot 7-10 à 18 €. L'ancien calcul les ramenait à 8,00 / 5,00 / 4,50 €
le tome, en tirait une médiane de 5,00 € et une confiance `HIGH` (trois
relevés), soit une référence de **70 €** présentée comme solide. Désormais : le
T.1 sort par la forme, les deux lots de 4 par la taille, et le résultat est
`UNAVAILABLE` / `NO_COMPARABLE_SHAPE`. Verrouillé par `MarketReferenceTest`.

**Ce sont des prix demandés et relevés, jamais des transactions conclues.**
IozyCore n'a aucune donnée de vente réelle, et l'interface le rappelle.

### D'où viennent les prix relevés

Une référence saine mais toujours `UNAVAILABLE` n'aide personne. Les relevés ne
pouvaient jusqu'ici naître que d'une saisie manuelle depuis la fiche d'une
édition — un geste délibéré, rarement fait. L'usage normal de l'application les
nourrit désormais aussi.

#### Ce qui devient un relevé, et quand

**Une annonce réellement analysée**, au moment où l'analyse est enregistrée —
pas quand l'URL est collée. À ce stade l'utilisateur a corrigé la série, choisi
l'édition et validé la composition : le relevé porte sur un produit confirmé
plutôt que sur un brouillon.

Le prix enregistré est **celui de l'annonce, hors frais**. Protection acheteur
et livraison relèvent du coût d'acquisition de l'acheteur, pas de ce que vaut
le produit : `10 €` sur une annonce à `14,03 €` frais compris.

Quatre refus, tous silencieux — mieux vaut `NO_OBSERVATION` qu'un relevé mal
rattaché :

| Cas | Pourquoi rien n'est créé |
|---|---|
| Lot multi-séries | le prix couvre l'ensemble ; le répartir au prorata fabriquerait un prix que personne n'a demandé |
| Édition non identifiée | « Lot manga divers » ne se rattache à aucun produit |
| Composition inconnue | sans nombre de tomes, la forme du lot est indéterminable, donc le relevé incomparable |
| Prix nul | rien à observer |

Et deux interdits absolus : une **estimation IA** et un **prix neuf catalogue**
ne deviennent jamais un relevé de marché. Le premier est une supposition, le
second décrit un autre marché. Tous deux gardent leurs usages ailleurs — coût
pour compléter, négociation, verdict global — sans jamais grossir l'échantillon.

#### Provenance

`MarketObservationOrigin` : `MANUAL_ENTRY` ou `LISTING_ANALYSIS`. Les deux
valent autant comme comparables — ce sont des prix vus. La distinction sert à
savoir ce qu'on regarde quand un chiffre surprend, pas à hiérarchiser. La
colonne `source` existait depuis V4, écrite en dur et jamais relue : V18 la
renomme `origin` et lui donne enfin un sens.

S'y ajoutent `volume_count` (fait autorité sur la plage : un lot 1-4 + 7-10
compte 8 tomes, pas 10), `listing_identity` et `source_url`.

#### Identité d'une annonce, et déduplication

`ListingIdentity`, par ordre de préférence :

1. l'**identifiant de la source** — sur Vinted, lu dans la page, indépendant du
   slug : deux liens vers la même annonce donnent le même identifiant ;
2. sinon l'**URL normalisée** — hôte en minuscules, sans `www.`, sans
   paramètres de suivi, sans ancre ni barre finale ;
3. sinon **rien**. Une saisie manuelle n'a pas d'annonce derrière elle : chaque
   relevé compte alors pour un comparable, ce qui est le sens même d'un relevé
   saisi à la main. Aucune déduplication forte n'est possible dans ce cas, et
   c'est assumé.

À l'écriture : si le dernier relevé connu de cette annonce affichait **déjà ce
prix**, rien n'est écrit — il ne s'est rien passé sur le marché. Un prix
**différent** crée une ligne : une annonce passée de 70 à 60 € dit quelque
chose.

#### Un échantillon compte des vendeurs, pas des lignes

C'est le point qui rend l'ingestion sûre. À la lecture, les relevés comparables
sont **regroupés par identité d'annonce**, et seul le plus récent est retenu :
il décrit l'état actuel de cette offre.

| | Lignes en base | `temporalCount` | `sampleSize` |
|---|---|---|---|
| Une annonce suivie 5 fois | 5 | 5 | **1** |
| Trois annonces distinctes | 3 | 3 | **3** |
| A suivie 3 fois + B | 4 | 4 | **2** |

`sampleSize` est donc le nombre d'**offres indépendantes**, et c'est lui qui
détermine la confiance. Recharger une page ne fera jamais monter une référence
à `HIGH`.

#### Une annonce ne se compare pas à elle-même

L'identité est établie **avant** le calcul et les relevés qui en proviennent
sont écartés de sa propre référence. Sans quoi, dès la deuxième analyse d'une
URL, la référence vaudrait le prix demandé et toute annonce se dirait « au prix
du marché » — le sien. Quand c'était le seul comparable, l'absence est nommée
`ONLY_CURRENT_LISTING` : il manque une **autre** offre, pas un relevé de plus
sur celle-là.

#### Historique non migré

Les analyses déjà enregistrées ne sont **pas** converties en relevés. Certaines
s'appuyaient sur une estimation IA, d'autres sur des références aujourd'hui
invalides. Seuls les nouveaux flux alimentent le journal.

Leur **affichage**, en revanche, ne ment plus. Une analyse dont la référence n'a
pas `OBSERVED_COMPARABLES` pour source — le cas de toutes celles antérieures à
ces règles — n'affiche plus « Référence X € · confiance bonne » mais
« Estimation utilisée lors de cette analyse : X € … ce n'est pas un prix de
marché observé ». Le verdict enregistré reste celui rendu ce jour-là : on
corrige la façon de présenter la donnée, jamais la donnée ni le verdict.

#### Compter des annonces, pas des lignes — partout

`MarketPrice.observationCount`, affiché dans le détail par série, est un compte
de **relevés** : il alimente le coût pour compléter et ne passe pas par le
regroupement par annonce. Il se lit donc « Prix observé sur N relevés ». Le
nombre d'**annonces** indépendantes est celui de la section Prix
(`referenceSampleSize`), et lui seul. Dans « Éditions de référence », les
relevés d'une même annonce suivie dans le temps portent la mention « même
annonce » pour qu'ils ne se lisent pas comme plusieurs vendeurs.

#### Ce que la négociation utilise

Le moteur de négociation ne s'appuie **pas** sur `MarketReference` mais sur la
*juste valeur* par série (`MarketPrice`), qui peut venir d'un prix observé,
d'une estimation IA ou du prix neuf catalogue. Une offre chiffrée peut donc
apparaître alors que la référence marché est `LOW` ou `UNAVAILABLE` : ce sont
deux bases distinctes. La base employée est affichée sans ambiguïté dans le
détail par série — « Prix observé sur N relevés », « Estimation IA — non
vérifiée », « Estimation théorique » — et le texte de recommandation parle de
« valeur estimée », jamais de prix de marché.

### Points de vigilance : des signaux, pas un verdict

Détection déterministe et testable : photos absentes ou trop peu nombreuses,
description trop courte, mentions de paiement ou de contact hors plateforme
(PayPal, virement, WhatsApp, Telegram…), prix très inférieur à la référence.

Quatre paliers nommés — `NO_OBVIOUS_SIGNAL`, `A_FEW_THINGS_TO_CHECK`,
`EXAMINE_CAREFULLY`, `CONCERNING` — et **aucune note sur 100**. Un
« confiance : 94/100 » suggérerait une probabilité mesurée ; IozyCore ne voit
qu'un texte, un prix et des photos.

Deux règles explicites :

- **beaucoup de photos ne donne aucun bonus.** Transformer l'abondance en gage
  de sérieux serait le raccourci qu'un vendeur malintentionné exploite ;
- **un prix très bas n'est pas une arnaque.** Il apparaît en vigilance *et*
  reste un très bon prix côté prix. Une excellente affaire existe réellement.

Rien n'est lu sur le vendeur (note, ancienneté, ventes) : ces données exigent
une session authentifiée.

### Identifier le contenu depuis le texte

`ListingTextParser` lit « tomes 1 à 14 », « 1-14 », « tomes 1,2,3,5 »,
« tome 7 ». Règles écrites, pas un modèle.

Il refuse plus souvent qu'il ne devine :

- « lot manga divers 25 pièces » → **rien** (« 25 » est un nombre de pièces) ;
- « intégrale complète » sans bornes → signalé, mais **aucun tome fabriqué** ;
- une plage reconnue mais absurde (« 1 à 900 ») ou inversée → **rien**, sans
  retomber sur une heuristique plus faible ;
- des nombres isolés (année, prix) → jamais des tomes.

Le résultat est une **proposition à confirmer**, jamais une vérité.

### Photos : toujours pas de reconnaissance

Inchangé (§7) : les photos sont récupérées, affichées et conservées comme
**références externes**, jamais analysées — IozyCore n'a pas de moteur de
vision. L'interface dit « photos récupérées », jamais « photos analysées ».

### Indépendant de Vinted

Toute cette évaluation travaille sur des nombres et du texte. Une annonce
saisie entièrement à la main produit exactement la même analyse — la source ne
fait que faire gagner de la saisie.
