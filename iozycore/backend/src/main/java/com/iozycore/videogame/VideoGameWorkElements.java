package com.iozycore.videogame;

import com.iozycore.core.application.work.WorkElementsSource;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.insights.ReleaseEntry;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.wishlist.WishlistEntry;
import com.iozycore.core.domain.work.DefaultWorkElements;
import com.iozycore.core.domain.work.WorkElements;
import com.iozycore.core.domain.work.WorkElementsContext;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The elements of a video game: the game itself, owned as soon as one copy is,
 * whatever the console. The other games of its franchise on the same console
 * come in a later lot, as optional elements.
 */
@Component
public class VideoGameWorkElements implements WorkElementsSource {

    @Override
    public boolean supports(EntityType entityType) {
        return "VIDEO_GAME".equals(entityType.code());
    }

    @Override
    public List<WorkElements> elementsOf(WorkElementsContext context) {
        Map<UUID, List<Ownership>> ownerships = context.ownershipsByWork();
        Map<UUID, List<WishlistEntry>> wishes = context.wishesByWork();
        Map<UUID, List<ReleaseEntry>> releases = context.releasesByWork();
        return context.works().stream()
                .map((Entity game) -> new WorkElements(game.id(), List.of(DefaultWorkElements.wholeWork(game,
                        ownerships.getOrDefault(game.id(), List.of()), wishes.getOrDefault(game.id(), List.of()),
                        releases.getOrDefault(game.id(), List.of()), context.today())), 1))
                .toList();
    }
}
