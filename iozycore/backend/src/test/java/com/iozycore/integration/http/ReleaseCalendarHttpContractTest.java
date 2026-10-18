package com.iozycore.integration.http;

import com.iozycore.core.domain.follow.FollowedWork;
import com.iozycore.core.domain.follow.FollowedWorkRepository;

import com.iozycore.core.application.QuickAddService;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.core.domain.wishlist.WishlistEntry;
import com.iozycore.core.domain.wishlist.WishlistEntryRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The HTTP contract of {@code /api/insights/releases} - the release
 * calendar (batch 146).
 *
 * <h2>What these tests freeze</h2>
 * The shape of a row, as the client reads it to build its month;
 * the relationship, always written; the period, bounded with a 400 and not a 500; and
 * the {@code hasReleaseSource} flag of the categories, which tells the client
 * which ones have a source of dates. The date goes through the detail page here
 * (entered attribute), the only path that depends on no provider; the
 * sources of each universe have their own tests.
 */
class ReleaseCalendarHttpContractTest extends HttpContractTestBase {

    @Autowired
    private QuickAddService quickAddService;

    @Autowired
    private WishlistEntryRepository wishlistEntryRepository;
    @Autowired
    private FollowedWorkRepository followedWorkRepository;
    @Autowired
    private OwnershipRepository ownershipRepository;

    @Test
    void lists_a_hand_dated_owned_work_with_everything_the_calendar_page_needs() throws Exception {
        String title = "Ark Nova " + UUID.randomUUID();
        QuickAddService.QuickAddResult result = quickAddService.addNewEntityWithOwnership(
                EntityTypeFixtures.BOARD_GAME.id(), title, OwnershipCondition.NEW,
                Map.of("releaseDate", "2026-10-14", "coverImageUrl", "https://img/ark-nova.jpg"));
        // Owned is no longer enough: it is FOLLOWED that puts a work on the calendar.
        followedWorkRepository.save(FollowedWork.follow(result.entityId(), LocalDate.now()));

        mockMvc.perform(get("/api/insights/releases").param("from", "2026-10-01").param("to", "2026-10-31"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.from").value("2026-10-01"))
                .andExpect(jsonPath("$.to").value("2026-10-31"))
                .andExpect(jsonPath("$.entries[?(@.entityId == '" + result.entityId() + "')]").exists())
                .andExpect(jsonPath("$.entries[?(@.entityId == '" + result.entityId() + "')].date").value("2026-10-14"))
                .andExpect(jsonPath("$.entries[?(@.entityId == '" + result.entityId() + "')].precision").value("DAY"))
                .andExpect(jsonPath("$.entries[?(@.entityId == '" + result.entityId() + "')].entityTitle").value(title))
                .andExpect(jsonPath("$.entries[?(@.entityId == '" + result.entityId() + "')].entityTypeId")
                        .value(EntityTypeFixtures.BOARD_GAME.id().toString()))
                .andExpect(jsonPath("$.entries[?(@.entityId == '" + result.entityId() + "')].relation").value("OWNED"))
                .andExpect(jsonPath("$.entries[?(@.entityId == '" + result.entityId() + "')].source").value("MANUAL"))
                .andExpect(jsonPath("$.entries[?(@.entityId == '" + result.entityId() + "')].label").value(""))
                .andExpect(jsonPath("$.entries[?(@.entityId == '" + result.entityId() + "')].coverImageUrl")
                        .value("https://img/ark-nova.jpg"));

        // The previous month does not show it: the period is the question, not a display filter.
        mockMvc.perform(get("/api/insights/releases").param("from", "2026-09-01").param("to", "2026-09-30"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entries[?(@.entityId == '" + result.entityId() + "')]").doesNotExist());
    }

    @Test
    void a_followed_work_dated_to_a_month_is_listed_at_month_precision() throws Exception {
        String title = "Dune Imperium " + UUID.randomUUID();
        QuickAddService.QuickAddResult result = quickAddService.addNewEntityWithOwnership(
                EntityTypeFixtures.BOARD_GAME.id(), title, OwnershipCondition.NEW, Map.of("releaseDate", "2026-11"));
        followedWorkRepository.save(FollowedWork.follow(result.entityId(), LocalDate.now()));

        mockMvc.perform(get("/api/insights/releases").param("from", "2026-11-01").param("to", "2026-11-30"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entries[?(@.entityId == '" + result.entityId() + "')].date").value("2026-11"))
                .andExpect(jsonPath("$.entries[?(@.entityId == '" + result.entityId() + "')].precision").value("MONTH"))
                .andExpect(jsonPath("$.entries[?(@.entityId == '" + result.entityId() + "')].relation").value("OWNED"));
    }

    @Test
    void answers_400_on_an_unreadable_date_a_reversed_period_or_more_than_a_year() throws Exception {
        mockMvc.perform(get("/api/insights/releases").param("from", "octobre").param("to", "2026-10-31"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/insights/releases").param("from", "2026-10-31").param("to", "2026-10-01"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/insights/releases").param("from", "2026-01-01").param("to", "2027-06-01"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/insights/releases").param("from", "2026-10-01"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void an_empty_month_is_an_empty_list_not_an_error() throws Exception {
        mockMvc.perform(get("/api/insights/releases").param("from", "1990-01-01").param("to", "1990-01-31"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entries").isArray())
                .andExpect(jsonPath("$.entries", hasSize(0)));
    }

    @Test
    void each_category_says_whether_an_universe_dates_its_releases() throws Exception {
        mockMvc.perform(get("/api/entity-types"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.code == 'MANGA')].hasReleaseSource").value(true))
                .andExpect(jsonPath("$[?(@.code == 'VIDEO_GAME')].hasReleaseSource").value(true))
                // BoardGameGeek only dates to the year: nothing automatic, only the detail page.
                .andExpect(jsonPath("$[?(@.code == 'BOARD_GAME')].hasReleaseSource").value(false));
    }

    @Test
    void the_latest_come_newest_first_with_no_period_to_give() throws Exception {
        String title = "Dans longtemps " + UUID.randomUUID();
        QuickAddService.QuickAddResult result = quickAddService.addNewEntityWithOwnership(
                EntityTypeFixtures.BOARD_GAME.id(), title, OwnershipCondition.NEW, Map.of("releaseDate", "2099-06-15"));
        followedWorkRepository.save(FollowedWork.follow(result.entityId(), LocalDate.now()));

        // Far beyond the one-year bound of the calendar, and still first.
        mockMvc.perform(get("/api/insights/releases/latest").param("limit", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entries[0].entityId").value(result.entityId().toString()))
                .andExpect(jsonPath("$.entries[0].date").value("2099-06-15"))
                .andExpect(jsonPath("$.entries[0].precision").value("DAY"))
                .andExpect(jsonPath("$.entries[0].entityTitle").value(title));

        mockMvc.perform(get("/api/insights/releases/latest"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entries[0].entityId").value(result.entityId().toString()));
    }

    @Test
    void the_latest_refuse_a_limit_outside_one_to_fifty() throws Exception {
        mockMvc.perform(get("/api/insights/releases/latest").param("limit", "0")).andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/insights/releases/latest").param("limit", "51")).andExpect(status().isBadRequest());
    }

    @Test
    void the_refresh_status_says_whether_a_launch_is_possible_and_when_it_last_ran() throws Exception {
        mockMvc.perform(get("/api/insights/releases/refresh"))
                .andExpect(status().isOk())
                // The manga universe can refresh its dates; nothing runs from a test.
                .andExpect(jsonPath("$.available").value(true))
                .andExpect(jsonPath("$.running").value(false));
    }

    @Test
    void an_owned_work_nobody_follows_is_in_the_calendar_as_owned() throws Exception {
        QuickAddService.QuickAddResult result = quickAddService.addNewEntityWithOwnership(
                EntityTypeFixtures.BOARD_GAME.id(), "Pas suivi " + UUID.randomUUID(), OwnershipCondition.NEW,
                Map.of("releaseDate", "2026-10-20"));

        mockMvc.perform(get("/api/insights/releases").param("from", "2026-10-01").param("to", "2026-10-31"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entries[?(@.entityId == '" + result.entityId() + "')].relation").value("OWNED"));
    }

    @Test
    void a_wanted_work_nobody_follows_is_in_the_calendar_as_wanted() throws Exception {
        QuickAddService.QuickAddResult result = quickAddService.addNewEntityWithOwnership(
                EntityTypeFixtures.BOARD_GAME.id(), "Voulu " + UUID.randomUUID(), OwnershipCondition.NEW,
                Map.of("releaseDate", "2026-10-21"));
        // Not owned any more, only wanted: the possession goes, the wish stays.
        ownershipRepository.findByEntityId(result.entityId()).forEach(o -> ownershipRepository.deleteById(o.id()));
        wishlistEntryRepository.save(WishlistEntry.add(result.entityId(), LocalDate.now()));

        mockMvc.perform(get("/api/insights/releases").param("from", "2026-10-01").param("to", "2026-10-31"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entries[?(@.entityId == '" + result.entityId() + "')].relation").value("WANTED"));
    }

    @Test
    void a_work_that_is_neither_followed_owned_nor_wanted_stays_out_of_the_calendar() throws Exception {
        QuickAddService.QuickAddResult owned = quickAddService.addNewEntityWithOwnership(
                EntityTypeFixtures.BOARD_GAME.id(), "Rendu " + UUID.randomUUID(), OwnershipCondition.NEW,
                Map.of("releaseDate", "2026-10-22"));
        ownershipRepository.findByEntityId(owned.entityId()).forEach(o -> ownershipRepository.deleteById(o.id()));

        mockMvc.perform(get("/api/insights/releases").param("from", "2026-10-01").param("to", "2026-10-31"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entries[?(@.entityId == '" + owned.entityId() + "')]").doesNotExist());
    }
}
