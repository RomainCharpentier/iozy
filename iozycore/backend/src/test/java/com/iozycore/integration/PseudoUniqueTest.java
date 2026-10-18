package com.iozycore.integration;

import com.iozycore.core.domain.user.AppUser;
import com.iozycore.core.domain.user.AppUserRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * <b>Two people cannot have the same username, and it is the DATABASE that
 * guarantees it.</b>
 *
 * <p>{@code AuthService} already checks that a username is free before writing -
 * but for the <b>sentence</b>: "Ce pseudo est déjà pris" can be read, an
 * index violation cannot. This check, alone, lets two simultaneous
 * creations through: each reads "free", then each writes.
 *
 * <p>The unique index of migration V27 is what makes the duplicate
 * <b>impossible</b>, and not only unlikely. It is set on
 * {@code lower(pseudo)}: two accounts also cannot differ by
 * case only - "Romain" and "romain" are the same person for any
 * human reader.
 */
class PseudoUniqueTest extends PostgresIntegrationTest {

    @Autowired
    private AppUserRepository comptes;

    @Autowired
    private EntityManager entityManager;

    @Test
    void la_base_refuse_deux_pseudos_identiques_a_la_casse_pres() {
        String pseudo = "kenshin" + UUID.randomUUID().toString().substring(0, 8);
        comptes.save(new AppUser(UUID.randomUUID(), "un-" + pseudo + "@example.com", "hache", pseudo, false, null));
        entityManager.flush();

        comptes.save(new AppUser(UUID.randomUUID(), "deux-" + pseudo + "@example.com", "hache",
                pseudo.toUpperCase(), false, null));

        // The flush is explicit: without it, the write would wait for the end of the
        // transaction and the failure would fall outside the test, where nobody
        // links it anymore to what it checks.
        assertThatThrownBy(entityManager::flush).isInstanceOf(Exception.class);
    }

    @Test
    void le_pseudo_se_relit_par_sa_forme_normalisee() {
        String pseudo = "Rémi" + UUID.randomUUID().toString().substring(0, 8);
        comptes.save(new AppUser(UUID.randomUUID(), pseudo + "@example.com", "hache", pseudo, false, null));
        entityManager.flush();

        // Searching "RÉMI..." must find "Rémi...": this reading
        // is what lets the door explain a refusal instead of just enforcing it.
        assertThat(comptes.findByPseudo(pseudo.toUpperCase())).isPresent();
    }
}
