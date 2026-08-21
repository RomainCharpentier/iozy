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

### C2 — 9 contrôleurs sur 17 sans aucun test · **moyen**

42 endpoints dont aucun test ne cite le contrôleur :

| Contrôleur | endpoints |
|---|---|
| `EntityController` | 11 |
| `OwnershipController` | 7 |
| `InsightsController` | 6 |
| `EntityTypeController` | 5 |
| `MetadataController` | 5 |
| `EditionUpgradeWishController` | 4 |
| `LoanController` | 4 |
| `TagController` | 4 |
| `ExportController` | 2 |
| `ListingMetadataController` | 1 |

À nuancer : leurs **services et domaines sont largement testés**
(`EntityDeletionService`, `OwnershipDeletionService`, `QuickAddService`,
`StatsService`, `CollectionProgressService`…). Ce qui n'est pas couvert, c'est
la **couche HTTP** : codes de statut, validation des corps, mapping des DTO —
précisément là où le 500 des préférences se cachait.

Les 8 contrôleurs testés sont exactement ceux qu'ont touchés les passes
récentes. La couverture suit l'activité, pas le risque.

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
