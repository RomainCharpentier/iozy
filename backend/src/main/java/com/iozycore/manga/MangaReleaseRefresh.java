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
 * La nuit, le calendrier des sorties relit les séries de mangas EN COURS pour
 * que les tomes annoncés finissent par y être (lot 146).
 *
 * <h2>Pourquoi une relecture, et pourquoi la nuit</h2>
 * Le résultat d'une recherche de tomes est stocké une fois pour toutes
 * ({@code volume_search_cache}) : c'est ce qui rend la fiche instantanée et
 * ménage les quotas. Mais un tome annoncé après cette recherche n'y entrera
 * jamais seul, et un calendrier qui ne verrait que les tomes d'hier mentirait
 * par omission. D'où une relecture, bornée pour que le quota journalier de
 * Google Books reste à ceux qui l'utilisent le jour : quelques séries par
 * nuit ({@code series-per-run}), les plus anciennes d'abord, et seulement
 * celles qu'une base de mangas dit en cours - une série terminée n'annonce
 * plus rien.
 *
 * <h2>Le catalogue, pas les collections</h2>
 * Les séries lues sont celles du catalogue de l'instance, commun à tous les
 * comptes : hors de toute session, les possessions ne se lisent pas (le
 * cloisonnement par propriétaire rend « personne »), et le catalogue est
 * précisément ce que tous ont ajouté. Une série que plus personne ne possède
 * peut être relue pour rien ; c'est le prix d'un travail de nuit qui ne
 * franchit aucune porte.
 *
 * <h2>Une panne ne coûte rien</h2>
 * Un fournisseur muet arrête la nuit sans rien effacer : voir
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

    /** Ce qu'une nuit a fait : combien de séries étaient à relire, combien l'ont été, et si une source s'est tue. */
    public record Summary(int stale, int refreshed, boolean stoppedOnUnavailableProvider) {
    }

    @Scheduled(cron = "${iozycore.releases.refresh.cron:0 30 4 * * *}")
    public void nightly() {
        try {
            Summary summary = refresh();
            log.info("Calendrier des sorties : {} série(s) à relire, {} relue(s){}", summary.stale(), summary.refreshed(),
                    summary.stoppedOnUnavailableProvider() ? ", arrêt sur un fournisseur muet" : "");
        } catch (RuntimeException e) {
            // Un travail de nuit qui lève ferait taire le planificateur pour cette exécution seulement,
            // mais sans une ligne pour le dire : la voici.
            log.warn("Calendrier des sorties : la relecture nocturne a échoué : {}", e.getMessage());
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

        // Une série par clé (titre, auteur) : deux fiches homonymes partagent le même résultat stocké.
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
                // Jamais relues d'abord, puis les plus anciennes.
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
