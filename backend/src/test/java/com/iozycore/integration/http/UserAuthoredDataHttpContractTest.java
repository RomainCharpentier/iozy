package com.iozycore.integration.http;

import com.iozycore.core.application.CatalogEntityResolver;
import com.iozycore.core.application.QuickAddService;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.experience.Experience;
import com.iozycore.core.domain.experience.ExperienceRepository;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.catalog.Relationship;
import com.iozycore.core.domain.catalog.RelationshipRepository;
import com.iozycore.core.domain.wishlist.WishlistEntry;
import com.iozycore.core.domain.wishlist.WishlistEntryRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The HTTP contract of the three surfaces through which the user attaches
 * <b>their own data</b> to a work: a link between two works
 * ({@code /api/relationships}), a lived fact ({@code /api/experiences}), a
 * wish ({@code /api/wishlist}).
 *
 * <h2>Why these three together</h2>
 * These are not three neighbouring modules by chance: they are the three places
 * where the user writes something that exists nowhere else. An
 * ownership can be bought again, a catalogue can be downloaded again; a reading note,
 * a link that one set up oneself and a wish noted one evening cannot. The three
 * were also reworked together during the pass "make the user
 * writes reversible".
 * <p>
 * They also share the <b>same historical defect</b>, fixed in Batch 28: a
 * reference to an unknown work was only protected by the foreign key
 * of Postgres, and came out as a 500 with the SQL query. These tests freeze the
 * 400 that replaced it - on the three surfaces, because the twin case is
 * precisely what ends up forgotten.
 *
 * <h2>The two product invariants</h2>
 * <b>Wishlist != Ownership</b>: adding to the wishes never creates an
 * ownership. <b>Catalogue != Collection</b>: a work unknown to IozyCore
 * can enter the wishes, by creating its only catalogue detail page.
 */
class UserAuthoredDataHttpContractTest extends HttpContractTestBase {

    @Autowired
    private EntityRepository entityRepository;

    @Autowired
    private CatalogEntityResolver catalogEntityResolver;

    @Autowired
    private QuickAddService quickAddService;

    @Autowired
    private RelationshipRepository relationshipRepository;

    @Autowired
    private ExperienceRepository experienceRepository;

    @Autowired
    private WishlistEntryRepository wishlistEntryRepository;

    @Autowired
    private com.iozycore.core.domain.ownership.OwnershipRepository ownershipRepository;

    private static final String MANGA = "00000000-0000-0000-0000-000000000001";

    /** A catalogue work, without ownership. */
    private Entity uneOeuvre(String titre) {
        return catalogEntityResolver.resolveOrCreate(EntityTypeFixtures.MANGA.id(),
                titre + " " + UUID.randomUUID(), Map.of()).entity();
    }

    /** An owned work, with a volume - needed for the per-volume experiences. */
    private QuickAddService.QuickAddResult uneOeuvrePossedee() {
        return quickAddService.addNewEntityWithOwnership(EntityTypeFixtures.MANGA.id(),
                "Pluto " + UUID.randomUUID(), OwnershipCondition.USED, Map.of(), 1, "Standard");
    }

    // ══════════════════════════════════════════════════ RELATIONSHIPS

    @Test
    void creates_a_relationship_between_two_works_and_reads_it_from_both_ends() throws Exception {
        Entity source = uneOeuvre("Monster");
        Entity cible = uneOeuvre("Pluto");

        String corps = "{\"sourceEntityId\":\"" + source.id() + "\",\"targetEntityId\":\"" + cible.id()
                + "\",\"relationshipType\":\"SPIN_OFF\"}";
        mockMvc.perform(post("/api/relationships").contentType("application/json").content(corps))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.sourceEntityId").value(source.id().toString()))
                .andExpect(jsonPath("$.targetEntityId").value(cible.id().toString()))
                .andExpect(jsonPath("$.relationshipType").value("SPIN_OFF"));

        // A relationship is directed: it is read from its source, and from its
        // target - both detail pages must show it.
        mockMvc.perform(get("/api/relationships/from/{id}", source.id()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].targetEntityId").value(cible.id().toString()));
        mockMvc.perform(get("/api/relationships/to/{id}", cible.id()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].sourceEntityId").value(source.id().toString()));
    }

    @Test
    void rejects_a_relationship_pointing_at_a_work_that_does_not_exist_with_400() throws Exception {
        Entity source = uneOeuvre("Berserk");

        // The defect of Batch 28: without this check, only the foreign key
        // protected the table and came out as a 500 with the SQL query.
        mockMvc.perform(post("/api/relationships").contentType("application/json")
                        .content("{\"sourceEntityId\":\"" + source.id() + "\",\"targetEntityId\":\"" + ABSENT
                                + "\",\"relationshipType\":\"SEQUEL\"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/relationships").contentType("application/json")
                        .content("{\"sourceEntityId\":\"" + ABSENT + "\",\"targetEntityId\":\"" + source.id()
                                + "\",\"relationshipType\":\"SEQUEL\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void refuses_to_relate_a_work_to_itself() throws Exception {
        Entity oeuvre = uneOeuvre("Akira");

        mockMvc.perform(post("/api/relationships").contentType("application/json")
                        .content("{\"sourceEntityId\":\"" + oeuvre.id() + "\",\"targetEntityId\":\"" + oeuvre.id()
                                + "\",\"relationshipType\":\"SEQUEL\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").isNotEmpty());
    }

    @Test
    void rejects_an_incomplete_or_unparseable_relationship_body_with_400_and_never_500() throws Exception {
        for (String corps : new String[] {"{}", "", "{pas du json",
                "{\"sourceEntityId\":\"" + ABSENT + "\",\"targetEntityId\":\"" + ABSENT + "\"}"}) {
            mockMvc.perform(post("/api/relationships").contentType("application/json").content(corps))
                    .andExpect(status().isBadRequest());
        }
        // An identifier that is not a UUID fails at deserialisation,
        // even before reaching the controller.
        mockMvc.perform(post("/api/relationships").contentType("application/json")
                        .content("{\"sourceEntityId\":\"" + MALFORME + "\",\"targetEntityId\":\"" + ABSENT
                                + "\",\"relationshipType\":\"SEQUEL\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void corrects_the_type_of_an_existing_relationship_then_deletes_it() throws Exception {
        Entity source = uneOeuvre("Vagabond");
        Entity cible = uneOeuvre("Slam Dunk");
        Relationship relation = relationshipRepository.save(new Relationship(
                UUID.randomUUID(), source.id(), cible.id(), "ADAPTED_INTO"));

        mockMvc.perform(patch("/api/relationships/{id}", relation.id()).contentType("application/json")
                        .content("{\"relationshipType\":\"SPIN_OFF\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.relationshipType").value("SPIN_OFF"))
                // Correcting the type does not redirect the relationship.
                .andExpect(jsonPath("$.sourceEntityId").value(source.id().toString()));

        mockMvc.perform(delete("/api/relationships/{id}", relation.id()))
                .andExpect(status().isNoContent());
        assertThat(relationshipRepository.findById(relation.id())).isEmpty();
        // Removing a relationship touches neither of the two works.
        assertThat(entityRepository.findById(source.id())).isPresent();
        assertThat(entityRepository.findById(cible.id())).isPresent();
    }

    @Test
    void returns_404_when_updating_a_relationship_that_does_not_exist() throws Exception {
        mockMvc.perform(patch("/api/relationships/{id}", ABSENT).contentType("application/json")
                        .content("{\"relationshipType\":\"SEQUEL\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void deleting_a_relationship_twice_stays_204_and_a_malformed_id_is_400() throws Exception {
        mockMvc.perform(delete("/api/relationships/{id}", ABSENT)).andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/relationships/{id}", MALFORME)).andExpect(status().isBadRequest());
    }

    // ══════════════════════════════════════════════════ EXPERIENCES

    @Test
    void records_an_experience_on_a_work_and_lists_it() throws Exception {
        Entity oeuvre = uneOeuvre("Death Note");

        mockMvc.perform(post("/api/experiences").contentType("application/json")
                        .content("{\"entityId\":\"" + oeuvre.id() + "\",\"experienceType\":\"READ\","
                                + "\"occurredAt\":\"2026-08-01\",\"rating\":9,\"comment\":\"Excellent\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.entityId").value(oeuvre.id().toString()))
                .andExpect(jsonPath("$.experienceType").value("READ"))
                .andExpect(jsonPath("$.rating").value(9))
                .andExpect(jsonPath("$.comment").value("Excellent"));

        mockMvc.perform(get("/api/experiences").param("entityId", oeuvre.id().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void records_an_experience_attached_to_one_volume() throws Exception {
        QuickAddService.QuickAddResult possedee = uneOeuvrePossedee();

        mockMvc.perform(post("/api/experiences").contentType("application/json")
                        .content("{\"entityId\":\"" + possedee.entityId() + "\",\"variantId\":\""
                                + possedee.variantId() + "\",\"experienceType\":\"READ\","
                                + "\"occurredAt\":\"2026-08-10\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.variantId").value(possedee.variantId().toString()));
    }

    @Test
    void rejects_an_experience_without_a_date_with_400_rather_than_a_meaningless_conflict() throws Exception {
        Entity oeuvre = uneOeuvre("Nausicaa");

        // Found by this pass. The column is NOT NULL and nothing
        // validated it: the body went down to Hibernate, whose
        // PropertyValueException came out as a 409 "Cette donnée entre en
        // conflit avec une donnée existante" - nothing was in conflict, a
        // date was missing, and the user could not know which one.
        mockMvc.perform(post("/api/experiences").contentType("application/json")
                        .content("{\"entityId\":\"" + oeuvre.id() + "\",\"experienceType\":\"READ\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").isNotEmpty());
    }

    @Test
    void rejects_a_volume_that_does_not_belong_to_that_work_with_400() throws Exception {
        Entity oeuvre = uneOeuvre("Gunnm");
        QuickAddService.QuickAddResult autre = uneOeuvrePossedee();

        // The volume exists, but elsewhere: attaching a reading to the wrong volume
        // would durably distort the detail page.
        mockMvc.perform(post("/api/experiences").contentType("application/json")
                        .content("{\"entityId\":\"" + oeuvre.id() + "\",\"variantId\":\"" + autre.variantId()
                                + "\",\"experienceType\":\"READ\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejects_an_experience_type_the_universe_does_not_allow_with_400() throws Exception {
        Entity manga = uneOeuvre("Naruto");

        // A manga is read; "PLAYED" belongs to the video game. The refusal comes from
        // the type of work, not from a list hard-coded in the controller.
        mockMvc.perform(post("/api/experiences").contentType("application/json")
                        .content("{\"entityId\":\"" + manga.id() + "\",\"experienceType\":\"PLAYED\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejects_an_experience_on_a_work_that_does_not_exist_with_400_not_404() throws Exception {
        // Deliberate 400 and not 404: the endpoint exists, it is the BODY that
        // references an unknown work. The client replaces any 404 by a translated
        // fallback, and the real reason never reached the screen.
        mockMvc.perform(post("/api/experiences").contentType("application/json")
                        .content("{\"entityId\":\"" + ABSENT + "\",\"experienceType\":\"READ\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejects_an_empty_or_unparseable_experience_body_with_400_and_never_500() throws Exception {
        for (String corps : new String[] {"{}", "", "{pas du json"}) {
            mockMvc.perform(post("/api/experiences").contentType("application/json").content(corps))
                    .andExpect(status().isBadRequest());
        }
    }

    @Test
    void corrects_the_rating_and_comment_of_an_experience_then_deletes_it() throws Exception {
        Entity oeuvre = uneOeuvre("Vinland Saga");
        Experience experience = experienceRepository.save(Experience.record_(
                oeuvre.id(), null, "READ", LocalDate.now(), 6, "Bof"));

        mockMvc.perform(patch("/api/experiences/{id}", experience.id()).contentType("application/json")
                        .content("{\"rating\":9,\"comment\":\"Relu, bien mieux\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rating").value(9))
                .andExpect(jsonPath("$.comment").value("Relu, bien mieux"));

        // null erases: both fields are replaced as they are, which allows
        // removing a rating set by mistake.
        mockMvc.perform(patch("/api/experiences/{id}", experience.id()).contentType("application/json")
                        .content("{\"rating\":null,\"comment\":null}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rating").doesNotExist())
                .andExpect(jsonPath("$.comment").doesNotExist());

        mockMvc.perform(delete("/api/experiences/{id}", experience.id()))
                .andExpect(status().isNoContent());
        assertThat(experienceRepository.findById(experience.id())).isEmpty();
        // Removing a reading does not remove the work.
        assertThat(entityRepository.findById(oeuvre.id())).isPresent();
    }

    @Test
    void rejects_an_out_of_range_rating_with_400_and_never_500() throws Exception {
        Entity oeuvre = uneOeuvre("Blame");
        Experience experience = experienceRepository.save(Experience.record_(
                oeuvre.id(), null, "READ", LocalDate.now(), 5, null));

        mockMvc.perform(patch("/api/experiences/{id}", experience.id()).contentType("application/json")
                        .content("{\"rating\":999}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void returns_404_on_update_and_400_on_a_malformed_id_for_experiences() throws Exception {
        mockMvc.perform(patch("/api/experiences/{id}", ABSENT).contentType("application/json")
                .content("{\"rating\":5}")).andExpect(status().isNotFound());
        mockMvc.perform(patch("/api/experiences/{id}", MALFORME).contentType("application/json")
                .content("{\"rating\":5}")).andExpect(status().isBadRequest());
        mockMvc.perform(delete("/api/experiences/{id}", ABSENT)).andExpect(status().isNoContent());
    }

    @Test
    void listing_experiences_requires_an_entity_and_answers_empty_for_an_unknown_one() throws Exception {
        mockMvc.perform(get("/api/experiences")).andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/experiences").param("entityId", MALFORME))
                .andExpect(status().isBadRequest());
        // No experience is a normal state, not an error.
        mockMvc.perform(get("/api/experiences").param("entityId", ABSENT))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    // ══════════════════════════════════════════════════ WISHLIST

    @Test
    void adds_an_existing_work_to_the_wishlist_without_creating_any_ownership() throws Exception {
        Entity oeuvre = uneOeuvre("Homunculus");

        mockMvc.perform(post("/api/wishlist").contentType("application/json")
                        .content("{\"entityId\":\"" + oeuvre.id() + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.entityId").value(oeuvre.id().toString()))
                .andExpect(jsonPath("$.addedAt").isNotEmpty());

        // Wishlist != Ownership: the assertion that matters. Without it, the test
        // would also pass if the add made up an ownership.
        assertThat(ownershipRepository.findByEntityId(oeuvre.id())).isEmpty();
    }

    @Test
    void adds_a_work_unknown_to_iozycore_by_creating_its_catalog_entry_only() throws Exception {
        String titre = "Œuvre jamais vue " + UUID.randomUUID();

        // Catalogue != Collection: a work found by an external search
        // or a scan enters the wishes by creating its only detail page.
        String corps = mockMvc.perform(post("/api/wishlist").contentType("application/json")
                        .content("{\"entityTypeId\":\"" + MANGA + "\",\"title\":\"" + titre + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.entityId").isNotEmpty())
                .andReturn().getResponse().getContentAsString();

        UUID entityId = UUID.fromString(objectMapper.readTree(corps).get("entityId").asText());
        assertThat(entityRepository.findById(entityId)).isPresent();
        assertThat(ownershipRepository.findByEntityId(entityId)).isEmpty();
    }

    @Test
    void adding_the_same_work_twice_returns_the_existing_entry_rather_than_duplicating() throws Exception {
        Entity oeuvre = uneOeuvre("Dorohedoro");
        String corps = "{\"entityId\":\"" + oeuvre.id() + "\"}";

        String premier = mockMvc.perform(post("/api/wishlist").contentType("application/json").content(corps))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String second = mockMvc.perform(post("/api/wishlist").contentType("application/json").content(corps))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();

        // Idempotent: replaying the add returns the same entry, without duplicate.
        assertThat(objectMapper.readTree(second).get("id"))
                .isEqualTo(objectMapper.readTree(premier).get("id"));
        assertThat(wishlistEntryRepository.findAll().stream()
                .filter(e -> e.entityId().equals(oeuvre.id())).count()).isEqualTo(1);
    }

    @Test
    void rejects_a_wishlist_body_that_identifies_no_work_at_all_with_400() throws Exception {
        // The body accepts two forms - an entityId, or a type and a title.
        // Satisfying neither is an invalid input, not a 500.
        for (String corps : new String[] {"{}", "", "{pas du json",
                "{\"entityTypeId\":\"" + MANGA + "\"}",
                "{\"entityTypeId\":\"" + MANGA + "\",\"title\":\"   \"}",
                "{\"title\":\"sans type\"}"}) {
            mockMvc.perform(post("/api/wishlist").contentType("application/json").content(corps))
                    .andExpect(status().isBadRequest());
        }
    }

    @Test
    void rejects_an_unknown_work_or_universe_in_a_wishlist_body_with_400() throws Exception {
        mockMvc.perform(post("/api/wishlist").contentType("application/json")
                        .content("{\"entityId\":\"" + ABSENT + "\"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/wishlist").contentType("application/json")
                        .content("{\"entityTypeId\":\"" + ABSENT + "\",\"title\":\"x\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void the_lookup_tells_the_screen_which_button_to_show() throws Exception {
        Entity souhaitee = uneOeuvre("Kingdom");
        wishlistEntryRepository.save(WishlistEntry.add(souhaitee.id(), LocalDate.now()));
        QuickAddService.QuickAddResult possedee = uneOeuvrePossedee();

        // Three states, three buttons: "Ajouter", "Déjà dans tes envies",
        // "Tu la possèdes". This is the contract that the detail page consumes.
        mockMvc.perform(get("/api/wishlist/lookup").param("entityId", souhaitee.id().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("WISHLISTED"));
        mockMvc.perform(get("/api/wishlist/lookup").param("entityId", possedee.entityId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OWNED"));
        mockMvc.perform(get("/api/wishlist/lookup").param("entityId", ABSENT))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UNKNOWN"));
    }

    @Test
    void the_lookup_requires_an_entity_and_rejects_a_malformed_one() throws Exception {
        mockMvc.perform(get("/api/wishlist/lookup")).andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/wishlist/lookup").param("entityId", MALFORME))
                .andExpect(status().isBadRequest());
    }

    @Test
    void removing_a_wishlist_entry_keeps_the_work_in_the_catalog() throws Exception {
        Entity oeuvre = uneOeuvre("Sanctuary");
        WishlistEntry entree = wishlistEntryRepository.save(WishlistEntry.add(oeuvre.id(), LocalDate.now()));

        mockMvc.perform(get("/api/wishlist")).andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id=='" + entree.id() + "')]").exists());

        mockMvc.perform(delete("/api/wishlist/{id}", entree.id())).andExpect(status().isNoContent());

        // No longer wanting a work does not erase it from the catalogue: it can
        // be ranked, linked, or wished again later.
        assertThat(entityRepository.findById(oeuvre.id())).isPresent();
        assertThat(wishlistEntryRepository.findByEntityId(oeuvre.id())).isEmpty();
        // Idempotent, like the other deletions of user data.
        mockMvc.perform(delete("/api/wishlist/{id}", entree.id())).andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/wishlist/{id}", MALFORME)).andExpect(status().isBadRequest());
    }
}
