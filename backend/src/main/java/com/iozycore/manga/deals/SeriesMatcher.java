package com.iozycore.manga.deals;

import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityType;
import com.iozycore.domain.catalog.EntityTypeRepository;

import java.util.Optional;

/**
 * Best-effort, read-only resolution of a listing's raw series title against
 * an existing {@link Entity} of type MANGA in the user's own catalog - same
 * case-insensitive matching convention as
 * {@link com.iozycore.metadata.MetadataSearchService#search}. Never reads
 * nor writes {@link com.iozycore.domain.ownership.Ownership} data; the
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
        // Une série sans titre ne se rapproche de rien : ce n'est pas « aucune
        // correspondance », c'est une entrée inexploitable. Sans cette garde,
        // le trim() ci-dessous levait une NullPointerException rendue en 500 -
        // par DEUX portes distinctes, toutes deux ouvertes à l'utilisateur :
        // un lot d'analyse dont un élément n'a pas de série, et la création
        // d'une édition sans titre de série.
        if (rawTitle == null || rawTitle.isBlank()) {
            throw new IllegalArgumentException("Le titre de la série est requis");
        }
        // La décoration d'annonce est retirée ICI plutôt que chez chaque
        // appelant : c'est le point de passage unique vers le catalogue, donc
        // le seul endroit où une seconde normalisation ne risque pas d'en
        // contredire une première. « 🔥 Hell's Paradise » et « Hell's Paradise »
        // désignent la même œuvre, quelle que soit la source qui les propose -
        // texte d'annonce, photo, ou saisie manuelle.
        String trimmedTitle = SeriesTitleNormalizer.normalize(rawTitle);
        Optional<EntityType> mangaType = entityTypeRepository.findByCode("MANGA");
        if (mangaType.isEmpty()) {
            return new MangaSeries(trimmedTitle, null);
        }
        Optional<Entity> existing = entityRepository.findByTypeAndTitle(mangaType.get().id(), trimmedTitle);
        return new MangaSeries(trimmedTitle, existing.map(Entity::id).orElse(null));
    }
}
