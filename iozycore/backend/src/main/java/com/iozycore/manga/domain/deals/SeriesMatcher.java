package com.iozycore.manga.domain.deals;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeRepository;

import java.util.Optional;

/**
 * Best-effort, read-only resolution of a listing's raw series title against
 * an existing {@link Entity} of type MANGA in the user's own catalog - same
 * case-insensitive matching convention as
 * {@link com.iozycore.core.metadata.MetadataSearchService#search}. Never reads
 * nor writes {@link com.iozycore.core.domain.ownership.Ownership} data; the
 * resulting {@link MangaSeries#knownEntityId()} is only used to power UI
 * hints ("you already own N volumes") and to enable the wishlist action.
 */
public class SeriesMatcher {

    private final EntityRepository entityRepository;
    private final EntityTypeRepository entityTypeRepository;

    public SeriesMatcher(EntityRepository entityRepository, EntityTypeRepository entityTypeRepository) {
        this.entityRepository = entityRepository;
        this.entityTypeRepository = entityTypeRepository;
    }

    public MangaSeries match(String rawTitle) {
        // A series without a title matches nothing: it is not "no
        // match", it is an input that cannot be used. Without this guard,
        // the trim() below threw a NullPointerException returned as a 500 -
        // through TWO distinct doors, both open to the user:
        // an analysis lot with an item that has no series, and the creation
        // of an edition without a series title.
        if (rawTitle == null || rawTitle.isBlank()) {
            throw new IllegalArgumentException("Le titre de la série est requis");
        }
        // The listing decoration is removed HERE rather than in each
        // caller: it is the single point of passage to the catalogue, so
        // the only place where a second normalisation cannot
        // contradict a first one. "🔥 Hell's Paradise" and "Hell's Paradise"
        // name the same work, whatever the source that offers them -
        // listing text, photo, or manual entry.
        String trimmedTitle = SeriesTitleNormalizer.normalize(rawTitle);
        Optional<EntityType> mangaType = entityTypeRepository.findByCode("MANGA");
        if (mangaType.isEmpty()) {
            return new MangaSeries(trimmedTitle, null);
        }
        Optional<Entity> existing = entityRepository.findByTypeAndTitle(mangaType.get().id(), trimmedTitle);
        return new MangaSeries(trimmedTitle, existing.map(Entity::id).orElse(null));
    }
}
