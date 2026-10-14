package com.iozycore.manga.recognition;

import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.manga.recognition.BarcodeWorkLookup;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Optional;
import com.iozycore.core.metadata.MetadataSearchService;
import com.iozycore.core.metadata.MetadataCandidate;

/**
 * Plugs the barcode recognition into the bibliographic providers
 * already in place.
 *
 * <h2>Nothing new on the network side</h2>
 * These are exactly the same {@code BarcodeMetadataProvider} - Google Books,
 * Open Library - that the "Scanner" page has been querying for a long time, with their
 * cache and their order of precedence. Reading a code on a photo therefore ends up in the
 * same place as scanning it with the camera; only the input changes.
 *
 * <h2>Why the adapter lives here and not in {@code recognition}</h2>
 * {@code recognition} declares what it needs ({@link BarcodeWorkLookup}:
 * a code, a title) without knowing {@code EntityType}, the providers,
 * or their cache. This is what lets the recognition tests run
 * without a single request - and it is also what will make, when the day comes, a
 * local resolution (an EAN stored in the catalog) replaceable without touching the
 * decoder.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class MetadataBarcodeWorkLookup implements BarcodeWorkLookup {

    private final MetadataSearchService metadataSearchService;
    private final EntityTypeRepository entityTypeRepository;

    @Override
    public Optional<String> titleFor(String ean, String entityTypeCode) {
        if (ean == null || ean.isBlank() || entityTypeCode == null || entityTypeCode.isBlank()) {
            // Without a universe, no provider can declare itself competent:
            // asking "who does this code belong to" without saying in which world
            // has no answer.
            return Optional.empty();
        }

        Optional<EntityType> type = entityTypeRepository.findByCode(entityTypeCode.trim().toUpperCase());
        if (type.isEmpty()) {
            return Optional.empty();
        }

        // No catch of QuotaExceededException here, and it was a mistake on
        // my part to write one: GoogleBooksBarcodeProvider already swallows it
        // itself and returns empty, leaving Open Library - which has no quota -
        // to take over. The catch could therefore never run, while
        // making it look as if this case was handled here.
        try {
            // The title of the print run, as the source writes it: the
            // candidate title names only the series, and BarcodeRecognizer
            // reads the volume number in this text.
            return metadataSearchService.lookupByBarcode(type.get(), ean.trim())
                    .map(candidate -> candidate.volume() != null ? candidate.volume().sourceTitle() : candidate.title())
                    .filter(titre -> titre != null && !titre.isBlank());
        } catch (RuntimeException e) {
            // The rest - network down, unreadable response - is one identification
            // less, never an interrupted analysis.
            log.info("Barcode identification unavailable: {}", e.getClass().getSimpleName());
            return Optional.empty();
        }
    }
}
