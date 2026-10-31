package com.iozycore.manga;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.core.domain.catalog.Variant;
import com.iozycore.core.metadata.CoverImageCheck;
import com.iozycore.manga.metadata.RelatedSeriesService;
import com.iozycore.manga.metadata.TomeSearchService;
import com.iozycore.manga.metadata.VolumeCandidate;
import com.iozycore.manga.metadata.VolumeSearchResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Fills the missing covers of the manga volumes, by itself.
 *
 * <h2>Why a job, when a button already exists</h2>
 * A volume added by its number, from a photo of the shelf, or while a
 * provider was down has no cover: the grid of a series then shows numbers
 * where the shelf should show spines. "Retrouver les jaquettes manquantes"
 * (Ma collection, on the manga shelf) fixes it, but it has to be pressed,
 * and the measurement of 2026-10-31 on a real collection found 81 volumes
 * out of 96 without a cover: nobody presses it. The catalogue now does the
 * same work on its own, a little after each start and then every hour, as
 * long as volumes miss a cover.
 *
 * <h2>The same rules as the button</h2>
 * The covers come from the volume searches (BnF first, then Google Books,
 * see {@link TomeSearchService}), served from the cache when fresh. A volume
 * gets the cover of the candidate with the SAME number, of the same edition
 * when one matches (case does not matter), otherwise the first one that has
 * a cover. Never an invented match: a number absent from the search stays
 * without a cover. A cover that a {@link CoverImageCheck} refuses (a dead
 * BnF address) is not written - the same rule as the manual merge.
 *
 * <h2>Gentle with the providers</h2>
 * A bounded number of series per run, the ones with missing covers only, a
 * pause between two series, and the run stops at the first series that gets
 * nothing while a provider is silent, after keeping what it got. Not at the
 * first silent provider, unlike the night refresh of the release calendar
 * ({@link MangaReleaseRefresh}): Google Books at its daily quota is the
 * usual state of an instance, and the covers come from the BnF - stopping
 * there would fill one series a day. The catalogue is shared, so this runs
 * outside any session, like that refresh.
 */
@Component
@Slf4j
public class MangaCoverBackfill {

    private static final String MANGA = "MANGA";
    static final String COVER_IMAGE_URL = "coverImageUrl";
    private static final String VOLUME_NUMBER = "volumeNumber";
    private static final String EDITION = "edition";
    private static final String MANGAKA = "mangaka";

    private final EntityTypeRepository entityTypeRepository;
    private final EntityRepository entityRepository;
    private final TomeSearchService tomeSearchService;
    private final RelatedSeriesService relatedSeriesService;
    private final List<CoverImageCheck> coverChecks;
    private final boolean enabled;
    private final int seriesPerRun;
    private final Duration pause;

    @Autowired
    public MangaCoverBackfill(EntityTypeRepository entityTypeRepository, EntityRepository entityRepository,
                              TomeSearchService tomeSearchService, RelatedSeriesService relatedSeriesService,
                              List<CoverImageCheck> coverChecks,
                              @Value("${iozycore.covers.backfill.enabled:true}") boolean enabled,
                              @Value("${iozycore.covers.backfill.series-per-run:25}") int seriesPerRun,
                              @Value("${iozycore.covers.backfill.pause-ms:1500}") long pauseMs) {
        this(entityTypeRepository, entityRepository, tomeSearchService, relatedSeriesService, coverChecks, enabled,
                seriesPerRun, Duration.ofMillis(pauseMs));
    }

    MangaCoverBackfill(EntityTypeRepository entityTypeRepository, EntityRepository entityRepository,
                       TomeSearchService tomeSearchService, RelatedSeriesService relatedSeriesService,
                       List<CoverImageCheck> coverChecks, boolean enabled, int seriesPerRun, Duration pause) {
        this.entityTypeRepository = entityTypeRepository;
        this.entityRepository = entityRepository;
        this.tomeSearchService = tomeSearchService;
        this.relatedSeriesService = relatedSeriesService;
        this.coverChecks = coverChecks;
        this.enabled = enabled;
        this.seriesPerRun = seriesPerRun;
        this.pause = pause;
    }

    /** What one run did. */
    public record Result(int seriesSearched, int coversSet, boolean stoppedOnUnavailable) {
    }

    /** A little after each start, then every hour: a run stops early when a
     *  source drops the connection (the BnF does, after a burst), and the
     *  next one picks up where it stopped. With nothing missing, a run is
     *  one database read (see application.yml). */
    @Scheduled(initialDelayString = "${iozycore.covers.backfill.initial-delay-ms:120000}",
               fixedDelayString = "${iozycore.covers.backfill.every-ms:3600000}")
    public void scheduled() {
        if (!enabled) {
            return;
        }
        try {
            Result result = run();
            log.info("Cover backfill: {} series searched, {} covers set{}", result.seriesSearched(), result.coversSet(),
                    result.stoppedOnUnavailable() ? ", stopped on a silent provider" : "");
        } catch (RuntimeException e) {
            // A background job must never take the application down with it.
            log.warn("Cover backfill failed: {}", e.getMessage());
        }
    }

    public Result run() {
        Optional<EntityType> manga = entityTypeRepository.findByCode(MANGA);
        if (manga.isEmpty()) {
            return new Result(0, 0, false);
        }
        EntityType type = manga.get();
        int searched = 0;
        int set = 0;
        for (Entity entity : entityRepository.findAllByType(type.id())) {
            List<Variant> missing = volumesWithoutCover(entity);
            if (missing.isEmpty()) {
                continue;
            }
            if (searched >= seriesPerRun) {
                break;
            }
            if (searched > 0) {
                attendre();
            }
            searched++;
            List<String> excluded = relatedSeriesService.findExcludedTitleFragments(type, textOf(entity, "malId"),
                    Optional.ofNullable(textOf(entity, "titleEnglish")).orElse(textOf(entity, "originalTitle")),
                    textOf(entity, "titleRomaji"));
            VolumeSearchResult result = tomeSearchService.searchVolumes(type, entity.title(), authorOf(entity), false,
                    excluded, totalVolumesOf(entity));
            set += apply(entity, missing, result.volumes());
            if (result.providerUnavailable() && result.volumes().isEmpty()) {
                // A silent provider stops the run only once nothing comes
                // back at all: Google Books at its daily quota is the usual
                // case (measured on 2026-10-31), and the covers come from the
                // BnF anyway. Volumes that came back without a cover are an
                // answer (the BnF has no image for old printings), not a
                // silence - stopping there blocked every run on the same
                // series. An empty search while a source was silent is the
                // sign that the useful source is down; the rest waits for the
                // next run rather than hammering it.
                return new Result(searched, set, true);
            }
        }
        return new Result(searched, set, false);
    }

    /** Writes the matching covers on the entity, once, and says how many. */
    private int apply(Entity entity, List<Variant> missing, List<VolumeCandidate> candidates) {
        int set = 0;
        for (Variant variant : missing) {
            Optional<VolumeCandidate> match = bestMatch(candidates, variant);
            if (match.isEmpty()) {
                continue;
            }
            String url = match.get().imageUrl();
            if (coverChecks.stream().anyMatch(check -> !check.estUtilisable(url))) {
                continue;
            }
            entity.mergeVariantAttributes(variant.id(), Map.of(COVER_IMAGE_URL, url));
            set++;
        }
        if (set > 0) {
            entityRepository.save(entity);
        }
        return set;
    }

    /** Same rule as the web's findBestCoverMatch: same number, then same edition, otherwise the first with a cover. */
    static Optional<VolumeCandidate> bestMatch(List<VolumeCandidate> candidates, Variant variant) {
        Integer number = volumeNumberOf(variant);
        if (number == null) {
            return Optional.empty();
        }
        List<VolumeCandidate> sameNumber = new ArrayList<>();
        for (VolumeCandidate candidate : candidates) {
            if (candidate.volumeNumber() == number && candidate.imageUrl() != null && !candidate.imageUrl().isBlank()) {
                sameNumber.add(candidate);
            }
        }
        if (sameNumber.isEmpty()) {
            return Optional.empty();
        }
        String edition = editionOf(variant);
        if (!edition.isEmpty()) {
            for (VolumeCandidate candidate : sameNumber) {
                if (candidate.edition() != null && candidate.edition().trim().equalsIgnoreCase(edition)) {
                    return Optional.of(candidate);
                }
            }
        }
        return Optional.of(sameNumber.get(0));
    }

    /** The volumes of a series that carry a number but no cover. */
    static List<Variant> volumesWithoutCover(Entity entity) {
        List<Variant> missing = new ArrayList<>();
        for (Variant variant : entity.variants()) {
            Object cover = variant.attributes().get(COVER_IMAGE_URL);
            boolean hasCover = cover instanceof String url && !url.isBlank();
            if (!hasCover && volumeNumberOf(variant) != null) {
                missing.add(variant);
            }
        }
        return missing;
    }

    private void attendre() {
        try {
            Thread.sleep(pause.toMillis());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private static String authorOf(Entity entity) {
        String mangaka = textOf(entity, MANGAKA);
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

    private static String editionOf(Variant variant) {
        Object value = variant.attributes().get(EDITION);
        return value instanceof String s ? s.trim() : "";
    }

    /** The attributes are an untyped bag: the number arrives as a number from one provider, as text from another. */
    private static Integer volumeNumberOf(Variant variant) {
        Object value = variant.attributes().get(VOLUME_NUMBER);
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value instanceof String text) {
            try {
                return Integer.parseInt(text.trim());
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }
}
