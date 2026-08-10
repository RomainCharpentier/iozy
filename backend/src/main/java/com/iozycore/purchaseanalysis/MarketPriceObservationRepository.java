package com.iozycore.purchaseanalysis;

import java.util.List;
import java.util.UUID;

/** Port for the append-only {@link MarketPriceObservation} log - see {@link MarketPriceObservation} for why this is the only source of observed prices in Phase 1. */
public interface MarketPriceObservationRepository {

    MarketPriceObservation save(MarketPriceObservation observation);

    List<MarketPriceObservation> findByEditionId(UUID mangaEditionId);
}
