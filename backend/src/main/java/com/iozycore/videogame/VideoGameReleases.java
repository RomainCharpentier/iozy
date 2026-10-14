package com.iozycore.videogame;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.insights.ReleaseContext;
import com.iozycore.core.insights.ReleaseDate;
import com.iozycore.core.insights.ReleaseEntry;
import com.iozycore.core.insights.ReleaseSource;
import com.iozycore.videogame.igdb.IgdbReleaseDates;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * The release calendar, for video games: the IGDB release date of the
 * games the user owns or wants - the facade of the module towards the core
 * (batch 146). Only games added from IGDB carry an {@code igdbId};
 * a game entered by hand has only the date written on its work page.
 */
@Component
@RequiredArgsConstructor
public class VideoGameReleases implements ReleaseSource {

    static final String SOURCE = "IGDB";
    private static final String IGDB_ID = "igdbId";
    private static final String COVER_IMAGE_URL = "coverImageUrl";

    private final IgdbReleaseDates igdbReleaseDates;

    @Override
    public boolean supports(EntityType entityType) {
        return "VIDEO_GAME".equals(entityType.code());
    }

    @Override
    public List<ReleaseEntry> releasesBetween(ReleaseContext context) {
        Map<String, List<Entity>> gamesByIgdbId = new LinkedHashMap<>();
        for (Entity game : context.entities()) {
            Object igdbId = game.attributes().get(IGDB_ID);
            if (igdbId instanceof String id && !id.isBlank()) {
                gamesByIgdbId.computeIfAbsent(id, key -> new ArrayList<>()).add(game);
            }
        }
        if (gamesByIgdbId.isEmpty()) {
            return List.of();
        }
        Map<String, Optional<ReleaseDate>> dates = igdbReleaseDates.fetch(gamesByIgdbId.keySet());

        List<ReleaseEntry> entries = new ArrayList<>();
        for (Map.Entry<String, List<Entity>> byId : gamesByIgdbId.entrySet()) {
            Optional<ReleaseDate> date = dates.getOrDefault(byId.getKey(), Optional.empty())
                    .filter(d -> d.isWithin(context.from(), context.to()));
            if (date.isEmpty()) {
                continue;
            }
            for (Entity game : byId.getValue()) {
                context.relationOf(game.id()).ifPresent(relation -> entries.add(new ReleaseEntry(date.get(), game.id(),
                        game.title(), game.entityTypeId(), "", null, null, coverOf(game), relation, SOURCE)));
            }
        }
        return entries;
    }

    private static String coverOf(Entity game) {
        Object cover = game.attributes().get(COVER_IMAGE_URL);
        return cover instanceof String url && !url.isBlank() ? url : null;
    }
}
