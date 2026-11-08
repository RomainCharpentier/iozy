package com.iozycore.videogame;

import com.iozycore.core.application.CatalogEntityResolver;
import com.iozycore.core.application.work.ElementAcquisition;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.work.CollectorStatus;
import com.iozycore.core.domain.work.WorkElement;
import com.iozycore.core.domain.work.WorkElements;
import com.iozycore.core.domain.work.WorkElementsContext;
import com.iozycore.core.domain.work.WorkView;
import com.iozycore.core.testing.InMemoryEntityRepository;
import com.iozycore.core.testing.InMemoryOwnershipRepository;
import com.iozycore.core.testing.InMemoryWishlistEntryRepository;
import com.iozycore.videogame.franchise.Franchise;
import com.iozycore.videogame.franchise.FranchiseGame;
import com.iozycore.videogame.franchise.FranchiseSource;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** A video game: the game itself, then the other games of its licence on the same console. */
class VideoGameWorkElementsTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 11, 8);
    private static final Instant READ_AT = Instant.parse("2026-11-01T00:00:00Z");
    private static final String SWITCH = "Nintendo Switch";

    private final InMemoryFranchiseCache cache = new InMemoryFranchiseCache();
    private final InMemoryEntityRepository entities = new InMemoryEntityRepository();
    private final InMemoryOwnershipRepository ownerships = new InMemoryOwnershipRepository();
    private final InMemoryWishlistEntryRepository wishes = new InMemoryWishlistEntryRepository();
    private boolean keyConfigured = true;
    private final FranchiseSource igdb = new FranchiseSource() {
        @Override
        public boolean configured() {
            return keyConfigured;
        }

        @Override
        public Franchise franchiseOf(String igdbId) {
            throw new AssertionError("a page never asks IGDB");
        }
    };
    private final ElementAcquisition acquisition = new ElementAcquisition(entities, ownerships, wishes,
            new CatalogEntityResolver(entities), event -> {
    });
    private final VideoGameWorkElements source =
            new VideoGameWorkElements(cache, igdb, entities, ownerships, wishes, acquisition);

    @Test
    void the_games_of_the_licence_on_the_console_follow_the_game_and_are_optional_with_one_owned() {
        Entity botw = game("Breath of the Wild", "1");
        zelda();

        WorkElements elements = only(botw, List.of(copy(botw, SWITCH)));

        // Ocarina of Time is not on Switch; Echoes is not out yet.
        assertThat(elements.elements()).extracting(WorkElement::label)
                .containsExactly("Breath of the Wild", "Link's Awakening", "Tears of the Kingdom",
                        "Echoes of Wisdom");
        assertThat(elements.elements()).extracting(WorkElement::state).containsExactly(WorkElement.State.OWNED,
                WorkElement.State.MISSING, WorkElement.State.MISSING, WorkElement.State.UPCOMING);
        assertThat(elements.elements()).extracting(WorkElement::optional).containsExactly(false, true, true, true);
        // The optional games are shown, but one Zelda on Switch is 1 of 1, not 1 of 4.
        assertThat(elements.totalCount()).isEqualTo(1);
        assertThat(view(elements).ownedCount()).isEqualTo(1);
        assertThat(elements.origin().groupName()).isEqualTo("The Legend of Zelda");
        assertThat(elements.origin().scope()).isEqualTo(SWITCH);
        assertThat(view(elements).missingCount()).isZero();
    }

    @Test
    void with_two_games_of_the_licence_on_the_console_the_others_count_as_missing() {
        Entity botw = game("Breath of the Wild", "1");
        Entity totk = entities.save(game("Tears of the Kingdom", "2"));
        Ownership totkCopy = ownerships.save(copy(totk, SWITCH));
        zelda();

        WorkElements elements = only(botw, List.of(copy(botw, SWITCH)));

        WorkElement tears = elements.elements().get(2);
        assertThat(tears.state()).isEqualTo(WorkElement.State.OWNED);
        assertThat(tears.ownershipId()).isEqualTo(totkCopy.id());
        assertThat(tears.linkedEntityId()).isEqualTo(totk.id());
        assertThat(elements.elements()).extracting(WorkElement::optional).containsOnly(false);
        assertThat(elements.totalCount()).isEqualTo(4);
        // Link's Awakening counts; Echoes is not out yet.
        assertThat(view(elements).missingCount()).isEqualTo(1);
    }

    @Test
    void in_a_list_a_game_stands_alone_so_a_missing_game_of_the_licence_is_never_counted_twice() {
        Entity botw = entities.save(game("Breath of the Wild", "1"));
        Entity totk = entities.save(game("Tears of the Kingdom", "2"));
        Ownership botwCopy = ownerships.save(copy(botw, SWITCH));
        Ownership totkCopy = ownerships.save(copy(totk, SWITCH));
        zelda();

        List<WorkElements> list = source.elementsOf(new WorkElementsContext(EntityTypeFixtures.VIDEO_GAME,
                List.of(botw, totk), List.of(botwCopy, totkCopy), List.of(), List.of(), TODAY, true));

        assertThat(list).allSatisfy(work -> {
            assertThat(work.elements()).extracting(WorkElement::key).containsExactly("work");
            assertThat(work.totalCount()).isEqualTo(1);
        });
        assertThat(list.stream().mapToInt(work -> view(work).missingCount()).sum()).isZero();
        // The page of one game still lists its licence, with Link's Awakening missing once.
        assertThat(only(botw, List.of(botwCopy)).elements()).hasSize(4);
    }

    @Test
    void a_console_typed_by_hand_is_the_console_igdb_names() {
        Entity botw = game("Breath of the Wild", "1");
        zelda();

        WorkElements elements = only(botw, List.of(copy(botw, "Switch")));

        assertThat(elements.elements()).extracting(WorkElement::label)
                .containsExactly("Breath of the Wild", "Link's Awakening", "Tears of the Kingdom",
                        "Echoes of Wisdom");
        assertThat(elements.origin().fallback()).isFalse();
        assertThat(elements.origin().scope()).isEqualTo("Switch");
        // A Switch is not a Switch 2, and a PS4 is not a PS5.
        assertThat(Consoles.canonical("Switch")).isEqualTo(Consoles.canonical("Nintendo Switch"));
        assertThat(Consoles.canonical("Switch")).isNotEqualTo(Consoles.canonical("Nintendo Switch 2"));
        assertThat(Consoles.canonical("PS5")).isEqualTo(Consoles.canonical("PlayStation 5"));
        assertThat(Consoles.canonical("PS4")).isNotEqualTo(Consoles.canonical("PlayStation 5"));
        assertThat(Consoles.canonical("PC")).isEqualTo(Consoles.canonical("PC (Microsoft Windows)"));
    }

    @Test
    void with_no_game_of_the_licence_on_the_console_the_page_says_so() {
        Entity botw = game("Breath of the Wild", "1");
        zelda();

        WorkElements elements = only(botw, List.of(copy(botw, "Xbox One")));

        assertThat(elements.elements()).extracting(WorkElement::key).containsExactly("work");
        assertThat(elements.origin().fallback()).isTrue();
        assertThat(elements.origin().note()).isEqualTo("Aucun autre jeu de la licence sur cette console");
    }

    @Test
    void a_game_owned_on_two_consoles_follows_the_licence_console_by_console() {
        Entity botw = game("Breath of the Wild", "1");
        Entity awakening = entities.save(game("Link's Awakening", "3"));
        ownerships.save(copy(awakening, "Game Boy"));
        zelda();

        // Owned on Game Boy too (a fiction of the test): Link's Awakening is on Game Boy, the first console.
        WorkElements elements = only(botw, List.of(copy(botw, "Game Boy"), copy(botw, SWITCH)));

        WorkElement links = elements.elements().stream().filter(e -> e.label().equals("Link's Awakening"))
                .findFirst().orElseThrow();
        assertThat(links.state()).isEqualTo(WorkElement.State.OWNED);
        // Two games on Game Boy: followed there. Tears of the Kingdom is on Switch only, where one game is owned.
        WorkElement tears = elements.elements().stream().filter(e -> e.label().equals("Tears of the Kingdom"))
                .findFirst().orElseThrow();
        assertThat(tears.optional()).isTrue();
        assertThat(view(elements).missingCount()).isZero();
    }

    @Test
    void je_l_ai_on_a_game_of_the_licence_creates_it_on_the_console_it_exists_on() {
        Entity botw = entities.save(game("Breath of the Wild", "1"));
        ownerships.save(copy(botw, "PS4"));
        ownerships.save(copy(botw, SWITCH));
        zelda();
        WorkElement tears = only(botw, ownerships.findByEntityId(botw.id())).elements().stream()
                .filter(e -> e.key().equals("igdb-2")).findFirst().orElseThrow();

        assertThat(source.own(EntityTypeFixtures.VIDEO_GAME, botw, tears)).isTrue();

        Entity created = entities.findAllByType(EntityTypeFixtures.VIDEO_GAME.id()).stream()
                .filter(e -> e.title().equals("Tears of the Kingdom")).findFirst().orElseThrow();
        assertThat(created.attributes().get("igdbId")).isEqualTo("2");
        // Tears of the Kingdom is a Switch game: never a copy on PS4.
        assertThat(ownerships.findByEntityId(created.id())).extracting(o -> o.platform().orElse(null))
                .containsExactly(SWITCH);
    }

    @Test
    void je_l_ai_on_a_game_of_the_licence_owns_the_catalog_game_with_its_igdb_id() {
        Entity botw = entities.save(game("Breath of the Wild", "1"));
        ownerships.save(copy(botw, SWITCH));
        Entity inCatalog = entities.save(game("Zelda: Tears of the Kingdom", "2"));
        zelda();
        WorkElement tears = only(botw, ownerships.findByEntityId(botw.id())).elements().stream()
                .filter(e -> e.key().equals("igdb-2")).findFirst().orElseThrow();

        source.own(EntityTypeFixtures.VIDEO_GAME, botw, tears);
        source.own(EntityTypeFixtures.VIDEO_GAME, botw, tears);

        assertThat(ownerships.findByEntityId(inCatalog.id())).extracting(o -> o.platform().orElse(null))
                .containsExactly(SWITCH);
        assertThat(entities.findAllByType(EntityTypeFixtures.VIDEO_GAME.id())).hasSize(2);
    }

    @Test
    void a_copy_on_another_console_is_not_owned_on_this_one() {
        Entity botw = game("Breath of the Wild", "1");
        Entity awakening = entities.save(game("Link's Awakening", "3"));
        ownerships.save(copy(awakening, "Game Boy"));
        zelda();

        WorkElements elements = only(botw, List.of(copy(botw, SWITCH)));

        assertThat(elements.elements().get(1).state()).isEqualTo(WorkElement.State.MISSING);
        assertThat(elements.elements().get(1).optional()).isTrue();
    }

    @Test
    void the_console_written_on_the_game_is_used_when_the_copy_does_not_say_it() {
        Entity botw = game("Breath of the Wild", "1");
        botw.mergeAttributes(Map.of("platform", "nintendo switch"));
        zelda();

        WorkElements elements = only(botw, List.of(copy(botw, null)));

        assertThat(elements.elements()).hasSize(4);
    }

    @Test
    void with_no_console_known_the_licence_is_not_shown_and_the_page_says_why() {
        Entity botw = game("Breath of the Wild", "1");
        zelda();

        WorkElements elements = only(botw, List.of(copy(botw, null)));

        assertThat(elements.elements()).extracting(WorkElement::key).containsExactly("work");
        assertThat(elements.origin().fallback()).isTrue();
        assertThat(elements.origin().note()).isEqualTo(VideoGameWorkElements.NO_CONSOLE);
    }

    @Test
    void without_the_igdb_key_the_game_stands_alone_and_says_the_key_is_missing() {
        keyConfigured = false;
        Entity botw = game("Breath of the Wild", "1");
        zelda();

        WorkElements elements = only(botw, List.of(copy(botw, SWITCH)));

        assertThat(elements.elements()).extracting(WorkElement::key).containsExactly("work");
        assertThat(elements.origin().fallback()).isTrue();
        assertThat(elements.origin().note()).isEqualTo("Licence indisponible : clé IGDB absente");
        assertThat(cache.reads).isZero();
    }

    @Test
    void a_game_not_linked_or_not_read_yet_stands_alone_and_says_why() {
        Entity homebrew = Entity.create(EntityTypeFixtures.VIDEO_GAME.id(), "Homebrew");
        Entity notRead = game("Metroid Dread", "99");

        List<WorkElements> all = source.elementsOf(new WorkElementsContext(EntityTypeFixtures.VIDEO_GAME,
                List.of(homebrew, notRead), List.of(), List.of(), List.of(), TODAY));

        assertThat(all.get(0).origin().note()).isEqualTo(VideoGameWorkElements.NOT_LINKED);
        assertThat(all.get(1).origin().note()).isEqualTo(VideoGameWorkElements.NOT_READ_YET);
    }

    private void zelda() {
        cache.save("1", new Franchise("The Legend of Zelda", List.of(
                new FranchiseGame("1", "Breath of the Wild", null, List.of("Wii U", SWITCH), "2017-03-03"),
                new FranchiseGame("2", "Tears of the Kingdom", null, List.of(SWITCH), "2023-05-12"),
                new FranchiseGame("3", "Link's Awakening", null, List.of("Game Boy", SWITCH), "2019-09-20"),
                new FranchiseGame("4", "Ocarina of Time", null, List.of("Nintendo 64"), "1998-11-21"),
                new FranchiseGame("5", "Echoes of Wisdom", null, List.of(SWITCH), "2027-09-26"))), READ_AT);
    }

    private static Entity game(String title, String igdbId) {
        Entity game = Entity.create(EntityTypeFixtures.VIDEO_GAME.id(), title);
        game.mergeAttributes(Map.of("igdbId", igdbId));
        return game;
    }

    private static Ownership copy(Entity game, String console) {
        Ownership copy = Ownership.acquire(game.id(), null, OwnershipCondition.NEW, TODAY, null);
        copy.updatePlatform(console);
        return copy;
    }

    private static WorkView view(WorkElements elements) {
        return WorkView.of(elements.entityId(), EntityTypeFixtures.VIDEO_GAME.id(), "Zelda", null, elements,
                CollectorStatus.ONGOING, 0, null, null, TODAY);
    }

    private WorkElements only(Entity game, List<Ownership> owned) {
        return source.elementsOf(new WorkElementsContext(EntityTypeFixtures.VIDEO_GAME, List.of(game), owned,
                List.of(), List.of(), TODAY)).get(0);
    }
}
