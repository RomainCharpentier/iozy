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
 * <b>Ne pas savoir qui écrit doit faire voir RIEN, jamais la collection du
 * premier compte.</b>
 *
 * <p>C'est la règle qui rend le cloisonnement sûr : tout le reste s'appuie
 * dessus. Un repli sur {@link DefaultOwner#ID} - l'identifiant que porte la
 * collection d'origine - transformerait chaque oubli en fuite silencieuse,
 * alors qu'un repli sur « personne » transforme le même oubli en écran vide,
 * c'est-à-dire en défaut visible.
 *
 * <p>Les tests d'intégration, eux, remplacent volontairement ce repli (voir
 * {@code ComptePourLesTests}) : ce fichier est donc le seul endroit où la
 * règle de production est vérifiée telle quelle.
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
        // Spring pose ce jeton quand personne n'est connecté : il est
        // « authentifié » au sens du framework, et son principal est la chaîne
        // « anonymousUser ». Le prendre pour un compte ferait tout basculer.
        SecurityContextHolder.getContext().setAuthentication(new AnonymousAuthenticationToken(
                "cle", "anonymousUser", List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS"))));

        assertThat(utilisateurCourant.id()).isEmpty();
        assertThat(utilisateurCourant.proprietaire()).isEqualTo(DefaultOwner.PERSONNE);
    }
}
