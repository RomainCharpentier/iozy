# Tests Multijoueur - Blindtest Webapp

## Modifications apportées

### Architecture serveur (source of truth)
- **playerId persistant** : UUID stocké en localStorage côté client
- **Grace period** : 20 secondes avant suppression d'un joueur déconnecté
- **Timers serveur** : `startedAt` + `durationMs` pour synchronisation parfaite
- **Événements standardisés** : `room:create`, `room:join`, `room:rejoin`, `room:leave`, `room:state`, `game:start`, `game:next`, `game:answer`, `game:end`, `error`

### Architecture front
- **playerId persistant** : Génération et stockage automatique
- **Reconnexion automatique** : Rejoin sur reconnect
- **Cleanup listeners** : Tous les `socket.on` dans `useEffect` avec cleanup
- **leaveRoom()** : Appelé sur bouton Quitter + `beforeunload`
- **Timer synchronisé** : Calcul depuis `startedAt` + `durationMs` du serveur

## Tests manuels à effectuer

### Test 1 : Synchronisation question/timer/scores (2 joueurs)

**Objectif** : Vérifier que 2 joueurs voient la même question, le même timer et les mêmes scores.

**Étapes** :
1. Ouvrir 2 onglets/navigateurs différents
2. Onglet 1 : Créer un salon (host)
3. Onglet 2 : Rejoindre le salon avec le code
4. Host : Démarrer la partie
5. **Vérifier** :
   - Les 2 joueurs voient la même question au même moment
   - Les timers sont synchronisés (même temps restant)
   - Quand un joueur répond correctement, les scores se mettent à jour sur les 2 onglets
   - La question suivante apparaît en même temps pour les 2 joueurs

**Résultat attendu** : ✅ Synchronisation parfaite

---

### Test 2 : Reconnexion après refresh

**Objectif** : Vérifier qu'un joueur qui refresh garde son score et peut continuer à jouer.

**Étapes** :
1. Créer un salon avec 2 joueurs
2. Démarrer la partie
3. Joueur 2 répond correctement à 2 questions (score = 2)
4. Joueur 2 : Rafraîchir la page (F5)
5. **Vérifier** :
   - Joueur 2 revient automatiquement dans le salon
   - Le score de Joueur 2 est toujours 2
   - Joueur 2 peut continuer à jouer
   - Les autres joueurs voient toujours Joueur 2 avec score = 2

**Résultat attendu** : ✅ Score conservé, reconnexion transparente

---

### Test 3 : Déconnexion et grace period

**Objectif** : Vérifier qu'un joueur qui ferme l'onglet disparaît après 20 secondes.

**Étapes** :
1. Créer un salon avec 3 joueurs (A, B, C)
2. Démarrer la partie
3. Joueur B : Fermer l'onglet complètement
4. **Vérifier immédiatement** (0-5s) :
   - Joueurs A et C voient Joueur B comme "déconnecté" (connected: false)
5. **Vérifier après 20 secondes** :
   - Joueur B a disparu de la liste des joueurs
   - Le salon continue normalement avec A et C
6. **Vérifier si Joueur B revient avant 20s** :
   - Ouvrir un nouvel onglet et rejoindre avec le même code
   - Joueur B réapparaît avec son score conservé

**Résultat attendu** : ✅ Grace period fonctionne, joueur supprimé après 20s si pas revenu

---

### Test 4 : Host quitte - promotion ou destruction

**Objectif** : Vérifier que si le host quitte, un autre joueur devient host ou la room est détruite.

**Étapes** :
1. Créer un salon avec 3 joueurs (A=host, B, C)
2. Host A : Quitter le salon (bouton Quitter)
3. **Vérifier** :
   - Un autre joueur (B ou C) devient host automatiquement
   - La partie continue normalement
4. Nouveau test : Host seul dans le salon
5. Host : Quitter le salon
6. **Vérifier** :
   - La room est détruite (plus accessible)

**Résultat attendu** : ✅ Host promu ou room détruite selon le nombre de joueurs

---

### Test 5 : Cleanup timers et listeners

**Objectif** : Vérifier qu'il n'y a pas de fuites mémoire (doublons de listeners, timers non nettoyés).

**Étapes** :
1. Ouvrir la console développeur (F12)
2. Créer un salon, démarrer une partie
3. Quitter le salon
4. Rejoindre un autre salon, démarrer une partie
5. Répéter 5-10 fois
6. **Vérifier dans la console** :
   - Pas d'erreurs de mémoire
   - Pas de warnings Socket.IO sur listeners multiples
   - Les timers sont bien nettoyés (pas de "time-up" après avoir quitté)

**Résultat attendu** : ✅ Pas de fuites, cleanup propre

---

### Test 6 : État synchronisé après reconnexion

**Objectif** : Vérifier que `room:state` synchronise correctement l'état complet.

**Étapes** :
1. Créer un salon avec 2 joueurs
2. Démarrer la partie, répondre à 2 questions
3. Joueur 2 : Fermer l'onglet
4. Attendre 5 secondes
5. Joueur 2 : Rejoindre à nouveau
6. **Vérifier** :
   - Joueur 2 voit la bonne question (même index)
   - Joueur 2 voit le bon timer (synchronisé)
   - Joueur 2 voit les bons scores de tous les joueurs
   - Joueur 2 peut répondre normalement

**Résultat attendu** : ✅ État 100% synchronisé depuis le serveur

---

### Test 7 : Timer serveur - synchronisation parfaite

**Objectif** : Vérifier que le timer est calculé depuis le serveur et non côté client.

**Étapes** :
1. Créer un salon avec 2 joueurs
2. Démarrer la partie
3. Ouvrir les DevTools sur les 2 onglets
4. Simuler une latence réseau (Network throttling : Slow 3G)
5. **Vérifier** :
   - Les timers restent synchronisés malgré la latence
   - Quand le timer arrive à 0, les 2 joueurs passent à la question suivante en même temps
   - Pas de décalage entre les 2 clients

**Résultat attendu** : ✅ Timer synchronisé depuis serveur, pas de décalage

---

## Checklist de validation

- [ ] Test 1 : Synchronisation question/timer/scores ✅
- [ ] Test 2 : Reconnexion après refresh ✅
- [ ] Test 3 : Déconnexion et grace period ✅
- [ ] Test 4 : Host quitte - promotion/destruction ✅
- [ ] Test 5 : Cleanup timers et listeners ✅
- [ ] Test 6 : État synchronisé après reconnexion ✅
- [ ] Test 7 : Timer serveur - synchronisation parfaite ✅

## Notes techniques

- **Grace period** : 20 secondes (configurable dans `roomRepository.startGracePeriod`)
- **Timer update** : Toutes les 100ms côté client (calcul depuis `startedAt` + `durationMs`)
- **Événements** : Tous les événements suivent le format `namespace:action` (ex: `room:create`, `game:start`)
- **Erreurs** : Format standardisé `{ code, message }` via événement `error`


