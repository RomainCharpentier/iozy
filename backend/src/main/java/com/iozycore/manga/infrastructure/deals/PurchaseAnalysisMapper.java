package com.iozycore.manga.infrastructure.deals;

import com.iozycore.manga.deals.PurchaseAnalysis;

final class PurchaseAnalysisMapper {

    private PurchaseAnalysisMapper() {
    }

    static PurchaseAnalysis toDomain(PurchaseAnalysisJpaEntity jpa) {
        return jpa.getPayload();
    }

    /** Extracts the indexed projection columns from the domain aggregate - {@code payload} carries the full snapshot. */
    static PurchaseAnalysisJpaEntity toJpa(PurchaseAnalysis domain) {
        var negotiation = domain.negotiation();
        var listing = domain.listing();
        return new PurchaseAnalysisJpaEntity(
                domain.id(), domain.requestedAt(), listing.url(), listing.platform().name(), listing.rawTitle(),
                listing.askingPrice(), listing.shippingFee(), listing.buyerProtectionFee(), domain.totalRealCost(),
                listing.condition().name(), domain.verdict().name(), domain.verdictScore(),
                negotiation.recommendedOffer(), negotiation.targetPriceMin(), negotiation.targetPriceMax(),
                negotiation.maxPrice(), negotiation.advice().name(), domain);
    }
}
