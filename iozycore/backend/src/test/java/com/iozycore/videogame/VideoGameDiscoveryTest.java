package com.iozycore.videogame;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.insights.Discovery;
import com.iozycore.core.domain.insights.Discovery.EmptyReason;
import com.iozycore.core.domain.insights.DiscoveryCandidate;
import com.iozycore.core.metadata.MetadataCandidate;
import com.iozycore.core.metadata.SourceUnavailableException;
import com.iozycore.videogame.igdb.IgdbSimilarGamesFetcher;
import org.junit.jupiter.api.Test;
import com.iozycore.core.testing.InMemoryEntityRepository;
import com.iozycore.core.testing.InMemoryOwnershipRepository;
import com.iozycore.core.application.insights.OwnedWorks;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static com.iozycore.core.testing.OwnedWorksFixtures.everythingOwnedIn;
import static com.iozycore.core.testing.OwnedWorksFixtures.owned;
import static org.assertj.core.api.Assertions.assertThat;

/** Video game discovery - test extracted from DiscoveryServiceTest in Batch 133. */
class VideoGameDiscoveryTest {

    @Test
    void suggests_similar_video_games_excluding_owned_titles() {
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();

        Entity hollowKnight = Entity.create(EntityTypeFixtures.VIDEO_GAME.id(), "Hollow Knight");
        hollowKnight.setAttribute("igdbId", "8123");
        entityRepository.save(hollowKnight);

        StubIgdbSimilarGamesFetcher igdb = new StubIgdbSimilarGamesFetcher(List.of(
                new MetadataCandidate("IGDB", "8123", "Hollow Knight", null, Map.of()), // already owned - must be excluded
                new MetadataCandidate("IGDB", "9001", "Tunic", null, Map.of())          // new - must appear
        ));

        VideoGameDiscovery discovery = new VideoGameDiscovery(everythingOwnedIn(entityRepository), igdb);

        Discovery result = discovery.discover(EntityTypeFixtures.VIDEO_GAME);

        List<DiscoveryCandidate> suggestions = result.candidates();
        assertThat(suggestions).extracting(DiscoveryCandidate::title).containsExactly("Tunic");
        assertThat(suggestions.get(0).source()).isEqualTo("IGDB");
        assertThat(result.sourceAnswered()).isTrue();
    }

    // ------------------------------------------ Silent source or nothing to offer (batch 159)

    @Test
    void says_nothing_is_owned_without_asking_igdb() {
        StubIgdbSimilarGamesFetcher igdb = new StubIgdbSimilarGamesFetcher(List.of());

        Discovery result = new VideoGameDiscovery(everythingOwnedIn(new InMemoryEntityRepository()), igdb).discover(EntityTypeFixtures.VIDEO_GAME);

        assertThat(result.sourceAnswered()).isTrue();
        assertThat(result.emptyReason()).isEqualTo(EmptyReason.NOTHING_OWNED);
        assertThat(igdb.calls).isZero();
    }

    @Test
    void says_no_game_comes_from_igdb_when_none_carries_an_igdb_id() {
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        entityRepository.save(Entity.create(EntityTypeFixtures.VIDEO_GAME.id(), "Typed by hand"));
        StubIgdbSimilarGamesFetcher igdb = new StubIgdbSimilarGamesFetcher(List.of());

        Discovery result = new VideoGameDiscovery(everythingOwnedIn(entityRepository), igdb).discover(EntityTypeFixtures.VIDEO_GAME);

        assertThat(result.emptyReason()).isEqualTo(EmptyReason.NOT_LINKED_TO_SOURCE);
        assertThat(igdb.calls).isZero();
    }

    @Test
    void says_igdb_did_not_answer_instead_of_an_empty_list() {
        Discovery result = new VideoGameDiscovery(everythingOwnedIn(repositoryWithHollowKnight()), new SilentIgdbSimilarGamesFetcher())
                .discover(EntityTypeFixtures.VIDEO_GAME);

        assertThat(result.candidates()).isEmpty();
        assertThat(result.sourceAnswered()).isFalse();
        assertThat(result.emptyReason()).isNull();
    }

    @Test
    void an_empty_answer_from_igdb_is_an_answer() {
        Discovery result = new VideoGameDiscovery(everythingOwnedIn(repositoryWithHollowKnight()), new StubIgdbSimilarGamesFetcher(List.of()))
                .discover(EntityTypeFixtures.VIDEO_GAME);

        assertThat(result.candidates()).isEmpty();
        assertThat(result.sourceAnswered()).isTrue();
        assertThat(result.emptyReason()).isNull();
    }

    // ------------------------------------------ Only what this account owns

    @Test
    void starts_from_the_games_this_account_owns_not_the_whole_catalog() {
        InMemoryEntityRepository entityRepository = repositoryWithHollowKnight();
        Entity hollowKnight = entityRepository.all().get(0);
        Entity celeste = Entity.create(EntityTypeFixtures.VIDEO_GAME.id(), "Celeste"); // in the catalog, not owned here
        celeste.setAttribute("igdbId", "7000");
        entityRepository.save(celeste);
        InMemoryOwnershipRepository ownerships = new InMemoryOwnershipRepository();
        ownerships.save(owned(hollowKnight));
        StubIgdbSimilarGamesFetcher igdb = new StubIgdbSimilarGamesFetcher(List.of(
                new MetadataCandidate("IGDB", "7000", "Celeste", null, Map.of())));

        Discovery result = new VideoGameDiscovery(new OwnedWorks(entityRepository, ownerships), igdb)
                .discover(EntityTypeFixtures.VIDEO_GAME);

        assertThat(igdb.askedIds).containsExactly("8123");
        assertThat(result.candidates()).extracting(DiscoveryCandidate::title).containsExactly("Celeste");
    }

    @Test
    void says_nothing_is_owned_when_the_only_copy_was_sold() {
        InMemoryEntityRepository entityRepository = repositoryWithHollowKnight();
        InMemoryOwnershipRepository ownerships = new InMemoryOwnershipRepository();
        Ownership sold = owned(entityRepository.all().get(0));
        sold.markSold();
        ownerships.save(sold);
        StubIgdbSimilarGamesFetcher igdb = new StubIgdbSimilarGamesFetcher(List.of());

        Discovery result = new VideoGameDiscovery(new OwnedWorks(entityRepository, ownerships), igdb)
                .discover(EntityTypeFixtures.VIDEO_GAME);

        assertThat(result.emptyReason()).isEqualTo(EmptyReason.NOTHING_OWNED);
        assertThat(igdb.calls).isZero();
    }

    private static InMemoryEntityRepository repositoryWithHollowKnight() {
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        Entity hollowKnight = Entity.create(EntityTypeFixtures.VIDEO_GAME.id(), "Hollow Knight");
        hollowKnight.setAttribute("igdbId", "8123");
        entityRepository.save(hollowKnight);
        return entityRepository;
    }

    private static class StubIgdbSimilarGamesFetcher extends IgdbSimilarGamesFetcher {
        private final List<MetadataCandidate> results;
        int calls;
        final List<String> askedIds = new ArrayList<>();

        StubIgdbSimilarGamesFetcher(List<MetadataCandidate> results) {
            super(null);
            this.results = results;
        }

        @Override
        public List<MetadataCandidate> fetchSimilarGames(String igdbId) {
            calls++;
            askedIds.add(igdbId);
            return results;
        }
    }

    private static class SilentIgdbSimilarGamesFetcher extends IgdbSimilarGamesFetcher {
        SilentIgdbSimilarGamesFetcher() {
            super(null);
        }

        @Override
        public List<MetadataCandidate> fetchSimilarGames(String igdbId) {
            throw new SourceUnavailableException("IGDB answered 503");
        }
    }
}
