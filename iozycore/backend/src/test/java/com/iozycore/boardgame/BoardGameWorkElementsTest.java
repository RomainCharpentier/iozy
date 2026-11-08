package com.iozycore.boardgame;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.catalog.Variant;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.work.WorkElement;
import com.iozycore.core.domain.work.WorkElements;
import com.iozycore.core.domain.work.WorkElementsContext;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** A board game: the base game first, then its expansions, each owned on its own. */
class BoardGameWorkElementsTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 11, 8);
    private final BoardGameWorkElements source = new BoardGameWorkElements();

    @Test
    void today_a_game_without_expansions_is_its_base_game() {
        Entity game = Entity.create(EntityTypeFixtures.BOARD_GAME.id(), "Ark Nova");

        WorkElements elements = only(game, List.of(
                Ownership.acquire(game.id(), null, OwnershipCondition.NEW, TODAY, null)));

        assertThat(elements.elements()).extracting(WorkElement::state).containsExactly(WorkElement.State.OWNED);
        assertThat(elements.totalCount()).isEqualTo(1);
    }

    @Test
    void an_expansion_stored_as_a_variant_follows_the_base_game_and_is_owned_on_its_own() {
        Entity game = Entity.create(EntityTypeFixtures.BOARD_GAME.id(), "Ark Nova");
        Variant expansion = game.addVariant("Zoos marins", Map.of());

        WorkElements elements = only(game, List.of(
                Ownership.acquire(game.id(), expansion.id(), OwnershipCondition.NEW, TODAY, null)));

        assertThat(elements.elements()).extracting(WorkElement::label).containsExactly("Ark Nova", "Zoos marins");
        assertThat(elements.elements()).extracting(WorkElement::state)
                .containsExactly(WorkElement.State.MISSING, WorkElement.State.OWNED);
        assertThat(elements.totalCount()).isEqualTo(2);
    }

    private WorkElements only(Entity game, List<Ownership> owned) {
        return source.elementsOf(new WorkElementsContext(EntityTypeFixtures.BOARD_GAME, List.of(game), owned,
                List.of(), List.of(), TODAY)).get(0);
    }
}
