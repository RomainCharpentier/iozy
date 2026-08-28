package com.iozycore.purchaseanalysis;

import java.util.Optional;

/**
 * Stockage durable des réponses de {@link AiMarketPriceAdvisor}
 * (voir V23__ai_price_estimate_cache.sql).
 *
 * <h2>Pourquoi</h2>
 * L'avis de l'IA n'est demandé que lorsqu'aucun relevé réel n'existe pour
 * l'édition - donc précisément sur les éditions qu'on analyse en boucle en
 * espérant s'en faire une idée. Sans mémoire, chaque analyse repose la même
 * question au même modèle et consomme le quota du palier gratuit. C'est le
 * raisonnement qui avait déjà donné {@code volume_search_cache} (V3) pour les
 * recherches de tomes.
 *
 * <h2>Ce qui se mémorise, et ce qui ne se mémorise pas</h2>
 * Une RÉPONSE, y compris « je ne sais pas » ({@code pricePerVolume} nul) -
 * c'est la plus stable de toutes, et l'invite demande explicitement au modèle
 * de la donner plutôt que d'inventer. Jamais un ÉCHEC : clé absente, quota
 * dépassé, réseau coupé ne laissent aucune trace, et l'appel sera retenté.
 * Confondre les deux ferait d'une panne passagère un « je ne sais pas »
 * définitif.
 *
 * <p>{@code seriesTitle} et {@code editionName} sont attendus déjà normalisés
 * par l'appelant (trim + minuscules), comme pour {@code volume_search_cache}.
 */
public interface AiPriceEstimateCacheRepository {

    Optional<AiPriceEstimate> find(String seriesTitle, String editionName, Condition condition);

    /** Remplace la ligne existante pour cette clé le cas échéant (upsert). */
    void save(String seriesTitle, String editionName, Condition condition, AiPriceEstimate estimate);
}
