package com.iozycore.boardgame;

import com.iozycore.boardgame.expansion.BoardGameExpansion;
import com.iozycore.boardgame.expansion.ExpansionSource;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.metadata.SourceUnavailableException;
import com.iozycore.core.testing.InMemoryEntityRepository;
import com.iozycore.core.testing.InMemoryEntityTypeRepository;
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

/** The expansions are read in the background, gently, and a silent BGG writes nothing. */
class BoardGameExpansionBackfillTest {

    private static final Instant NOW = Instant.parse("2026-11-08T10:00:00Z");

    private final InMemoryEntityRepository entities = new InMemoryEntityRepository();
    private final InMemoryExpansionCache cache = new InMemoryExpansionCache();
    private final List<String> asked = new ArrayList<>();
    private Set<String> silent = Set.of();
    private final ExpansionSource bgg = bggId -> {
        asked.add(bggId);
        if (silent.contains(bggId)) {
            throw new SourceUnavailableException("BGG answered 429");
        }
        return List.of(new BoardGameExpansion("x" + bggId, "Expansion of " + bggId, null, null));
    };

    private BoardGameExpansionBackfill backfill(boolean enabled, int perRun) {
        return new BoardGameExpansionBackfill(new InMemoryEntityTypeRepository(EntityTypeFixtures.BOARD_GAME),
                entities, cache, bgg, enabled, perRun, Duration.ZERO, Duration.ofDays(30),
                Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void reads_the_games_never_read_first_then_the_oldest_and_leaves_the_fresh_ones() {
        game("1");
        game("2");
        game("3");
        game("4");
        cache.save("2", List.of(), NOW.minus(Duration.ofDays(40)));
        cache.save("3", List.of(), NOW.minus(Duration.ofDays(5)));
        cache.save("4", List.of(), NOW.minus(Duration.ofDays(60)));

        BoardGameExpansionBackfill.Result result = backfill(true, 10).run();

        assertThat(asked).containsExactly("1", "4", "2");
        assertThat(result.gamesStored()).isEqualTo(3);
        assertThat(cache.rows.get("1").expansions()).extracting(BoardGameExpansion::bggId).containsExactly("x1");
        assertThat(cache.rows.get("3").fetchedAt()).isEqualTo(NOW.minus(Duration.ofDays(5)));
    }

    @Test
    void stops_at_a_silent_bgg_and_writes_nothing_for_that_game() {
        game("1");
        game("2");
        silent = Set.of("1");

        BoardGameExpansionBackfill.Result result = backfill(true, 10).run();

        assertThat(result.stoppedOnUnavailable()).isTrue();
        assertThat(asked).containsExactly("1");
        assertThat(cache.rows).isEmpty();
    }

    @Test
    void reads_a_few_games_per_run_and_skips_the_games_without_a_bgg_id() {
        game("1");
        game("2");
        entities.save(Entity.create(EntityTypeFixtures.BOARD_GAME.id(), "Jeu maison"));

        backfill(true, 1).run();

        assertThat(asked).hasSize(1);
    }

    @Test
    void does_nothing_when_off() {
        game("1");

        backfill(false, 10).scheduled();

        assertThat(asked).isEmpty();
    }

    private void game(String bggId) {
        Entity game = Entity.create(EntityTypeFixtures.BOARD_GAME.id(), "Jeu " + bggId);
        game.mergeAttributes(Map.of("bggId", bggId));
        entities.save(game);
    }
}
