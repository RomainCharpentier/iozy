package com.iozycore.core.metadata;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Small in-memory cache with expiration, single-process (consistent with the
 * strict single-user design of IozyCore - no need for Redis or
 * a distributed cache for a personal self-hosted use). Reduces the
 * calls to the external APIs (Jikan/MyAnimeList/BGG/IGDB/Google Books/Open
 * Library) for the same search or the same barcode repeated within a short
 * time (retype, back and forth on the add screen, debounce that still
 * lets several requests through, several iOS/Web clients) - protects in
 * particular tight quotas like the one of Google Books (see README,
 * "anonymous quota used up").
 * <p>
 * Deliberately simple: no real LRU eviction, a full purge of the
 * cache on overflow of {@code maxEntries} is largely enough at
 * the scale of a personal collection (the cost is just a few more API
 * calls, never an inconsistency).
 */
// Public since Batch 132: the services of the universes (metadata.manga...) use it.
public class TtlCache<K, V> {

    private record Entry<V>(V value, Instant expiresAt) {
        boolean isExpired(Instant now) {
            return !now.isBefore(expiresAt);
        }
    }

    private final Duration timeToLive;
    private final int maxEntries;
    private final Map<K, Entry<V>> entries = new ConcurrentHashMap<>();

    public TtlCache(Duration timeToLive, int maxEntries) {
        this.timeToLive = timeToLive;
        this.maxEntries = maxEntries;
    }

    public Optional<V> get(K key) {
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

    public void put(K key, V value) {
        if (entries.size() >= maxEntries) {
            entries.clear();
        }
        entries.put(key, new Entry<>(value, Instant.now().plus(timeToLive)));
    }

    /** Forgets a key, if it is there. */
    public void invalidate(K key) {
        entries.remove(key);
    }
}
