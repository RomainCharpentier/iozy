package com.iozycore.integration.http;

import com.iozycore.boardgame.expansion.BoardGameExpansion;
import com.iozycore.boardgame.expansion.ExpansionCache;
import com.iozycore.core.application.QuickAddService;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The derived elements of a work through HTTP (lot 211): the expansions of a
 * board game, the fallback of a video game without the IGDB key, and
 * {@code POST /api/works/{id}/elements/{key}/own}.
 */
class WorkElementsHttpContractTest extends HttpContractTestBase {

    @Autowired private QuickAddService quickAddService;
    @Autowired private ExpansionCache expansionCache;
    @Autowired private EntityRepository entityRepository;
    @Autowired private EntityTypeRepository entityTypeRepository;
    @Autowired private OwnershipRepository ownershipRepository;

    @Test
    void a_board_game_lists_its_bgg_expansions_as_optional_until_one_is_owned() throws Exception {
        String bggId = "9" + Math.abs(UUID.randomUUID().getMostSignificantBits() % 1_000_000);
        UUID game = quickAddService.addNewEntityWithOwnership(EntityTypeFixtures.BOARD_GAME.id(),
                "Catan " + bggId, OwnershipCondition.NEW, Map.of("bggId", bggId)).entityId();
        expansionCache.save(bggId, List.of(
                new BoardGameExpansion(bggId + "1", "Catan " + bggId + ": Seafarers", "https://cf.geekdo-images.com/s.jpg", "1997"),
                new BoardGameExpansion(bggId + "2", "Catan " + bggId + ": Cities & Knights", null, null)),
                Instant.now());

        String body = mockMvc.perform(get("/api/works/{id}", game))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.elementsSource.provider").value("BGG"))
                .andExpect(jsonPath("$.elementsSource.fallback").value(false))
                .andExpect(jsonPath("$.elements", hasSize(3)))
                .andExpect(jsonPath("$.elements[1].key").value("bgg-" + bggId + "1"))
                .andExpect(jsonPath("$.elements[1].label").value("Seafarers"))
                .andExpect(jsonPath("$.elements[1].state").value("MISSING"))
                .andExpect(jsonPath("$.elements[1].optional").value(true))
                .andExpect(jsonPath("$.elements[1].countedAsMissing").value(false))
                .andExpect(jsonPath("$.totalCount").value(3))
                .andExpect(jsonPath("$.missingCount").value(0))
                .andReturn().getResponse().getContentAsString();
        System.out.println("GET /api/works/{id} (board game) -> " + body);

        String owned = mockMvc.perform(post("/api/works/{id}/elements/{key}/own", game, "bgg-" + bggId + "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entityId").value(game.toString()))
                .andExpect(jsonPath("$.elements", hasSize(3)))
                .andExpect(jsonPath("$.elements[1].label").value("Seafarers"))
                .andExpect(jsonPath("$.elements[1].state").value("OWNED"))
                .andExpect(jsonPath("$.elements[1].variantId").isNotEmpty())
                .andExpect(jsonPath("$.elements[1].coverImageUrl").value("https://cf.geekdo-images.com/s.jpg"))
                // One expansion owned: the others now count.
                .andExpect(jsonPath("$.elements[2].optional").value(false))
                .andExpect(jsonPath("$.missingCount").value(1))
                .andReturn().getResponse().getContentAsString();
        System.out.println("POST /api/works/{id}/elements/{key}/own -> " + owned);

        // Idempotent: the element is found again under its variant key, nothing new is created.
        String variantKey = "variant-" + entityRepository.findById(game).orElseThrow().variants().get(0).id();
        mockMvc.perform(post("/api/works/{id}/elements/{key}/own", game, variantKey))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ownedCount").value(2));
        assertThat(ownershipRepository.findByEntityId(game)).hasSize(2);
    }

    @Test
    void the_whole_work_of_a_custom_type_is_owned_through_the_core_default() throws Exception {
        EntityType figurines = entityTypeRepository.save(EntityType.create("FIG_" + UUID.randomUUID()
                .toString().substring(0, 8), "Figurines", Set.of(), Set.of()));
        String title = "Totoro " + UUID.randomUUID();
        mockMvc.perform(post("/api/wishlist").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("entityTypeId", figurines.id(), "title", title))))
                .andExpect(status().isCreated());
        UUID work = entityRepository.findByTypeAndTitle(figurines.id(), title).orElseThrow().id();

        mockMvc.perform(post("/api/works/{id}/elements/{key}/own", work, "work"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.elements[0].state").value("OWNED"))
                .andExpect(jsonPath("$.ownedCount").value(1))
                .andExpect(jsonPath("$.elementsSource").doesNotExist());
        // The wish closed, as with the add field.
        mockMvc.perform(get("/api/wishlist/lookup").param("entityId", work.toString()))
                .andExpect(jsonPath("$.status").value("OWNED"));
        mockMvc.perform(post("/api/works/{id}/elements/{key}/own", work, "work")).andExpect(status().isOk());
        assertThat(ownershipRepository.findByEntityId(work)).hasSize(1);
    }

    @Test
    void a_video_game_without_the_igdb_key_stands_alone_and_says_so() throws Exception {
        UUID game = quickAddService.addNewEntityWithOwnership(EntityTypeFixtures.VIDEO_GAME.id(),
                "Zelda " + UUID.randomUUID(), OwnershipCondition.NEW, Map.of("igdbId", "7346")).entityId();

        mockMvc.perform(get("/api/works/{id}", game))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.elements", hasSize(1)))
                .andExpect(jsonPath("$.elementsSource.provider").value("IGDB"))
                .andExpect(jsonPath("$.elementsSource.fallback").value(true))
                .andExpect(jsonPath("$.elementsSource.note").value("Licence indisponible : clé IGDB absente"));
    }

    @Test
    void an_unknown_element_answers_404_and_a_gap_the_page_cannot_fill_answers_409() throws Exception {
        UUID series = quickAddService.addNewEntityWithOwnership(EntityTypeFixtures.MANGA.id(),
                "Dandadan " + UUID.randomUUID(), OwnershipCondition.NEW, Map.of(), 2, "Crunchyroll").entityId();

        mockMvc.perform(post("/api/works/{id}/elements/{key}/own", series, "bgg-1"))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/works/{id}/elements/{key}/own", ABSENT, "work"))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/works/{id}/elements/{key}/own", series, "volume-1"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("Cet élément s'ajoute depuis le champ « Chercher ou ajouter »"));
    }

    @Test
    void a_work_only_in_the_catalog_can_be_owned_from_its_page() throws Exception {
        Entity game = entityRepository.save(Entity.create(EntityTypeFixtures.BOARD_GAME.id(),
                "Azul " + UUID.randomUUID()));

        mockMvc.perform(post("/api/works/{id}/elements/{key}/own", game.id(), "work"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.elements[0].state").value("OWNED"))
                .andExpect(jsonPath("$.elementsSource.note").value("Jeu non relié à BoardGameGeek : extensions inconnues"));
    }
}
