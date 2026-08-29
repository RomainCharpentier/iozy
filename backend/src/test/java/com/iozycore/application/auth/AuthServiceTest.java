package com.iozycore.application.auth;

import com.iozycore.domain.shared.DefaultOwner;
import com.iozycore.domain.user.AppUser;
import com.iozycore.domain.user.AppUserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * <b>Qui a le droit de créer un compte, et ce que devient la collection déjà
 * saisie.</b>
 *
 * <h2>Les deux règles qui décident de tout</h2>
 * Le <b>premier</b> compte est libre - il faut bien que quelqu'un entre - et il
 * <b>reprend l'identifiant du propriétaire par défaut</b> : les possessions,
 * envies et classements déjà en base deviennent les siens sans qu'une ligne ne
 * bouge. Les <b>suivants</b> exigent un code d'invitation, et <b>l'absence de
 * code configuré ferme la porte</b> au lieu de l'ouvrir. C'est le sens de la
 * mesure : une instance déployée sans y penser ne doit pas devenir une base
 * ouverte à qui passe.
 */
class AuthServiceTest {

    /** Une table de comptes en mémoire - ces règles n'ont rien à voir avec SQL. */
    static class ComptesEnMemoire implements AppUserRepository {
        private final Map<UUID, AppUser> parId = new HashMap<>();

        @Override
        public AppUser save(AppUser user) {
            parId.put(user.id(), user);
            return user;
        }

        @Override
        public Optional<AppUser> findByEmail(String email) {
            return parId.values().stream().filter(u -> u.email().equals(AppUser.normaliserEmail(email))).findFirst();
        }

        @Override
        public Optional<AppUser> findByPseudo(String pseudo) {
            return parId.values().stream()
                    .filter(u -> AppUser.normaliserPseudo(u.pseudo()).equals(AppUser.normaliserPseudo(pseudo)))
                    .findFirst();
        }

        @Override
        public Optional<AppUser> findById(UUID id) {
            return Optional.ofNullable(parId.get(id));
        }

        @Override
        public boolean isEmpty() {
            return parId.isEmpty();
        }
    }

    /** Un encodeur reconnaissable : ce test parle d'autorisation, pas de cryptographie. */
    private static final PasswordEncoder ENCODEUR = new PasswordEncoder() {
        @Override
        public String encode(CharSequence brut) {
            return "hache:" + brut;
        }

        @Override
        public boolean matches(CharSequence brut, String hache) {
            return hache.equals(encode(brut));
        }
    };

    private final ComptesEnMemoire comptes = new ComptesEnMemoire();

    private AuthService service(String codeInvitation) {
        return new AuthService(comptes, ENCODEUR, codeInvitation);
    }

    @Test
    void le_premier_compte_est_libre_et_reprend_la_collection_deja_en_base() {
        AppUser premier = service("").creer("Romain@Example.COM", "un-mot-de-passe", "Romain", null);

        assertThat(premier.id()).isEqualTo(DefaultOwner.ID);
        // L'adresse est rangée en minuscules : deux comptes ne peuvent pas
        // différer par la seule casse.
        assertThat(premier.email()).isEqualTo("romain@example.com");
        assertThat(premier.passwordHash()).isEqualTo("hache:un-mot-de-passe");
    }

    @Test
    void sans_code_configure_la_creation_se_ferme_apres_le_premier_compte() {
        AuthService service = service("");
        service.creer("premier@example.com", "un-mot-de-passe", "Premier", null);

        assertThat(service.creationOuverte()).isFalse();
        assertThatThrownBy(() -> service.creer("second@example.com", "un-mot-de-passe", "Second", null))
                .isInstanceOf(AuthService.CreationInterdite.class);
    }

    @Test
    void avec_un_code_configure_seul_le_bon_code_ouvre() {
        AuthService service = service("SESAME");
        service.creer("premier@example.com", "un-mot-de-passe", "Premier", null);

        assertThatThrownBy(() -> service.creer("second@example.com", "un-mot-de-passe", "Second", "sesame"))
                .isInstanceOf(AuthService.CreationInterdite.class);
        assertThatThrownBy(() -> service.creer("second@example.com", "un-mot-de-passe", "Second", null))
                .isInstanceOf(AuthService.CreationInterdite.class);

        AppUser second = service.creer("second@example.com", "un-mot-de-passe", "Second", "  SESAME ");

        // Un identifiant NEUF : le second compte arrive sur une collection vide,
        // il ne rejoint pas celle du premier.
        assertThat(second.id()).isNotEqualTo(DefaultOwner.ID);
    }

    @Test
    void deux_comptes_ne_partagent_pas_une_adresse_meme_ecrite_autrement() {
        AuthService service = service("SESAME");
        service.creer("romain@example.com", "un-mot-de-passe", "Romain", null);

        assertThatThrownBy(() -> service.creer("ROMAIN@example.com", "un-autre-passe", "Autre", "SESAME"))
                .isInstanceOf(AuthService.CreationRefusee.class)
                .hasMessageContaining("existe déjà");
    }

    @Test
    void un_mot_de_passe_trop_court_est_refuse_avec_la_raison() {
        assertThatThrownBy(() -> service("").creer("romain@example.com", "court", "Romain", null))
                .isInstanceOf(AuthService.CreationRefusee.class)
                .hasMessageContaining(String.valueOf(AuthService.LONGUEUR_MINIMALE_MOT_DE_PASSE));
    }

    @Test
    void une_adresse_qui_n_en_est_manifestement_pas_une_est_refusee() {
        AuthService service = service("");

        assertThatThrownBy(() -> service.creer("romain", "un-mot-de-passe", "Romain", null))
                .isInstanceOf(AuthService.CreationRefusee.class);
        assertThatThrownBy(() -> service.creer("romain@local", "un-mot-de-passe", "Romain", null))
                .isInstanceOf(AuthService.CreationRefusee.class);
        assertThatThrownBy(() -> service.creer("  ", "un-mot-de-passe", "Romain", null))
                .isInstanceOf(AuthService.CreationRefusee.class);
    }

    @Test
    void un_pseudo_vide_ferme_la_porte_plutot_que_de_recopier_l_adresse() {
        // Avant le pseudo, un nom laissé vide était remplacé par l'adresse
        // e-mail. L'avatar du menu affichait alors l'adresse de quelqu'un, et
        // deux comptes pouvaient porter le même nom : ce repli n'existe plus.
        assertThatThrownBy(() -> service("").creer("romain@example.com", "un-mot-de-passe", "   ", null))
                .isInstanceOf(AuthService.CreationRefusee.class)
                .hasMessageContaining("pseudo");
    }

    @Test
    void un_pseudo_mal_forme_est_refuse_avec_une_phrase_qui_dit_la_regle() {
        AuthService service = service("");

        // Trop court, une espace, une arobase, et un début qui ne se lit pas.
        for (String refuse : new String[] { "ro", "jean dupont", "romain@local", "-romain" }) {
            assertThatThrownBy(() -> service.creer("romain@example.com", "un-mot-de-passe", refuse, null))
                    .as("pseudo refusé : %s", refuse)
                    .isInstanceOf(AuthService.CreationRefusee.class)
                    .hasMessageContaining("pseudo");
        }
    }

    @Test
    void un_pseudo_accentue_est_accepte() {
        // Refuser « Rémi » dans une application française serait une règle
        // technique déguisée en règle produit.
        AppUser compte = service("").creer("remi@example.com", "un-mot-de-passe", "Rémi", null);

        assertThat(compte.pseudo()).isEqualTo("Rémi");
    }

    @Test
    void deux_comptes_ne_peuvent_pas_porter_le_meme_pseudo_a_la_casse_pres() {
        AuthService service = service("le-code");
        service.creer("premier@example.com", "un-mot-de-passe", "Romain", null);

        assertThatThrownBy(() -> service.creer("second@example.com", "un-mot-de-passe", "romain", "le-code"))
                .isInstanceOf(AuthService.CreationRefusee.class)
                .hasMessageContaining("déjà pris");
    }
}
