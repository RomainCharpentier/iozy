package com.iozycore.manga.deals;

import java.util.Optional;

/**
 * Durable storage for the answers of {@link AiMarketPriceAdvisor}
 * (see V23__ai_price_estimate_cache.sql).
 *
 * <h2>Why</h2>
 * The AI opinion is only asked when no real observation exists for the
 * edition - so exactly on the editions that are analysed again and again in
 * the hope of getting an idea. Without memory, each analysis asks the same
 * question to the same model and uses the quota of the free tier. This is the
 * same reasoning that gave {@code volume_search_cache} (V3) for volume
 * searches.
 *
 * <h2>What is remembered, and what is not</h2>
 * An ANSWER, including "I do not know" ({@code pricePerVolume} null) -
 * it is the most stable of all, and the prompt explicitly asks the model to
 * give it instead of making something up. Never a FAILURE: missing key, quota
 * exceeded, network down leave no trace, and the call will be tried again.
 * Mixing the two would turn a short outage into a permanent "I do not know".
 *
 * <p>{@code seriesTitle} and {@code editionName} are expected to be already
 * normalised by the caller (trim + lower case), as for {@code volume_search_cache}.
 */
public interface AiPriceEstimateCacheRepository {

    Optional<AiPriceEstimate> find(String seriesTitle, String editionName, Condition condition);

    /** Replaces the existing row for this key if there is one (upsert). */
    void save(String seriesTitle, String editionName, Condition condition, AiPriceEstimate estimate);
}
