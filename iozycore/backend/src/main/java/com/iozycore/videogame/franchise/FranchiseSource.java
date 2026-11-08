package com.iozycore.videogame.franchise;

/** The provider that knows the licence of a game (IGDB). Optional: without its key, it is off. */
public interface FranchiseSource {

    /** False when the provider has no key: the licences are then neither read nor shown. */
    boolean configured();

    /**
     * @throws com.iozycore.core.metadata.SourceUnavailableException when the provider did not answer
     */
    Franchise franchiseOf(String igdbId);
}
