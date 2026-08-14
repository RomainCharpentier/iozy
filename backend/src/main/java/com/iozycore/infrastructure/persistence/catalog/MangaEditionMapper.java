package com.iozycore.infrastructure.persistence.catalog;

import com.iozycore.domain.catalog.EditionTier;
import com.iozycore.domain.catalog.MangaEdition;

final class MangaEditionMapper {

    private MangaEditionMapper() {
    }

    static MangaEdition toDomain(MangaEditionJpaEntity jpa) {
        return new MangaEdition(jpa.getId(), jpa.getEntityId(), jpa.getSeriesTitle(), jpa.getEditionName(),
                EditionTier.valueOf(jpa.getEditionTier()), jpa.getPublisher(), jpa.getTotalVolumes(),
                jpa.getRetailPriceNewPerVolume(), jpa.isOutOfPrint(), jpa.isBetterEditionAnnounced(),
                jpa.getBetterEditionNote(), jpa.getLanguageCode(), jpa.getCreatedAt(), jpa.getUpdatedAt());
    }

    static MangaEditionJpaEntity toJpa(MangaEdition domain) {
        return new MangaEditionJpaEntity(domain.id(), domain.entityId(), domain.seriesTitle(), domain.editionName(),
                domain.tier().name(), domain.publisher(), domain.totalVolumes(), domain.retailPriceNewPerVolume(),
                domain.outOfPrint(), domain.betterEditionAnnounced(), domain.betterEditionNote(),
                domain.languageCode(), domain.createdAt(), domain.updatedAt());
    }
}
