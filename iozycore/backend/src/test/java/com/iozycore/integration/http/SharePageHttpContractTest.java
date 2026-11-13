package com.iozycore.integration.http;

import com.fasterxml.jackson.databind.JsonNode;
import com.iozycore.core.application.CatalogEntityResolver;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.catalog.Variant;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.core.domain.share.ShareSettings;
import com.iozycore.core.domain.share.ShareSettingsRepository;
import com.iozycore.core.domain.shared.DefaultOwner;
import com.iozycore.core.domain.wishlist.WishlistEntry;
import com.iozycore.core.domain.wishlist.WishlistEntryRepository;
import com.iozycore.manga.domain.EditionTier;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.manga.domain.MangaEditionRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The HTTP contract of the "Partager" page (lot 217): the preview, "Mes 4
 * incontournables", the value switch and the gift list link that expires.
 * The share link of before keeps its contract ({@link ShareHttpContractTest}).
 */
class SharePageHttpContractTest extends HttpContractTestBase {

    @Autowired private ShareSettingsRepository shareSettingsRepository;
    @Autowired private CatalogEntityResolver catalogEntityResolver;
    @Autowired private OwnershipRepository ownershipRepository;
    @Autowired private WishlistEntryRepository wishlistEntryRepository;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private EntityRepository entityRepository;
    @Autowired private MangaEditionRepository mangaEditionRepository;

    private Entity work(String title) {
        return catalogEntityResolver.resolveOrCreate(EntityTypeFixtures.MANGA.id(),
                title + " " + UUID.randomUUID(), Map.of()).entity();
    }

    private Entity owned(String title) {
        Entity work = work(title);
        ownershipRepository.save(Ownership.acquire(work.id(), null, OwnershipCondition.NEW, LocalDate.now(), null));
        return work;
    }

    private Entity wished(String title) {
        Entity work = work(title);
        wishlistEntryRepository.save(WishlistEntry.add(work.id(), LocalDate.now()));
        return work;
    }

    private String shareLink() {
        return shareSettingsRepository.save(ShareSettings.withNewToken(DefaultOwner.ID)).token();
    }

    private JsonNode body(org.springframework.test.web.servlet.ResultActions result) throws Exception {
        return objectMapper.readTree(result.andReturn().getResponse().getContentAsString());
    }

    private String giftToken() throws Exception {
        return body(mockMvc.perform(post("/api/share/gift")).andExpect(status().isOk()))
                .path("giftLink").path("token").asText();
    }

    // ------------------------------------------------------------- Preview

    @Test
    void the_preview_follows_the_current_choices_even_before_a_link_exists() throws Exception {
        Entity naruto = owned("Naruto");
        wished("Berserk");
        shareSettingsRepository.save(ShareSettings.noLink(DefaultOwner.ID).withSections(true, false));

        mockMvc.perform(get("/api/share/preview"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.collection[*].items[?(@.title=='" + naruto.title() + "')]").exists())
                .andExpect(jsonPath("$.wishlist").value(nullValue()))
                .andExpect(jsonPath("$.giftList").value(false));
    }

    // -------------------------------------------------- Mes 4 incontournables

    @Test
    void pinned_works_come_first_on_the_public_page_in_the_order_chosen() throws Exception {
        Entity first = owned("Vinland Saga");
        Entity second = owned("Pluto");
        String token = shareLink();

        mockMvc.perform(put("/api/share/pins").contentType("application/json")
                        .content("{\"entityIds\":[\"" + second.id() + "\",\"" + first.id() + "\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pinnedWorkIds[0]").value(second.id().toString()))
                .andExpect(jsonPath("$.pinnedWorkIds[1]").value(first.id().toString()));

        mockMvc.perform(get("/api/public/share/{token}", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pinned[0].title").value(second.title()))
                .andExpect(jsonPath("$.pinned[1].title").value(first.title()))
                .andExpect(jsonPath("$.pinned[0].ownedCount").value(1));
    }

    @Test
    void a_work_that_is_not_owned_cannot_be_pinned() throws Exception {
        Entity wish = wished("Monster");

        // A pinned wish would show the wishes to a visitor of a collection-only link.
        mockMvc.perform(put("/api/share/pins").contentType("application/json")
                        .content("{\"entityIds\":[\"" + wish.id() + "\"]}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(put("/api/share/pins").contentType("application/json")
                        .content("{\"entityIds\":[\"" + UUID.randomUUID() + "\"]}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void a_pin_no_longer_owned_does_not_block_the_next_change() throws Exception {
        Entity sold = owned("Ashita no Joe");
        Entity kept = owned("Dragon Head");
        Entity added = owned("Ping Pong");
        mockMvc.perform(put("/api/share/pins").contentType("application/json")
                .content("{\"entityIds\":[\"" + sold.id() + "\",\"" + kept.id() + "\"]}"))
                .andExpect(status().isOk());
        Ownership ownership = ownershipRepository.findAll().stream()
                .filter(o -> o.entityId().equals(sold.id())).findFirst().orElseThrow();
        ownership.markSold();
        ownershipRepository.save(ownership);

        // The owner no longer sees the sold work among the pins.
        mockMvc.perform(get("/api/share"))
                .andExpect(jsonPath("$.pinnedWorkIds.length()").value(1))
                .andExpect(jsonPath("$.pinnedWorkIds[0]").value(kept.id().toString()));
        // A client that still sends it is not blocked: the old pin is dropped.
        mockMvc.perform(put("/api/share/pins").contentType("application/json")
                        .content("{\"entityIds\":[\"" + sold.id() + "\",\"" + kept.id() + "\",\""
                                + added.id() + "\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pinnedWorkIds.length()").value(2))
                .andExpect(jsonPath("$.pinnedWorkIds[1]").value(added.id().toString()));
    }

    @Test
    void four_visible_pins_plus_one_no_longer_owned_still_save() throws Exception {
        Entity sold = owned("Kaiji");
        mockMvc.perform(put("/api/share/pins").contentType("application/json")
                .content("{\"entityIds\":[\"" + sold.id() + "\"]}")).andExpect(status().isOk());
        Ownership ownership = ownershipRepository.findAll().stream()
                .filter(o -> o.entityId().equals(sold.id())).findFirst().orElseThrow();
        ownership.markSold();
        ownershipRepository.save(ownership);

        StringBuilder ids = new StringBuilder("\"" + sold.id() + "\"");
        for (int i = 0; i < 4; i++) {
            ids.append(",\"").append(owned("Gantz " + i).id()).append('"');
        }
        mockMvc.perform(put("/api/share/pins").contentType("application/json")
                        .content("{\"entityIds\":[" + ids + "]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pinnedWorkIds.length()").value(4));
    }

    @Test
    void a_fifth_pinned_work_is_refused() throws Exception {
        StringBuilder ids = new StringBuilder();
        for (int i = 0; i < 5; i++) {
            ids.append(i == 0 ? "" : ",").append('"').append(owned("Tome " + i).id()).append('"');
        }
        mockMvc.perform(put("/api/share/pins").contentType("application/json")
                        .content("{\"entityIds\":[" + ids + "]}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void pins_stay_hidden_when_only_the_wishes_are_shared() throws Exception {
        Entity pinned = owned("Akira");
        mockMvc.perform(put("/api/share/pins").contentType("application/json")
                .content("{\"entityIds\":[\"" + pinned.id() + "\"]}")).andExpect(status().isOk());
        String token = shareSettingsRepository.save(ShareSettings.withNewToken(DefaultOwner.ID)
                .withSections(false, true)).token();

        mockMvc.perform(get("/api/public/share/{token}", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pinned").value(nullValue()));
    }

    // ------------------------------------------------------------- Value

    @Test
    void the_value_never_comes_out_without_enough_prices_even_when_turned_on() throws Exception {
        owned("Dorohedoro");
        String token = shareLink();

        mockMvc.perform(patch("/api/share").contentType("application/json").content("{\"showValue\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.showValue").value(true))
                .andExpect(jsonPath("$.token").value(token));

        // No edition has a new price here: below the threshold, no number at all.
        mockMvc.perform(get("/api/public/share/{token}", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.value").value(nullValue()));
        mockMvc.perform(get("/api/share/value")).andExpect(status().isNoContent());
    }

    @Test
    void the_value_comes_out_once_enough_prices_back_it_and_it_is_turned_on() throws Exception {
        // Six owned volumes, all with a new price: above both thresholds.
        for (int s = 0; s < 2; s++) {
            String title = "Valeur " + UUID.randomUUID();
            Entity series = Entity.create(EntityTypeFixtures.MANGA.id(), title);
            for (int tome = 1; tome <= 3; tome++) {
                series.addVariant("Tome " + tome, Map.of("volumeNumber", tome, "edition", "Standard"));
            }
            entityRepository.save(series);
            // Linked to the saved series: the value is read per (series, edition).
            mangaEditionRepository.save(MangaEdition.create(series.id(), title, "Standard", EditionTier.STANDARD,
                    "Éditeur", 10, new BigDecimal("7.90"), false, false, null));
            for (Variant variant : series.variants()) {
                ownershipRepository.save(Ownership.acquire(series.id(), variant.id(),
                        OwnershipCondition.NEW, LocalDate.now(), null));
            }
        }
        String token = shareLink();

        mockMvc.perform(get("/api/share/value"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pricedCount").value(6))
                .andExpect(jsonPath("$.totalKnownValue").value(47.4));
        // Off by default on the public page, even above the threshold.
        mockMvc.perform(get("/api/public/share/{token}", token))
                .andExpect(jsonPath("$.value").value(nullValue()));
        mockMvc.perform(patch("/api/share").contentType("application/json").content("{\"showValue\":true}"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/public/share/{token}", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.value.pricedCount").value(6))
                .andExpect(jsonPath("$.value.totalKnownValue").value(47.4));
    }

    @Test
    void a_new_link_starts_with_the_value_off() throws Exception {
        mockMvc.perform(post("/api/share"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.showValue").value(false));
    }

    // --------------------------------------------------------- Gift list

    @Test
    void the_gift_link_shows_the_wishes_only_to_a_visitor() throws Exception {
        Entity naruto = owned("Naruto");
        Entity wish = wished("Frieren");
        mockMvc.perform(put("/api/share/pins").contentType("application/json")
                .content("{\"entityIds\":[\"" + naruto.id() + "\"]}")).andExpect(status().isOk());

        String token = giftToken();

        mockMvc.perform(get("/api/public/share/{token}", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.giftList").value(true))
                .andExpect(jsonPath("$.expiresAt").isNotEmpty())
                .andExpect(jsonPath("$.wishlist[?(@.title=='" + wish.title() + "')]").exists())
                .andExpect(jsonPath("$.collection").value(nullValue()))
                .andExpect(jsonPath("$.pinned").value(nullValue()))
                .andExpect(jsonPath("$.tierLists").value(nullValue()))
                .andExpect(jsonPath("$.value").value(nullValue()));
    }

    @Test
    void the_gift_link_lasts_thirty_days() throws Exception {
        JsonNode share = body(mockMvc.perform(post("/api/share/gift")).andExpect(status().isOk()));

        Instant expiresAt = Instant.parse(share.path("giftLink").path("expiresAt").asText());
        assertThat(expiresAt).isBetween(Instant.now().plusSeconds(30L * 86400 - 120),
                Instant.now().plusSeconds(30L * 86400 + 120));
        assertThat(share.path("giftLink").path("expired").asBoolean()).isFalse();
    }

    @Test
    void an_expired_gift_link_answers_410_with_a_message_and_renewing_brings_it_back() throws Exception {
        wished("Blame");
        String token = giftToken();
        jdbc.update("UPDATE gift_link SET expires_at = ? WHERE owner_id = ?",
                java.sql.Timestamp.from(Instant.now().minusSeconds(60)), DefaultOwner.ID);

        mockMvc.perform(get("/api/public/share/{token}", token))
                .andExpect(status().isGone())
                .andExpect(status().reason("Ce lien a expiré"));
        mockMvc.perform(get("/api/share"))
                .andExpect(jsonPath("$.giftLink.expired").value(true));

        // Renewing keeps the token: the list already sent works again.
        mockMvc.perform(post("/api/share/gift"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.giftLink.token").value(token))
                .andExpect(jsonPath("$.giftLink.expired").value(false));
        mockMvc.perform(get("/api/public/share/{token}", token)).andExpect(status().isOk());
    }

    @Test
    void deleting_the_gift_link_leaves_the_share_link_working() throws Exception {
        String share = shareLink();
        String gift = giftToken();

        mockMvc.perform(delete("/api/share/gift")).andExpect(status().isNoContent());

        mockMvc.perform(get("/api/public/share/{token}", gift)).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/share")).andExpect(jsonPath("$.giftLink").value(nullValue()));
        // The share link does not expire and is not a gift list.
        mockMvc.perform(get("/api/public/share/{token}", share))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.giftList").value(false))
                .andExpect(jsonPath("$.expiresAt").value(nullValue()));
    }

    @Test
    void the_public_page_never_carries_the_gift_token() throws Exception {
        wished("Gunnm");
        String gift = giftToken();

        String json = mockMvc.perform(get("/api/public/share/{token}", gift))
                .andReturn().getResponse().getContentAsString();

        assertThat(json).doesNotContain(gift);
    }
}
