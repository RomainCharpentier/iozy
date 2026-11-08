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
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

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
 * what it found but marks nothing as checked: the next run reads it again.
 *
 * <h2>No series stuck at the head</h2>
 * The due series are taken in order: the ones this job has never tried
 * first, then the least recently tried, then the one whose editions were read
 * the longest ago (never read first). A series the job tried goes to the back
 * of the queue, even when nothing was written for it (silent provider), so a
 * series that keeps failing does not block the others. The attempts are kept
 * in memory: after a restart the queue starts again from the oldest check.
 *
 * <h2>An edition of another series</h2>
 * The linker can find a row by title alone, and the reference holds one row
 * per (title, edition): a homonym series may already own it. Such a row is
 * left alone - writing a total there would give one series the count of
 * another.
 */
@Component
@Slf4j
public class EditionTotalBackfill {

    private static final String MANGA = "MANGA";
    /** French editions: "out today" is read on the French calendar. */
    private static final ZoneId FRANCE = ZoneId.of("Europe/Paris");

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
    /** When this job last searched each series (see "No series stuck at the head"). */
    private final Map<UUID, Instant> lastAttempts = new HashMap<>();

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
        LocalDate today = LocalDate.ofInstant(now, FRANCE);
        int searched = 0;
        int set = 0;
        // All the editions in one read: a run with nothing due stays a few queries.
        Map<String, MangaEdition> known = new HashMap<>();
        for (MangaEdition edition : mangaEditionRepository.findAll()) {
            if (edition.entityId() != null) {
                known.put(CollectionProgress.editionKey(edition.entityId(), edition.editionName()), edition);
            }
        }
        for (DueSeries series : dueSeries(type, known, now)) {
            if (searched >= seriesPerRun) {
                break;
            }
            if (searched > 0) {
                waitBetweenSeries();
            }
            searched++;
            Entity entity = series.entity();
            lastAttempts.put(entity.id(), now);
            VolumeSearchResult result = search(type, entity);
            if (result.providerUnavailable() && result.volumes().isEmpty()) {
                // Silence is not an answer: nothing is written, the next run tries again.
                return new Result(searched, set, true);
            }
            boolean answeredInFull = !result.providerUnavailable();
            Integer originalTotal = positiveNumber(entity.attributes().get("totalVolumes"));
            boolean originalFinished = SeriesStatus.isFinished(entity.attributes().get("seriesStatus"));
            for (Map.Entry<String, MangaEdition> entry : series.due().entrySet()) {
                String name = entry.getKey();
                Optional<EditionTotalRule.Found> found = EditionTotalRule.fromCandidates(name, result.volumes(),
                        series.editions().get(name), originalTotal, originalFinished, today);
                if (found.isEmpty() && !answeredInFull) {
                    // A silent source may hold this edition: do not mark it as checked.
                    continue;
                }
                MangaEdition edition = entry.getValue() != null ? entry.getValue() : createEdition(entity, name);
                if (edition == null) {
                    continue;
                }
                MangaEdition updated = EditionTotalRule.apply(edition, found, now, answeredInFull);
                mangaEditionRepository.save(updated);
                if (found.isPresent() && !Objects.equals(updated.totalVolumes(), edition.totalVolumes())) {
                    set++;
                }
            }
        }
        return new Result(searched, set, false);
    }

    /** A series with at least one edition to read again: name -> highest volume, and the due rows. */
    private record DueSeries(Entity entity, Map<String, Integer> editions, Map<String, MangaEdition> due) {

        /** The oldest check among the due editions; null when one was never checked. */
        Instant oldestCheck() {
            Instant oldest = Instant.MAX;
            for (MangaEdition edition : due.values()) {
                if (edition == null || edition.totalCheckedAt() == null) {
                    return null;
                }
                if (edition.totalCheckedAt().isBefore(oldest)) {
                    oldest = edition.totalCheckedAt();
                }
            }
            return oldest;
        }
    }

    /** The due series: never tried first, then the least recently tried, then the oldest check. */
    private List<DueSeries> dueSeries(EntityType type, Map<String, MangaEdition> known, Instant now) {
        List<DueSeries> queue = new ArrayList<>();
        for (Entity entity : entityRepository.findAllByType(type.id())) {
            Map<String, Integer> editions = CataloguedEditions.of(entity);
            Map<String, MangaEdition> due = dueEditions(entity, editions, known, now);
            if (!due.isEmpty()) {
                queue.add(new DueSeries(entity, editions, due));
            }
        }
        queue.sort(Comparator
                .comparing((DueSeries series) -> lastAttempts.get(series.entity().id()),
                        Comparator.nullsFirst(Comparator.<Instant>naturalOrder()))
                .thenComparing(DueSeries::oldestCheck, Comparator.nullsFirst(Comparator.<Instant>naturalOrder())));
        return queue;
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
        MangaEdition edition = mangaEditionLinker.editionIdPour(entity, name)
                .flatMap(mangaEditionRepository::findById)
                .orElse(null);
        if (edition != null && !entity.id().equals(edition.entityId())) {
            // A homonym series owns this row (same title, same edition name): not ours to fill.
            log.info("Edition total backfill: edition \"{}\" of \"{}\" belongs to another series, left alone",
                    name, entity.title());
            return null;
        }
        return edition;
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
