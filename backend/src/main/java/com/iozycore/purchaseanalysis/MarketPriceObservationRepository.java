package com.iozycore.purchaseanalysis;

import java.util.List;
import java.util.UUID;

/** Port for the append-only {@link MarketPriceObservation} log - see {@link MarketPriceObservation} for why this is the only source of observed prices in Phase 1. */
public interface MarketPriceObservationRepository {

    MarketPriceObservation save(MarketPriceObservation observation);

    List<MarketPriceObservation> findByEditionId(UUID mangaEditionId);

    /**
     * Retire un relevé saisi par erreur (une virgule mal placée, la mauvaise
     * édition). C'est la SEULE écriture offerte en plus de l'ajout : un relevé
     * est un fait constaté à une date, pas un champ qu'on ajuste. Le corriger
     * après coup réécrirait une observation passée, et donc les analyses qui
     * s'appuient dessus ; on retire le relevé faux et on en enregistre un juste.
     * <p>
     * Idempotent, comme les autres suppressions de données utilisateur du projet.
     */
    void deleteById(UUID id);
}
