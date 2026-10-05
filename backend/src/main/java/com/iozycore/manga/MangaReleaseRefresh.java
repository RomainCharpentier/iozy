package com.iozycore.manga;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.core.domain.shared.TexteRecherche;
import com.iozycore.manga.metadata.RelatedSeriesService;
import com.iozycore.manga.metadata.SeriesStatus;
import com.iozycore.manga.metadata.StoredVolumeSearch;
import com.iozycore.manga.metadata.StoredVolumeSearchKey;
import com.iozycore.manga.metadata.TomeSearchService;
import com.iozycore.manga.metadata.VolumeSearchCacheRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * At night, the release calendar re-reads the series of ONGOING mangas so
 * that announced volumes end up being there (batch 146).
 *
 * <h2>Why a re-read, and why at night</h2>
 * The result of a volume search is stored once and for all
 * ({@code volume_search_cache}): this is what makes the detail page instant and
 * spares the quotas. But a volume announced after this search will never enter it
 * on its own, and a calendar that only saw yesterday's volumes would lie
 * by omission. Hence a re-read, limited so that the daily quota of
 * Google Books stays for those who use it during the day: a few series per
 * night ({@code series-per-run}), the oldest first, and only
 * the ones a manga database says are ongoing - a finished series announces
 * nothing anymore.
 *
 * <h2>The catalog, not the collections</h2>
 * The series read are those of the catalog of the instance, common to all
 * accounts: outside any session, ownerships cannot be read (the separation
 * by owner returns "nobody"), and the catalog is
 * precisely what everyone added. A series that nobody owns anymore
 * may be re-read for nothing; this is the price of a night job that
 * crosses no door.
 *
 * <h2>An outage costs nothing</h2>
 * A silent provider stops the night without erasing anything: see
 * {@link TomeSearchService#refreshUnlessUnavailable}.
 */
@Component
@ConditionalOnProperty(prefix = "iozycore.releases.refresh", name = "enabled", havingValue = "true", matchIfMissing = true)
public class MangaReleaseRefresh {

    private static final Logger log = LoggerFactory.getLogger(MangaReleaseRefresh.class);
    private static final String MANGA = "MANGA";

    private final EntityTypeRepository entityTypeRepository;
    private final EntityRepository entityRepository;
    private final VolumeSearchCacheRepository volumeSearchCacheRepository;
    private final TomeSearchService tomeSearchService;
    private final RelatedSeriesService relatedSeriesService;
    private final int seriesPerRun;
    private final Duration staleAfter;
    private final Clock clock;

    @Autowired
    public MangaReleaseRefresh(EntityTypeRepository entityTypeRepository, EntityRepository entityRepository,
                               VolumeSearchCacheRepository volumeSearchCacheRepository, TomeSearchService tomeSearchService,
                               RelatedSeriesService relatedSeriesService,
                               @Value("${iozycore.releases.refresh.series-per-run:10}") int seriesPerRun,
                               @Value("${iozycore.releases.refresh.stale-after-days:7}") int staleAfterDays) {
        this(entityTypeRepository, entityRepository, volumeSearchCacheRepository, tomeSearchService, relatedSeriesService,
                seriesPerRun, Duration.ofDays(staleAfterDays), Clock.systemUTC());
    }

    MangaReleaseRefresh(EntityTypeRepository entityTypeRepository, EntityRepository entityRepository,
                        VolumeSearchCacheRepository volumeSearchCacheRepository, TomeSearchService tomeSearchService,
                        RelatedSeriesService relatedSeriesService, int seriesPerRun, Duration staleAfter, Clock clock) {
        this.entityTypeRepository = entityTypeRepository;
        this.entityRepository = entityRepository;
        this.volumeSearchCacheRepository = volumeSearchCacheRepository;
        this.tomeSearchService = tomeSearchService;
        this.relatedSeriesService = relatedSeriesService;
        this.seriesPerRun = seriesPerRun;
        this.staleAfter = staleAfter;
        this.clock = clock;
    }

    /** What a night did: how many series were to be re-read, how many were, and whether a source went silent. */
    public record Summary(int stale, int refreshed, boolean stoppedOnUnavailableProvider) {
    }

    @Scheduled(cron = "${iozycore.releases.refresh.cron:0 30 4 * * *}")
    public void nightly() {
        try {
            Summary summary = refresh();
            log.info("Release calendar: {} series to re-read, {} re-read{}", summary.stale(), summary.refreshed(),
                    summary.stoppedOnUnavailableProvider() ? ", stopped on a silent provider" : "");
        } catch (RuntimeException e) {
            // A night job that throws would silence the scheduler for this run only,
            // but without a line to say it: here it is.
            log.warn("Release calendar: the night re-read failed: {}", e.getMessage());
        }
    }

    public Summary refresh() {
        Optional<EntityType> manga = entityTypeRepository.findByCode(MANGA);
        if (manga.isEmpty()) {
            return new Summary(0, 0, false);
        }
        EntityType type = manga.get();
        Map<String, Instant> fetchedAtByKey = volumeSearchCacheRepository.findKeysByEntityTypeId(type.id()).stream()
                .collect(Collectors.toMap(StoredVolumeSearchKey::key, StoredVolumeSearchKey::fetchedAt, (a, b) -> a));
        Instant threshold = clock.instant().minus(staleAfter);

        // One series per key (title, author): two homonym pages share the same stored result.
        Map<String, Entity> ongoingByKey = new LinkedHashMap<>();
        for (Entity entity : entityRepository.findAllByType(type.id())) {
            String author = TexteRecherche.normaliser(authorOf(entity));
            if (!SeriesStatus.isOngoing(entity.attributes().get("seriesStatus")) || author.isBlank()) {
                continue;
            }
            ongoingByKey.putIfAbsent(StoredVolumeSearch.key(TexteRecherche.normaliser(entity.title()), author), entity);
        }
        List<Map.Entry<String, Entity>> stale = ongoingByKey.entrySet().stream()
                .filter(entry -> {
                    Instant fetchedAt = fetchedAtByKey.get(entry.getKey());
                    return fetchedAt == null || fetchedAt.isBefore(threshold);
                })
                // Never re-read first, then the oldest.
                .sorted(Comparator.comparing((Map.Entry<String, Entity> entry) ->
                        Optional.ofNullable(fetchedAtByKey.get(entry.getKey())).orElse(Instant.MIN)))
                .toList();

        int refreshed = 0;
        List<Entity> batch = new ArrayList<>(stale.stream().map(Map.Entry::getValue).limit(seriesPerRun).toList());
        for (Entity entity : batch) {
            List<String> excluded = relatedSeriesService.findExcludedTitleFragments(type, textOf(entity, "malId"),
                    Optional.ofNullable(textOf(entity, "titleEnglish")).orElse(textOf(entity, "originalTitle")),
                    textOf(entity, "titleRomaji"));
            boolean done = tomeSearchService.refreshUnlessUnavailable(type, entity.title(), authorOf(entity), excluded,
                    totalVolumesOf(entity));
            if (!done) {
                return new Summary(stale.size(), refreshed, true);
            }
            refreshed++;
        }
        return new Summary(stale.size(), refreshed, false);
    }

    private static String authorOf(Entity entity) {
        String mangaka = textOf(entity, "mangaka");
        return mangaka == null ? "" : mangaka;
    }

    private static String textOf(Entity entity, String key) {
        Object value = entity.attributes().get(key);
        return value instanceof String text && !text.isBlank() ? text : null;
    }

    private static Integer totalVolumesOf(Entity entity) {
        Object value = entity.attributes().get("totalVolumes");
        return value instanceof Number number && number.intValue() > 0 ? number.intValue() : null;
    }
}
