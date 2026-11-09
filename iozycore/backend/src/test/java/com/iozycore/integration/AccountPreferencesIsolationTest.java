package com.iozycore.integration;

import com.iozycore.core.application.auth.AccountProfile;
import com.iozycore.core.application.auth.AppUserDetailsService;
import com.iozycore.core.domain.user.AccountPreferences;
import com.iozycore.core.domain.user.AccountPreferences.Accent;
import com.iozycore.core.domain.user.AccountPreferences.Appearance;
import com.iozycore.core.domain.user.AccountPreferences.BlindtestSound;
import com.iozycore.core.domain.user.AccountPreferencesRepository;
import com.iozycore.core.domain.user.AppUser;
import com.iozycore.core.domain.user.AppUserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The preferences of one account are nobody else's (lot 218): another
 * account reads none of them, sets its own, and a change touches only its
 * own row.
 *
 * <p>Outside a transaction, like {@link PurchaseBudgetIsolationTest}:
 * Hibernate reads the owner when a session opens, so each call is its own
 * request.
 */
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class AccountPreferencesIsolationTest extends PostgresIntegrationTest {

    @Autowired private AccountProfile profile;
    @Autowired private AccountPreferencesRepository preferences;
    @Autowired private AppUserRepository accounts;
    @Autowired private JdbcTemplate jdbc;

    private UUID alice;
    private UUID bob;

    @BeforeEach
    void twoAccounts() {
        alice = accounts.save(AppUser.nouveau("alice-" + UUID.randomUUID() + "@example.com", "{noop}x",
                "alice" + UUID.randomUUID().toString().substring(0, 8))).id();
        bob = accounts.save(AppUser.nouveau("bob-" + UUID.randomUUID() + "@example.com", "{noop}x",
                "bob" + UUID.randomUUID().toString().substring(0, 8))).id();
    }

    @AfterEach
    void cleanUp() {
        jdbc.update("DELETE FROM account_preferences WHERE owner_id IN (?, ?)", alice, bob);
        jdbc.update("DELETE FROM app_user WHERE id IN (?, ?)", alice, bob);
        SecurityContextHolder.clearContext();
    }

    private void signIn(UUID account) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new AppUserDetailsService.Principal(account, account + "@example.com", "{noop}x", "Compte", false),
                null, List.of()));
    }

    @Test
    void another_account_reads_none_of_the_preferences_and_keeps_its_own() {
        signIn(alice);
        profile.update(alice, null, new AccountPreferences(Accent.TERRACOTTA, Appearance.LIGHT, null,
                new BlindtestSound(false, 10)));

        signIn(bob);
        assertThat(profile.preferences()).isEqualTo(AccountPreferences.NONE);
        profile.update(bob, null, new AccountPreferences(Accent.AUTO, null, null, null));
        assertThat(profile.preferences().accent()).isEqualTo(Accent.AUTO);

        signIn(alice);
        AccountPreferences hers = profile.preferences();
        assertThat(hers.accent()).isEqualTo(Accent.TERRACOTTA);
        assertThat(hers.appearance()).isEqualTo(Appearance.LIGHT);
        assertThat(hers.blindtestSound()).isEqualTo(new BlindtestSound(false, 10));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM account_preferences WHERE owner_id = ?", Long.class,
                alice)).isEqualTo(1L);
    }

    @Test
    void two_first_saves_at_once_leave_one_row() {
        signIn(bob);
        // Two apps that both read nothing: each saves a whole new set.
        preferences.save(new AccountPreferences(Accent.AUTO, null, null, null));
        preferences.save(new AccountPreferences(null, Appearance.DARK, null, null));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM account_preferences WHERE owner_id = ?", Long.class,
                bob)).isEqualTo(1L);
        assertThat(profile.preferences().appearance()).isEqualTo(Appearance.DARK);
    }

    @Test
    void a_new_pseudo_is_written_on_the_account_itself() {
        signIn(bob);
        String pseudo = "neo" + UUID.randomUUID().toString().substring(0, 8);
        profile.update(bob, pseudo, null);

        assertThat(accounts.findById(bob).orElseThrow().pseudo()).isEqualTo(pseudo);
        assertThat(accounts.findById(alice).orElseThrow().pseudo()).isNotEqualTo(pseudo);
    }
}
