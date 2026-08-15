# IozyCore — Document de conception

*Second cerveau numérique personnel — auto-hébergé sur NAS Synology*

---

## 1. Vision produit

IozyCore est une base de connaissances personnelle, auto-hébergée et strictement mono-utilisateur, construite autour d'un moteur générique d'Entités (Type → Entité → Version → Possession(s) → Expérience(s) → Média(s) → Relations → Tags).

Le MVP couvre 3 types métier codés en dur — **Manga, Jeu vidéo, Jeu de société** — chacun distinct, construits sur ce moteur commun. L'ajout d'éléments ne dépend d'aucune IA au MVP (scan code-barres/ISBN, recherche via API publiques, saisie manuelle).

La généricité complète des types/champs/relations (éditeur no-code) et les capacités d'IA (OCR, reconnaissance visuelle, requêtes en langage naturel) sont prévues nativement par l'architecture mais reportées en V2/V3, sans refonte du cœur.

**Principe fondamental** : une donnée n'existe qu'une seule fois ; les Expériences sont totalement indépendantes des Possessions.

---

## 2. Benchmark des applications existantes

| Domaine | Références du marché | Limite par rapport à IozyCore |
|---|---|---|
| Jeux vidéo | Stash, My Game Collection, GAMEYE, MyGameDB | Silos verticaux, aucune vision transversale |
| Mangas | Mangacollec, Bubble | Excellent sur son domaine, mais mono-domaine |
| Jeux de société | BoardGameGeek (BGG) + clients tiers | Base de données de référence mais pas de collection multi-domaine |
| Générique multi-collections | GCstar, Tellico | Types configurables mais logiciels desktop datés, pas d'auto-hébergement moderne, pas de séparation Possession/Expérience |
| PKM généraliste | Notion, Obsidian, AppFlowy | Pas de modèle métier pour objets physiques/expériences typées |

**Conclusion** : aucun outil n'unifie Œuvre + Possession + Expérience + auto-hébergement sur plusieurs domaines. IozyCore comble un vide réel du marché.

**Positionnement retenu** : usage en parallèle des apps spécialisées existantes, sans lien ni import direct au démarrage.

---

## 3. Contextes d'usage (personas contextuels)

IozyCore étant mono-utilisateur, les "personas" sont en réalité des **contextes d'usage** :

1. **Le collectionneur pressé** — ajout rapide en boutique (< 5 secondes).
2. **Le curateur du soir** — enrichissement approfondi (notes, commentaires, photos).
3. **Le décideur avant achat** — vérification instantanée en situation d'arbitrage (brocante, boutique).
4. **Feuilleter ses étagères** — consultation passive et esthétique, sans objectif précis.

---

## 4. User Stories (MVP)

### Ajout rapide
- Scanner un code-barres (manga, jeu vidéo) pour ajout automatique.
- Rechercher un jeu de société par nom (pas toujours de code-barres exploitable).
- Pré-remplissage automatique des métadonnées via API publique.
- Détection de doublon potentiel à l'ajout.

### Entités et Versions
- Une même œuvre peut exister en plusieurs éditions/versions (`Variant`).
- Champs personnalisés selon le type (mangaka/tome, plateforme/studio, nombre de joueurs/durée).

### Possessions (`Ownership`)
- État, date d'acquisition, note libre.
- Marquer un exemplaire comme vendu ou perdu.
- *(Hors périmètre MVP : prix d'acquisition, statut "prêté" — simplification demandée)*

### Expériences
- Enregistrer qu'un jeu vidéo est terminé, un tome lu, un jeu de société joué — avec une note et un commentaire, indépendamment de la possession.
- *(Hors périmètre MVP : suivi détaillé des sessions/parties — simplification demandée)*

### Wishlist
- Vérifier en 2 secondes si un titre est déjà possédé ou en wishlist.
- Voir les tomes manquants d'une série suivie.

### Recherche et Statistiques
- Recherche instantanée transversale (tous types confondus).
- Filtres par type, statut, tags.
- Valeur totale de la collection (calcul automatique via le web, prévu en V2).
- Statistiques de progression (jeux terminés, tomes lus).

### Multi-plateforme
- Fonctionnement hors ligne sur iOS (au moins en lecture).
- Accès à la même donnée depuis le web pour des saisies plus riches.

---

## 5. Parcours utilisateurs

**Parcours 1 — Ajout rapide en boutique**
Ouverture app → scan code-barres → pré-remplissage via API → détection doublon → confirmation en un tap. Cible : < 5 secondes.

**Parcours 2 — Enrichissement du soir**
Recherche/navigation → fiche entité → ajout d'une Expérience (note + commentaire) → mise à jour des statistiques.

**Parcours 3 — Vérification avant achat**
Recherche instantanée → résultat immédiat (possédé / wishlist / inconnu) → décision d'achat, éventuel ajout à la wishlist. Doit fonctionner hors ligne (cache local).

**Parcours 4 — Feuilleter ses étagères**
Vue "étagère" par type (grille de couvertures) → navigation libre, sans filtre actif → tri ludique (récent / mieux noté / aléatoire) → ouverture d'une fiche pour redécouverte.

---

## 6. Cas d'utilisation

| UC | Nom | Déclencheur | Postcondition |
|---|---|---|---|
| UC1 | Ajouter une Entité | Achat/découverte d'un élément | Entité (nouvelle ou existante) + Ownership créée |
| UC2 | Gérer une Possession | Évolution du statut d'un exemplaire | Historique d'Ownership mis à jour |
| UC3 | Enregistrer une Expérience | Lecture/jeu/visionnage terminé | Nouvelle Experience rattachée à l'Entité |
| UC4 | Rechercher / Vérifier avant achat | Hésitation en situation d'achat | Décision éclairée, éventuel ajout wishlist |
| UC5 | Gérer la Wishlist | Découverte d'un élément désiré | Entrée wishlist créée |
| UC6 | Consulter les Statistiques | Besoin de vision globale | Lecture seule |
| UC7 | Parcourir en mode découverte | Envie de consultation libre | Navigation par étagères visuelles |

**3 verbes fondamentaux du moteur** : Créer une Entité, Posséder, Vivre une Expérience — complètement découplés.

---

## 7. Domaine métier (DDD)

### Langage ubiquitaire (nommage retenu en anglais pour le code)

| Terme français | Terme anglais (code) |
|---|---|
| Type | `EntityType` |
| Entité | `Entity` |
| Version | `Variant` |
| Possession | `Ownership` |
| Expérience | `Experience` |
| Relation | `Relationship` |
| Tag | `Tag` |
| Wishlist | `Wishlist` |

### Agrégats

- **`Entity`** (racine) : `EntityType` (référence), attributs personnalisés, Tags, Relations, `Variant`(s) internes. Invariant : le `EntityType` ne change jamais après création.
- **`Ownership`** (racine indépendante) : référence une `Entity`/`Variant` par ID. Invariant : sa suppression n'affecte jamais l'Entité.
- **`Experience`** (racine indépendante) : référence une `Entity` par ID uniquement, jamais un `Ownership`.
- **`EntityType`** (configuration) : au MVP, 3 instances codées en dur (Manga, Jeu vidéo, Jeu de société).

### Règles

- Une `Entity` peut exister seule indéfiniment (cas Wishlist pure) — jamais un état invalide.
- Suppression d'une `Entity` bloquée tant qu'il existe des `Ownership`/`Experience` la référençant.

### Événements de domaine

`EntityCreated`, `OwnershipAdded`, `OwnershipReleased`, `ExperienceRecorded`, `EntityAddedToWishlist`.

---

## 8. Bounded Contexts

1. **Catalog** — `Entity`, `EntityType`, `Variant`, `Relationship`, `Tag`. Cœur du système, aucune dépendance vers les autres contextes.
2. **Ownership** — gestion des possessions, référence Catalog par ID.
3. **Experience** — gestion des expériences vécues, référence Catalog par ID.
4. **Wishlist** — cycle de vie propre (ajoutée / retirée / convertie en Ownership).
5. **Metadata Enrichment** — intégration API publiques externes, anti-corruption layer vers Catalog.
6. **Insights** — regroupe Recherche + Statistiques, lecture transversale en read-model alimentée par les domain events des autres contextes.

---

## 9. Modèle de données

**Choix central** : table `entity` générique avec colonne `attributes` en JSONB (plutôt qu'une table par type), afin que le passage aux types dynamiques (V2) ne nécessite aucune migration de schéma.

Tables principales : `entity_type`, `entity`, `variant`, `ownership`, `experience`, `wishlist_entry`, `relationship`, `tag`, `entity_tag`.

*(Voir schéma ERD généré séparément dans la conversation.)*

---

## 10. Architecture logicielle

**Modulith en Clean Architecture** :

- **Domain** : les 4 agrégats, sans dépendance framework.
- **Application** : cas d'usage (UC1-UC7), orchestration, publication des domain events.
- **Infrastructure** : persistance JPA/PostgreSQL, appels API publiques (Metadata Enrichment), stockage fichiers médias sur disque NAS.
- **API** : REST + OpenAPI, consommée identiquement par iOS et Web.

Chaque Bounded Context = un module Java séparé, communication par interfaces + événements internes (`ApplicationEventPublisher` Spring, pas de bus externe nécessaire).

---

## 11. Choix techniques

- **Backend** : Java 21, Spring Boot, PostgreSQL (avec JSONB), Docker, REST, OpenAPI, OAuth2/JWT.
- **iOS** : SwiftUI, SwiftData/CoreData (cache local).
- **Web** (post-MVP) : React, TypeScript, Vite, TanStack Query.
- **Architecture** : Clean Architecture, DDD, SOLID, API First, monolithe modulaire évolutif vers microservices.

---

## 12. APIs publiques à intégrer

| Domaine | API |
|---|---|
| Mangas | Jikan API (MyAnimeList) ou AniList API |
| Jeux vidéo | IGDB API |
| Jeux de société | BoardGameGeek XML API |

Toutes passent par le module Metadata Enrichment avant de créer/enrichir une `Entity`.

---

## 13. UX/UI

Deux registres distincts :

- **Mode "outil"** (ajout rapide, vérification avant achat) : minimaliste, un seul CTA visible, recherche instantanée prioritaire.
- **Mode "vitrine"** (étagères, curation) : grille de couvertures en grand format, animations douces, tri ludique.

Navigation par onglets : Étagères / Recherche / Wishlist / Statistiques. Fiche d'Entité en un seul écran (infos, Ownership, historique d'Expériences, tags).

---

## 14. MVP

**Inclus** : moteur complet (Entity/Variant/Ownership/Experience/Wishlist/Tag/Relationship), 3 types codés en dur, ajout rapide via scan + API publiques, les 4 parcours utilisateurs, recherche transversale, statistiques de base, app iOS + API backend, Docker Compose sur NAS.

**Hors MVP** : éditeur de types dynamique, toute IA, app web, suivi de prix automatique, multi-utilisateur.

---

## 15. Roadmap

- **V1 (MVP)** : cœur fonctionnel, 3 types, sans IA.
- **V2** : éditeur de types dynamique, app Web, calcul automatique de valeur, premières briques IA (OCR, reconnaissance code-barres avancée).
- **V3** : requêtes en langage naturel, reconnaissance d'image IA, relations enrichies (sagas, adaptations), nouveaux modules (Voyages, Restaurants, Objets de collection).

---

## 16. Plan de développement

1. Socle domaine (4 agrégats, Java pur, testable).
2. Persistance PostgreSQL + JPA, migrations Flyway/Liquibase dès le départ.
3. API REST minimale + OpenAPI.
4. Module Catalog complet pour un seul type (validation du moteur de bout en bout).
5. Metadata Enrichment : IGDB, puis Jikan, puis BGG.
6. Extension aux 2 autres types.
7. App iOS : parcours 1 et 3 d'abord, puis 2 et 4.
8. Statistiques et recherche transversale en dernier.

---

## 17. Stratégie de tests

- Domaine : tests unitaires exhaustifs sur les invariants des agrégats.
- API : tests d'intégration (Testcontainers + PostgreSQL réel).
- Metadata Enrichment : fixtures mockées, pas d'appel réseau réel en CI.
- iOS : tests unitaires sur la synchronisation locale, tests UI ciblés sur les parcours 1 et 3.

---

## 18. Déploiement sur Synology

- **Docker Compose** : services `iozycore-api`, `postgres`, `reverse-proxy` (Traefik/Nginx + Let's Encrypt).
- **Volumes** : un pour PostgreSQL, un pour les médias, montés sur le stockage RAID du NAS.
- **Sauvegardes** : `pg_dump` planifié + Hyper Backup vers stockage externe.
- **Mises à jour** : migrations Flyway versionnées jouées automatiquement au démarrage, jamais de modification manuelle du schéma.
- **Accès distant** : reverse proxy + HTTPS, PostgreSQL jamais exposé directement.

---

## 19. Évolutions futures

- Ouverture possible en lecture seule à des proches (facilitée par la séparation Ownership/Experience, sans refonte).
- Export complet des données (JSON/CSV) pour garantir l'absence d'enfermement, même auto-hébergé.
- **Import Manga Collec** : évalué (voir historique) — ni API publique documentée, ni export utilisateur, ni données de possession réelles dans la page de collection publique (seulement des compteurs agrégés et des listes de suivi/lecture, pas la liste tome par tome). Construire l'import obligerait à reverse-engineer leur API privée (`api.mangacollec.com`), fragile et de statut CGU incertain — écarté pour l'instant. **À reconsidérer uniquement si une source officielle ou suffisamment stable devient disponible** (API publique, export officiel, format utilisateur exploitable). Pas prioritaire.

---

*Document de conception généré à partir des échanges de conception d'IozyCore — toutes les décisions ci-dessus ont été validées étape par étape.*
