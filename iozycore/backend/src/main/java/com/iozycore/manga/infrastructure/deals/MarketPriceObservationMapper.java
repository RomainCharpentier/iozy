package com.iozycore.manga.infrastructure.deals;

import com.iozycore.manga.domain.deals.Condition;
import com.iozycore.manga.domain.deals.MarketObservationOrigin;
import com.iozycore.core.listing.ListingPlatform;
import com.iozycore.manga.domain.deals.MarketPriceObservation;
import com.iozycore.manga.domain.deals.VolumeRange;

final class MarketPriceObservationMapper {

    private MarketPriceObservationMapper() {
    }

    static MarketPriceObservation toDomain(MarketPriceObservationJpaEntity jpa) {
        VolumeRange scope = jpa.getVolumeRangeStart() != null && jpa.getVolumeRangeEnd() != null
                ? new VolumeRange(jpa.getVolumeRangeStart(), jpa.getVolumeRangeEnd())
                : null;
        Condition condition = jpa.getObservedCondition() != null ? Condition.valueOf(jpa.getObservedCondition()) : null;
        // Unreadable origin (value from an earlier version): we fall back on
        // manual entry, which was then the only creation path - rather
        // than make the read of an otherwise valid record fail.
        MarketObservationOrigin origin;
        try {
            origin = MarketObservationOrigin.valueOf(jpa.getOrigin());
        } catch (IllegalArgumentException | NullPointerException e) {
            origin = MarketObservationOrigin.MANUAL_ENTRY;
        }
        return new MarketPriceObservation(jpa.getId(), jpa.getMangaEditionId(), scope, jpa.getObservedPrice(),
                ListingPlatform.valueOf(jpa.getPlatform()), condition, jpa.getObservedAt(), jpa.getNote(),
                jpa.getCreatedAt(), origin, jpa.getVolumeCount(), jpa.getListingIdentity(), jpa.getSourceUrl());
    }

    static MarketPriceObservationJpaEntity toJpa(MarketPriceObservation domain) {
        return new MarketPriceObservationJpaEntity(domain.id(), domain.mangaEditionId(),
                domain.scope() != null ? domain.scope().from() : null,
                domain.scope() != null ? domain.scope().to() : null,
                domain.observedPrice(), domain.platform().name(),
                domain.observedCondition() != null ? domain.observedCondition().name() : null,
                domain.observedAt(), domain.note(), domain.origin().name(), domain.createdAt(),
                domain.volumeCount(), domain.listingIdentity(), domain.sourceUrl());
    }
}
