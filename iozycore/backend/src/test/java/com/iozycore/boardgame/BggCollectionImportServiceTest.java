package com.iozycore.boardgame;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.boardgame.bgg.BggCollectionFetcher;
import com.iozycore.boardgame.bgg.BggCollectionItem;
import com.iozycore.core.application.QuickAddService;
import com.iozycore.core.application.CatalogEntityResolver;
import com.iozycore.core.application.TomeResolver;
import org.junit.jupiter.api.Test;
import com.iozycore.core.testing.InMemoryEntityRepository;
import com.iozycore.core.testing.InMemoryEntityTypeRepository;
import com.iozycore.core.testing.InMemoryOwnershipRepository;
import com.iozycore.core.testing.InMemoryWishlistEntryRepository;
import com.iozycore.manga.testing.InMemoryMangaEditionRepository;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import com.iozycore.manga.MangaEditionLinker;

/**
 * Checks the orchestration of the BGG import - the fetcher is stubbed (no
 * real network call in the tests), the repositories are simple in-memory
 * fakes, as for QuickAddServiceTest.
 */
class BggCollectionImportServiceTest {

    @Test
    void imports_every_owned_game_and_counts_created_vs_matched() {
        StubBggCollectionFetcher fetcher = new StubBggCollectionFetcher(List.of(
                new BggCollectionItem("13", "Catan", "1995"),
                new BggCollectionItem("822", "Carcassonne", "2000")
        ));
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        QuickAddService quickAddService = new QuickAddService(entityRepository, new InMemoryOwnershipRepository(),
                new CatalogEntityResolver(entityRepository),
                new TomeResolver(entityRepository, List.of(), List.of(new MangaEditionLinker(new InMemoryMangaEditionRepository()))), new InMemoryWishlistEntryRepository(), event -> {
        });
        BggCollectionImportService importService =
                new BggCollectionImportService(fetcher, quickAddService, new InMemoryEntityTypeRepository(EntityTypeFixtures.BOARD_GAME));

        BggCollectionImportService.ImportResult result = importService.importOwnedGames("someuser");

        assertThat(result.totalFound()).isEqualTo(2);
        assertThat(result.created()).isEqualTo(2);
        assertThat(result.matchedExisting()).isEqualTo(0);
        assertThat(result.failed()).isEqualTo(0);
        assertThat(entityRepository.count()).isEqualTo(2);
    }

    @Test
    void re_importing_the_same_collection_matches_existing_entities_instead_of_duplicating() {
        StubBggCollectionFetcher fetcher = new StubBggCollectionFetcher(List.of(
                new BggCollectionItem("13", "Catan", "1995")
        ));
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        QuickAddService quickAddService = new QuickAddService(entityRepository, new InMemoryOwnershipRepository(),
                new CatalogEntityResolver(entityRepository),
                new TomeResolver(entityRepository, List.of(), List.of(new MangaEditionLinker(new InMemoryMangaEditionRepository()))), new InMemoryWishlistEntryRepository(), event -> {
        });
        BggCollectionImportService importService =
                new BggCollectionImportService(fetcher, quickAddService, new InMemoryEntityTypeRepository(EntityTypeFixtures.BOARD_GAME));

        importService.importOwnedGames("someuser");
        BggCollectionImportService.ImportResult second = importService.importOwnedGames("someuser");

        assertThat(second.matchedExisting()).isEqualTo(1);
        assertThat(second.created()).isEqualTo(0);
        assertThat(entityRepository.count()).isEqualTo(1); // still only one Catan in the Catalog
    }

    @Test
    void stores_the_collection_cover_and_details_and_imports_a_game_without_them() {
        StubBggCollectionFetcher fetcher = new StubBggCollectionFetcher(List.of(
                new BggCollectionItem("230802", "Azul", "2017",
                        "https://cf.geekdo-images.com/azul/pic.png", 2, 4, 45),
                new BggCollectionItem("999", "Prototype", null)
        ));
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        BggCollectionImportService importService = new BggCollectionImportService(
                fetcher, quickAddService(entityRepository), new InMemoryEntityTypeRepository(EntityTypeFixtures.BOARD_GAME));

        BggCollectionImportService.ImportResult result = importService.importOwnedGames("someuser");

        assertThat(result.created()).isEqualTo(2);
        assertThat(result.failed()).isEqualTo(0);
        Map<String, Object> azul = byTitle(entityRepository, "Azul").attributes();
        assertThat(azul).containsEntry("coverImageUrl", "https://cf.geekdo-images.com/azul/pic.png")
                .containsEntry("minPlayers", 2)
                .containsEntry("maxPlayers", 4)
                .containsEntry("averageDurationMinutes", 45)
                .containsEntry("bggId", "230802");
        assertThat(byTitle(entityRepository, "Prototype").attributes())
                .containsOnlyKeys("bggId");
    }

    @Test
    void re_importing_gives_a_cover_to_a_game_imported_without_one() {
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        QuickAddService quickAddService = quickAddService(entityRepository);
        new BggCollectionImportService(
                new StubBggCollectionFetcher(List.of(new BggCollectionItem("13", "Catan", "1995"))),
                quickAddService, new InMemoryEntityTypeRepository(EntityTypeFixtures.BOARD_GAME)).importOwnedGames("someuser");

        new BggCollectionImportService(
                new StubBggCollectionFetcher(List.of(new BggCollectionItem("13", "Catan", "1995",
                        "https://cf.geekdo-images.com/catan/pic.jpg", 3, 4, 120))),
                quickAddService, new InMemoryEntityTypeRepository(EntityTypeFixtures.BOARD_GAME)).importOwnedGames("someuser");

        assertThat(entityRepository.count()).isEqualTo(1);
        assertThat(byTitle(entityRepository, "Catan").attributes())
                .containsEntry("coverImageUrl", "https://cf.geekdo-images.com/catan/pic.jpg");
    }

    private static QuickAddService quickAddService(InMemoryEntityRepository entityRepository) {
        return new QuickAddService(entityRepository, new InMemoryOwnershipRepository(),
                new CatalogEntityResolver(entityRepository),
                new TomeResolver(entityRepository, List.of(), List.of(new MangaEditionLinker(new InMemoryMangaEditionRepository()))), new InMemoryWishlistEntryRepository(), event -> {
        });
    }

    private static class StubBggCollectionFetcher extends BggCollectionFetcher {
        private final List<BggCollectionItem> items;

        StubBggCollectionFetcher(List<BggCollectionItem> items) {
            this.items = items;
        }

        @Override
        public List<BggCollectionItem> fetchOwnedGames(String username) {
            return items;
        }
    }

    private static Entity byTitle(InMemoryEntityRepository entityRepository, String title) {
        return entityRepository.findByTypeAndTitle(EntityTypeFixtures.BOARD_GAME.id(), title).orElseThrow();
    }
}
