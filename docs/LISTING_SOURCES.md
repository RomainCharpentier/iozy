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
| **Photos (toutes)** | données embarquées uniquement | **Moyenne** |

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
  `currencyCode`). Prendre « le premier prix trouvé » donnerait un coût faux ;
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
