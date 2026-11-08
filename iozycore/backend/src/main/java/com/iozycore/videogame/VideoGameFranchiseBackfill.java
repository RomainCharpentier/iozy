package com.iozycore.videogame;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.core.metadata.SourceUnavailableException;
import com.iozycore.videogame.franchise.Franchise;
import com.iozycore.videogame.franchise.FranchiseCache;
import com.iozycore.videogame.franchise.FranchiseSource;
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
 * Reads the licence of the video games of the catalog from IGDB, by itself
 * (lot 211), into {@code video_game_franchise_cache}.
 *
 * <p>Off without the IGDB key: IGDB has no mode without it, and a run then
 * asks nothing. Otherwise the same rules as the other backfills: a few games
 * per run, a pause between two, the run stops at the first silent answer
 * (nothing written for that game), never-read games first, a stored answer
 * read again after {@code refresh-after-days}.
 */
@Component
@Slf4j
public class VideoGameFranchiseBackfill {

    static final String IGDB_ID = "igdbId";
    private static final String VIDEO_GAME = "VIDEO_GAME";

    private final EntityTypeRepository entityTypeRepository;
    private final EntityRepository entityRepository;
    private final FranchiseCache cache;
    private final FranchiseSource source;
    private final boolean enabled;
    private final int gamesPerRun;
    private final Duration pause;
    private final Duration refreshAfter;
    private final Clock clock;

    @Autowired
    public VideoGameFranchiseBackfill(EntityTypeRepository entityTypeRepository, EntityRepository entityRepository,
                                      FranchiseCache cache, FranchiseSource source,
                                      @Value("${iozycore.video-game-franchises.backfill.enabled:true}") boolean enabled,
                                      @Value("${iozycore.video-game-franchises.backfill.games-per-run:10}") int gamesPerRun,
                                      @Value("${iozycore.video-game-franchises.backfill.pause-ms:1000}") long pauseMs,
                                      @Value("${iozycore.video-game-franchises.backfill.refresh-after-days:30}")
                                      long refreshAfterDays) {
        this(entityTypeRepository, entityRepository, cache, source, enabled, gamesPerRun, Duration.ofMillis(pauseMs),
                Duration.ofDays(refreshAfterDays), Clock.systemUTC());
    }

    VideoGameFranchiseBackfill(EntityTypeRepository entityTypeRepository, EntityRepository entityRepository,
                               FranchiseCache cache, FranchiseSource source, boolean enabled, int gamesPerRun,
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
    @Scheduled(initialDelayString = "${iozycore.video-game-franchises.backfill.initial-delay-ms:330000}",
               fixedDelayString = "${iozycore.video-game-franchises.backfill.every-ms:3600000}")
    public void scheduled() {
        if (!enabled) {
            return;
        }
        try {
            Result result = run();
            log.info("Video game licence backfill: {} games asked, {} stored{}", result.gamesAsked(),
                    result.gamesStored(), result.stoppedOnUnavailable() ? ", stopped on a silent provider" : "");
        } catch (RuntimeException e) {
            // A background job must never take the application down with it.
            log.warn("Video game licence backfill failed: {}", e.getMessage());
        }
    }

    public synchronized Result run() {
        if (!source.configured()) {
            return new Result(0, 0, false);
        }
        Optional<EntityType> type = entityTypeRepository.findByCode(VIDEO_GAME);
        if (type.isEmpty()) {
            return new Result(0, 0, false);
        }
        Instant now = clock.instant();
        Map<String, Instant> fetched = cache.fetchedAtById();
        Set<String> ids = new LinkedHashSet<>();
        for (Entity game : entityRepository.findAllByType(type.get().id())) {
            Optional.ofNullable(textOf(game.attributes().get(IGDB_ID))).ifPresent(ids::add);
        }
        List<String> due = ids.stream()
                .filter(id -> !fetched.containsKey(id) || !fetched.get(id).plus(refreshAfter).isAfter(now))
                .sorted(Comparator.comparing(fetched::get, Comparator.nullsFirst(Comparator.<Instant>naturalOrder())))
                .toList();
        int asked = 0;
        int stored = 0;
        for (String igdbId : due) {
            if (asked >= gamesPerRun) {
                break;
            }
            if (asked > 0) {
                waitBetweenGames();
            }
            asked++;
            Franchise franchise;
            try {
                franchise = source.franchiseOf(igdbId);
            } catch (SourceUnavailableException e) {
                // Silence is not an answer: nothing is written, the next run tries again.
                log.info("Video game licence backfill: IGDB silent for {}: {}", igdbId, e.getMessage());
                return new Result(asked, stored, true);
            }
            cache.save(igdbId, franchise, now);
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
