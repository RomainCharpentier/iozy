package com.iozycore.manga.metadata;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Stockage durable du résultat de {@link VolumeSearchProvider#searchVolumes}
 * (voir V3__volume_search_cache.sql) - contrairement au {@link TtlCache} en
 * mémoire utilisé ailleurs dans {@link TomeSearchService}, celui-ci
 * survit aux redémarrages du backend. seriesTitle/author sont attendus déjà
 * normalisés (trim + minuscules) par l'appelant, jamais affichés tels quels.
 */
public interface VolumeSearchCacheRepository {

    Optional<List<VolumeCandidate>> find(UUID entityTypeId, String seriesTitle, String author);

    /** Remplace la ligne existante pour cette clé le cas échéant (upsert) -
     * c'est le point d'entrée du rafraîchissement manuel (bouton "Actualiser"
     * côté client) : une nouvelle recherche Google Books écrase l'ancien
     * résultat stocké plutôt que de s'y ajouter. */
    void save(UUID entityTypeId, String seriesTitle, String author, List<VolumeCandidate> volumes);

    /** Oublie la ligne de cette cle, si elle existe - voir TomeSearchService.searchVolumes (Lot 126). */
    void delete(UUID entityTypeId, String seriesTitle, String author);

    /**
     * Les résultats stockés de plusieurs séries d'un type, en UNE lecture -
     * ce que le calendrier des sorties demande pour toutes les séries
     * possédées ou voulues, plutôt qu'une lecture par série (lot 146). Les
     * titres sont attendus normalisés, comme pour {@link #find}. Une liste
     * vide de titres rend une liste vide sans rien lire.
     */
    List<StoredVolumeSearch> findAllByEntityTypeIdAndSeriesTitleIn(UUID entityTypeId, Collection<String> seriesTitles);

    /** Les clés stockées de ce type et leur fraîcheur, sans les tomes - pour choisir quoi relire la nuit (lot 146). */
    List<StoredVolumeSearchKey> findKeysByEntityTypeId(UUID entityTypeId);
}
