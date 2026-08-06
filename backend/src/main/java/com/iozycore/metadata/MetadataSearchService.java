package com.iozycore.metadata;

import com.iozycore.domain.catalog.EntityType;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Point d'entrée unique du Bounded Context Metadata Enrichment (étape 8
 * de la conception). Sélectionne le(s) MetadataProvider/BarcodeMetadataProvider
 * compétent(s) pour l'EntityType demandé et agrège leurs résultats - le
 * reste de l'application n'a jamais besoin de connaître Jikan/BGG/Open
 * Library directement.
 */
@Service
public class MetadataSearchService {

    private final List<MetadataProvider> providers;
    private final List<BarcodeMetadataProvider> barcodeProviders;

    public MetadataSearchService(List<MetadataProvider> providers,
                                  List<BarcodeMetadataProvider> barcodeProviders) {
        this.providers = providers;
        this.barcodeProviders = barcodeProviders;
    }

    public List<MetadataCandidate> search(EntityType entityType, String query) {
        return providers.stream()
                .filter(provider -> provider.supports(entityType))
                .flatMap(provider -> provider.search(query).stream())
                .collect(Collectors.toList());
    }

    /** Retourne le premier résultat trouvé par un provider compétent pour ce code-barres. */
    public Optional<MetadataCandidate> lookupByBarcode(EntityType entityType, String barcode) {
        return barcodeProviders.stream()
                .filter(provider -> provider.supports(entityType))
                .map(provider -> provider.lookup(barcode))
                .filter(Optional::isPresent)
                .map(Optional::get)
                .findFirst();
    }
}
