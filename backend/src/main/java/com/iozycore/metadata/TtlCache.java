package com.iozycore.metadata;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Petit cache mémoire à expiration, mono-processus (cohérent avec la
 * conception mono-utilisateur strict d'IozyCore - pas besoin de Redis ou
 * d'un cache distribué pour un usage personnel auto-hébergé). Réduit les
 * appels aux API externes (Jikan/MyAnimeList/BGG/IGDB/Google Books/Open
 * Library) pour une même recherche ou un même code-barres répété en peu de
 * temps (retype, va-et-vient sur l'écran d'ajout, débounce qui laisse quand
 * même passer plusieurs requêtes, plusieurs clients iOS/Web) - protège en
 * particulier les quotas serrés comme celui de Google Books (voir README,
 * "quota anonyme épuisé").
 * <p>
 * Volontairement simple : pas de vraie éviction LRU, une purge complète du
 * cache en cas de débordement de {@code maxEntries} suffit largement à
 * l'échelle d'une collection personnelle (le coût est juste quelques appels
 * API en plus, jamais une incohérence).
 */
class TtlCache<K, V> {

    private record Entry<V>(V value, Instant expiresAt) {
        boolean isExpired(Instant now) {
            return !now.isBefore(expiresAt);
        }
    }

    private final Duration timeToLive;
    private final int maxEntries;
    private final Map<K, Entry<V>> entries = new ConcurrentHashMap<>();

    TtlCache(Duration timeToLive, int maxEntries) {
        this.timeToLive = timeToLive;
        this.maxEntries = maxEntries;
    }

    Optional<V> get(K key) {
        Entry<V> entry = entries.get(key);
        if (entry == null) {
            return Optional.empty();
        }
        if (entry.isExpired(Instant.now())) {
            entries.remove(key);
            return Optional.empty();
        }
        return Optional.of(entry.value());
    }

    void put(K key, V value) {
        if (entries.size() >= maxEntries) {
            entries.clear();
        }
        entries.put(key, new Entry<>(value, Instant.now().plus(timeToLive)));
    }
}
