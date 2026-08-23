# Reconnaissance visuelle — V1

Identifier les œuvres présentes sur des photos, pour aider à remplir une
analyse d'achat sans tout saisir à la main.

Premier usage : une annonce Vinted dont les photos ont déjà été récupérées.
Le moteur est volontairement **générique** — la même mécanique servira une
photo de bibliothèque, un lot acheté ailleurs ou un import de collection.

---

## 1. L'état de départ : `IMAGE → RECOGNITION = BLOCKED`

Constat vérifié avant d'écrire la moindre ligne, et bloqué pour **quatre
raisons indépendantes** — aucune n'était un simple manque de câblage.

| # | Barrière | Preuve |
|---|---|---|
| 1 | **Aucun octet d'image n'atteignait le backend** | Le scan de code-barres est **entièrement navigateur** : `CameraBarcodeScanner.tsx` utilise `window.BarcodeDetector` sur le flux caméra, et n'envoie au serveur que la chaîne EAN décodée. Aucun endpoint d'upload, aucun téléchargement d'image |
| 2 | **Aucune dépendance capable de lire une image** | `backend/pom.xml` : ni ZXing, ni Tesseract, ni OpenCV, ni ONNX, ni DJL. Sept dépendances au total, toutes Spring/JDBC |
| 3 | **L'enveloppe Gemini était texte seul** | `GeminiRequests.send()` construisait `contents:[{parts:[{text: prompt}]}]`. Pas de `inline_data`, donc aucun moyen de joindre une image |
| 4 | **Le CDN d'images n'était sur aucune liste blanche** | `VintedListingProvider.allowedHosts()` couvre les domaines de **pages** (`vinted.fr`…). Les photos vivent sur `imagesN.vinted.net`, que `ListingUrlGuard` aurait refusé |

Ce que les photos servaient jusqu'ici : **leur nombre, et rien d'autre**.
`PurchaseAnalysisEngine` lit `listing.photoUrls().size()` pour signaler
« aucune photo » ou « très peu de photos pour un lot ». Elles n'étaient jamais
ouvertes.

### Une trouvaille d'audit : `ListingTextParser` n'est pas branché

`ListingTextParser` — 217 lignes, une vingtaine de tests, un modèle
`Detection` avec `needsConfirmation()` — n'est **appelé par aucun code de
production**. Seuls une Javadoc (`Listing.java`) et ses propres tests le
citent. Vérifié par recherche sur `backend/src/main`, `web/src` et `ios`.

C'est la brique « deviner le contenu d'un lot depuis son texte, puis faire
confirmer » : déjà écrite, déjà testée, jamais reliée au parcours.

**Délibérément non intégré dans ce lot.** Le brancher parce qu'on l'a croisé
en chemin gonflerait un commit déjà large, et mélangerait deux sujets qui
méritent chacun leur validation.

#### Suivi : combiner reconnaissance déterministe et reconnaissance visuelle

Les deux sources répondent à la même question — « que contient ce lot ? » — par
des moyens opposés : l'une lit des règles écrites dans un texte, l'autre
interprète des pixels. Elles ne se trompent pas aux mêmes endroits, ce qui est
exactement ce qui rend leur combinaison intéressante.

```
titre + description ──> ListingTextParser ──┐
                                            ├──> consolidation commune
photos ──────────────> ImageRecognitionService ──┘
                                            ↓
                                  confirmation utilisateur
```

Points à trancher le jour où ce lot sera ouvert :

- **qui l'emporte en cas de désaccord** ? Le texte annonce « tomes 1 à 14 », les
  photos n'en montrent que neuf. Le texte est déclaratif (donc parfois faux ou
  optimiste), les photos sont factuelles mais partielles — aucune des deux
  n'est autorité ;
- **la consolidation actuelle regroupe par série + tome** ; elle accepterait des
  candidats venus du texte sans modification, à condition que ceux-ci portent
  une confiance et une provenance ;
- **l'évidence devra dire d'où vient chaque proposition** (« annoncé dans le
  titre » vs « lu sur la photo 2 »), sans quoi l'utilisateur ne peut pas
  arbitrer un désaccord.

---

## 2. Local ou cloud : l'arbitrage

IozyCore est auto-hébergé sur un NAS Synology et doit le rester. Quatre
options examinées avant de choisir.

| | Qualité sur couvertures/tranches manga | CPU / RAM | GPU | Temps/image | Docker | Confidentialité | Coût |
|---|---|---|---|---|---|---|---|
| **A. Local léger** (ZXing, OCR Tesseract) | **Faible.** Un code-barres est au dos, rarement lisible sur une photo de lot ; l'OCR bute sur les typographies stylisées des couvertures | Négligeable | Non | ~50 ms | +1 jar (ZXing) ou +50 Mo natif (Tesseract) | Parfaite | 0 |
| **B. Modèle vision local** (Qwen2-VL, LLaVA) | Bonne | **8–16 Go de RAM** | En pratique oui | Dizaines de secondes à plusieurs minutes sur CPU de NAS | +plusieurs Go | Parfaite | 0 |
| **C. Cloud** (Gemini Flash multimodal) | **Bonne** : lit titres et numéros de tome sur des tranches | Négligeable | Non | ~3–10 s pour 3–8 photos | Rien | **Les images sortent de la machine** | Palier gratuit |
| **D. Hybride** | Le meilleur des deux quand un code-barres est lisible | = C | Non | = C | = A + C | = C | = C |

### Décision : **HYBRIDE** — vision cloud, identification déterministe

Le mot demande une précision, parce qu'il serait facile d'en faire un compliment
vague. Le pipeline enchaîne trois étages de natures différentes :

| Étage | Nature | Implémentation V1 |
|---|---|---|
| **Lire** les pixels → du texte | **Cloud** | Gemini Flash multimodal, seule implémentation |
| **Identifier** ce texte → une œuvre du catalogue | **Déterministe, local** | `SeriesMatcher` (comparaison exacte insensible à la casse), `MangaEditionRepository` — aucun modèle, aucun réseau |
| **Trancher** | **Humain** | Confirmation obligatoire, rien ne s'écrit sans elle |

C'est ce qui rend l'ensemble hybride : **le moteur ne décide jamais ce qu'est
une œuvre**. Il propose du texte ; c'est du code déterministe qui dit
« cette série existe », « cette édition correspond », « celle-ci est à
confirmer », « celle-là est absente du catalogue ». Un modèle qui écrirait
« Platinum end » ne crée pas de doublon, parce que l'étage d'identification ne
lui demande pas son avis.

**Ce qui n'est pas encore hybride, et qu'il faut dire.** L'étage de *lecture*
n'a **qu'une** implémentation, et elle est cloud. La règle de priorité
déterministe existe et est testée — un élément porteur d'un EAN passe devant
une lecture visuelle, quelle que soit la confiance de celle-ci — mais **aucun
producteur indépendant d'EAN n'est branché** : aujourd'hui, seul le moteur
vision peut remplir ce champ en lisant les chiffres. Le jour où un décodeur
local lit les codes-barres depuis les pixels, il alimente ce même champ et la
priorité joue déjà.

### Le choix du provider de lecture : cloud, derrière une interface remplaçable

**B est éliminé par le matériel.** Un modèle vision utile demande une machine
que ce projet n'a pas ; le faire tourner sur le CPU d'un NAS rendrait la
fonctionnalité inutilisable (minutes par photo) tout en occupant la mémoire
dont Postgres a besoin.

**A ne résout pas le problème posé.** L'usage cible est une photo de lot :
piles de tomes vus de tranche, couvertures en biais, résolution moyenne. Les
codes-barres y sont presque toujours invisibles. Ajouter ZXing pour cet usage
serait une dépendance de façade, avec un taux de réussite proche de zéro sur
les entrées réelles.

**C est retenu pour l'étage de lecture** parce que c'est la seule option qui lit réellement
« Platinum End » et « 04 » sur une tranche, et parce que la plomberie existait
déjà à 80 % (`GeminiRequests` : authentification, mode réponse JSON, gestion
d'erreur). Il a fallu lui ajouter les `inline_data` et un délai adapté.

**D est préparé, pas construit** — voir la réserve ci-dessus. Écrire le
décodeur aujourd'hui serait construire l'orchestration avant d'avoir le
composant qui la justifie.

### Le domaine ne dépend pas de Gemini

`ImageRecognitionService`, `RecognitionConsolidator`, `RecognitionCatalogResolver`
et `ImageRecognitionController` ne connaissent que `ImageRecognitionProvider`.
Le nom « Gemini » n'apparaît **que** dans
`recognition/gemini/GeminiVisionRecognitionProvider`. Remplacer le moteur par
un modèle auto-hébergé revient à ajouter une classe et changer un bean —
aucun appelant, aucun test de domaine, aucun contrat HTTP ne bouge.

Et **sans aucun moteur**, IozyCore fonctionne : `NO_ENGINE`, message explicite,
saisie manuelle entière. L'analyse d'achat n'a aucune dépendance dure à
Gemini.

### La contrepartie, dite clairement

**Les images sont envoyées à Google.** C'est la raison pour laquelle :

- rien n'est déclenché automatiquement — l'utilisateur clique
  « Analyser les photos » ;
- le nombre d'images est plafonné à **8** ;
- aucun octet d'image n'apparaît dans les journaux, nulle part ;
- rien n'est archivé : les octets vivent en mémoire le temps de l'appel.

### Coût et bornes du provider Gemini

| | |
|---|---|
| Modèle | `gemini-3.5-flash` par défaut (`GeminiRequests.DEFAULT_MODEL`), surchargeable par `GEMINI_MODEL` |
| Appels par analyse | **1**, quelles que soient les photos — toutes partent dans la même requête |
| Photos par analyse | **8 au maximum** ; au-delà, la requête est refusée en 400, jamais tronquée en silence |
| Taille envoyée | 3 Mo par photo, **12 Mo cumulés**. Mesuré sur le smoke test : 3 tranches synthétiques = **34 Ko** ; des photos d'annonce réelles tiennent typiquement en quelques centaines de Ko |
| Délai | 45 s pour la requête vision (contre 20 s pour les appels texte : plusieurs Mo à téléverser ne se comparent pas à une question en texte) |
| Déclenchement | **Clic explicite** sur « Analyser les photos ». Jamais au collage d'une URL, jamais en arrière-plan |
| Coût | Palier gratuit de Gemini Flash — le projet y tourne déjà pour les conseils d'édition et de prix. **Ordre de grandeur seulement** : les grilles tarifaires changent, et prétendre à un chiffre au centime serait faux |

Il n'existe **aucun appel non borné** : un appel part sur un geste, porte au
plus 8 images, et rend la main au bout de 45 s.

---

## 3. Le pipeline

```
URL de photos
  ↓  liste blanche + bornes            RecognitionImageFetcher
octets d'images
  ↓  lecture                            ImageRecognitionProvider
éléments bruts
  ↓  fusion entre photos                RecognitionConsolidator
éléments consolidés
  ↓  confrontation au catalogue         RecognitionCatalogResolver
propositions
  ↓  confirmation par l'utilisateur     PhotoRecognitionPanel
brouillon d'analyse d'achat
```

**Vision et catalogue sont deux phases séparées.** Lire « Platinum End 4 » sur
une photo et savoir si cette série existe au catalogue sont deux questions
distinctes. Les confondre ferait entrer une lecture approximative dans le
catalogue — or le catalogue reste la source de vérité, et un résultat de
moteur n'en est jamais une.

---

## 4. Ce que le système ne fait jamais

| Interdit | Où c'est garanti |
|---|---|
| Créer une **Ownership** | Aucun chemin ne le permet ; affirmé par `ImageRecognitionHttpContractTest.analyzing_photos_never_creates_an_ownership` |
| Créer une **Entity**, une **Édition** ou un **Tome** | `RecognitionCatalogResolver` s'appuie sur `SeriesMatcher` (lecture seule), jamais sur `CatalogEntityResolver.resolveOrCreate` |
| **Inventer une édition** ambiguë | `EDITION_TO_CONFIRM` + la liste des éditions connues. Même avec **une seule** édition au catalogue, elle n'est pas choisie d'office : le catalogue peut en ignorer une seconde |
| Transformer un résultat **LOW** en vérité | Seul `HIGH` **et** `MATCHED` **et** un tome lu se pré-coche — et pré-cocher n'est pas écrire |
| **Télécharger une URL arbitraire** | Trois barrières, voir §5 |
| **Bloquer la saisie manuelle** | Toute panne rend un 200 avec un `status` ; le formulaire manuel est intact |
| Appeler une **vraie IA dans les tests** | `FakeImageRecognitionProvider` et `FakeRecognitionProvider` (`@Primary`) |

### Confirmer ≠ acheter

Le bouton « Confirmer » dit **« voilà ce que contient l'annonce »**. Il ne dit
pas « j'ai acheté ces mangas ». Aucune possession n'est créée — la phrase est
écrite à l'écran, sous le bouton, parce que la confusion serait coûteuse.

---

## 5. Pourquoi ce n'est pas une SSRF

Un endpoint qui accepte une URL et va la chercher côté serveur est un vecteur
d'attaque classique : on lui donne `http://169.254.169.254/` et il rapporte
les identifiants de la machine hôte.

Trois barrières, franchies dans cet ordre, toutes dans
`RecognitionImageFetcher` :

1. **Liste blanche d'hôtes**, assemblée uniquement à partir de ce que les
   `ListingProvider` déclarent en `allowedImageHosts()`. Aucune liste globale,
   aucun caractère générique, comparaison **exacte**. Le défaut est **vide** :
   un provider qui ne se prononce pas n'autorise aucun téléchargement.
   `allowedImageHosts()` est **distinct** de `allowedHosts()` — lire une page
   HTML et télécharger un binaire ne présentent pas le même risque.
2. **`ListingUrlGuard`**, déjà écrit et déjà testé : HTTPS obligatoire, refus
   des adresses locales, privées, de lien-local et multicast.
3. **Bornes** : 8 images, 3 Mo par image, 12 Mo cumulés, 10 s par requête,
   type MIME image constaté (`jpeg`/`png`/`webp`).

**Aucune redirection n'est suivie** (`Redirect.NEVER`), contrairement au
chargeur de pages : un CDN d'images n'a pas de raison d'en émettre, et chaque
saut est une occasion de sortir de la liste blanche.

`RecognitionImageFetcherTest` couvre 12 refus : URL arbitraire, endpoint de
métadonnées cloud, `localhost`, plages privées, HTTP simple, hôte qui
*contient* un nom autorisé, `file://`.

**Aucun cookie Vinted, aucune API privée, aucun contournement anti-bot** — les
photos viennent exclusivement du `ListingSnapshot` déjà récupéré proprement.

---

## 6. Le modèle de confiance

`HIGH` / `MEDIUM` / `LOW`, **jamais un pourcentage**.

Aucun moteur branché ici n'est **calibré** : un modèle qui annonce « 97,36 % »
dit son assurance, pas sa justesse mesurée. Afficher ce nombre donnerait une
précision que personne n'a vérifiée. Trois niveaux nommés se lisent pour ce
qu'ils sont — un tri, pas une mesure.

Une valeur inattendue rendue par un moteur devient `LOW`, jamais `HIGH` : dans
le doute, on ne pré-coche pas.

### Evidence

Chaque proposition porte une raison courte — « titre visible »,
« "04" sur la tranche ». L'objectif est que l'utilisateur comprenne
**pourquoi** IozyCore propose ça, et puisse le contredire en connaissance de
cause.

---

## 7. Déduplication entre photos

Un vendeur photographie son lot de face, de côté, puis en gros plan. Le tome 4
apparaît trois fois. Sans consolidation, l'analyse compterait **trois** tomes
4 : prix par tome divisé par trois, complétude fausse, verdict calculé sur un
lot qui n'existe pas.

Clé de regroupement : **titre normalisé** (sans accents, casse, ponctuation)
**+ numéro de tome**. Pas de distance d'édition, pas de synonymes : rapprocher
« Naruto » et « Boruto » ferait bien plus de dégâts que de laisser deux lignes
que l'utilisateur fusionne d'un geste.

### Une asymétrie assumée entre numéro et édition

Un **numéro absent bloque** la fusion ; une **édition absente ne la bloque
pas**. Ce n'est pas une incohérence :

- le **numéro de tome** *identifie* un élément dans un lot. Deux « Death
  Note » sans numéro peuvent être les tomes 1 et 5 ; les fondre ferait
  disparaître un livre du décompte ;
- l'**édition** est un *attribut* d'un élément déjà identifié par sa série et
  son numéro. « Vinland Saga 7 » et « Vinland Saga 7, Standard » désignent
  presque toujours le même livre, dont l'édition n'était pas lisible sur une
  des photos. Une édition absente est une **information manquante**, pas une
  édition différente.

Deux éditions **toutes deux lues et différentes** restent deux éléments : là,
les photos se contredisent, et c'est à l'utilisateur de trancher.

Chaque élément consolidé conserve la trace de **toutes** les photos qui l'ont
soutenu — l'écran affiche « Vu sur 3 photos (1, 2, 3) ».

---

## 8. L'API

`POST /api/image-recognition/analyze`

Sous un domaine propre, **pas** sous `/purchase-analysis` ni `/vinted` : le
même moteur servira d'autres parcours, et l'attacher au premier aurait figé
cet usage dans l'URL.

En POST malgré l'absence d'effet : la requête porte un corps et déclenche un
traitement coûteux, ce qu'un GET ne doit pas faire.

**Toujours 200**, sauf requête invalide. Aucun moteur configuré, moteur en
panne, photos illisibles, rien reconnu : ce sont des issues normales,
distinguées par `status`. Même convention que
`POST /listing-metadata/resolve`. Un bandeau rouge confondrait « ces photos ne
montrent rien de lisible » avec « le service est cassé ».

`400` seulement pour : aucune image, champ absent, corps cassé, **plus de 8
images** — refusé explicitement plutôt que tronqué en silence.

### Synchrone, et c'est suffisant

Quelques secondes pour 3 à 8 photos : une requête synchrone avec un indicateur
de chargement suffit. Construire une file et un suivi de tâche pour ça serait
de l'infrastructure sans mesure qui la justifie.

---

## 8 bis. Validation manuelle du vrai provider

Un smoke test **manuel**, hors suite automatisée, pour prouver que la chaîne de
production fonctionne réellement — pas pour mesurer la précision du modèle,
ce qu'une poignée d'images ne permettrait pas.

**Images 100 % synthétiques**, dessinées par le script du test : des
« tranches » de tomes portant un titre inventé et un numéro. Aucune couverture
protégée, aucun contenu Vinted, rien de téléchargé. Ce qui est mesuré est la
**chaîne** — enveloppe `inline_data`, modèle, parsing, consolidation — pas la
culture manga du modèle. Le script vit hors du dépôt et n'y entre pas.

| | |
|---|---|
| Images envoyées | 3 (34 Ko), dont **deux montrant le même tome** |
| Durée | **≈ 3,9 s** |
| Statut provider | `OK` |
| Candidats bruts | 2 |
| Titres lus | corrects sur les 2 |
| Numéros de tome lus | corrects sur les 2 |
| Éditions inventées | **0** — `editionHint` est resté `null`, les images n'en portaient aucune |
| EAN hallucinés | **0** |
| Non identifiés | 0 |
| Après consolidation | 2 candidats, celui vu deux fois portant `photos=[0, 2]` |

Deux constats utiles au-delà du « ça marche » :

- le modèle a **lui-même** regroupé les deux photos du même tome, et la
  consolidation l'a confirmé plutôt que contredit ;
- interrogé sur des images sans mention d'édition, il a rendu `null` au lieu
  d'inventer une édition plausible — c'est exactement ce que la consigne du
  prompt lui demande, et le comportement dont dépend la règle « on demande, on
  ne choisit pas ».

**Vision et catalogue restent deux choses.** Le smoke test couvre
`fetch → provider → Gemini → parsing → consolidation`. L'étage
`CatalogResolution → API → UI` est couvert par les tests (17 contrats HTTP) et
la validation navigateur ; le titre inventé du smoke test serait de toute façon
ressorti en `NOT_IN_CATALOG`, sans rien créer.

**Vérifications post-appel** : aucune ligne créée en base (entity, variant,
ownership, wishlist, edition, observation, analyse : identiques avant/après) ;
ni la clé d'API ni le moindre octet d'image n'apparaissent dans les journaux.

## 9. Ce que la V1 ne couvre pas

| | État |
|---|---|
| **Manga** | Seul univers validé. Le provider décline poliment tout autre `entityTypeCode` plutôt que de répondre n'importe quoi |
| Jeux vidéo, livres, jeux de société | Architecture prête, comportement **non validé** — donc non proposé |
| Décodage de code-barres depuis les pixels | Non fait. La **règle de priorité** existe et est testée ; le décodeur viendra s'y brancher |
| Cache d'analyse | Non fait. Une même analyse ne se relance que sur un clic ; un hash d'image serait la voie naturelle si le besoin apparaît |
| Persistance des candidats non confirmés | **Volontairement absente.** L'analyse enregistrée conserve les éléments **confirmés** (elle le faisait déjà) ; garder les propositions rejetées gonflerait le JSONB sans usage |
| `ListingTextParser` branché sur ce parcours | Hors périmètre — voir §1 |

---

## 10. Fichiers

**Domaine** (`backend/src/main/java/com/iozycore/recognition/`) :
`RecognitionConfidence`, `RecognitionStatus`, `RecognizedItem`,
`RecognitionResult`, `RecognitionImage`, `RecognitionContext`,
`ImageRecognitionProvider`, `RecognitionConsolidator`, `CatalogStatus`,
`ResolvedItem`, `RecognitionCatalogResolver`, `RecognitionImageFetcher`,
`ImageRecognitionService`, `gemini/GeminiVisionRecognitionProvider`.

**API** : `api/recognition/ImageRecognitionController`.

**Modifiés** : `ListingProvider` (+`allowedImageHosts()`, méthode par défaut
vide), `VintedListingProvider` (CDN d'images), `GeminiRequests` (variante
multimodale).

**Web** : `types/imageRecognition.ts`, `api/imageRecognition.ts`,
`routes/PurchaseAnalysis/PhotoRecognitionPanel.tsx`, branchement dans
`PurchaseAnalysisPage.tsx`.
