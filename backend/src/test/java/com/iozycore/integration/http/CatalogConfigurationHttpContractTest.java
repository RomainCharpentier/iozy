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
 * Le contrat HTTP de la <b>configuration du catalogue</b> : les types d'œuvres
 * ({@code /api/entity-types}) et les tags ({@code /api/tags}).
 *
 * <p><b>Les écritures partent au nom d'un administrateur depuis le
 * 2026-08-30</b> : les tags décrivent une œuvre du catalogue PARTAGÉ, et les
 * poser engage tous les comptes. Le refus opposé aux autres est vérifié
 * ailleurs, par {@code TagsAdministresHttpContractTest} - ici on décrit ce que
 * fait la route, pas qui a le droit de l'appeler.
 *
 * <h2>Ce que ces deux surfaces ont en commun</h2>
 * Elles écrivent des données <b>structurantes ou personnelles</b> sans passer
 * par aucune intégration externe, et chacune référence quelque chose d'autre -
 * un type référencé par des œuvres, un tag accroché à une œuvre. C'est
 * précisément là que les références invalides
 * remontaient historiquement en 500 ou en 409 trompeur : la clé étrangère de
 * Postgres tranchait à la place du code.
 *
 * <h2>Le cas le plus lourd de conséquences</h2>
 * Un {@code EntityType} est une racine : Manga, Jeu vidéo, Jeu de société,
 * Livre. Le supprimer alors que des œuvres en dépendent effacerait une branche
 * entière du catalogue. Le refus est testé <b>avec vérification de l'état
 * après réponse</b> - un 409 qui laisserait la base à moitié modifiée serait
 * pire qu'un 500 franc.
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

    /** Un code de type unique par test - le code est la clé d'unicité. */
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
                // Les clients iOS/Web lisent cette liste au lieu d'une liste
                // codée en dur : le champ doit être présent, même à false.
                .andExpect(jsonPath("$.hasMetadataProvider").exists())
                // Meme regle pour les decouvertes (lot 142) : c'est le type qui
                // dit s'il en a une source, jamais une liste de codes a l'ecran.
                // Un type cree ici n'en a aucune.
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

        // Le refus ne doit rien avoir écrit, et surtout pas avoir renommé
        // le type existant au passage.
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
                // Le code ne change jamais après création : c'est la clé sur
                // laquelle les clients s'appuient.
                .andExpect(jsonPath("$.code").value(code));
    }

    @Test
    void returns_a_deterministic_error_when_updating_or_reading_a_type_that_does_not_exist() throws Exception {
        mockMvc.perform(get("/api/entity-types/{id}", ABSENT)).andExpect(status().isNotFound());
        // Le PATCH passe par le service, dont l'IllegalArgumentException devient
        // 400 - convention existante, différente du 404 du GET. Figée telle
        // quelle plutôt qu'uniformisée au passage.
        mockMvc.perform(patch("/api/entity-types/{id}", ABSENT).contentType("application/json")
                        .content("{\"label\":\"x\"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/entity-types/{id}", MALFORME))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").isNotEmpty());
    }

    @Test
    void refuses_to_delete_a_type_still_used_by_works_and_changes_nothing() throws Exception {
        // LE cas prioritaire : supprimer « Manga » effacerait une branche
        // entière du catalogue. La base de test étant vierge, on crée d'abord
        // l'œuvre qui rend le type utilisé - sans elle le test passerait pour
        // une raison qui n'a rien à voir : il n'y aurait simplement rien à
        // protéger.
        uneOeuvre("Une série qui rend le type utilisé");
        long typesAvant = entityTypeRepository.findAll().size();
        long oeuvresAvant = entityRepository.findAllByType(UUID.fromString(MANGA)).size();
        assertThat(oeuvresAvant).isPositive();

        mockMvc.perform(delete("/api/entity-types/{id}", MANGA))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").isNotEmpty());

        // Un 409 qui laisserait la base à moitié modifiée serait pire qu'un 500
        // franc : le type ET ses œuvres doivent être intacts.
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

        // Contrat existant : un label déjà pris rend le tag existant plutôt
        // qu'un 409. Un tag est un mot, pas une ressource qu'on se dispute.
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

        // Un Tag est fait pour être réutilisé sur plusieurs œuvres : cette
        // liste est ce que le sélecteur propose. En son absence, l'utilisateur
        // recréerait le même mot à chaque fois.
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

        // Un tag personnel ne touche jamais l'œuvre catalogue elle-même : après
        // détachement, l'œuvre et le tag existent toujours.
        Entity relue = entityRepository.findById(oeuvre.id()).orElseThrow();
        assertThat(relue.tagIds()).doesNotContain(tag.id());
        assertThat(relue.title()).isEqualTo(oeuvre.title());
        assertThat(tagRepository.findById(tag.id())).isPresent();
    }

    @Test
    void returns_404_when_attaching_a_tag_that_does_not_exist_rather_than_a_confusing_conflict() throws Exception {
        Entity oeuvre = uneOeuvre("Vagabond");

        // Découvert par cette passe : seule la clé étrangère protégeait la
        // table, et le client recevait « Cette donnée entre en conflit avec une
        // donnée existante » - alors que le tag est ABSENT. La ligne au-dessus
        // rendait déjà, pour l'entité, le 404 que ce cas mérite tout autant.
        mockMvc.perform(post("/api/tags/entities/{e}/{t}", oeuvre.id(), ABSENT).with(user(IDENTITE_ADMIN)))
                .andExpect(status().isNotFound());

        // Et rien n'a été écrit au passage.
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

        // Idempotent : rejouer un détachement hors ligne ne doit pas devenir
        // une erreur.
        mockMvc.perform(delete("/api/tags/entities/{e}/{t}", oeuvre.id(), jamaisAttache.id()).with(user(IDENTITE_ADMIN)))
                .andExpect(status().isOk());
        assertThat(entityRepository.findById(oeuvre.id())).isPresent();
    }
}
