package com.iozycore.manga.infrastructure.catalog;

import com.iozycore.manga.domain.EditionTier;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.manga.domain.TotalSource;

final class MangaEditionMapper {

    private MangaEditionMapper() {
    }

    static MangaEdition toDomain(MangaEditionJpaEntity jpa) {
        return new MangaEdition(jpa.getId(), jpa.getEntityId(), jpa.getSeriesTitle(), jpa.getEditionName(),
                EditionTier.valueOf(jpa.getEditionTier()), jpa.getPublisher(), jpa.getTotalVolumes(),
                jpa.getRetailPriceNewPerVolume(), jpa.isOutOfPrint(), jpa.isBetterEditionAnnounced(),
                jpa.getBetterEditionNote(), jpa.getLanguageCode(), jpa.getCreatedAt(), jpa.getUpdatedAt(),
                jpa.getTotalSource() == null ? null : TotalSource.valueOf(jpa.getTotalSource()),
                jpa.isFrenchRunFinished(), jpa.getTotalCheckedAt());
    }

    static MangaEditionJpaEntity toJpa(MangaEdition domain) {
        return new MangaEditionJpaEntity(domain.id(), domain.entityId(), domain.seriesTitle(), domain.editionName(),
                domain.tier().name(), domain.publisher(), domain.totalVolumes(), domain.retailPriceNewPerVolume(),
                domain.outOfPrint(), domain.betterEditionAnnounced(), domain.betterEditionNote(),
                domain.languageCode(), domain.createdAt(), domain.updatedAt(),
                domain.totalSource() == null ? null : domain.totalSource().name(),
                domain.frenchRunFinished(), domain.totalCheckedAt());
    }
}
