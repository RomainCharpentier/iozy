package com.iozycore.core.application;

import java.util.List;

/**
 * Extension point: what a universe needs to put its works on the shelves of
 * "Ma collection", and which source id lets its provider give it back.
 * Read by {@link ShelfDetailsBackfill}, which knows no provider: each
 * universe that has one names its type, its id key and the keys to fill.
 */
public interface ShelfDetailsSource {

    /** The code of the entity type, for instance the one of video games. */
    String entityTypeCode();

    /** The attribute that holds the work's id at its provider. */
    String sourceIdKey();

    /** The attributes the shelves read, filled from the provider's details when missing. */
    List<String> shelfKeys();
}
