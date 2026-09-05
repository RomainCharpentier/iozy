package com.iozycore.manga.deals;

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
     * Retire une analyse de l'historique. Aucune modification n'est offerte en
     * regard : une analyse est le RÉSULTAT figé d'un calcul sur une annonce à
     * un instant donné - en corriger un chiffre produirait un verdict qui n'a
     * jamais été calculé. On la supprime, et on relance une analyse si besoin.
     * <p>
     * Ne touche à rien d'autre : les prix relevés et les éditions de référence
     * créés au fil d'une analyse sont des données à part entière, qui servent
     * toutes les analyses suivantes.
     * <p>
     * Idempotent, comme les autres suppressions de données utilisateur du projet.
     */
    void deleteById(UUID id);
}
