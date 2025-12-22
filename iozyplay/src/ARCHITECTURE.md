# Architecture du projet

## Structure en couches

Le projet suit une architecture en couches (Clean Architecture) pour séparer le cœur de métier des dépendances externes.

### 📁 Domain (Domaine métier pur)
**`src/domain/`**

Contient la logique métier pure, **sans aucune dépendance externe** (pas de React, npm, localStorage, etc.).

- `question.ts` : Logique métier pour la gestion des questions
- `game.ts` : Logique métier pour le jeu (scores, progression, etc.)

**Principe** : Ces fichiers peuvent être utilisés dans n'importe quel contexte (React, Vue, Node.js, tests unitaires, etc.)

### 🔌 Ports (Interfaces)
**`src/ports/`**

Définit les contrats (interfaces) pour les dépendances externes sans implémentation.

- `storage.ts` : Interface pour le stockage de données

**Principe** : Les ports permettent de changer d'implémentation sans modifier le domaine.

### 🏗️ Infrastructure (Implémentations concrètes)
**`src/infrastructure/`**

Contient les implémentations concrètes des ports.

- `storage/localStorageAdapter.ts` : Implémentation du port de stockage avec localStorage
- `storage/questionRepository.ts` : Repository concret pour les questions

**Principe** : Ces fichiers dépendent des ports mais pas du domaine. Ils peuvent être remplacés facilement.

### 🎯 Services (Facades)
**`src/services/`**

Facades qui exposent une API simple pour utiliser le domaine avec les implémentations concrètes.

- `questionService.ts` : Service pour les questions
- `gameService.ts` : Service pour le jeu

**Principe** : Les composants React utilisent ces services, pas directement le domaine.

### ⚛️ Components (Présentation)
**`src/components/`**

Composants React organisés par domaine fonctionnel.

- `game/` : Composants liés au jeu
- `room/` : Composants de salle multijoueur
- `menu/` : Composants de menu
- `editor/` : Éditeur de questions
- `media/` : Lecteurs média

**Principe** : Les composants ne contiennent que la logique de présentation et utilisent les services pour la logique métier.

## Flux de données

```
Component (React)
    ↓ utilise
Service (Facade)
    ↓ utilise
Domain (Logique pure)
    ↓ utilise
Port (Interface)
    ↑ implémenté par
Infrastructure (Implémentation concrète)
```

## Exemple d'utilisation

```typescript
// ❌ MAUVAIS : Logique métier dans le composant
const percentage = Math.round((score / totalQuestions) * 100)

// ✅ BON : Utilisation du service
import { GameService } from '../../services/gameService'
const percentage = GameService.calculatePercentage(score, totalQuestions)
```

## Avantages

1. **Testabilité** : Le domaine peut être testé sans React, localStorage, etc.
2. **Réutilisabilité** : Le domaine peut être utilisé dans d'autres projets
3. **Maintenabilité** : Séparation claire des responsabilités
4. **Flexibilité** : Facile de changer d'implémentation (ex: remplacer localStorage par IndexedDB)

## Règles

- ✅ Le domaine ne doit **jamais** importer depuis `components/`, `utils/`, `infrastructure/`
- ✅ Les composants ne doivent **jamais** contenir de logique métier complexe
- ✅ Toute logique métier doit être dans `domain/` ou `services/`
- ✅ Les dépendances externes (localStorage, socket.io, etc.) doivent être abstraites via des ports





