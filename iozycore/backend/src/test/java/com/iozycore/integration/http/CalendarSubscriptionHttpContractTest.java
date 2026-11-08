package com.iozycore.integration.http;

import com.fasterxml.jackson.databind.JsonNode;
import com.iozycore.core.application.QuickAddService;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockHttpServletResponse;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The HTTP contract of the calendar subscription (lot 215):
 * {@code /api/calendar/subscription} on the owner side, and the feed
 * {@code /api/public/calendar/{token}.ics} an agenda app reads.
 * <p>
 * What breaks silently here: a second click that draws a second link (the one
 * pasted in the agenda dies), a revoked link that keeps feeding, a feed that
 * an agenda app cannot read (wrong type, no event), and a feed read again in
 * full every time an app polls it. Isolation between owners and the anonymous
 * door are in {@code CalendarFeedIsolationTest}.
 */
class CalendarSubscriptionHttpContractTest extends HttpContractTestBase {

    @Autowired
    private QuickAddService quickAddService;

    private JsonNode subscribe() throws Exception {
        String body = mockMvc.perform(post("/api/calendar/subscription"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body);
    }

    @Test
    void subscribing_twice_gives_the_same_link() throws Exception {
        JsonNode first = subscribe();
        JsonNode second = subscribe();

        String token = first.get("token").asText();
        assertThat(token).hasSize(43).matches("[A-Za-z0-9_-]+");
        assertThat(first.get("feedPath").asText()).isEqualTo("/api/public/calendar/" + token + ".ics");
        assertThat(first.get("createdAt").isNull()).isFalse();
        assertThat(second.get("token").asText()).isEqualTo(token);
    }

    @Test
    void the_feed_is_an_icalendar_file_with_the_upcoming_releases_of_the_owner() throws Exception {
        LocalDate day = LocalDate.now().plusDays(20);
        String title = "Ark Nova " + UUID.randomUUID();
        quickAddService.addNewEntityWithOwnership(EntityTypeFixtures.BOARD_GAME.id(), title, OwnershipCondition.NEW,
                Map.of("releaseDate", day.toString()));
        String feedPath = subscribe().get("feedPath").asText();

        MockHttpServletResponse response = mockMvc.perform(get(feedPath))
                .andExpect(status().isOk())
                .andReturn().getResponse();

        assertThat(response.getContentType()).startsWith("text/calendar");
        String ics = response.getContentAsString();
        assertThat(ics).startsWith("BEGIN:VCALENDAR\r\n").contains("BEGIN:VEVENT")
                .contains("DTSTART;VALUE=DATE:" + day.toString().replace("-", ""));
        assertThat(ics.replace("\r\n ", "")).contains("SUMMARY:" + title);
        assertThat(response.getHeader("Cache-Control")).contains("max-age=3600").contains("private");
        assertThat(response.getHeader("ETag")).isNotBlank();
    }

    @Test
    void an_unchanged_feed_answers_304_to_an_app_that_already_has_it() throws Exception {
        String feedPath = subscribe().get("feedPath").asText();
        String etag = mockMvc.perform(get(feedPath)).andReturn().getResponse().getHeader("ETag");

        mockMvc.perform(get(feedPath).header("If-None-Match", etag)).andExpect(status().isNotModified());
    }

    @Test
    void a_revoked_link_answers_404_and_the_next_one_is_new() throws Exception {
        JsonNode first = subscribe();
        String feedPath = first.get("feedPath").asText();
        mockMvc.perform(get(feedPath)).andExpect(status().isOk());

        mockMvc.perform(delete("/api/calendar/subscription")).andExpect(status().isNoContent());

        mockMvc.perform(get(feedPath)).andExpect(status().isNotFound());
        assertThat(subscribe().get("token").asText()).isNotEqualTo(first.get("token").asText());
    }

    @Test
    void revoking_without_a_link_is_not_an_error() throws Exception {
        mockMvc.perform(delete("/api/calendar/subscription")).andExpect(status().isNoContent());
    }

    @Test
    void an_unknown_or_absurd_token_gets_a_bare_404() throws Exception {
        mockMvc.perform(get("/api/public/calendar/{token}.ics", "x".repeat(43))).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/public/calendar/{token}.ics", "x".repeat(300))).andExpect(status().isNotFound());
    }
}
