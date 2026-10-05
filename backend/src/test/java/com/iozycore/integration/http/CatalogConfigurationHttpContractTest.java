package com.iozycore.integration.http;

import com.iozycore.core.application.CatalogEntityResolver;
import com.iozycore.core.application.QuickAddService;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.core.domain.catalog.Tag;
import com.iozycore.core.domain.catalog.TagRepository;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.core.domain.wishlist.WishlistEntryRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The HTTP contract of the <b>catalogue configuration</b>: the types of works
 * ({@code /api/entity-types}) and the tags ({@code /api/tags}).
 *
 * <p><b>The writes are made in the name of an administrator since
 * 2026-08-30</b>: the tags describe a work of the SHARED catalogue, and
 * setting them commits all the accounts. The refusal given to the others is checked
 * elsewhere, by {@code TagsAdministresHttpContractTest} - here we describe what
 * the route does, not who is allowed to call it.
 *
 * <h2>What these two surfaces have in common</h2>
 * They write <b>structuring or personal</b> data without going through
 * any external integration, and each one references something else -
 * a type referenced by works, a tag attached to a work. This is
 * precisely where invalid references
 * historically came out as a 500 or a misleading 409: the foreign key of
 * Postgres decided instead of the code.
 *
 * <h2>The case with the heaviest consequences</h2>
 * An {@code EntityType} is a root: Manga, Video game, Board game,
 * Book. Deleting it while works depend on it would erase a whole branch
 * of the catalogue. The refusal is tested <b>with a check of the state
 * after the response</b> - a 409 that leaves the database half modified would be
 * worse than a plain 500.
 */
class CatalogConfigurationHttpContractTest extends HttpContractTestBase {

    @Autowired
    private EntityTypeRepository entityTypeRepository;

    @Autowired
    private EntityRepository entityRepository;

    @Autowired
    private TagRepository tagRepository;

    @Autowired
    private CatalogEntityResolver catalogEntityResolver;

    @Autowired
    private QuickAddService quickAddService;

    @Autowired
    private OwnershipRepository ownershipRepository;

    @Autowired
    private WishlistEntryRepository wishlistEntryRepository;

    private static final String MANGA = "00000000-0000-0000-0000-000000000001";

    private Entity uneOeuvre(String titre) {
        return catalogEntityResolver.resolveOrCreate(EntityTypeFixtures.MANGA.id(),
                titre + " " + UUID.randomUUID(), Map.of()).entity();
    }

    /** A unique type code per test - the code is the uniqueness key. */
    private String unCode() {
        return "ZZTEST_" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    // ══════════════════════════════════════════════════ ENTITY TYPES

    @Test
    void creates_a_type_and_makes_it_appear_in_the_list_clients_read() throws Exception {
        String code = unCode();

        String corps = mockMvc.perform(post("/api/entity-types").contentType("application/json")
                        .content("{\"code\":\"" + code + "\",\"label\":\"Vinyles\","
                                + "\"allowedExperienceTypes\":[\"LISTENED\"],\"customFieldKeys\":[\"artiste\"]}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.code").value(code))
                .andExpect(jsonPath("$.label").value("Vinyles"))
                .andExpect(jsonPath("$.allowedExperienceTypes[0]").value("LISTENED"))
                // The iOS/Web clients read this list instead of a hard-coded
                // list: the field must be present, even when false.
                .andExpect(jsonPath("$.hasMetadataProvider").exists())
                // Same rule for the discoveries (batch 142): it is the type that
                // says whether it has a source, never a list of codes on the screen.
                // A type created here has none.
                .andExpect(jsonPath("$.hasDiscoverySource").value(false))
                .andReturn().getResponse().getContentAsString();

        UUID id = UUID.fromString(objectMapper.readTree(corps).get("id").asText());
        mockMvc.perform(get("/api/entity-types"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id=='" + id + "')]").exists());
        mockMvc.perform(get("/api/entity-types/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(code));
    }

    @Test
    void refuses_a_duplicate_code_with_409_and_leaves_the_existing_type_untouched() throws Exception {
        long avant = entityTypeRepository.findAll().size();

        mockMvc.perform(post("/api/entity-types").contentType("application/json")
                        .content("{\"code\":\"MANGA\",\"label\":\"Un autre manga\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").isNotEmpty());

        // The refusal must have written nothing, and above all must not have renamed
        // the existing type on the way.
        assertThat(entityTypeRepository.findAll()).hasSize((int) avant);
        assertThat(entityTypeRepository.findById(UUID.fromString(MANGA)).orElseThrow().label())
                .isEqualTo(EntityTypeFixtures.MANGA.label());
    }

    @Test
    void rejects_a_type_without_code_or_label_with_400_and_never_500() throws Exception {
        for (String corps : new String[] {"{}", "{\"label\":\"Sans code\"}", "{\"code\":\"   \",\"label\":\"x\"}",
                                          "{\"code\":\"X\",\"label\":\"  \"}", "", "{pas du json"}) {
            mockMvc.perform(post("/api/entity-types").contentType("application/json").content(corps))
                    .andExpect(status().isBadRequest());
        }
    }

    @Test
    void updates_a_type_label_without_ever_changing_its_code() throws Exception {
        String code = unCode();
        EntityType type = entityTypeRepository.save(EntityType.create(code, "Avant", java.util.Set.of("READ"),
                java.util.Set.of(), null, null, null));

        mockMvc.perform(patch("/api/entity-types/{id}", type.id()).contentType("application/json")
                        .content("{\"label\":\"Après\",\"allowedExperienceTypes\":[\"READ\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.label").value("Après"))
                // The code never changes after creation: it is the key on
                // which the clients rely.
                .andExpect(jsonPath("$.code").value(code));
    }

    @Test
    void returns_a_deterministic_error_when_updating_or_reading_a_type_that_does_not_exist() throws Exception {
        mockMvc.perform(get("/api/entity-types/{id}", ABSENT)).andExpect(status().isNotFound());
        // The PATCH goes through the service, whose IllegalArgumentException becomes
        // 400 - existing convention, different from the 404 of the GET. Frozen as
        // it is rather than made uniform on the way.
        mockMvc.perform(patch("/api/entity-types/{id}", ABSENT).contentType("application/json")
                        .content("{\"label\":\"x\"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/entity-types/{id}", MALFORME))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").isNotEmpty());
    }

    @Test
    void refuses_to_delete_a_type_still_used_by_works_and_changes_nothing() throws Exception {
        // THE priority case: deleting "Manga" would erase a whole
        // branch of the catalogue. As the test database is empty, we first create
        // the work that makes the type used - without it the test would pass for
        // a reason that has nothing to do with it: there would simply be nothing to
        // protect.
        uneOeuvre("Une série qui rend le type utilisé");
        long typesAvant = entityTypeRepository.findAll().size();
        long oeuvresAvant = entityRepository.findAllByType(UUID.fromString(MANGA)).size();
        assertThat(oeuvresAvant).isPositive();

        mockMvc.perform(delete("/api/entity-types/{id}", MANGA))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").isNotEmpty());

        // A 409 that leaves the database half modified would be worse than a plain
        // 500: the type AND its works must be intact.
        assertThat(entityTypeRepository.findById(UUID.fromString(MANGA))).isPresent();
        assertThat(entityTypeRepository.findAll()).hasSize((int) typesAvant);
        assertThat(entityRepository.findAllByType(UUID.fromString(MANGA))).hasSize((int) oeuvresAvant);
    }

    @Test
    void deletes_a_type_that_no_work_uses() throws Exception {
        EntityType inutilise = entityTypeRepository.save(EntityType.create(unCode(), "Éphémère",
                java.util.Set.of("READ"), java.util.Set.of(), null, null, null));

        mockMvc.perform(delete("/api/entity-types/{id}", inutilise.id()))
                .andExpect(status().isNoContent());
        assertThat(entityTypeRepository.findById(inutilise.id())).isEmpty();
        mockMvc.perform(get("/api/entity-types/{id}", inutilise.id())).andExpect(status().isNotFound());
    }

    // ══════════════════════════════════════════════════════════ TAGS

    @Test
    void creates_a_tag_and_returns_the_same_one_when_the_label_already_exists() throws Exception {
        String label = "à relire " + UUID.randomUUID();

        String premier = mockMvc.perform(post("/api/tags").with(user(IDENTITE_ADMIN)).contentType("application/json")
                        .content(json(Map.of("label", label))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.label").value(label))
                .andReturn().getResponse().getContentAsString();

        // Existing contract: a label already taken returns the existing tag rather
        // than a 409. A tag is a word, not a resource that people fight over.
        String second = mockMvc.perform(post("/api/tags").with(user(IDENTITE_ADMIN)).contentType("application/json")
                        .content(json(Map.of("label", label))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        assertThat(objectMapper.readTree(second).get("id"))
                .isEqualTo(objectMapper.readTree(premier).get("id"));
    }

    @Test
    void lists_tags_so_the_picker_can_offer_them_for_reuse() throws Exception {
        Tag tag = tagRepository.save(new Tag(UUID.randomUUID(), "à racheter " + UUID.randomUUID()));

        // A Tag is made to be reused on several works: this
        // list is what the selector offers. Without it, the user
        // would recreate the same word every time.
        mockMvc.perform(get("/api/tags"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id=='" + tag.id() + "')].label").value(tag.label()));
    }

    @Test
    void rejects_a_tag_without_a_label_with_400_and_never_500() throws Exception {
        for (String corps : new String[] {"{}", "{\"label\":\"   \"}", "", "{pas du json"}) {
            mockMvc.perform(post("/api/tags").with(user(IDENTITE_ADMIN)).contentType("application/json").content(corps))
                    .andExpect(status().isBadRequest());
        }
    }

    @Test
    void attaches_a_tag_to_a_work_then_detaches_it_without_touching_the_work() throws Exception {
        Entity oeuvre = uneOeuvre("Berserk");
        Tag tag = tagRepository.save(new Tag(UUID.randomUUID(), "chef-d'œuvre " + UUID.randomUUID()));

        mockMvc.perform(post("/api/tags/entities/{e}/{t}", oeuvre.id(), tag.id()).with(user(IDENTITE_ADMIN)))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/entities/{id}", oeuvre.id()))
                .andExpect(jsonPath("$.tagIds[?(@=='" + tag.id() + "')]").exists());

        mockMvc.perform(delete("/api/tags/entities/{e}/{t}", oeuvre.id(), tag.id()).with(user(IDENTITE_ADMIN)))
                .andExpect(status().isOk());

        // A personal tag never touches the catalogue work itself: after
        // detaching, the work and the tag still exist.
        Entity relue = entityRepository.findById(oeuvre.id()).orElseThrow();
        assertThat(relue.tagIds()).doesNotContain(tag.id());
        assertThat(relue.title()).isEqualTo(oeuvre.title());
        assertThat(tagRepository.findById(tag.id())).isPresent();
    }

    @Test
    void returns_404_when_attaching_a_tag_that_does_not_exist_rather_than_a_confusing_conflict() throws Exception {
        Entity oeuvre = uneOeuvre("Vagabond");

        // Found by this pass: only the foreign key protected the
        // table, and the client received "Cette donnée entre en conflit avec une
        // donnée existante" - while the tag is ABSENT. The line above
        // already returned, for the entity, the 404 that this case deserves just as much.
        mockMvc.perform(post("/api/tags/entities/{e}/{t}", oeuvre.id(), ABSENT).with(user(IDENTITE_ADMIN)))
                .andExpect(status().isNotFound());

        // And nothing was written on the way.
        assertThat(entityRepository.findById(oeuvre.id()).orElseThrow().tagIds()).isEmpty();
    }

    @Test
    void returns_404_when_tagging_a_work_that_does_not_exist_and_400_for_a_malformed_id() throws Exception {
        mockMvc.perform(post("/api/tags/entities/{e}/{t}", ABSENT, ABSENT).with(user(IDENTITE_ADMIN))).andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/tags/entities/{e}/{t}", ABSENT, ABSENT).with(user(IDENTITE_ADMIN))).andExpect(status().isNotFound());
        mockMvc.perform(post("/api/tags/entities/{e}/{t}", MALFORME, ABSENT).with(user(IDENTITE_ADMIN))).andExpect(status().isBadRequest());
    }

    @Test
    void detaching_a_tag_that_was_never_attached_is_a_no_op() throws Exception {
        Entity oeuvre = uneOeuvre("Pluto");
        Tag jamaisAttache = tagRepository.save(new Tag(UUID.randomUUID(), "inutilisé " + UUID.randomUUID()));

        // Idempotent: replaying a detach done offline must not become
        // an error.
        mockMvc.perform(delete("/api/tags/entities/{e}/{t}", oeuvre.id(), jamaisAttache.id()).with(user(IDENTITE_ADMIN)))
                .andExpect(status().isOk());
        assertThat(entityRepository.findById(oeuvre.id())).isPresent();
    }
}
