package com.iozycore.manga;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.core.domain.shared.TexteRecherche;
import com.iozycore.core.application.insights.ReleaseRefreshSource;
import com.iozycore.manga.metadata.RelatedSeriesService;
import com.iozycore.manga.metadata.SeriesStatus;
import com.iozycore.manga.metadata.StoredVolumeSearch;
import com.iozycore.manga.metadata.StoredVolumeSearchKey;
import com.iozycore.manga.metadata.TomeSearchService;
import com.iozycore.manga.metadata.VolumeSearchCacheRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
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
 * The release calendar re-reads the series of ONGOING mangas so that announced
 * volumes end up being there (batch 146). It is a {@link ReleaseRefreshSource}:
 * the core runs it at night and when a person asks, and records each pass.
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
 * <h2>Which series (lot 208)</h2>
 * Those that can still announce a volume ({@link SeriesStatus#mayAnnounceVolumes}:
 * ongoing, on hiatus, not started). A finished series is not re-read: it has
 * nothing left to announce. The author is no longer required: a series whose
 * author is unknown is searched by its title, and the calendar reads the result
 * by (title, "").
 *
 * <h2>An outage costs nothing</h2>
 * A silent provider erases nothing: see {@link TomeSearchService#refreshUnlessUnavailable}.
 * It no longer ends the pass at the first series: another series, or another
 * provider, may still answer. The pass stops after {@code max-silent-series-in-a-row}
 * series in a row with no answer at all (a spent quota), waits
 * {@code pause-between-series-ms} between two series, and never reads more
 * than {@code series-per-run}.
 */
@Component
public class MangaReleaseRefresh implements ReleaseRefreshSource {

    private static final String MANGA = "MANGA";

    private final EntityTypeRepository entityTypeRepository;
    private final EntityRepository entityRepository;
    private final VolumeSearchCacheRepository volumeSearchCacheRepository;
    private final TomeSearchService tomeSearchService;
    private final RelatedSeriesService relatedSeriesService;
    private final int seriesPerRun;
    private final Duration staleAfter;
    private final Clock clock;
    private final Duration pauseBetweenSeries;
    private final int maxSilentInARow;

    @Autowired
    public MangaReleaseRefresh(EntityTypeRepository entityTypeRepository, EntityRepository entityRepository,
                               VolumeSearchCacheRepository volumeSearchCacheRepository, TomeSearchService tomeSearchService,
                               RelatedSeriesService relatedSeriesService,
                               @Value("${iozycore.releases.refresh.series-per-run:10}") int seriesPerRun,
                               @Value("${iozycore.releases.refresh.stale-after-days:7}") int staleAfterDays,
                               @Value("${iozycore.releases.refresh.pause-between-series-ms:2000}") long pauseMs,
                               @Value("${iozycore.releases.refresh.max-silent-series-in-a-row:3}") int maxSilentInARow) {
        this(entityTypeRepository, entityRepository, volumeSearchCacheRepository, tomeSearchService, relatedSeriesService,
                seriesPerRun, Duration.ofDays(staleAfterDays), Clock.systemUTC(), Duration.ofMillis(pauseMs),
                maxSilentInARow);
    }

    MangaReleaseRefresh(EntityTypeRepository entityTypeRepository, EntityRepository entityRepository,
                        VolumeSearchCacheRepository volumeSearchCacheRepository, TomeSearchService tomeSearchService,
                        RelatedSeriesService relatedSeriesService, int seriesPerRun, Duration staleAfter, Clock clock) {
        this(entityTypeRepository, entityRepository, volumeSearchCacheRepository, tomeSearchService, relatedSeriesService,
                seriesPerRun, staleAfter, clock, Duration.ZERO, 3);
    }

    MangaReleaseRefresh(EntityTypeRepository entityTypeRepository, EntityRepository entityRepository,
                        VolumeSearchCacheRepository volumeSearchCacheRepository, TomeSearchService tomeSearchService,
                        RelatedSeriesService relatedSeriesService, int seriesPerRun, Duration staleAfter, Clock clock,
                        Duration pauseBetweenSeries, int maxSilentInARow) {
        this.entityTypeRepository = entityTypeRepository;
        this.entityRepository = entityRepository;
        this.volumeSearchCacheRepository = volumeSearchCacheRepository;
        this.tomeSearchService = tomeSearchService;
        this.relatedSeriesService = relatedSeriesService;
        this.seriesPerRun = seriesPerRun;
        this.staleAfter = staleAfter;
        this.clock = clock;
        this.pauseBetweenSeries = pauseBetweenSeries;
        this.maxSilentInARow = Math.max(1, maxSilentInARow);
    }

    @Override
    public Result refresh() {
        Optional<EntityType> manga = entityTypeRepository.findByCode(MANGA);
        if (manga.isEmpty()) {
            return new Result(0, 0, false);
        }
        EntityType type = manga.get();
        Map<String, Instant> fetchedAtByKey = volumeSearchCacheRepository.findKeysByEntityTypeId(type.id()).stream()
                .collect(Collectors.toMap(StoredVolumeSearchKey::key, StoredVolumeSearchKey::fetchedAt, (a, b) -> a));
        Instant threshold = clock.instant().minus(staleAfter);

        // One series per key (title, author): two homonym pages share the same stored result.
        Map<String, Entity> ongoingByKey = new LinkedHashMap<>();
        for (Entity entity : entityRepository.findAllByType(type.id())) {
            if (!SeriesStatus.mayAnnounceVolumes(entity.attributes().get("seriesStatus"))) {
                continue;
            }
            String author = TexteRecherche.normaliser(authorOf(entity));
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
        int silentInARow = 0;
        boolean providerSilent = false;
        List<Entity> batch = new ArrayList<>(stale.stream().map(Map.Entry::getValue).limit(seriesPerRun).toList());
        for (int i = 0; i < batch.size(); i++) {
            if (i > 0 && !pause()) {
                break;
            }
            Entity entity = batch.get(i);
            List<String> excluded = relatedSeriesService.findExcludedTitleFragments(type, textOf(entity, "malId"),
                    Optional.ofNullable(textOf(entity, "titleEnglish")).orElse(textOf(entity, "originalTitle")),
                    textOf(entity, "titleRomaji"));
            TomeSearchService.CalendarRefresh outcome = tomeSearchService.refreshUnlessUnavailable(type, entity.title(),
                    authorOf(entity), excluded, totalVolumesOf(entity));
            if (outcome == TomeSearchService.CalendarRefresh.SILENT) {
                providerSilent = true;
                silentInARow++;
                if (silentInARow >= maxSilentInARow) {
                    // Most likely a spent quota: stop asking until the next pass.
                    break;
                }
                continue;
            }
            providerSilent |= outcome == TomeSearchService.CalendarRefresh.MERGED;
            silentInARow = 0;
            refreshed++;
        }
        return new Result(stale.size(), refreshed, providerSilent);
    }

    /** Waits between two series. False when the pass was interrupted (given up as stuck). */
    private boolean pause() {
        if (pauseBetweenSeries.isZero() || pauseBetweenSeries.isNegative()) {
            return !Thread.currentThread().isInterrupted();
        }
        try {
            Thread.sleep(pauseBetweenSeries.toMillis());
            return true;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
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
