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
 * The HTTP contract of sharing: {@code /api/share} (settings) and
 * {@code /api/public/share/{token}} (the space read by the recipient).
 *
 * <h2>Why this surface comes before the others</h2>
 * It is the only one in the application where a regression is <b>irreversible and
 * silent</b>. Elsewhere, a defect shows a wrong number or refuses an
 * action; here, it exposes to a third party data that the user had chosen
 * to keep. A link that was handed out cannot be called back.
 * <p>
 * And the filtering lives <b>in the public controller</b>, not in a service:
 * 219 lines that no test went through. This is exactly the case where "the
 * service is already tested" protects nothing, because there is no service.
 *
 * <h2>What these tests state</h2>
 * Not "the response arrives", but "<b>what is not shared is
 * absent</b>". A test that settled for a 200 would also pass with a
 * complete leak.
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

    /** A work that is really owned - so eligible for the Collection section. */
    private void unePossession() {
        quickAddService.addNewEntityWithOwnership(EntityTypeFixtures.MANGA.id(),
                "Akira " + UUID.randomUUID(), OwnershipCondition.USED, Map.of(), 1, "Standard");
    }

    /** A wished work, never owned - so eligible for the Wishes section only. */
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

    // ================================================ /api/share (settings)

    @Test
    void reports_no_active_link_before_anything_is_generated() throws Exception {
        shareSettingsRepository.save(ShareSettings.noLink(DefaultOwner.ID));

        mockMvc.perform(get("/api/share"))
                .andExpect(status().isOk())
                // token null is the contract: this is how the screen knows to
                // show "Générer un lien" rather than an empty link.
                .andExpect(jsonPath("$.token").doesNotExist());
    }

    @Test
    void generates_a_link_that_starts_from_the_most_closed_tier_list_choice() throws Exception {
        mockMvc.perform(post("/api/share"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.shareCollection").value(true))
                .andExpect(jsonPath("$.shareWishlist").value(true))
                // The Tier Lists are a choice, never a default: regenerating a
                // link must not reopen a section closed on purpose.
                .andExpect(jsonPath("$.includeTierLists").value(false));
    }

    @Test
    void regenerating_replaces_the_previous_token_immediately() throws Exception {
        String premier = jetonAvecSections(true, true, false);

        mockMvc.perform(post("/api/share")).andExpect(status().isCreated());

        // The old link stops working - this is the only way to take back
        // what was handed out.
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
                // Missing field = unchanged: a partial PATCH does not silently close
                // what it does not mention.
                .andExpect(jsonPath("$.shareCollection").value(true))
                .andExpect(jsonPath("$.shareWishlist").value(false));
    }

    @Test
    void refuses_to_leave_a_live_link_exposing_nothing_at_all() throws Exception {
        jetonAvecSections(true, true, false);

        // The domain invariant: a link that exposes nothing must be deleted,
        // not emptied. Translated into 400, never let through as a 500.
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
        // A message that would tell "never existed" from "revoked"
        // would already inform the one who tries tokens.
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
                // NULL, and above all not an empty list: "[]" would say "it has
                // nothing in its wishes", which is information in itself,
                // whereas null says "you have no access to it".
                //
                // `doesNotExist()` was not enough to say it: it is true
                // for a missing key as well as for a key set to null, and
                // the wire really carries "tierLists":null. The assertion
                // therefore looked like it checked the shape without doing so. This one
                // fails if the value becomes a list, an empty one included.
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
        // A work present in the catalogue without ownership - entered through the
        // wishes or a scan - is not part of "my collection".
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

        // The token IS the password: finding it again in the body served to the
        // recipient would bring nothing and would make it leak through a screenshot.
        assertThat(corps).doesNotContain(jeton);
    }
}
