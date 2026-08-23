package com.iozycore.integration.http;

import com.iozycore.application.CatalogEntityResolver;
import com.iozycore.application.QuickAddService;
import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityTypeFixtures;
import com.iozycore.domain.experience.Experience;
import com.iozycore.domain.experience.ExperienceRepository;
import com.iozycore.domain.ownership.OwnershipCondition;
import com.iozycore.domain.catalog.Relationship;
import com.iozycore.domain.catalog.RelationshipRepository;
import com.iozycore.domain.wishlist.WishlistEntry;
import com.iozycore.domain.wishlist.WishlistEntryRepository;
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
 * Le contrat HTTP des trois surfaces par lesquelles l'utilisateur attache
 * <b>ses propres données</b> à une œuvre : un lien entre deux œuvres
 * ({@code /api/relationships}), un fait vécu ({@code /api/experiences}), une
 * envie ({@code /api/wishlist}).
 *
 * <h2>Pourquoi ces trois ensemble</h2>
 * Ce ne sont pas trois modules voisins par hasard : ce sont les trois endroits
 * où l'utilisateur écrit quelque chose qui n'existe nulle part ailleurs. Une
 * possession se rachète, un catalogue se re-télécharge ; une note de lecture,
 * un lien qu'on a établi soi-même et une envie notée un soir, non. Les trois
 * ont d'ailleurs été repris ensemble lors de la passe « rendre réversibles les
 * écritures utilisateur ».
 * <p>
 * Ils partagent aussi le <b>même défaut historique</b>, corrigé au Lot 28 : une
 * référence vers une œuvre inconnue n'était protégée que par la clé étrangère
 * de Postgres, et remontait en 500 avec la requête SQL. Ces tests figent le
 * 400 qui l'a remplacé - sur les trois surfaces, parce que le cas jumeau est
 * précisément ce qui se retrouve oublié.
 *
 * <h2>Les deux invariants produit</h2>
 * <b>Wishlist ≠ Ownership</b> : ajouter aux envies ne crée jamais de
 * possession. <b>Catalogue ≠ Collection</b> : une œuvre inconnue d'IozyCore
 * peut entrer aux envies, en créant sa seule fiche catalogue.
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
    private com.iozycore.domain.ownership.OwnershipRepository ownershipRepository;

    private static final String MANGA = "00000000-0000-0000-0000-000000000001";

    /** Une œuvre au catalogue, sans possession. */
    private Entity uneOeuvre(String titre) {
        return catalogEntityResolver.resolveOrCreate(EntityTypeFixtures.MANGA.id(),
                titre + " " + UUID.randomUUID(), Map.of()).entity();
    }

    /** Une œuvre possédée, avec un tome - nécessaire pour les expériences par tome. */
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

        // Une relation est orientée : elle se lit depuis sa source, et depuis sa
        // cible - les deux fiches doivent la montrer.
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

        // Le défaut du Lot 28 : sans ce contrôle, seule la clé étrangère
        // protégeait la table et remontait en 500 avec la requête SQL.
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
        // Un identifiant qui n'est pas un UUID échoue à la désérialisation,
        // avant même d'atteindre le contrôleur.
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
                // Corriger le type ne redirige pas la relation.
                .andExpect(jsonPath("$.sourceEntityId").value(source.id().toString()));

        mockMvc.perform(delete("/api/relationships/{id}", relation.id()))
                .andExpect(status().isNoContent());
        assertThat(relationshipRepository.findById(relation.id())).isEmpty();
        // Retirer une relation ne touche à aucune des deux œuvres.
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

        // Découvert par cette passe. La colonne est NOT NULL et rien ne le
        // validait : le corps descendait jusqu'à Hibernate, dont la
        // PropertyValueException ressortait en 409 « Cette donnée entre en
        // conflit avec une donnée existante » - rien n'entrait en conflit, il
        // manquait une date, et l'utilisateur ne pouvait pas savoir laquelle.
        mockMvc.perform(post("/api/experiences").contentType("application/json")
                        .content("{\"entityId\":\"" + oeuvre.id() + "\",\"experienceType\":\"READ\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").isNotEmpty());
    }

    @Test
    void rejects_a_volume_that_does_not_belong_to_that_work_with_400() throws Exception {
        Entity oeuvre = uneOeuvre("Gunnm");
        QuickAddService.QuickAddResult autre = uneOeuvrePossedee();

        // Le tome existe, mais ailleurs : rattacher une lecture au mauvais tome
        // fausserait durablement la fiche.
        mockMvc.perform(post("/api/experiences").contentType("application/json")
                        .content("{\"entityId\":\"" + oeuvre.id() + "\",\"variantId\":\"" + autre.variantId()
                                + "\",\"experienceType\":\"READ\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejects_an_experience_type_the_universe_does_not_allow_with_400() throws Exception {
        Entity manga = uneOeuvre("Naruto");

        // Un manga se lit ; « PLAYED » appartient au jeu vidéo. Le refus vient du
        // type d'œuvre, pas d'une liste codée dans le contrôleur.
        mockMvc.perform(post("/api/experiences").contentType("application/json")
                        .content("{\"entityId\":\"" + manga.id() + "\",\"experienceType\":\"PLAYED\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejects_an_experience_on_a_work_that_does_not_exist_with_400_not_404() throws Exception {
        // 400 délibéré et non 404 : l'endpoint existe, c'est le CORPS qui
        // référence une œuvre inconnue. Le client remplace tout 404 par un repli
        // traduit, et la vraie raison n'arrivait jamais à l'écran.
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

        // null efface : les deux champs sont remplacés tels quels, ce qui permet
        // de retirer une note posée par erreur.
        mockMvc.perform(patch("/api/experiences/{id}", experience.id()).contentType("application/json")
                        .content("{\"rating\":null,\"comment\":null}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rating").doesNotExist())
                .andExpect(jsonPath("$.comment").doesNotExist());

        mockMvc.perform(delete("/api/experiences/{id}", experience.id()))
                .andExpect(status().isNoContent());
        assertThat(experienceRepository.findById(experience.id())).isEmpty();
        // Retirer une lecture ne retire pas l'œuvre.
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
        // Aucune expérience n'est un état normal, pas une erreur.
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

        // Wishlist ≠ Ownership : l'assertion qui compte. Sans elle, le test
        // passerait aussi si l'ajout fabriquait une possession.
        assertThat(ownershipRepository.findByEntityId(oeuvre.id())).isEmpty();
    }

    @Test
    void adds_a_work_unknown_to_iozycore_by_creating_its_catalog_entry_only() throws Exception {
        String titre = "Œuvre jamais vue " + UUID.randomUUID();

        // Catalogue ≠ Collection : une œuvre trouvée par une recherche externe
        // ou un scan entre aux envies en créant sa seule fiche.
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

        // Idempotent : rejouer l'ajout rend la même entrée, sans doublon.
        assertThat(objectMapper.readTree(second).get("id"))
                .isEqualTo(objectMapper.readTree(premier).get("id"));
        assertThat(wishlistEntryRepository.findAll().stream()
                .filter(e -> e.entityId().equals(oeuvre.id())).count()).isEqualTo(1);
    }

    @Test
    void rejects_a_wishlist_body_that_identifies_no_work_at_all_with_400() throws Exception {
        // Le corps accepte deux formes - un entityId, ou un type et un titre.
        // N'en satisfaire aucune est une saisie invalide, pas un 500.
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

        // Trois états, trois boutons : « Ajouter », « Déjà dans tes envies »,
        // « Tu la possèdes ». C'est ce contrat que la fiche consomme.
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

        // Ne plus vouloir une œuvre ne l'efface pas du catalogue : elle peut
        // être classée, reliée, ou souhaitée de nouveau plus tard.
        assertThat(entityRepository.findById(oeuvre.id())).isPresent();
        assertThat(wishlistEntryRepository.findByEntityId(oeuvre.id())).isEmpty();
        // Idempotent, comme les autres suppressions de données utilisateur.
        mockMvc.perform(delete("/api/wishlist/{id}", entree.id())).andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/wishlist/{id}", MALFORME)).andExpect(status().isBadRequest());
    }
}
