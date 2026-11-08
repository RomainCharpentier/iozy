package com.iozycore.core.application;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.metadata.MetadataCandidate;
import com.iozycore.core.metadata.MetadataDetailsService;
import com.iozycore.core.metadata.MetadataProvider;
import com.iozycore.core.metadata.SourceUnavailableException;
import com.iozycore.core.testing.InMemoryEntityRepository;
import com.iozycore.core.testing.InMemoryEntityTypeRepository;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The automatic backfill of the shelf keys: which works are asked, what is
 * written, what a key typed by hand and a silent provider leave behind.
 */
class ShelfDetailsBackfillTest {

    private static final ShelfDetailsSource VIDEO_GAMES = new TestSource("VIDEO_GAME", "igdbId",
            List.of("publisher", "platforms"));
    private static final ShelfDetailsSource BOARD_GAMES = new TestSource("BOARD_GAME", "bggId",
            List.of("publisher"));

    private final InMemoryEntityTypeRepository types = new InMemoryEntityTypeRepository(
            EntityTypeFixtures.VIDEO_GAME, EntityTypeFixtures.BOARD_GAME);
    private final InMemoryEntityRepository entities = new InMemoryEntityRepository();
    private final ScriptedProvider igdb = new ScriptedProvider("VIDEO_GAME", "igdbId");
    private final ScriptedProvider bgg = new ScriptedProvider("BOARD_GAME", "bggId");

    private ShelfDetailsBackfill backfill(int worksPerRun) {
        MetadataDetailsService details = new MetadataDetailsService(List.of(igdb, bgg), types);
        return new ShelfDetailsBackfill(types, entities, details, List.of(VIDEO_GAMES, BOARD_GAMES), true,
                worksPerRun, Duration.ZERO);
    }

    @Test
    void fills_the_missing_keys_of_each_type_from_its_source() {
        Entity zelda = work(EntityTypeFixtures.VIDEO_GAME, "Zelda", Map.of("igdbId", "1025"));
        Entity catan = work(EntityTypeFixtures.BOARD_GAME, "Catan", Map.of("bggId", "13"));
        igdb.answers.put("1025", Map.of("publisher", "Nintendo", "platforms", "Switch, Wii U", "genre", "Aventure"));
        bgg.answers.put("13", Map.of("publisher", "Kosmos", "minPlayers", 3));

        ShelfDetailsBackfill.Result result = backfill(10).run();

        assertThat(result).isEqualTo(new ShelfDetailsBackfill.Result(2, 2, false));
        assertThat(attributes(zelda)).containsEntry("publisher", "Nintendo").containsEntry("platforms", "Switch, Wii U")
                // Only the shelf keys: the rest of the details is not the job's business.
                .doesNotContainKey("genre");
        assertThat(attributes(catan)).containsEntry("publisher", "Kosmos").doesNotContainKey("minPlayers");
    }

    @Test
    void keeps_the_keys_typed_by_hand() {
        Entity typed = Entity.reconstitute(UUID.randomUUID(), EntityTypeFixtures.VIDEO_GAME.id(), "Hades",
                new HashMap<>(Map.of("igdbId", "113112", "platforms", "PC")), List.of(), Set.of(),
                Set.of("platforms"));
        entities.save(typed);
        // Removed by hand: marked as typed, without a value. It stays removed.
        Entity removed = Entity.reconstitute(UUID.randomUUID(), EntityTypeFixtures.BOARD_GAME.id(), "Azul",
                new HashMap<>(Map.of("bggId", "230802")), List.of(), Set.of(), Set.of("publisher"));
        entities.save(removed);
        igdb.answers.put("113112", Map.of("publisher", "Supergiant Games", "platforms", "PC, Switch, PS5"));
        bgg.answers.put("230802", Map.of("publisher", "Plan B Games"));

        ShelfDetailsBackfill.Result result = backfill(10).run();

        assertThat(attributes(typed)).containsEntry("publisher", "Supergiant Games").containsEntry("platforms", "PC");
        assertThat(attributes(removed)).doesNotContainKey("publisher");
        // Nothing left to ask for the removed key: no call at all.
        assertThat(bgg.asked).isEmpty();
        assertThat(result).isEqualTo(new ShelfDetailsBackfill.Result(1, 1, false));
    }

    @Test
    void skips_the_works_without_a_source_id() {
        Entity byHand = work(EntityTypeFixtures.VIDEO_GAME, "Jeu maison", Map.of());
        Entity blankId = work(EntityTypeFixtures.BOARD_GAME, "Jeu sans id", Map.of("bggId", " "));

        ShelfDetailsBackfill.Result result = backfill(10).run();

        assertThat(result).isEqualTo(new ShelfDetailsBackfill.Result(0, 0, false));
        assertThat(igdb.asked).isEmpty();
        assertThat(bgg.asked).isEmpty();
        assertThat(attributes(byHand)).doesNotContainKey("publisher");
        assertThat(attributes(blankId)).doesNotContainKey("publisher");
    }

    @Test
    void stops_a_type_on_its_silent_provider_after_keeping_what_it_got() {
        Entity first = work(EntityTypeFixtures.VIDEO_GAME, "Premier", Map.of("igdbId", "1"));
        Entity silent = work(EntityTypeFixtures.VIDEO_GAME, "Muet", Map.of("igdbId", "2"));
        Entity after = work(EntityTypeFixtures.VIDEO_GAME, "Après", Map.of("igdbId", "3"));
        Entity board = work(EntityTypeFixtures.BOARD_GAME, "Catan", Map.of("bggId", "13"));
        igdb.answers.put("1", Map.of("publisher", "Sega", "platforms", "PS5"));
        igdb.silentOn.add("2");
        igdb.answers.put("3", Map.of("publisher", "Capcom", "platforms", "PC"));
        bgg.answers.put("13", Map.of("publisher", "Kosmos"));

        ShelfDetailsBackfill.Result result = backfill(10).run();

        assertThat(result).isEqualTo(new ShelfDetailsBackfill.Result(3, 2, true));
        assertThat(attributes(first)).containsEntry("publisher", "Sega");
        assertThat(attributes(silent)).doesNotContainKey("publisher");
        // The rest of the type waits for the next run; the other type goes on.
        assertThat(igdb.asked).containsExactly("1", "2");
        assertThat(attributes(after)).doesNotContainKey("publisher");
        assertThat(attributes(board)).containsEntry("publisher", "Kosmos");

        // The next run picks up where it stopped.
        igdb.silentOn.clear();
        igdb.answers.put("2", Map.of("publisher", "Atlus", "platforms", "PS4"));
        backfill(10).run();
        assertThat(attributes(silent)).containsEntry("publisher", "Atlus");
        assertThat(attributes(after)).containsEntry("publisher", "Capcom");
    }

    @Test
    void does_nothing_when_nothing_is_missing() {
        work(EntityTypeFixtures.VIDEO_GAME, "Zelda",
                Map.of("igdbId", "1025", "publisher", "Nintendo", "platforms", "Switch"));
        work(EntityTypeFixtures.BOARD_GAME, "Catan", Map.of("bggId", "13", "publisher", "Kosmos"));

        ShelfDetailsBackfill.Result result = backfill(10).run();

        assertThat(result).isEqualTo(new ShelfDetailsBackfill.Result(0, 0, false));
        assertThat(igdb.asked).isEmpty();
        assertThat(bgg.asked).isEmpty();
    }

    @Test
    void bounds_the_works_per_run_and_does_not_ask_again_a_work_its_source_answered_without_the_key() {
        work(EntityTypeFixtures.BOARD_GAME, "Inconnu", Map.of("bggId", "1"));
        Entity second = work(EntityTypeFixtures.BOARD_GAME, "Deuxième", Map.of("bggId", "2"));
        bgg.answers.put("1", Map.of("minPlayers", 2));
        bgg.answers.put("2", Map.of("publisher", "Iello"));
        ShelfDetailsBackfill backfill = backfill(1);

        assertThat(backfill.run()).isEqualTo(new ShelfDetailsBackfill.Result(1, 0, false));
        assertThat(backfill.run()).isEqualTo(new ShelfDetailsBackfill.Result(1, 1, false));

        assertThat(bgg.asked).containsExactly("1", "2");
        assertThat(attributes(second)).containsEntry("publisher", "Iello");
    }

    private Entity work(EntityType type, String title, Map<String, Object> attributes) {
        Entity entity = Entity.reconstitute(UUID.randomUUID(), type.id(), title, new HashMap<>(attributes), List.of(),
                Set.of());
        return entities.save(entity);
    }

    private Map<String, Object> attributes(Entity entity) {
        return entities.findById(entity.id()).orElseThrow().attributes();
    }

    private record TestSource(String entityTypeCode, String sourceIdKey, List<String> shelfKeys)
            implements ShelfDetailsSource {
    }

    /** A provider with answers written in the test, never the network. */
    private static final class ScriptedProvider implements MetadataProvider {
        private final String typeCode;
        private final String idKey;
        final Map<String, Map<String, Object>> answers = new HashMap<>();
        final Set<String> silentOn = new HashSet<>();
        final List<String> asked = new ArrayList<>();

        ScriptedProvider(String typeCode, String idKey) {
            this.typeCode = typeCode;
            this.idKey = idKey;
        }

        @Override
        public boolean supports(EntityType entityType) {
            return typeCode.equals(entityType.code());
        }

        @Override
        public List<MetadataCandidate> search(String query) {
            return List.of();
        }

        @Override
        public Map<String, Object> details(Map<String, Object> attributes) {
            String id = String.valueOf(attributes.get(idKey));
            asked.add(id);
            if (silentOn.contains(id)) {
                throw new SourceUnavailableException("silent");
            }
            return answers.getOrDefault(id, Map.of());
        }
    }
}
