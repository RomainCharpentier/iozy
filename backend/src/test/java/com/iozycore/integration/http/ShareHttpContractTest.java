package com.iozycore.integration.http;

import com.iozycore.core.domain.shared.DefaultOwner;
import com.iozycore.core.application.CatalogEntityResolver;
import com.iozycore.core.application.QuickAddService;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.share.ShareSettings;
import com.iozycore.core.domain.share.ShareSettingsRepository;
import com.iozycore.core.domain.wishlist.WishlistEntry;
import com.iozycore.core.domain.wishlist.WishlistEntryRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

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
 * Le contrat HTTP du partage : {@code /api/share} (réglages) et
 * {@code /api/public/share/{token}} (l'espace lu par le destinataire).
 *
 * <h2>Pourquoi cette surface passe avant les autres</h2>
 * C'est la seule de l'application dont une régression est <b>irréversible et
 * silencieuse</b>. Ailleurs, un défaut affiche un mauvais chiffre ou refuse une
 * action ; ici, il expose à un tiers des données que l'utilisateur avait choisi
 * de garder. Un lien distribué ne se rappelle pas.
 * <p>
 * Et le filtrage vit <b>dans le contrôleur public</b>, pas dans un service :
 * 219 lignes qu'aucun test ne traversait. C'est exactement le cas où « le
 * service est déjà testé » ne protège rien, parce qu'il n'y a pas de service.
 *
 * <h2>Ce que ces tests affirment</h2>
 * Non pas « la réponse arrive », mais « <b>ce qui n'est pas partagé est
 * absent</b> ». Un test qui se contenterait d'un 200 passerait aussi avec une
 * fuite complète.
 */
class ShareHttpContractTest extends HttpContractTestBase {

    @Autowired
    private ShareSettingsRepository shareSettingsRepository;

    @Autowired
    private QuickAddService quickAddService;

    @Autowired
    private CatalogEntityResolver catalogEntityResolver;

    @Autowired
    private WishlistEntryRepository wishlistEntryRepository;

    /** Une œuvre réellement possédée - donc éligible à la section Collection. */
    private void unePossession() {
        quickAddService.addNewEntityWithOwnership(EntityTypeFixtures.MANGA.id(),
                "Akira " + UUID.randomUUID(), OwnershipCondition.USED, Map.of(), 1, "Standard");
    }

    /** Une œuvre souhaitée, jamais possédée - donc éligible à la seule section Envies. */
    private void uneEnvie() {
        Entity oeuvre = catalogEntityResolver.resolveOrCreate(EntityTypeFixtures.MANGA.id(),
                "Gunnm " + UUID.randomUUID(), Map.of()).entity();
        wishlistEntryRepository.save(WishlistEntry.add(oeuvre.id(), java.time.LocalDate.now()));
    }

    private String jetonAvecSections(boolean collection, boolean envies, boolean tierLists) {
        ShareSettings settings = ShareSettings.withNewToken(DefaultOwner.ID)
                .withSections(collection, envies)
                .withTierLists(tierLists);
        return shareSettingsRepository.save(settings).token();
    }

    // ================================================ /api/share (réglages)

    @Test
    void reports_no_active_link_before_anything_is_generated() throws Exception {
        shareSettingsRepository.save(ShareSettings.noLink(DefaultOwner.ID));

        mockMvc.perform(get("/api/share"))
                .andExpect(status().isOk())
                // token null est le contrat : c'est ainsi que l'écran sait
                // afficher « Générer un lien » plutôt qu'un lien vide.
                .andExpect(jsonPath("$.token").doesNotExist());
    }

    @Test
    void generates_a_link_that_starts_from_the_most_closed_tier_list_choice() throws Exception {
        mockMvc.perform(post("/api/share"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.shareCollection").value(true))
                .andExpect(jsonPath("$.shareWishlist").value(true))
                // Les Tier Lists sont un choix, jamais un défaut : régénérer un
                // lien ne doit pas rouvrir une section fermée exprès.
                .andExpect(jsonPath("$.includeTierLists").value(false));
    }

    @Test
    void regenerating_replaces_the_previous_token_immediately() throws Exception {
        String premier = jetonAvecSections(true, true, false);

        mockMvc.perform(post("/api/share")).andExpect(status().isCreated());

        // L'ancien lien cesse de fonctionner - c'est la seule façon de reprendre
        // ce qu'on a distribué.
        mockMvc.perform(get("/api/public/share/{token}", premier))
                .andExpect(status().isNotFound());
    }

    @Test
    void updates_sections_without_changing_the_distributed_link() throws Exception {
        String jeton = jetonAvecSections(true, true, false);

        mockMvc.perform(patch("/api/share").contentType("application/json")
                        .content("{\"shareWishlist\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value(jeton))
                // Champ absent = inchangé : un PATCH partiel ne referme pas
                // silencieusement ce qu'il ne mentionne pas.
                .andExpect(jsonPath("$.shareCollection").value(true))
                .andExpect(jsonPath("$.shareWishlist").value(false));
    }

    @Test
    void refuses_to_leave_a_live_link_exposing_nothing_at_all() throws Exception {
        jetonAvecSections(true, true, false);

        // L'invariant du domaine : un lien qui n'expose rien doit être supprimé,
        // pas vidé. Traduit en 400, jamais laissé remonter en 500.
        mockMvc.perform(patch("/api/share").contentType("application/json")
                        .content("{\"shareCollection\":false,\"shareWishlist\":false}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejects_an_empty_or_unparseable_share_update_with_400_and_never_500() throws Exception {
        for (String corps : new String[] {"", "{pas du json", "[1,2]", "{\"shareCollection\":\"oui\"}"}) {
            mockMvc.perform(patch("/api/share").contentType("application/json").content(corps))
                    .andExpect(status().isBadRequest());
        }
    }

    @Test
    void deleting_the_link_makes_the_previous_token_stop_working() throws Exception {
        String jeton = jetonAvecSections(true, true, false);

        mockMvc.perform(delete("/api/share")).andExpect(status().isNoContent());

        mockMvc.perform(get("/api/public/share/{token}", jeton)).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/share")).andExpect(jsonPath("$.token").doesNotExist());
    }

    // ================================== /api/public/share/{token} (public)

    @Test
    void returns_a_bare_404_for_an_unknown_token_without_hinting_it_ever_existed() throws Exception {
        // Un message qui distinguerait « jamais existé » de « révoqué »
        // renseignerait déjà celui qui essaie des jetons.
        mockMvc.perform(get("/api/public/share/{token}", "jeton-qui-n-existe-pas"))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/public/share/{token}", "x".repeat(300)))
                .andExpect(status().isNotFound());
    }

    @Test
    void omits_the_wishlist_section_entirely_when_it_is_not_shared() throws Exception {
        unePossession();
        uneEnvie();
        String jeton = jetonAvecSections(true, false, false);

        mockMvc.perform(get("/api/public/share/{token}", jeton))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.collection").exists())
                // NULLE, et surtout pas une liste vide : « [] » dirait « il n'a
                // rien dans ses envies », ce qui est une information en soi,
                // alors que null dit « tu n'y as pas accès ».
                //
                // `doesNotExist()` ne suffisait pas à le dire : il est vrai
                // aussi bien pour une clé absente que pour une clé à null, et
                // le fil porte bel et bien « "tierLists":null ». L'assertion
                // avait donc l'air de vérifier la forme sans le faire. Celle-ci
                // échoue si la valeur devient une liste, vide comprise.
                .andExpect(jsonPath("$.wishlist").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.tierLists").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    void omits_the_collection_section_entirely_when_only_the_wishlist_is_shared() throws Exception {
        unePossession();
        uneEnvie();
        String jeton = jetonAvecSections(false, true, false);

        mockMvc.perform(get("/api/public/share/{token}", jeton))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.collection").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.wishlist").exists());
    }

    @Test
    void never_exposes_tier_lists_unless_they_were_explicitly_included() throws Exception {
        unePossession();
        String avecTierLists = jetonAvecSections(true, true, true);
        mockMvc.perform(get("/api/public/share/{token}", avecTierLists))
                .andExpect(jsonPath("$.tierLists").exists());

        String sansTierLists = jetonAvecSections(true, true, false);
        mockMvc.perform(get("/api/public/share/{token}", sansTierLists))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tierLists").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    void shares_only_what_is_owned_never_the_bare_catalog() throws Exception {
        // Une œuvre présente au catalogue sans possession - entrée par les
        // envies ou un scan - ne fait pas partie de « ma collection ».
        Entity jamaisPossedee = catalogEntityResolver.resolveOrCreate(EntityTypeFixtures.MANGA.id(),
                "Blame " + UUID.randomUUID(), Map.of()).entity();
        unePossession();
        String jeton = jetonAvecSections(true, false, false);

        mockMvc.perform(get("/api/public/share/{token}", jeton))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$..items[?(@.entityId=='" + jamaisPossedee.id() + "')]").doesNotExist());
    }

    @Test
    void the_public_endpoint_never_leaks_the_token_of_another_link() throws Exception {
        unePossession();
        String jeton = jetonAvecSections(true, true, true);

        String corps = mockMvc.perform(get("/api/public/share/{token}", jeton))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        // Le jeton EST le mot de passe : le retrouver dans le corps servi au
        // destinataire n'apporterait rien et le ferait fuiter par capture d'écran.
        assertThat(corps).doesNotContain(jeton);
    }
}
