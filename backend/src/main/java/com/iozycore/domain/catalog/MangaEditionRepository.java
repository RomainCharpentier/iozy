package com.iozycore.domain.catalog;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Port for {@link MangaEdition} persistence - lookups are case-insensitive at the query level (same convention as EntityRepository.findByTypeAndTitle), seriesTitle/editionName are stored as typed for display. */
public interface MangaEditionRepository {

    MangaEdition save(MangaEdition edition);

    Optional<MangaEdition> findById(UUID id);

    /** Case-insensitive on both fields. */
    Optional<MangaEdition> findBySeriesAndEdition(String seriesTitle, String editionName);

    /** All known editions of a series (case-insensitive) - powers "a Perfect edition exists for this work" warnings. */
    List<MangaEdition> findBySeriesTitle(String seriesTitle);

    /** All known editions structurally linked to a catalog Série (see {@link MangaEdition#entityId()}) - unlike
     * {@link #findBySeriesTitle}, never a text-matching fallback: only editions actually rattachées. */
    List<MangaEdition> findByEntityId(UUID entityId);

    /** Toutes les éditions connues - lecture en masse pour un écran qui affiche la
     * progression de PLUSIEURS séries d'un coup (voir Ma collection), plutôt qu'un
     * appel par tuile. Le référentiel d'éditions est petit par nature (une ligne par
     * édition réellement renseignée), jamais une table de volumétrie. */
    List<MangaEdition> findAll();

    /** One specific edition of a structurally-linked Série, by ID rather than by title (case-insensitive on
     * editionName) - the preferred lookup once a Série's {@code entityId} is known: unlike
     * {@link #findBySeriesAndEdition}, immune to the Série having been renamed since this edition was linked
     * (see {@code Entity.rename}). Never a text-matching fallback, same spirit as {@link #findByEntityId}. */
    Optional<MangaEdition> findByEntityIdAndEditionName(UUID entityId, String editionName);

    /**
     * Étape 5 (modèle Série -> Édition -> Tome) : supprime une Édition devenue vide de
     * tout Tome catalogué. L'appelant est responsable de s'être déjà assuré qu'aucun
     * Variant ne la référence plus - si une donnée de marché (MarketPriceObservation)
     * la référence encore, la contrainte FK {@code market_price_observation.manga_edition_id}
     * rejette la suppression (voir VariantDeletionService, qui traite ce cas comme "ne pas
     * encore cascader" plutôt que comme une erreur).
     */
    void deleteById(UUID id);
}
