package com.iozycore.manga.domain.deals;

import java.util.List;
import java.util.UUID;

/** Port for the append-only {@link MarketPriceObservation} log - see {@link MarketPriceObservation} for why this is the only source of observed prices in Phase 1. */
public interface MarketPriceObservationRepository {

    MarketPriceObservation save(MarketPriceObservation observation);

    List<MarketPriceObservation> findByEditionId(UUID mangaEditionId);

    /**
     * How many observations refer to this edition, <b>all accounts
     * together</b>.
     *
     * <p>The only question of this repository that deliberately ignores the separation,
     * because it is not a question of ownership but of integrity:
     * the reference editions are SHARED, and deleting one that the
     * observations of another account still use would break its analyses. Without
     * this global count, the polite refusal would give way to a foreign key
     * violation - a database error shown to someone who did
     * nothing wrong.
     */
    int countByEditionIdAllOwners(UUID mangaEditionId);

    /**
     * The whole log, for the full export - an observation entered by hand cannot
     * be recovered elsewhere, and the export promises no lock-in
     * (same reason as the reference editions in Batch 33). One method
     * rather than a loop per edition on the caller side: the export has no
     * reason to send one query per edition.
     */
    List<MarketPriceObservation> findAll();

    /**
     * Removes an observation entered by mistake (a misplaced comma, the wrong
     * edition). This is the ONLY write offered besides adding: an observation
     * is a fact noted on a date, not a field that is adjusted. Correcting it
     * afterwards would rewrite a past observation, and therefore the analyses that
     * rely on it; we remove the wrong observation and record a correct one.
     * <p>
     * Idempotent, like the other deletions of user data in the project.
     */
    void deleteById(UUID id);
}
