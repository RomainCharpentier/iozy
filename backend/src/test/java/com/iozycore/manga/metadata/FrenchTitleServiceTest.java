package com.iozycore.manga.metadata;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.manga.metadata.FrenchTitleMatch;
import com.iozycore.core.metadata.MetadataCandidate;
import com.iozycore.core.metadata.MetadataProvider;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** The French title of a manga - tests taken out of MetadataSearchServiceTest in Batch 132. */
class FrenchTitleServiceTest {

    private static final EntityType MANGA = new EntityType(UUID.randomUUID(), "MANGA", "Manga", Set.of(), Set.of());

    @Test
    void does_not_call_the_french_title_provider_again_for_a_repeated_identical_query() {
        FakeEntityRepository repository = new FakeEntityRepository(List.of());
        FakeFrenchTitleProvider frenchTitleProvider = new FakeFrenchTitleProvider(Optional.of(FrenchTitleMatch.seriesMatched("L'Attaque des Titans")));
        FrenchTitleService service =
                new FrenchTitleService(List.of(), List.of(frenchTitleProvider));

        Optional<String> first = service.findFrenchTitle(MANGA, "Shingeki no Kyojin", "Hajime Isayama");
        // same query apart from the case - must stay a cache hit
        Optional<String> second = service.findFrenchTitle(MANGA, "shingeki no kyojin", "hajime isayama");

        assertThat(first).contains("L'Attaque des Titans");
        assertThat(second).contains("L'Attaque des Titans");
        assertThat(frenchTitleProvider.callCount).isEqualTo(1);
    }

    @Test
    void tries_the_next_french_title_provider_when_the_first_finds_nothing() {
        FakeEntityRepository repository = new FakeEntityRepository(List.of());
        FakeFrenchTitleProvider firstProvider = new FakeFrenchTitleProvider(Optional.empty());
        FakeFrenchTitleProvider secondProvider = new FakeFrenchTitleProvider(Optional.of(FrenchTitleMatch.seriesMatched("L'Attaque des Titans")));
        FrenchTitleService service = new FrenchTitleService(List.of(), List.of(firstProvider, secondProvider));

        Optional<String> result = service.findFrenchTitle(MANGA, "Shingeki no Kyojin", "Hajime Isayama");

        assertThat(result).contains("L'Attaque des Titans");
        assertThat(firstProvider.callCount).isEqualTo(1);
        assertThat(secondProvider.callCount).isEqualTo(1);
    }

    @Test
    void does_not_cache_a_failed_french_title_lookup_so_a_later_retry_can_still_succeed() {
        FakeEntityRepository repository = new FakeEntityRepository(List.of());
        StatefulFrenchTitleProvider provider = new StatefulFrenchTitleProvider("L'Attaque des Titans");
        FrenchTitleService service =
                new FrenchTitleService(List.of(), List.of(provider));

        Optional<String> firstAttempt = service.findFrenchTitle(MANGA, "Shingeki no Kyojin", "Hajime Isayama");
        Optional<String> secondAttempt = service.findFrenchTitle(MANGA, "Shingeki no Kyojin", "Hajime Isayama");

        assertThat(firstAttempt).isEmpty();
        assertThat(secondAttempt).contains("L'Attaque des Titans");
        assertThat(provider.callCount).isEqualTo(2); // no cache hit after the failure
    }

    @Test
    void prefers_a_series_matched_french_title_over_an_author_only_one_found_by_an_earlier_provider() {
        // Real case (see history): Open Library, tried first, only
        // finds "Vagabond" through the author's name (and returns "Slam
        // Dunk"); the order of providers must not let this
        // guess win over a real series match from the next one.
        FakeEntityRepository repository = new FakeEntityRepository(List.of());
        FakeFrenchTitleProvider guessing = new FakeFrenchTitleProvider(Optional.of(FrenchTitleMatch.authorOnly("Slam Dunk")));
        FakeFrenchTitleProvider matching = new FakeFrenchTitleProvider(Optional.of(FrenchTitleMatch.seriesMatched("Vagabond")));
        FrenchTitleService service = new FrenchTitleService(List.of(), List.of(guessing, matching));

        Optional<String> result = service.findFrenchTitle(MANGA, "Vagabond", "Takehiko Inoue");

        assertThat(result).contains("Vagabond");
    }

    @Test
    void drops_an_author_only_french_title_that_is_the_catalogued_title_of_another_work() {
        // The original bug: "Vagabond" (Takehiko Inoue) was pre-filled
        // as "Slam Dunk", his other manga - catalogued as is under another
        // identifier, so never a French translation of the series
        // being searched.
        FakeEntityRepository repository = new FakeEntityRepository(List.of());
        FakeMetadataProvider catalogue = new FakeMetadataProvider(List.of(candidate("Slam Dunk", "51")));
        FakeFrenchTitleProvider frenchTitleProvider =
                new FakeFrenchTitleProvider(Optional.of(FrenchTitleMatch.authorOnly("Slam Dunk")));
        FrenchTitleService service = new FrenchTitleService(List.of(catalogue), List.of(frenchTitleProvider));

        Optional<String> result = service.findFrenchTitle(MANGA, "Vagabond", "Takehiko Inoue", List.of(), "656");

        assertThat(result).isEmpty();
    }

    @Test
    void keeps_an_author_only_french_title_that_no_catalogued_work_bears_exactly() {
        // "Zom 100" (Haro Aso) is published in France as "Bucket List of the
        // Dead": the catalogue only knows "Zom 100: Bucket List of the
        // Dead", a DIFFERENT title - the check compares by exact
        // equality, never by inclusion, otherwise this real French title
        // would be wrongly discarded.
        FakeEntityRepository repository = new FakeEntityRepository(List.of());
        FakeMetadataProvider catalogue =
                new FakeMetadataProvider(List.of(candidate("Zom 100: Bucket List of the Dead", "122392")));
        FakeFrenchTitleProvider frenchTitleProvider =
                new FakeFrenchTitleProvider(Optional.of(FrenchTitleMatch.authorOnly("Bucket List of the Dead")));
        FrenchTitleService service = new FrenchTitleService(List.of(catalogue), List.of(frenchTitleProvider));

        Optional<String> result = service.findFrenchTitle(MANGA, "Zom 100", "Haro Aso", List.of(), "122392");

        assertThat(result).contains("Bucket List of the Dead");
    }

    @Test
    void keeps_an_author_only_french_title_when_the_catalogued_work_is_the_queried_series_itself() {
        // A French edition that keeps the original title: the catalogue
        // necessarily knows it, but it is the searched series itself, not
        // another work - recognised by its title when the identifier is
        // not provided (e.g. a candidate from an ISBN scan).
        FakeEntityRepository repository = new FakeEntityRepository(List.of());
        FakeMetadataProvider catalogue = new FakeMetadataProvider(List.of(candidate("Vagabond", "656")));
        FakeFrenchTitleProvider frenchTitleProvider =
                new FakeFrenchTitleProvider(Optional.of(FrenchTitleMatch.authorOnly("Vagabond")));
        FrenchTitleService service = new FrenchTitleService(List.of(catalogue), List.of(frenchTitleProvider));

        Optional<String> result = service.findFrenchTitle(MANGA, "Vagabond", "Takehiko Inoue");

        assertThat(result).contains("Vagabond");
    }

    @Test
    void ignores_a_provider_that_searches_by_french_title_when_checking_an_author_only_title() {
        // "Gloutons et Dragons" (French title of "Delicious in Dungeon")
        // is obviously found by the provider that searches BY French
        // title - using it to decide "this is another work"
        // would systematically discard the good answers.
        FakeEntityRepository repository = new FakeEntityRepository(List.of());
        FakeFrenchTitleSearchProvider frenchCatalogue =
                new FakeFrenchTitleSearchProvider(List.of(candidate("Gloutons et Dragons", "gb-1")));
        FakeFrenchTitleProvider frenchTitleProvider =
                new FakeFrenchTitleProvider(Optional.of(FrenchTitleMatch.authorOnly("Gloutons et Dragons")));
        FrenchTitleService service = new FrenchTitleService(List.of(frenchCatalogue), List.of(frenchTitleProvider));

        Optional<String> result = service.findFrenchTitle(MANGA, "Delicious in Dungeon", "Ryoko Kui", List.of(), "88089");

        assertThat(result).contains("Gloutons et Dragons");
    }

    @Test
    void drops_an_author_only_title_when_the_catalogue_cannot_be_reached_to_check_it() {
        // An uncorroborated guess is worth less than a 404: the client
        // then keeps the original title already displayed, rather than being
        // forced to take the title of another series.
        FakeEntityRepository repository = new FakeEntityRepository(List.of());
        FakeFrenchTitleProvider frenchTitleProvider =
                new FakeFrenchTitleProvider(Optional.of(FrenchTitleMatch.authorOnly("Slam Dunk")));
        FrenchTitleService service = new FrenchTitleService(List.of(new FailingMetadataProvider()), List.of(frenchTitleProvider));

        Optional<String> result = service.findFrenchTitle(MANGA, "Vagabond", "Takehiko Inoue");

        assertThat(result).isEmpty();
    }

    @Test
    void does_not_call_the_french_title_provider_for_an_unsupported_entity_type() {
        EntityType videoGame = new EntityType(UUID.randomUUID(), "VIDEO_GAME", "Jeu vidéo", Set.of(), Set.of());
        FakeEntityRepository repository = new FakeEntityRepository(List.of());
        FakeFrenchTitleProvider frenchTitleProvider = new FakeFrenchTitleProvider(Optional.of(FrenchTitleMatch.seriesMatched("Ne devrait jamais sortir")));
        FrenchTitleService service =
                new FrenchTitleService(List.of(), List.of(frenchTitleProvider));

        Optional<String> result = service.findFrenchTitle(videoGame, "Zelda", null);

        assertThat(result).isEmpty();
        assertThat(frenchTitleProvider.callCount).isEqualTo(0);
    }

    private static MetadataCandidate candidate(String title) {
        return new MetadataCandidate("FAKE", title, title, null, Map.of());
    }

    private static MetadataCandidate candidate(String title, String externalId) {
        return new MetadataCandidate("FAKE", externalId, title, null, Map.of());
    }

    /** entities is deliberately mutable (defensive copy in the compact constructor) -
     * some tests simulate an addition happening between two searches. */
    private record FakeEntityRepository(List<Entity> entities) implements EntityRepository {
        FakeEntityRepository {
            entities = new ArrayList<>(entities);
        }

        @Override
        public Entity save(Entity entity) {
            throw new UnsupportedOperationException();
        }

        @Override
        public Optional<Entity> findById(UUID id) {
            throw new UnsupportedOperationException();
        }

        @Override
        public Optional<Entity> findByTypeAndTitle(UUID entityTypeId, String title) {
            throw new UnsupportedOperationException();
        }

        @Override
        public List<Entity> findAllByType(UUID entityTypeId) {
            return entities;
        }

        @Override
        public boolean existsByType(UUID entityTypeId) {
            throw new UnsupportedOperationException();
        }

        @Override
        public List<Entity> search(String titleQuery, UUID entityTypeId, UUID tagId) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void deleteById(UUID id) {
            throw new UnsupportedOperationException();
        }
    }

    /** callCount is deliberately not a record component: it must stay
     * mutable so that cache tests can check how many times
     * the "provider" was really called (so not served by the cache). */
    private static final class FakeMetadataProvider implements MetadataProvider {
        private final List<MetadataCandidate> results;
        int callCount = 0;

        FakeMetadataProvider(List<MetadataCandidate> results) {
            this.results = results;
        }

        @Override
        public boolean supports(EntityType entityType) {
            return true;
        }

        @Override
        public List<MetadataCandidate> search(String query) {
            callCount++;
            return results;
        }
    }

    /** Searches by FRENCH title (like GoogleBooksTitleSearchProvider) -
     * must stay outside the check of an "author only" title. */
    private static final class FakeFrenchTitleSearchProvider implements MetadataProvider {
        private final List<MetadataCandidate> results;

        FakeFrenchTitleSearchProvider(List<MetadataCandidate> results) {
            this.results = results;
        }

        @Override
        public boolean supports(EntityType entityType) {
            return true;
        }

        @Override
        public boolean catalogsOriginalTitles() {
            return false;
        }

        @Override
        public List<MetadataCandidate> search(String query) {
            return results;
        }
    }

    /** Catalogue unreachable (network outage/quota) - see
     * drops_an_author_only_title_when_the_catalogue_cannot_be_reached_to_check_it. */
    private static final class FailingMetadataProvider implements MetadataProvider {
        @Override
        public boolean supports(EntityType entityType) {
            return true;
        }

        @Override
        public List<MetadataCandidate> search(String query) {
            throw new IllegalStateException("catalogue injoignable");
        }
    }

    private static final class FakeFrenchTitleProvider implements FrenchTitleProvider {
        private final Optional<FrenchTitleMatch> result;
        int callCount = 0;

        FakeFrenchTitleProvider(Optional<FrenchTitleMatch> result) {
            this.result = result;
        }

        @Override
        public boolean supports(EntityType entityType) {
            return "MANGA".equals(entityType.code());
        }

        @Override
        public Optional<FrenchTitleMatch> findFrenchTitle(String query, String author, List<String> excludedTitleFragments) {
            callCount++;
            return result;
        }
    }

    /** Same for the French title search. */
    private static final class StatefulFrenchTitleProvider implements FrenchTitleProvider {
        private final String result;
        int callCount = 0;

        StatefulFrenchTitleProvider(String result) {
            this.result = result;
        }

        @Override
        public boolean supports(EntityType entityType) {
            return "MANGA".equals(entityType.code());
        }

        @Override
        public Optional<FrenchTitleMatch> findFrenchTitle(String query, String author, List<String> excludedTitleFragments) {
            callCount++;
            return callCount == 1 ? Optional.empty() : Optional.of(FrenchTitleMatch.seriesMatched(result));
        }
    }
}
