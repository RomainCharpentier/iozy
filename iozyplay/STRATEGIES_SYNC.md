# Stratégies de synchronisation chrono/vidéo

## Stratégie 1 : Temps relatif depuis la réception
**Principe** : Le serveur envoie le temps restant jusqu'au démarrage de la vidéo, le client compte depuis la réception.

**Avantages** : Pas besoin d'offset, simple
**Inconvénients** : La latence réseau n'est pas compensée

```javascript
// Serveur
const revealStartTime = Date.now() + 50
const timeUntilStart = 50 // ms jusqu'au démarrage
io.emit('game:reveal', { timeUntilStart: timeUntilStart })

// Client
const receivedAt = Date.now()
const videoStartTime = receivedAt + timeUntilStart
const chronoStartTime = videoStartTime - gameDurationMsRef.current
```

## Stratégie 2 : Estimation de latence
**Principe** : Estimer la latence réseau (RTT/2) et l'ajuster

**Avantages** : Compense partiellement la latence
**Inconvénients** : Estimation imprécise

```javascript
// Client
const receivedAt = Date.now()
const estimatedLatency = 50 // ms (peut être calculé avec ping/pong)
const adjustedStartTime = startTime - estimatedLatency
```

## Stratégie 3 : Temps écoulé depuis game:go
**Principe** : Utiliser le temps écoulé depuis le début de la question

**Avantages** : Pas besoin de timestamp absolu
**Inconvénients** : Nécessite que game:go soit bien synchronisé

```javascript
// Serveur envoie dans game:reveal
const elapsedSinceGo = Date.now() - room.game.goAt
io.emit('game:reveal', { elapsedSinceGo })

// Client
const timeSinceGo = Date.now() - goAtRef.current
const adjustedElapsed = elapsedSinceGo - (timeSinceGo - elapsedSinceGo)
```

## Stratégie 4 : Temps restant calculé par le serveur
**Principe** : Le serveur calcule et envoie directement le temps restant

**Avantages** : Le serveur a la vérité, pas besoin de conversion
**Inconvénients** : Nécessite que le serveur calcule pour chaque client

```javascript
// Serveur
const timeRemaining = gameDurationMsRef.current
io.emit('game:reveal', { timeRemaining })

// Client
setTimeRemaining(timeRemaining / 1000)
// Compte à rebours depuis maintenant
```

## Stratégie 5 : Réception immédiate + délai fixe
**Principe** : Le chrono commence immédiatement à la réception, la vidéo démarre après la durée complète

**Avantages** : Très simple, pas de conversion
**Inconvénients** : Pas de synchronisation précise entre clients

```javascript
// Client
const receivedAt = Date.now()
revealStartTimeClientRef.current = receivedAt
// Chrono commence maintenant à la durée complète
// Vidéo démarre à receivedAt + gameDurationMsRef.current
```


