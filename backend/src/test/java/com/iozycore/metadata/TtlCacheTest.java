package com.iozycore.metadata;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class TtlCacheTest {

    @Test
    void returns_the_cached_value_before_expiry() {
        TtlCache<String, String> cache = new TtlCache<>(Duration.ofMinutes(10), 10);

        cache.put("naruto", "Naruto");

        assertThat(cache.get("naruto")).contains("Naruto");
    }

    @Test
    void returns_empty_for_a_key_never_put() {
        TtlCache<String, String> cache = new TtlCache<>(Duration.ofMinutes(10), 10);

        assertThat(cache.get("missing")).isEmpty();
    }

    @Test
    void treats_an_already_expired_entry_as_absent() {
        // TTL négatif = déjà expiré au moment du put, pour tester l'expiration
        // sans dépendre d'un vrai sleep().
        TtlCache<String, String> cache = new TtlCache<>(Duration.ofSeconds(-1), 10);

        cache.put("naruto", "Naruto");

        assertThat(cache.get("naruto")).isEmpty();
    }

    @Test
    void clears_everything_once_maxEntries_is_reached() {
        TtlCache<String, String> cache = new TtlCache<>(Duration.ofMinutes(10), 2);

        cache.put("a", "1");
        cache.put("b", "2");
        cache.put("c", "3"); // déclenche la purge complète (taille déjà à maxEntries)

        // La purge simple (pas de LRU) vide tout avant d'insérer le nouvel
        // élément - seul le dernier survit, "a"/"b" sont perdus.
        assertThat(cache.get("a")).isEmpty();
        assertThat(cache.get("b")).isEmpty();
        assertThat(cache.get("c")).contains("3");
    }
}
