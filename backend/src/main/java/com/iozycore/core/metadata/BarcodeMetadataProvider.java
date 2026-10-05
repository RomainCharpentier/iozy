package com.iozycore.core.metadata;

import com.iozycore.core.domain.catalog.EntityType;

import java.util.Optional;

/**
 * Completes MetadataProvider for the case "I have just scanned a
 * barcode" (flow 1): unlike search(query), we start
 * from an exact identifier (ISBN/EAN) and expect at most one result.
 * A MetadataProvider can implement both interfaces if its source
 * allows it (this is not the case of Jikan/BGG, which do not index by
 * barcode).
 */
public interface BarcodeMetadataProvider {

    boolean supports(EntityType entityType);

    /** Must never throw an exception for a network outage, see implementations. */
    Optional<MetadataCandidate> lookup(String barcode);

    /**
     * The same search, saying <b>why</b> it returned nothing.
     *
     * <p>A provider that cannot tell the difference keeps this default: it
     * never concludes anything from an empty result, and nothing will be remembered. This is the
     * cautious behavior, and the one from before.
     *
     * @see BarcodeLookup
     */
    default BarcodeLookup lookupDetailed(String barcode) {
        return lookup(barcode).map(BarcodeLookup::found).orElseGet(BarcodeLookup::unavailable);
    }
}
