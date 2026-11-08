package com.iozycore.videogame;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.metadata.SourceUnavailableException;
import com.iozycore.core.testing.InMemoryEntityRepository;
import com.iozycore.core.testing.InMemoryEntityTypeRepository;
import com.iozycore.videogame.franchise.Franchise;
import com.iozycore.videogame.franchise.FranchiseGame;
import com.iozycore.videogame.franchise.FranchiseSource;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/** The licences are read in the background, only with the IGDB key, and a silent IGDB writes nothing. */
class VideoGameFranchiseBackfillTest {

    private static final Instant NOW = Instant.parse("2026-11-08T10:00:00Z");

    private final InMemoryEntityRepository entities = new InMemoryEntityRepository();
    private final InMemoryFranchiseCache cache = new InMemoryFranchiseCache();
    private final List<String> asked = new ArrayList<>();
    private boolean configured = true;
    private Set<String> silent = Set.of();
    private final FranchiseSource igdb = new FranchiseSource() {
        @Override
        public boolean configured() {
            return configured;
        }

        @Override
        public Franchise franchiseOf(String igdbId) {
            asked.add(igdbId);
            if (silent.contains(igdbId)) {
                throw new SourceUnavailableException("IGDB answered 503");
            }
            return new Franchise("Licence " + igdbId,
                    List.of(new FranchiseGame(igdbId, "Jeu " + igdbId, null, List.of("PC"), null)));
        }
    };

    private VideoGameFranchiseBackfill backfill() {
        return new VideoGameFranchiseBackfill(new InMemoryEntityTypeRepository(EntityTypeFixtures.VIDEO_GAME),
                entities, cache, igdb, true, 10, Duration.ZERO, Duration.ofDays(30),
                Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void stores_the_licence_of_each_game_never_read() {
        game("7");
        game("8");

        VideoGameFranchiseBackfill.Result result = backfill().run();

        assertThat(result.gamesStored()).isEqualTo(2);
        assertThat(cache.rows.get("7").franchise().name()).isEqualTo("Licence 7");
        assertThat(cache.rows.get("7").fetchedAt()).isEqualTo(NOW);
    }

    @Test
    void asks_nothing_without_the_igdb_key() {
        configured = false;
        game("7");

        VideoGameFranchiseBackfill.Result result = backfill().run();

        assertThat(result.gamesAsked()).isZero();
        assertThat(asked).isEmpty();
    }

    @Test
    void stops_at_a_silent_igdb_and_writes_nothing_for_that_game() {
        game("7");
        silent = Set.of("7");

        VideoGameFranchiseBackfill.Result result = backfill().run();

        assertThat(result.stoppedOnUnavailable()).isTrue();
        assertThat(cache.rows).isEmpty();
    }

    private void game(String igdbId) {
        Entity game = Entity.create(EntityTypeFixtures.VIDEO_GAME.id(), "Jeu " + igdbId);
        game.mergeAttributes(Map.of("igdbId", igdbId));
        entities.save(game);
    }
}
