package com.iozycore.boardgame;

import com.iozycore.core.application.work.WorkElementsSource;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.insights.ReleaseEntry;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.wishlist.WishlistEntry;
import com.iozycore.core.domain.work.DefaultWorkElements;
import com.iozycore.core.domain.work.WorkElement;
import com.iozycore.core.domain.work.WorkElements;
import com.iozycore.core.domain.work.WorkElementsContext;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The elements of a board game: the base game first, then its expansions.
 *
 * <p>Expansions are stored as variants of the game. None is filled yet (BoardGameGeek
 * expansions come in a later lot), so today a board game is its base game alone.
 * The base game is owned by a copy of the whole game (an ownership without
 * variant); an expansion by a copy of that variant.
 */
@Component
public class BoardGameWorkElements implements WorkElementsSource {

    @Override
    public boolean supports(EntityType entityType) {
        return "BOARD_GAME".equals(entityType.code());
    }

    @Override
    public List<WorkElements> elementsOf(WorkElementsContext context) {
        Map<UUID, List<Ownership>> ownerships = context.ownershipsByWork();
        Map<UUID, List<WishlistEntry>> wishes = context.wishesByWork();
        Map<UUID, List<ReleaseEntry>> releases = context.releasesByWork();
        List<WorkElements> result = new ArrayList<>();
        for (Entity game : context.works()) {
            List<Ownership> owned = ownerships.getOrDefault(game.id(), List.of());
            List<WishlistEntry> wished = wishes.getOrDefault(game.id(), List.of());
            List<Ownership> baseCopies = owned.stream().filter(o -> o.variantId().isEmpty()).toList();
            List<WorkElement> elements = new ArrayList<>();
            elements.add(DefaultWorkElements.wholeWork(game, game.variants().isEmpty() ? owned : baseCopies, wished,
                    releases.getOrDefault(game.id(), List.of()), context.today()));
            game.variants().stream()
                    .map(expansion -> DefaultWorkElements.ofVariant(expansion, owned, wished, context.today()))
                    .sorted(DefaultWorkElements.DISPLAY_ORDER)
                    .forEach(elements::add);
            result.add(new WorkElements(game.id(), elements, elements.size()));
        }
        return result;
    }
}
