package com.iozycore.boardgame;

import com.iozycore.boardgame.expansion.BoardGameExpansion;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.catalog.Variant;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.wishlist.WishlistEntry;
import com.iozycore.core.domain.work.CollectorStatus;
import com.iozycore.core.domain.work.WorkElement;
import com.iozycore.core.domain.work.WorkElements;
import com.iozycore.core.domain.work.WorkElementsContext;
import com.iozycore.core.domain.work.WorkView;
import com.iozycore.core.testing.InMemoryEntityRepository;
import com.iozycore.core.testing.InMemoryOwnershipRepository;
import com.iozycore.core.testing.InMemoryWishlistEntryRepository;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** A board game: the base game first, then its expansions - the variants and the ones BGG lists. */
class BoardGameWorkElementsTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 11, 8);
    private static final Instant READ_AT = Instant.parse("2026-11-01T00:00:00Z");

    private final InMemoryExpansionCache cache = new InMemoryExpansionCache();
    private final InMemoryEntityRepository entities = new InMemoryEntityRepository();
    private final InMemoryOwnershipRepository ownerships = new InMemoryOwnershipRepository();
    private final InMemoryWishlistEntryRepository wishes = new InMemoryWishlistEntryRepository();
    private final BoardGameWorkElements source = new BoardGameWorkElements(cache, entities, ownerships, wishes, null);

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

    @Test
    void the_expansions_read_from_bgg_are_listed_but_optional_while_no_expansion_is_owned() {
        Entity game = catan();
        cache.save("13", List.of(expansion("325", "Catan: Seafarers", "https://cf.geekdo-images.com/sea.jpg"),
                expansion("926", "Catan: Cities & Knights", null)), READ_AT);

        WorkElements elements = only(game, List.of(baseCopy(game)));

        assertThat(elements.elements()).extracting(WorkElement::key).containsExactly("work", "bgg-325", "bgg-926");
        // The page names the game already: "Catan: Seafarers" reads "Seafarers".
        assertThat(elements.elements()).extracting(WorkElement::label)
                .containsExactly("Catan", "Seafarers", "Cities & Knights");
        assertThat(elements.elements().get(1).coverImageUrl()).isEqualTo("https://cf.geekdo-images.com/sea.jpg");
        assertThat(elements.elements()).extracting(WorkElement::optional).containsExactly(false, true, true);
        assertThat(elements.totalCount()).isEqualTo(3);
        assertThat(elements.origin().fallback()).isFalse();
        assertThat(view(elements).missingCount()).isZero();
    }

    @Test
    void once_one_expansion_is_owned_the_other_expansions_count_as_missing() {
        Entity game = catan();
        Variant seafarers = game.addVariant("Marins", Map.of("bggId", "325"));
        cache.save("13", List.of(expansion("325", "Catan: Seafarers", null),
                expansion("926", "Catan: Cities & Knights", null)), READ_AT);

        WorkElements elements = only(game, List.of(baseCopy(game),
                Ownership.acquire(game.id(), seafarers.id(), OwnershipCondition.NEW, TODAY, null)));

        // The variant with the BGG id stands for the expansion: listed once, under its own name.
        assertThat(elements.elements()).extracting(WorkElement::label)
                .containsExactly("Catan", "Marins", "Cities & Knights");
        assertThat(elements.elements()).extracting(WorkElement::optional).containsExactly(false, false, false);
        assertThat(view(elements).missingCount()).isEqualTo(1);
    }

    @Test
    void a_variant_with_the_name_of_an_expansion_stands_for_it() {
        Entity game = catan();
        game.addVariant("Seafarers", Map.of());
        cache.save("13", List.of(expansion("325", "Catan: Seafarers", "https://cf.geekdo-images.com/sea.jpg")),
                READ_AT);

        WorkElements elements = only(game, List.of(baseCopy(game)));

        assertThat(elements.elements()).hasSize(2);
        assertThat(elements.elements().get(1).variantId()).isNotNull();
        // The variant had no cover: it takes the one of BGG.
        assertThat(elements.elements().get(1).coverImageUrl()).isEqualTo("https://cf.geekdo-images.com/sea.jpg");
    }

    @Test
    void an_expansion_owned_as_a_game_of_its_own_is_owned_and_linked() {
        Entity game = catan();
        Entity imported = entities.save(Entity.create(EntityTypeFixtures.BOARD_GAME.id(), "Catan: Seafarers"));
        Ownership copy = ownerships.save(Ownership.acquire(imported.id(), null, OwnershipCondition.NEW, TODAY, null));
        Entity wishedOne = Entity.create(EntityTypeFixtures.BOARD_GAME.id(), "Other name");
        wishedOne.mergeAttributes(Map.of("bggId", "926"));
        entities.save(wishedOne);
        wishes.save(WishlistEntry.add(wishedOne.id(), TODAY));
        cache.save("13", List.of(expansion("325", "Catan: Seafarers", null),
                expansion("926", "Catan: Cities & Knights", null)), READ_AT);

        WorkElements elements = only(game, List.of(baseCopy(game)));

        WorkElement seafarers = elements.elements().get(1);
        assertThat(seafarers.state()).isEqualTo(WorkElement.State.OWNED);
        assertThat(seafarers.ownershipId()).isEqualTo(copy.id());
        assertThat(seafarers.linkedEntityId()).isEqualTo(imported.id());
        // Matched by its BGG id, not its title.
        assertThat(elements.elements().get(2).state()).isEqualTo(WorkElement.State.WANTED);
        assertThat(elements.elements().get(2).optional()).isFalse();
    }

    @Test
    void without_bgg_the_game_keeps_its_catalog_elements_and_says_why() {
        Entity notLinked = Entity.create(EntityTypeFixtures.BOARD_GAME.id(), "Jeu maison");
        Entity notReadYet = catan();

        List<WorkElements> all = source.elementsOf(new WorkElementsContext(EntityTypeFixtures.BOARD_GAME,
                List.of(notLinked, notReadYet), List.of(), List.of(), List.of(), TODAY));

        assertThat(all.get(0).origin().fallback()).isTrue();
        assertThat(all.get(0).origin().note()).isEqualTo(BoardGameWorkElements.NOT_LINKED);
        assertThat(all.get(1).origin().note()).isEqualTo(BoardGameWorkElements.NOT_READ_YET);
        assertThat(all.get(1).elements()).hasSize(1);
    }

    @Test
    void the_account_is_not_read_when_no_game_has_expansions() {
        int[] reads = {0};
        InMemoryOwnershipRepository counting = new InMemoryOwnershipRepository() {
            @Override
            public List<Ownership> findAll() {
                reads[0]++;
                return super.findAll();
            }
        };
        BoardGameWorkElements counted = new BoardGameWorkElements(cache, entities, counting, wishes, null);
        Entity game = catan();
        cache.save("13", List.of(), READ_AT);

        counted.elementsOf(new WorkElementsContext(EntityTypeFixtures.BOARD_GAME, List.of(game),
                List.of(baseCopy(game)), List.of(), List.of(), TODAY));

        assertThat(reads[0]).isZero();
    }

    private static Entity catan() {
        Entity game = Entity.create(EntityTypeFixtures.BOARD_GAME.id(), "Catan");
        game.mergeAttributes(Map.of("bggId", "13"));
        return game;
    }

    private static BoardGameExpansion expansion(String id, String name, String image) {
        return new BoardGameExpansion(id, name, image, null);
    }

    private static Ownership baseCopy(Entity game) {
        return Ownership.acquire(game.id(), null, OwnershipCondition.NEW, TODAY, null);
    }

    private static WorkView view(WorkElements elements) {
        return WorkView.of(elements.entityId(), EntityTypeFixtures.BOARD_GAME.id(), "Catan", null, elements,
                CollectorStatus.ONGOING, 0, null, null, TODAY);
    }

    private WorkElements only(Entity game, List<Ownership> owned) {
        return source.elementsOf(new WorkElementsContext(EntityTypeFixtures.BOARD_GAME, List.of(game), owned,
                List.of(), List.of(), TODAY)).get(0);
    }
}
