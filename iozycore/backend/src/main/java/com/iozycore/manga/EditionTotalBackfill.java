package com.iozycore.manga;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.core.domain.insights.CollectionProgress;
import com.iozycore.manga.application.CataloguedEditions;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.manga.domain.MangaEditionRepository;
import com.iozycore.manga.metadata.RelatedSeriesService;
import com.iozycore.manga.metadata.SeriesStatus;
import com.iozycore.manga.metadata.TomeSearchService;
import com.iozycore.manga.metadata.VolumeSearchResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Fills the volume count of the French editions, by itself (lot 207).
 *
 * <h2>Why</h2>
 * Without a total, a series can say what it holds but never what is
 * missing: on the owner's collection, 15 of 19 manga series had none, because
 * only a person ever typed it. The French volume lists are already read for
 * the covers and the release calendar; this job reads the count from them.
 * The rules live in {@link EditionTotalRule}.
 *
 * <h2>What it touches</h2>
 * Every named edition of the manga series of the catalogue (the catalogue is
 * shared, and a series is there because someone keeps or wants it; the job
 * runs outside any session, like the cover backfill). A total typed by a
 * person ({@code MANUAL}) is never touched, and neither is a run a source
 * said is finished. The others are read again once {@code recheck-after-days}
 * have passed since the last answer: an ongoing series gets its new volumes.
 * A series whose volumes carry no edition name is left out: the progress of
 * such a group has no edition to hold a total.
 *
 * <h2>An edition missing from the reference</h2>
 * A named edition without a row gets one through {@link MangaEditionLinker},
 * the same path as a volume added by hand - never a second way of creating
 * one.
 *
 * <h2>Gentle with the providers</h2>
 * The volume search of {@link TomeSearchService}, served from its cache when
 * fresh, as for the covers. A few series per run, a pause between two, and
 * the run stops at the first series that gets nothing while a provider is
 * silent: nothing is written for it, not even the check time, so the next run
 * tries again. A partial answer (one source silent, volumes found) writes
 * what it found but does not mark the other editions as checked.
 */
@Component
@Slf4j
public class EditionTotalBackfill {

    private static final String MANGA = "MANGA";

    private final EntityTypeRepository entityTypeRepository;
    private final EntityRepository entityRepository;
    private final MangaEditionRepository mangaEditionRepository;
    private final MangaEditionLinker mangaEditionLinker;
    private final TomeSearchService tomeSearchService;
    private final RelatedSeriesService relatedSeriesService;
    private final boolean enabled;
    private final int seriesPerRun;
    private final Duration pause;
    private final Duration recheckAfter;
    private final Clock clock;

    @Autowired
    public EditionTotalBackfill(EntityTypeRepository entityTypeRepository, EntityRepository entityRepository,
                                MangaEditionRepository mangaEditionRepository, MangaEditionLinker mangaEditionLinker,
                                TomeSearchService tomeSearchService, RelatedSeriesService relatedSeriesService,
                                @Value("${iozycore.edition-totals.backfill.enabled:true}") boolean enabled,
                                @Value("${iozycore.edition-totals.backfill.series-per-run:10}") int seriesPerRun,
                                @Value("${iozycore.edition-totals.backfill.pause-ms:3000}") long pauseMs,
                                @Value("${iozycore.edition-totals.backfill.recheck-after-days:7}") long recheckAfterDays) {
        this(entityTypeRepository, entityRepository, mangaEditionRepository, mangaEditionLinker, tomeSearchService,
                relatedSeriesService, enabled, seriesPerRun, Duration.ofMillis(pauseMs),
                Duration.ofDays(recheckAfterDays), Clock.systemUTC());
    }

    EditionTotalBackfill(EntityTypeRepository entityTypeRepository, EntityRepository entityRepository,
                         MangaEditionRepository mangaEditionRepository, MangaEditionLinker mangaEditionLinker,
                         TomeSearchService tomeSearchService, RelatedSeriesService relatedSeriesService,
                         boolean enabled, int seriesPerRun, Duration pause, Duration recheckAfter, Clock clock) {
        this.entityTypeRepository = entityTypeRepository;
        this.entityRepository = entityRepository;
        this.mangaEditionRepository = mangaEditionRepository;
        this.mangaEditionLinker = mangaEditionLinker;
        this.tomeSearchService = tomeSearchService;
        this.relatedSeriesService = relatedSeriesService;
        this.enabled = enabled;
        this.seriesPerRun = seriesPerRun;
        this.pause = pause;
        this.recheckAfter = recheckAfter;
        this.clock = clock;
    }

    /** What one run did. */
    public record Result(int seriesSearched, int totalsSet, boolean stoppedOnUnavailable) {
    }

    /** A little after each start (after the covers and the shelf details), then every hour; a run with nothing due is
     *  a few database reads (see application.yml). */
    @Scheduled(initialDelayString = "${iozycore.edition-totals.backfill.initial-delay-ms:240000}",
               fixedDelayString = "${iozycore.edition-totals.backfill.every-ms:3600000}")
    public void scheduled() {
        if (!enabled) {
            return;
        }
        try {
            Result result = run();
            log.info("Edition total backfill: {} series searched, {} totals set{}", result.seriesSearched(),
                    result.totalsSet(), result.stoppedOnUnavailable() ? ", stopped on a silent provider" : "");
        } catch (RuntimeException e) {
            // A background job must never take the application down with it.
            log.warn("Edition total backfill failed: {}", e.getMessage());
        }
    }

    public synchronized Result run() {
        Optional<EntityType> manga = entityTypeRepository.findByCode(MANGA);
        if (manga.isEmpty()) {
            return new Result(0, 0, false);
        }
        EntityType type = manga.get();
        Instant now = clock.instant();
        int searched = 0;
        int set = 0;
        // All the editions in one read: a run with nothing due stays a few queries.
        Map<String, MangaEdition> known = new HashMap<>();
        for (MangaEdition edition : mangaEditionRepository.findAll()) {
            if (edition.entityId() != null) {
                known.put(CollectionProgress.editionKey(edition.entityId(), edition.editionName()), edition);
            }
        }
        for (Entity entity : entityRepository.findAllByType(type.id())) {
            Map<String, Integer> editions = CataloguedEditions.of(entity);
            Map<String, MangaEdition> due = dueEditions(entity, editions, known, now);
            if (due.isEmpty()) {
                continue;
            }
            if (searched >= seriesPerRun) {
                break;
            }
            if (searched > 0) {
                waitBetweenSeries();
            }
            searched++;
            VolumeSearchResult result = search(type, entity);
            if (result.providerUnavailable() && result.volumes().isEmpty()) {
                // Silence is not an answer: nothing is written, the next run tries again.
                return new Result(searched, set, true);
            }
            Integer originalTotal = positiveNumber(entity.attributes().get("totalVolumes"));
            boolean originalFinished = SeriesStatus.isFinished(entity.attributes().get("seriesStatus"));
            for (Map.Entry<String, MangaEdition> entry : due.entrySet()) {
                String name = entry.getKey();
                Optional<EditionTotalRule.Found> found = EditionTotalRule.fromCandidates(name, result.volumes(),
                        editions.get(name), originalTotal, originalFinished);
                if (found.isEmpty() && result.providerUnavailable()) {
                    // A silent source may hold this edition: do not mark it as checked.
                    continue;
                }
                MangaEdition edition = entry.getValue() != null ? entry.getValue() : createEdition(entity, name);
                if (edition == null) {
                    continue;
                }
                MangaEdition updated = EditionTotalRule.apply(edition, found, now);
                mangaEditionRepository.save(updated);
                if (found.isPresent() && !updated.totalVolumes().equals(edition.totalVolumes())) {
                    set++;
                }
            }
        }
        return new Result(searched, set, false);
    }

    /** The named editions of this series that the job should read again: name -> row, or null when none yet. */
    private Map<String, MangaEdition> dueEditions(Entity entity, Map<String, Integer> editions,
                                                  Map<String, MangaEdition> known, Instant now) {
        Map<String, MangaEdition> due = new LinkedHashMap<>();
        for (String name : editions.keySet()) {
            MangaEdition edition = known.get(CollectionProgress.editionKey(entity.id(), name));
            if (EditionTotalRule.isDue(edition, now, recheckAfter)) {
                due.put(name, edition);
            }
        }
        return due;
    }

    private VolumeSearchResult search(EntityType type, Entity entity) {
        var excluded = relatedSeriesService.findExcludedTitleFragments(type, textOf(entity, "malId"),
                Optional.ofNullable(textOf(entity, "titleEnglish")).orElse(textOf(entity, "originalTitle")),
                textOf(entity, "titleRomaji"));
        String author = Optional.ofNullable(textOf(entity, "mangaka")).orElse("");
        return tomeSearchService.searchVolumes(type, entity.title(), author, false, excluded,
                positiveNumber(entity.attributes().get("totalVolumes")));
    }

    /** Through the linker, like a volume added by hand; the row it found or created. */
    private MangaEdition createEdition(Entity entity, String name) {
        return mangaEditionLinker.editionIdPour(entity, name)
                .flatMap(mangaEditionRepository::findById)
                .orElse(null);
    }

    private void waitBetweenSeries() {
        try {
            Thread.sleep(pause.toMillis());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private static String textOf(Entity entity, String key) {
        Object value = entity.attributes().get(key);
        return value instanceof String text && !text.isBlank() ? text : null;
    }

    private static Integer positiveNumber(Object value) {
        if (value instanceof Number number && number.intValue() > 0) {
            return number.intValue();
        }
        if (value instanceof String text) {
            try {
                int parsed = Integer.parseInt(text.trim());
                return parsed > 0 ? parsed : null;
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }
}
