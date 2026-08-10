package com.iozycore.purchaseanalysis;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Port for the {@link PurchaseAnalysis} history log - one entry per "ANALYZE LOT" click. */
public interface PurchaseAnalysisRepository {

    PurchaseAnalysis save(PurchaseAnalysis analysis);

    Optional<PurchaseAnalysis> findById(UUID id);

    /** Most recent first - used for the history list and "Compare listings" view. */
    List<PurchaseAnalysis> findAll();
}
