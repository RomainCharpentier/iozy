package com.iozycore.core.application.insights;

import com.iozycore.core.domain.catalog.EntityType;

import java.util.List;
import com.iozycore.core.domain.insights.ReleaseContext;
import com.iozycore.core.domain.insights.ReleaseEntry;

/**
 * Extension point of the core: a universe knows when the works we
 * own or want come out.
 *
 * <p>The core knows no source of dates: Google Books for the volumes
 * of a manga, IGDB for a video game. It asks the universe that
 * {@link #supports covers} the category, giving it what it has already read
 * (the owned or wanted works, their possessions, their wishes - see
 * {@link ReleaseContext}) so that no source rereads the catalog on
 * its side. A category that nobody covers only has the dates typed by
 * hand on its detail pages, and it is the type that tells the client
 * ({@code hasReleaseSource}), never a list of codes in a screen.
 */
public interface ReleaseSource {

    boolean supports(EntityType entityType);

    /**
     * The releases of the period for the works of the context - never an invented
     * date, never an outage disguised as a silent empty list: a
     * source that does not know simply returns what it knows.
     */
    List<ReleaseEntry> releasesBetween(ReleaseContext context);
}
