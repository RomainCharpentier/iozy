package com.iozycore.integration;

import com.iozycore.core.application.QuickAddService;
import com.iozycore.core.application.admin.GestionDesComptes;
import com.iozycore.core.application.auth.AppUserDetailsService;
import com.iozycore.core.application.calendar.CalendarSubscriptionService;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.shared.DefaultOwner;
import com.iozycore.core.domain.user.AppUser;
import com.iozycore.core.domain.user.AppUserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * <b>A calendar link shows the releases of its owner, and of nobody else - to an
 * app that has no session.</b>
 * <p>
 * Outside a transaction, like {@code SuppressionDeCompteTest}: Hibernate reads the
 * owner when a session is opened, so a feed read on behalf of another owner
 * needs a session of its own - exactly as in production. The requests go out
 * WITHOUT any account, as an agenda app sends them. The test cleans up by itself.
 */
@AutoConfigureMockMvc
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class CalendarFeedIsolationTest extends PostgresIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private QuickAddService quickAddService;
    @Autowired private CalendarSubscriptionService subscriptions;
    @Autowired private GestionDesComptes gestion;
    @Autowired private AppUserRepository comptes;
    @Autowired private JdbcTemplate jdbc;

    private final List<UUID> works = new ArrayList<>();
    private final List<UUID> accounts = new ArrayList<>();

    @AfterEach
    void cleanUp() {
        for (UUID work : works) {
            jdbc.update("DELETE FROM ownership WHERE entity_id = ?", work);
            jdbc.update("DELETE FROM entity WHERE id = ?", work);
        }
        for (UUID account : accounts) {
            jdbc.update("DELETE FROM calendar_subscription WHERE owner_id = ?", account);
            jdbc.update("DELETE FROM app_user WHERE id = ?", account);
        }
        works.clear();
        accounts.clear();
        SecurityContextHolder.clearContext();
    }

    private AppUser account(String name) {
        AppUser created = comptes.save(AppUser.nouveau(name + UUID.randomUUID() + "@example.com", "hash",
                name + UUID.randomUUID().toString().substring(0, 6)));
        accounts.add(created.id());
        return created;
    }

    private void signIn(UUID account) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new AppUserDetailsService.Principal(account, account + "@example.com", "{noop}x", "Compte", false),
                null, List.of()));
    }

    /** A work owned by the signed-in account, dated by hand in twenty days. */
    private String datedWork() {
        String title = "Cascadia " + UUID.randomUUID();
        works.add(quickAddService.addNewEntityWithOwnership(EntityTypeFixtures.BOARD_GAME.id(), title,
                OwnershipCondition.NEW, Map.of("releaseDate", LocalDate.now().plusDays(20).toString())).entityId());
        return title;
    }

    private String feed(String token) throws Exception {
        return mockMvc.perform(get("/api/public/calendar/{token}.ics", token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString().replace("\r\n ", "");
    }

    @Test
    void each_link_shows_the_releases_of_its_owner_only_and_needs_no_session() throws Exception {
        AppUser alice = account("alice");
        AppUser bob = account("bob");

        signIn(alice.id());
        String aliceWork = datedWork();
        String aliceToken = subscriptions.subscribe().token();

        signIn(bob.id());
        String bobWork = datedWork();
        String bobToken = subscriptions.subscribe().token();
        assertThat(bobToken).isNotEqualTo(aliceToken);

        // The agenda app: no account at all.
        SecurityContextHolder.clearContext();

        assertThat(feed(aliceToken)).contains(aliceWork).doesNotContain(bobWork);
        assertThat(feed(bobToken)).contains(bobWork).doesNotContain(aliceWork);
    }

    @Test
    void revoking_only_touches_the_link_of_the_account_that_revokes() throws Exception {
        AppUser alice = account("alice");
        AppUser bob = account("bob");
        signIn(alice.id());
        String aliceToken = subscriptions.subscribe().token();
        signIn(bob.id());
        String bobToken = subscriptions.subscribe().token();

        subscriptions.revoke();
        SecurityContextHolder.clearContext();

        mockMvc.perform(get("/api/public/calendar/{token}.ics", bobToken)).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/public/calendar/{token}.ics", aliceToken)).andExpect(status().isOk());
    }

    @Test
    void the_link_goes_with_a_deleted_account() {
        AppUser bob = account("bob");
        signIn(bob.id());
        subscriptions.subscribe();

        signIn(DefaultOwner.ID);
        gestion.supprimer(bob.id(), DefaultOwner.ID);

        Long rows = jdbc.queryForObject("SELECT count(*) FROM calendar_subscription WHERE owner_id = ?", Long.class,
                bob.id());
        assertThat(rows).isZero();
    }
}
