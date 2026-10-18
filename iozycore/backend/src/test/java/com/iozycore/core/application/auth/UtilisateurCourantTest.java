package com.iozycore.core.application.auth;

import com.iozycore.core.domain.shared.DefaultOwner;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * <b>Not knowing who writes must show NOTHING, never the collection of the
 * first account.</b>
 *
 * <p>This is the rule that makes the separation safe: everything else relies
 * on it. A fallback to {@link DefaultOwner#ID} - the identifier carried by the
 * original collection - would turn every oversight into a silent leak,
 * while a fallback to "nobody" turns the same oversight into an empty screen,
 * that is, into a visible defect.
 *
 * <p>The integration tests deliberately replace this fallback (see
 * {@code ComptePourLesTests}): this file is therefore the only place where the
 * production rule is checked as it is.
 */
class UtilisateurCourantTest {

    private final UtilisateurCourant utilisateurCourant = new UtilisateurCourant();

    @AfterEach
    void refermer() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void sans_session_le_proprietaire_est_personne() {
        assertThat(utilisateurCourant.id()).isEmpty();
        assertThat(utilisateurCourant.proprietaire()).isEqualTo(DefaultOwner.PERSONNE);
        assertThat(utilisateurCourant.proprietaire()).isNotEqualTo(DefaultOwner.ID);
    }

    @Test
    void une_session_ouverte_donne_l_identifiant_du_compte() {
        UUID compte = UUID.randomUUID();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new AppUserDetailsService.Principal(compte, "moi@example.com", "{noop}x", "Moi", false), null, List.of()));

        assertThat(utilisateurCourant.id()).contains(compte);
        assertThat(utilisateurCourant.proprietaire()).isEqualTo(compte);
    }

    @Test
    void une_authentification_anonyme_ne_vaut_pas_un_compte() {
        // Spring sets this token when nobody is logged in: it is
        // "authenticated" in the framework's sense, and its principal is the string
        // "anonymousUser". Taking it for an account would break everything.
        SecurityContextHolder.getContext().setAuthentication(new AnonymousAuthenticationToken(
                "cle", "anonymousUser", List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS"))));

        assertThat(utilisateurCourant.id()).isEmpty();
        assertThat(utilisateurCourant.proprietaire()).isEqualTo(DefaultOwner.PERSONNE);
    }
}
