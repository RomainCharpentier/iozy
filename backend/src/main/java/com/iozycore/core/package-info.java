/**
 * The CORE: what holds for all collection types - the generic catalog
 * (works, volumes, types), ownerships, wishes, tier
 * lists, accounts, sharing, export, statistics, listings,
 * and the extension points that the universes implement (metadata
 * provider, barcode, discovery, progress, value, cover,
 * linked edition, deletion, export).
 *
 * <p>OPEN module: the universes ({@code manga}, {@code videogame},
 * {@code boardgame}, {@code custom}) rely on its domain, its use
 * cases and its contracts. It knows no universe - this is what the
 * module test checks, and what lets us take one out into its own service later
 * (Batch 133).
 */
@org.springframework.modulith.ApplicationModule(displayName = "Cœur", type = org.springframework.modulith.ApplicationModule.Type.OPEN)
package com.iozycore.core;
