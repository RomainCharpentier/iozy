package com.iozycore.manga.domain.deals;

/**
 * What we can honestly say about the vigilance needed on a listing.
 * <p>
 * Four named levels, and above all <b>no score out of 100</b>. A
 * "trust: 94/100" would suggest a measured probability; but IozyCore has
 * neither the seller's history, nor the transactions, nor any database
 * of reports. What it sees is a text, a price and photos. Putting
 * a number on that would dress an intuition up as a measurement.
 */
public enum TrustLevel {

    /** Nothing unusual in what the listing shows. */
    NO_OBVIOUS_SIGNAL,

    /** A few details to look at, nothing particularly serious. */
    A_FEW_THINGS_TO_CHECK,

    /** Enough elements to take the time to check before buying. */
    EXAMINE_CAREFULLY,

    /** At least one strong signal: not to be taken lightly. */
    CONCERNING
}
