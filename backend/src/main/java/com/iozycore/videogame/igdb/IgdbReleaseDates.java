package com.iozycore.videogame.igdb;

import com.iozycore.core.insights.ReleaseDate;

import java.util.Collection;
import java.util.Map;
import java.util.Optional;

/**
 * The release dates of games known to IGDB, by identifier. A game with no
 * usable date ("TBD", only a year or a quarter) answers empty;
 * a game missing from the response, or that an outage prevented from reading, does not appear
 * in the map - this is what makes it possible to never cache an
 * outage (see IgdbReleaseDatesFetcher).
 */
public interface IgdbReleaseDates {

    Map<String, Optional<ReleaseDate>> fetch(Collection<String> igdbIds);
}
