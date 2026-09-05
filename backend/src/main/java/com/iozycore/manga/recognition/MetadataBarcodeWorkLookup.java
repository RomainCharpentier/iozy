package com.iozycore.manga.recognition;

import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.manga.recognition.BarcodeWorkLookup;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Optional;
import com.iozycore.core.metadata.MetadataSearchService;
import com.iozycore.core.metadata.MetadataCandidate;

/**
 * Branche la reconnaissance de codes-barres sur les providers bibliographiques
 * déjà en place.
 *
 * <h2>Rien de neuf côté réseau</h2>
 * Ce sont exactement les mêmes {@code BarcodeMetadataProvider} — Google Books,
 * Open Library — que la page « Scanner » interroge depuis longtemps, avec leur
 * cache et leur ordre de préséance. Lire un code sur une photo aboutit donc au
 * même endroit qu'en le scannant à la caméra ; seule l'entrée change.
 *
 * <h2>Pourquoi l'adaptateur vit ici et pas dans {@code recognition}</h2>
 * {@code recognition} déclare ce dont il a besoin ({@link BarcodeWorkLookup} :
 * un code, un titre) sans connaître ni {@code EntityType}, ni les providers,
 * ni leur cache. C'est ce qui permet aux tests de reconnaissance de tourner
 * sans la moindre requête — et c'est aussi ce qui rendra le jour venu une
 * résolution locale (un EAN stocké au catalogue) substituable sans toucher au
 * décodeur.
 */
@Component
public class MetadataBarcodeWorkLookup implements BarcodeWorkLookup {

    private static final Logger log = LoggerFactory.getLogger(MetadataBarcodeWorkLookup.class);

    private final MetadataSearchService metadataSearchService;
    private final EntityTypeRepository entityTypeRepository;

    public MetadataBarcodeWorkLookup(MetadataSearchService metadataSearchService,
                                      EntityTypeRepository entityTypeRepository) {
        this.metadataSearchService = metadataSearchService;
        this.entityTypeRepository = entityTypeRepository;
    }

    @Override
    public Optional<String> titleFor(String ean, String entityTypeCode) {
        if (ean == null || ean.isBlank() || entityTypeCode == null || entityTypeCode.isBlank()) {
            // Sans univers, aucun provider ne peut se déclarer compétent :
            // demander « à qui appartient ce code » sans dire dans quel monde
            // n'a pas de réponse.
            return Optional.empty();
        }

        Optional<EntityType> type = entityTypeRepository.findByCode(entityTypeCode.trim().toUpperCase());
        if (type.isEmpty()) {
            return Optional.empty();
        }

        // Pas de capture de QuotaExceededException ici, et c'était une erreur de
        // ma part que d'en écrire une : GoogleBooksBarcodeProvider l'avale déjà
        // lui-même et rend vide, laissant Open Library - qui n'a pas de quota -
        // prendre le relais. Le catch ne pouvait donc jamais s'exécuter, tout en
        // laissant croire que ce cas se traitait ici.
        try {
            return metadataSearchService.lookupByBarcode(type.get(), ean.trim())
                    .map(MetadataCandidate::title)
                    .filter(titre -> titre != null && !titre.isBlank());
        } catch (RuntimeException e) {
            // Le reste - réseau coupé, réponse illisible - est une identification
            // en moins, jamais une analyse interrompue.
            log.info("Identification d'un code-barres indisponible : {}", e.getClass().getSimpleName());
            return Optional.empty();
        }
    }
}
