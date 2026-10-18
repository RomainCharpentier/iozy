package com.iozycore.videogame;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.insights.Discovery;
import com.iozycore.core.domain.insights.Discovery.EmptyReason;
import com.iozycore.core.domain.insights.DiscoveryCandidate;
import com.iozycore.core.metadata.MetadataCandidate;
import com.iozycore.core.metadata.SourceUnavailableException;
import com.iozycore.videogame.igdb.IgdbSimilarGamesFetcher;
import org.junit.jupiter.api.Test;
import com.iozycore.core.testing.InMemoryEntityRepository;

import java.util.List;
import java.util.Map;

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

        VideoGameDiscovery discovery = new VideoGameDiscovery(entityRepository, igdb);

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

        Discovery result = new VideoGameDiscovery(new InMemoryEntityRepository(), igdb).discover(EntityTypeFixtures.VIDEO_GAME);

        assertThat(result.sourceAnswered()).isTrue();
        assertThat(result.emptyReason()).isEqualTo(EmptyReason.NOTHING_OWNED);
        assertThat(igdb.calls).isZero();
    }

    @Test
    void says_no_game_comes_from_igdb_when_none_carries_an_igdb_id() {
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        entityRepository.save(Entity.create(EntityTypeFixtures.VIDEO_GAME.id(), "Typed by hand"));
        StubIgdbSimilarGamesFetcher igdb = new StubIgdbSimilarGamesFetcher(List.of());

        Discovery result = new VideoGameDiscovery(entityRepository, igdb).discover(EntityTypeFixtures.VIDEO_GAME);

        assertThat(result.emptyReason()).isEqualTo(EmptyReason.NOT_LINKED_TO_SOURCE);
        assertThat(igdb.calls).isZero();
    }

    @Test
    void says_igdb_did_not_answer_instead_of_an_empty_list() {
        Discovery result = new VideoGameDiscovery(repositoryWithHollowKnight(), new SilentIgdbSimilarGamesFetcher())
                .discover(EntityTypeFixtures.VIDEO_GAME);

        assertThat(result.candidates()).isEmpty();
        assertThat(result.sourceAnswered()).isFalse();
        assertThat(result.emptyReason()).isNull();
    }

    @Test
    void an_empty_answer_from_igdb_is_an_answer() {
        Discovery result = new VideoGameDiscovery(repositoryWithHollowKnight(), new StubIgdbSimilarGamesFetcher(List.of()))
                .discover(EntityTypeFixtures.VIDEO_GAME);

        assertThat(result.candidates()).isEmpty();
        assertThat(result.sourceAnswered()).isTrue();
        assertThat(result.emptyReason()).isNull();
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

        StubIgdbSimilarGamesFetcher(List<MetadataCandidate> results) {
            super(null);
            this.results = results;
        }

        @Override
        public List<MetadataCandidate> fetchSimilarGames(String igdbId) {
            calls++;
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
