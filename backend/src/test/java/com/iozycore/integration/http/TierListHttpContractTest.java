package com.iozycore.integration.http;

import com.iozycore.application.CatalogEntityResolver;
import com.iozycore.application.QuickAddService;
import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityTypeFixtures;
import com.iozycore.domain.ownership.OwnershipCondition;
import com.iozycore.domain.tierlist.TierList;
import com.iozycore.domain.tierlist.TierListRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.Map;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Le contrat HTTP de {@code /api/tier-lists} - onze routes, sept mutations,
 * deux niveaux de paramètres de chemin.
 *
 * <h2>Pourquoi cette surface</h2>
 * C'est la plus grosse concentration de mutations non couvertes de
 * l'application, et elle orchestre trois agrégats : la liste, ses éléments, et
 * le classement général rattaché aux œuvres. Elle a aussi déjà été corrigée une
 * fois pour une raison de fond - <i>« découpler le classement de la
 * possession »</i> - ce qui la rend d'autant plus utile à figer.
 *
 * <h2>L'invariant produit</h2>
 * <b>Classer n'est pas posséder.</b> Une œuvre du catalogue, jamais acquise,
 * doit pouvoir être classée. Un test l'affirme explicitement, en vérifiant
 * qu'aucune possession n'apparaît au passage.
 */
class TierListHttpContractTest extends HttpContractTestBase {

    @Autowired
    private TierListRepository tierListRepository;

    @Autowired
    private CatalogEntityResolver catalogEntityResolver;

    @Autowired
    private QuickAddService quickAddService;

    @Autowired
    private com.iozycore.domain.ownership.OwnershipRepository ownershipRepository;

    private static final String MANGA = "00000000-0000-0000-0000-000000000001";

    private TierList uneListe() {
        return tierListRepository.save(TierList.create(
                "Mes préférés " + UUID.randomUUID(), EntityTypeFixtures.MANGA.id(), null, null));
    }

    /** Une œuvre au catalogue, sans aucune possession. */
    private Entity uneOeuvreNonPossedee() {
        return catalogEntityResolver.resolveOrCreate(EntityTypeFixtures.MANGA.id(),
                "Nausicaä " + UUID.randomUUID(), Map.of()).entity();
    }

    // ========================================================= Création

    @Test
    void creates_a_tier_list_for_one_universe() throws Exception {
        mockMvc.perform(post("/api/tier-lists").contentType("application/json")
                        .content("{\"name\":\"Shônen\",\"entityTypeId\":\"" + MANGA + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.name").value("Shônen"))
                .andExpect(jsonPath("$.entityTypeId").value(MANGA))
                // Rangs non précisés : la liste reçoit l'échelle complète plutôt
                // qu'aucun rang, sans quoi rien ne serait classable.
                .andExpect(jsonPath("$.activeRanks").isNotEmpty());
    }

    @Test
    void creates_a_cross_universe_tier_list_when_no_entity_type_is_given() throws Exception {
        // entityTypeId absent = liste transverse « toutes catégories ». C'est un
        // contrat, pas un oubli de validation : le tester évite qu'un futur
        // contrôle de présence le casse.
        mockMvc.perform(post("/api/tier-lists").contentType("application/json")
                        .content("{\"name\":\"Tout confondu\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.entityTypeId").doesNotExist());
    }

    @Test
    void rejects_an_unknown_universe_with_400_rather_than_a_misleading_conflict() throws Exception {
        // Découvert par cette passe : le contrôle d'existence du type ne
        // validait rien (findAllByType rend une liste vide), la contrainte de
        // clé étrangère tranchait à sa place, et le client recevait 409
        // « Cette donnée entre en conflit avec une donnée existante » - alors
        // que la donnée est absente, pas conflictuelle.
        // Seul le status est affirmé : une ResponseStatusException porte son
        // corps JSON via la redirection d'erreur du conteneur, que MockMvc ne
        // rejoue pas. Le probe live confirme le corps réel côté serveur.
        mockMvc.perform(post("/api/tier-lists").contentType("application/json")
                        .content("{\"name\":\"x\",\"entityTypeId\":\"" + ABSENT + "\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejects_a_blank_name_and_an_unparseable_body_with_400_and_never_500() throws Exception {
        for (String corps : new String[] {"{}", "{\"name\":\"   \"}", "", "{pas du json",
                                          "{\"name\":\"x\",\"activeRanks\":[\"ZZZ\"]}"}) {
            mockMvc.perform(post("/api/tier-lists").contentType("application/json").content(corps))
                    .andExpect(status().isBadRequest());
        }
    }

    // ==================================================== Lecture / listing

    @Test
    void lists_tier_lists_and_filters_them_by_universe() throws Exception {
        TierList liste = uneListe();

        mockMvc.perform(get("/api/tier-lists").param("entityTypeId", MANGA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id=='" + liste.id() + "')]").exists());

        // Sans filtre, la route rend tout : c'est ce dont se sert l'écran
        // « toutes mes listes ».
        mockMvc.perform(get("/api/tier-lists")).andExpect(status().isOk());
    }

    @Test
    void returns_404_for_a_tier_list_that_does_not_exist_and_400_for_a_malformed_id() throws Exception {
        mockMvc.perform(get("/api/tier-lists/{id}", ABSENT)).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/tier-lists/{id}", MALFORME))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").isNotEmpty());
    }

    @Test
    void the_general_board_requires_a_universe_and_rejects_a_malformed_one() throws Exception {
        mockMvc.perform(get("/api/tier-lists/general")).andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/tier-lists/general").param("entityTypeId", MALFORME))
                .andExpect(status().isBadRequest());
        // Un univers inconnu rend un board vide, pas une erreur : l'écran doit
        // pouvoir s'ouvrir avant qu'une seule œuvre existe.
        mockMvc.perform(get("/api/tier-lists/general").param("entityTypeId", ABSENT))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ranked").exists());
    }

    @Test
    void the_entity_summary_answers_for_an_entity_that_was_never_ranked() throws Exception {
        Entity oeuvre = uneOeuvreNonPossedee();

        mockMvc.perform(get("/api/tier-lists/entities/{id}/summary", oeuvre.id()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.generalRank").doesNotExist())
                .andExpect(jsonPath("$.customRanks").isArray());
    }

    // ================================================ Classement général

    @Test
    void ranks_an_entity_in_the_general_board_without_owning_it() throws Exception {
        Entity oeuvre = uneOeuvreNonPossedee();

        mockMvc.perform(put("/api/tier-lists/general/entities/{id}", oeuvre.id())
                        .contentType("application/json").content("{\"rank\":\"S\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rank").value("S"))
                .andExpect(jsonPath("$.entityId").value(oeuvre.id().toString()));

        // Classer n'est pas posséder : l'assertion qui compte. Sans elle, le
        // test passerait aussi si le classement fabriquait une possession.
        org.assertj.core.api.Assertions.assertThat(ownershipRepository.findByEntityId(oeuvre.id())).isEmpty();

        mockMvc.perform(get("/api/tier-lists/entities/{id}/summary", oeuvre.id()))
                .andExpect(jsonPath("$.generalRank").value("S"));
    }

    @Test
    void returns_400_when_ranking_an_entity_that_does_not_exist() throws Exception {
        mockMvc.perform(put("/api/tier-lists/general/entities/{id}", ABSENT)
                        .contentType("application/json").content("{\"rank\":\"S\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejects_an_invalid_or_missing_rank_with_400_and_never_500() throws Exception {
        Entity oeuvre = uneOeuvreNonPossedee();

        mockMvc.perform(put("/api/tier-lists/general/entities/{id}", oeuvre.id())
                        .contentType("application/json").content("{\"rank\":\"ZZZ\"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(put("/api/tier-lists/general/entities/{id}", MALFORME)
                        .contentType("application/json").content("{\"rank\":\"S\"}"))
                .andExpect(status().isBadRequest());
    }

    // ============================================ Mise à jour / suppression

    @Test
    void renames_a_tier_list_and_leaves_untouched_what_the_body_omits() throws Exception {
        TierList liste = uneListe();

        mockMvc.perform(patch("/api/tier-lists/{id}", liste.id()).contentType("application/json")
                        .content("{\"name\":\"Mes intouchables\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Mes intouchables"))
                // L'univers n'est pas dans le corps : il ne doit pas disparaître.
                .andExpect(jsonPath("$.entityTypeId").value(EntityTypeFixtures.MANGA.id().toString()));
    }

    @Test
    void returns_404_when_updating_or_deleting_items_of_an_absent_tier_list() throws Exception {
        // Quatre routes distinctes passent par le même requireTierList : un cas
        // chacune suffit à prouver le câblage, sans quadrupler l'assertion.
        mockMvc.perform(patch("/api/tier-lists/{id}", ABSENT).contentType("application/json")
                .content("{\"name\":\"x\"}")).andExpect(status().isNotFound());
        mockMvc.perform(post("/api/tier-lists/{id}/items", ABSENT).contentType("application/json")
                .content("{\"entityIds\":[\"" + ABSENT + "\"]}")).andExpect(status().isNotFound());
        mockMvc.perform(put("/api/tier-lists/{id}/items/{e}", ABSENT, ABSENT)
                .contentType("application/json").content("{\"rank\":\"S\"}")).andExpect(status().isNotFound());
    }

    @Test
    void deleting_a_tier_list_stays_204_and_is_idempotent() throws Exception {
        TierList liste = uneListe();

        mockMvc.perform(delete("/api/tier-lists/{id}", liste.id())).andExpect(status().isNoContent());
        mockMvc.perform(get("/api/tier-lists/{id}", liste.id())).andExpect(status().isNotFound());
        // Contrat existant : rejouer la suppression ne devient pas une erreur.
        mockMvc.perform(delete("/api/tier-lists/{id}", liste.id())).andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/tier-lists/{id}", ABSENT)).andExpect(status().isNoContent());
    }

    // ==================================================== Éléments d'une liste

    @Test
    void adds_items_ranks_one_then_removes_it() throws Exception {
        TierList liste = uneListe();
        Entity oeuvre = uneOeuvreNonPossedee();

        mockMvc.perform(post("/api/tier-lists/{id}/items", liste.id()).contentType("application/json")
                        .content("{\"entityIds\":[\"" + oeuvre.id() + "\"]}"))
                // 201 : ajouter des éléments crée des ressources, et la route
                // le déclare (@ResponseStatus(CREATED)). Figé tel quel.
                .andExpect(status().isCreated())
                // Ajoutée mais pas encore classée : elle doit apparaître dans
                // « à classer », pas se perdre.
                .andExpect(jsonPath("$.unranked[?(@.entityId=='" + oeuvre.id() + "')]").exists());

        mockMvc.perform(put("/api/tier-lists/{id}/items/{e}", liste.id(), oeuvre.id())
                        .contentType("application/json").content("{\"rank\":\"A\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rank").value("A"));

        mockMvc.perform(get("/api/tier-lists/{id}", liste.id()))
                .andExpect(jsonPath("$.ranked[?(@.entityId=='" + oeuvre.id() + "')]").exists())
                .andExpect(jsonPath("$.unranked[?(@.entityId=='" + oeuvre.id() + "')]").doesNotExist());

        mockMvc.perform(delete("/api/tier-lists/{id}/items/{e}", liste.id(), oeuvre.id()))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/tier-lists/{id}", liste.id()))
                .andExpect(jsonPath("$.ranked[?(@.entityId=='" + oeuvre.id() + "')]").doesNotExist());
    }

    @Test
    void rejects_an_empty_item_list_with_400_rather_than_silently_doing_nothing() throws Exception {
        TierList liste = uneListe();

        for (String corps : new String[] {"{}", "{\"entityIds\":[]}"}) {
            mockMvc.perform(post("/api/tier-lists/{id}/items", liste.id())
                            .contentType("application/json").content(corps))
                    .andExpect(status().isBadRequest());
        }
    }

    @Test
    void ranking_an_item_that_belongs_to_an_owned_series_works_the_same_way() throws Exception {
        // Le pendant du test « classer n'est pas posséder » : posséder n'empêche
        // pas non plus de classer. Les deux dimensions sont indépendantes.
        TierList liste = uneListe();
        QuickAddService.QuickAddResult possedee = quickAddService.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "Monster " + UUID.randomUUID(),
                OwnershipCondition.USED, Map.of(), 1, "Standard");

        mockMvc.perform(post("/api/tier-lists/{id}/items", liste.id()).contentType("application/json")
                        .content("{\"entityIds\":[\"" + possedee.entityId() + "\"]}"))
                .andExpect(status().isCreated());
        mockMvc.perform(put("/api/tier-lists/{id}/items/{e}", liste.id(), possedee.entityId())
                        .contentType("application/json").content("{\"rank\":\"B\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rank").value("B"));
    }

    @Test
    void removing_an_item_that_was_never_in_the_list_stays_204() throws Exception {
        TierList liste = uneListe();

        mockMvc.perform(delete("/api/tier-lists/{id}/items/{e}", liste.id(), ABSENT))
                .andExpect(status().isNoContent());
    }
}
