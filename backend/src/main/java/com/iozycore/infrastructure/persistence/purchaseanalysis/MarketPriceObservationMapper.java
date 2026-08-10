package com.iozycore.infrastructure.persistence.purchaseanalysis;

import com.iozycore.purchaseanalysis.Condition;
import com.iozycore.purchaseanalysis.ListingPlatform;
import com.iozycore.purchaseanalysis.MarketPriceObservation;
import com.iozycore.purchaseanalysis.VolumeRange;

final class MarketPriceObservationMapper {

    private MarketPriceObservationMapper() {
    }

    static MarketPriceObservation toDomain(MarketPriceObservationJpaEntity jpa) {
        VolumeRange scope = jpa.getVolumeRangeStart() != null && jpa.getVolumeRangeEnd() != null
                ? new VolumeRange(jpa.getVolumeRangeStart(), jpa.getVolumeRangeEnd())
                : null;
        Condition condition = jpa.getObservedCondition() != null ? Condition.valueOf(jpa.getObservedCondition()) : null;
        return new MarketPriceObservation(jpa.getId(), jpa.getMangaEditionId(), scope, jpa.getObservedPrice(),
                ListingPlatform.valueOf(jpa.getPlatform()), condition, jpa.getObservedAt(), jpa.getNote(), jpa.getCreatedAt());
    }

    static MarketPriceObservationJpaEntity toJpa(MarketPriceObservation domain) {
        return new MarketPriceObservationJpaEntity(domain.id(), domain.mangaEditionId(),
                domain.scope() != null ? domain.scope().from() : null,
                domain.scope() != null ? domain.scope().to() : null,
                domain.observedPrice(), domain.platform().name(),
                domain.observedCondition() != null ? domain.observedCondition().name() : null,
                domain.observedAt(), domain.note(), "MANUAL_ENTRY", domain.createdAt());
    }
}
