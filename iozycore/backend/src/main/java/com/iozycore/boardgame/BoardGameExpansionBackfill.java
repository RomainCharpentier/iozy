package com.iozycore.boardgame;

import com.iozycore.boardgame.expansion.BoardGameExpansion;
import com.iozycore.boardgame.expansion.ExpansionCache;
import com.iozycore.boardgame.expansion.ExpansionSource;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.core.metadata.SourceUnavailableException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Reads the expansions of the board games of the catalog from BoardGameGeek,
 * by itself (lot 211), into {@code board_game_expansion_cache}.
 *
 * <h2>Why a job</h2>
 * The page of a board game lists its expansions, but a page read must never
 * wait on BGG: the expansions are read in the background and the page shows
 * what is stored, or says it has nothing yet.
 *
 * <h2>Gentle with BGG</h2>
 * A few games per run, a pause between two, and the run stops at the first
 * silent answer: nothing is written for that game, the next run tries again.
 * Games never read come first, then the oldest read; a stored answer is read
 * again after {@code refresh-after-days}. Like the other backfills, the
 * catalog is shared and this runs outside any session.
 */
@Component
@Slf4j
public class BoardGameExpansionBackfill {

    static final String BGG_ID = "bggId";
    private static final String BOARD_GAME = "BOARD_GAME";

    private final EntityTypeRepository entityTypeRepository;
    private final EntityRepository entityRepository;
    private final ExpansionCache cache;
    private final ExpansionSource source;
    private final boolean enabled;
    private final int gamesPerRun;
    private final Duration pause;
    private final Duration refreshAfter;
    private final Clock clock;

    @Autowired
    public BoardGameExpansionBackfill(EntityTypeRepository entityTypeRepository, EntityRepository entityRepository,
                                      ExpansionCache cache, ExpansionSource source,
                                      @Value("${iozycore.board-game-expansions.backfill.enabled:true}") boolean enabled,
                                      @Value("${iozycore.board-game-expansions.backfill.games-per-run:10}") int gamesPerRun,
                                      @Value("${iozycore.board-game-expansions.backfill.pause-ms:2000}") long pauseMs,
                                      @Value("${iozycore.board-game-expansions.backfill.refresh-after-days:30}")
                                      long refreshAfterDays) {
        this(entityTypeRepository, entityRepository, cache, source, enabled, gamesPerRun, Duration.ofMillis(pauseMs),
                Duration.ofDays(refreshAfterDays), Clock.systemUTC());
    }

    BoardGameExpansionBackfill(EntityTypeRepository entityTypeRepository, EntityRepository entityRepository,
                               ExpansionCache cache, ExpansionSource source, boolean enabled, int gamesPerRun,
                               Duration pause, Duration refreshAfter, Clock clock) {
        this.entityTypeRepository = entityTypeRepository;
        this.entityRepository = entityRepository;
        this.cache = cache;
        this.source = source;
        this.enabled = enabled;
        this.gamesPerRun = gamesPerRun;
        this.pause = pause;
        this.refreshAfter = refreshAfter;
        this.clock = clock;
    }

    /** What one run did. */
    public record Result(int gamesAsked, int gamesStored, boolean stoppedOnUnavailable) {
    }

    /** A little after each start (after the other backfills), then every hour. */
    @Scheduled(initialDelayString = "${iozycore.board-game-expansions.backfill.initial-delay-ms:300000}",
               fixedDelayString = "${iozycore.board-game-expansions.backfill.every-ms:3600000}")
    public void scheduled() {
        if (!enabled) {
            return;
        }
        try {
            Result result = run();
            log.info("Board game expansion backfill: {} games asked, {} stored{}", result.gamesAsked(),
                    result.gamesStored(), result.stoppedOnUnavailable() ? ", stopped on a silent provider" : "");
        } catch (RuntimeException e) {
            // A background job must never take the application down with it.
            log.warn("Board game expansion backfill failed: {}", e.getMessage());
        }
    }

    public synchronized Result run() {
        Optional<EntityType> type = entityTypeRepository.findByCode(BOARD_GAME);
        if (type.isEmpty()) {
            return new Result(0, 0, false);
        }
        Instant now = clock.instant();
        Map<String, Instant> fetched = cache.fetchedAtByBaseId();
        Set<String> ids = new LinkedHashSet<>();
        for (Entity game : entityRepository.findAllByType(type.get().id())) {
            String bggId = textOf(game.attributes().get(BGG_ID));
            if (bggId != null) {
                ids.add(bggId);
            }
        }
        List<String> due = ids.stream()
                .filter(id -> !fetched.containsKey(id) || !fetched.get(id).plus(refreshAfter).isAfter(now))
                .sorted(Comparator.comparing(fetched::get, Comparator.nullsFirst(Comparator.<Instant>naturalOrder())))
                .toList();
        int asked = 0;
        int stored = 0;
        for (String bggId : due) {
            if (asked >= gamesPerRun) {
                break;
            }
            if (asked > 0) {
                waitBetweenGames();
            }
            asked++;
            List<BoardGameExpansion> expansions;
            try {
                expansions = source.expansionsOf(bggId);
            } catch (SourceUnavailableException e) {
                // Silence is not an answer: nothing is written, the next run tries again.
                log.info("Board game expansion backfill: BGG silent for {}: {}", bggId, e.getMessage());
                return new Result(asked, stored, true);
            }
            cache.save(bggId, expansions, now);
            stored++;
        }
        return new Result(asked, stored, false);
    }

    static String textOf(Object value) {
        if (value == null) {
            return null;
        }
        String text = value.toString().trim();
        return text.isEmpty() ? null : text;
    }

    private void waitBetweenGames() {
        try {
            Thread.sleep(pause.toMillis());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
