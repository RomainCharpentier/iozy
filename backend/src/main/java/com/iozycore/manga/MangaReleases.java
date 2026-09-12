package com.iozycore.manga;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.Variant;
import com.iozycore.core.domain.shared.TexteRecherche;
import com.iozycore.core.insights.ReleaseContext;
import com.iozycore.core.insights.ReleaseDate;
import com.iozycore.core.insights.ReleaseEntry;
import com.iozycore.core.insights.ReleaseSource;
import com.iozycore.manga.domain.followededition.FollowedEdition;
import com.iozycore.manga.domain.followededition.FollowedEditionRepository;
import com.iozycore.manga.metadata.StoredVolumeSearch;
import com.iozycore.manga.metadata.VolumeCandidate;
import com.iozycore.manga.metadata.VolumeSearchCacheRepository;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Le calendrier des sorties, pour les mangas : les tomes datés des séries
 * qu'on possède ou qu'on veut - la façade du module manga vers le cœur
 * (lot 146).
 *
 * <h2>D'où viennent les dates</h2>
 * Du résultat stocké de la recherche de tomes ({@code volume_search_cache}),
 * le même que lit la grille des tomes d'une fiche : Google Books y écrit le
 * jour de parution, précommandes comprises ; la BnF et Open Library n'y
 * mettent que l'année, dont le calendrier ne fait rien. Aucun fournisseur
 * n'est appelé ici : c'est {@link MangaReleaseRefresh} qui relit les séries
 * en cours, la nuit, pour que les tomes annoncés finissent par y être.
 *
 * <h2>Quelle édition</h2>
 * Une série a un tome 1 par édition, et le calendrier ne les montre pas
 * toutes : l'édition suivie quand il y en a une (le badge « SUIVIE » de la
 * fiche), sinon celles dont on possède déjà des tomes, sinon - pour une série
 * seulement voulue - la plus fournie. Un tome d'une autre édition n'est pas
 * une sortie qui concerne cette collection.
 *
 * <h2>La relation, toujours écrite</h2>
 * Possédé quand le tome (édition, numéro) est en possession active ; voulu
 * quand il est dans les envies, ou que la série entière l'est sans rien de
 * possédé ; manquant sinon - c'est le cas qui appelle un geste.
 */
@Component
public class MangaReleases implements ReleaseSource {

    /** Les jours et les mois viennent de Google Books ; la BnF ne date qu'à l'année. */
    static final String SOURCE = "GOOGLE_BOOKS";

    private static final String MANGAKA = "mangaka";
    private static final String EDITION = "edition";
    private static final String VOLUME_NUMBER = "volumeNumber";
    private static final String COVER_IMAGE_URL = "coverImageUrl";

    private final VolumeSearchCacheRepository volumeSearchCacheRepository;
    private final FollowedEditionRepository followedEditionRepository;

    public MangaReleases(VolumeSearchCacheRepository volumeSearchCacheRepository,
                         FollowedEditionRepository followedEditionRepository) {
        this.volumeSearchCacheRepository = volumeSearchCacheRepository;
        this.followedEditionRepository = followedEditionRepository;
    }

    @Override
    public boolean supports(EntityType entityType) {
        return "MANGA".equals(entityType.code());
    }

    @Override
    public List<ReleaseEntry> releasesBetween(ReleaseContext context) {
        List<Entity> series = context.entities();
        if (series.isEmpty()) {
            return List.of();
        }

        // Les résultats stockés de toutes les séries, en une lecture ; les
        // éditions suivies, en une autre.
        Set<String> normalizedTitles = series.stream()
                .map(entity -> TexteRecherche.normaliser(entity.title()))
                .collect(Collectors.toSet());
        Map<String, StoredVolumeSearch> storedByKey = volumeSearchCacheRepository
                .findAllByEntityTypeIdAndSeriesTitleIn(context.entityType().id(), normalizedTitles).stream()
                .collect(Collectors.toMap(StoredVolumeSearch::key, Function.identity(), (first, second) -> first));
        Map<UUID, String> followedEditionByEntity = followedEditionRepository
                .findByEntityIdIn(series.stream().map(Entity::id).toList()).stream()
                .collect(Collectors.toMap(FollowedEdition::entityId, FollowedEdition::editionName, (a, b) -> a));
        Map<UUID, Set<UUID>> ownedVariants = context.ownedVariantIdsByEntity();
        Map<UUID, Set<UUID>> wantedVariants = context.wantedVariantIdsByEntity();

        List<ReleaseEntry> entries = new ArrayList<>();
        for (Entity entity : series) {
            StoredVolumeSearch stored = storedByKey.get(StoredVolumeSearch.key(
                    TexteRecherche.normaliser(entity.title()), TexteRecherche.normaliser(authorOf(entity))));
            if (stored == null) {
                continue;
            }
            Map<UUID, Variant> variantsById = entity.variants().stream()
                    .collect(Collectors.toMap(Variant::id, v -> v, (a, b) -> a));
            Set<String> ownedKeys = keysOf(ownedVariants.get(entity.id()), variantsById);
            Set<String> wantedKeys = keysOf(wantedVariants.get(entity.id()), variantsById);
            Set<String> editions = editionsToShow(followedEditionByEntity.get(entity.id()),
                    ownedVariants.get(entity.id()), variantsById, stored.volumes());

            for (VolumeCandidate candidate : stored.volumes()) {
                Optional<ReleaseDate> date = ReleaseDate.parse(candidate.releaseDate())
                        .filter(d -> d.isWithin(context.from(), context.to()));
                if (date.isEmpty() || !editions.contains(TexteRecherche.normaliser(candidate.edition()))) {
                    continue;
                }
                String key = candidate.key();
                ReleaseEntry.Relation relation = ownedKeys.contains(key) ? ReleaseEntry.Relation.OWNED
                        : wantedKeys.contains(key) ? ReleaseEntry.Relation.WANTED
                        // La série est suivie : un tome qu'on n'a pas est à acheter, sauf
                        // celui qu'on a dit vouloir - l'envie d'un tome reste un état du tome.
                        : ReleaseEntry.Relation.MISSING;
                entries.add(new ReleaseEntry(date.get(), entity.id(), entity.title(), entity.entityTypeId(),
                        "Tome " + candidate.volumeNumber() + " · " + candidate.edition(), candidate.volumeNumber(),
                        candidate.edition(), candidate.imageUrl() != null ? candidate.imageUrl() : coverOf(entity),
                        relation, SOURCE));
            }
        }
        return entries;
    }

    /** L'édition suivie, sinon celles qu'on possède, sinon la plus fournie du résultat - normalisées. */
    private static Set<String> editionsToShow(String followedEdition, Set<UUID> ownedVariantIds,
                                              Map<UUID, Variant> variantsById, List<VolumeCandidate> candidates) {
        if (followedEdition != null && !followedEdition.isBlank()) {
            return Set.of(TexteRecherche.normaliser(followedEdition));
        }
        Set<String> owned = new HashSet<>();
        if (ownedVariantIds != null) {
            for (UUID variantId : ownedVariantIds) {
                Variant variant = variantsById.get(variantId);
                if (variant != null && volumeNumberOf(variant) != null) {
                    owned.add(TexteRecherche.normaliser(editionOf(variant)));
                }
            }
        }
        if (!owned.isEmpty()) {
            return owned;
        }
        Map<String, Integer> sizes = new HashMap<>();
        for (VolumeCandidate candidate : candidates) {
            sizes.merge(TexteRecherche.normaliser(candidate.edition()), 1, Integer::sum);
        }
        return sizes.entrySet().stream()
                .max(Map.Entry.<String, Integer>comparingByValue().thenComparing(Map.Entry.comparingByKey()))
                .map(entry -> Set.of(entry.getKey()))
                .orElse(Set.of());
    }

    /** L'identité (édition, numéro) des tomes désignés - la même qu'un {@link VolumeCandidate}. */
    private static Set<String> keysOf(Set<UUID> variantIds, Map<UUID, Variant> variantsById) {
        Set<String> keys = new HashSet<>();
        if (variantIds == null) {
            return keys;
        }
        for (UUID variantId : variantIds) {
            Variant variant = variantsById.get(variantId);
            Integer number = variant == null ? null : volumeNumberOf(variant);
            if (number != null) {
                keys.add(VolumeCandidate.key(editionOf(variant), number));
            }
        }
        return keys;
    }

    private static String authorOf(Entity entity) {
        Object value = entity.attributes().get(MANGAKA);
        return value instanceof String s ? s : "";
    }

    private static String coverOf(Entity entity) {
        Object cover = entity.attributes().get(COVER_IMAGE_URL);
        return cover instanceof String url && !url.isBlank() ? url : null;
    }

    private static String editionOf(Variant variant) {
        Object value = variant.attributes().get(EDITION);
        return value instanceof String s ? s.trim() : "";
    }

    /** Les attributs sont un sac non typé : le numéro arrive en nombre d'un fournisseur, en texte d'un autre. */
    private static Integer volumeNumberOf(Variant variant) {
        Object value = variant.attributes().get(VOLUME_NUMBER);
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value instanceof String text) {
            try {
                return Integer.parseInt(text.trim());
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }
}
