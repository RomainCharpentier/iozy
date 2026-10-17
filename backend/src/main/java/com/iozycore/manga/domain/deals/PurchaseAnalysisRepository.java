package com.iozycore.manga.domain.deals;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Port for the {@link PurchaseAnalysis} history log - one entry per "ANALYZE LOT" click. */
public interface PurchaseAnalysisRepository {

    PurchaseAnalysis save(PurchaseAnalysis analysis);

    Optional<PurchaseAnalysis> findById(UUID id);

    /** Most recent first - used for the history list and "Compare listings" view. */
    List<PurchaseAnalysis> findAll();

    /**
     * Removes an analysis from the history. No edit is offered
     * in return: an analysis is the frozen RESULT of a calculation on a listing at
     * a given time - correcting a number in it would produce a verdict that was
     * never computed. We delete it, and run a new analysis if needed.
     * <p>
     * Touches nothing else: the observed prices and the reference editions
     * created during an analysis are data in their own right, which serve
     * all the following analyses.
     * <p>
     * Idempotent, like the other deletions of user data in the project.
     */
    void deleteById(UUID id);
}
