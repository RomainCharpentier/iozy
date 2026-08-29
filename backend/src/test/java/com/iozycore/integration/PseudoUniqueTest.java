package com.iozycore.integration;

import com.iozycore.domain.user.AppUser;
import com.iozycore.domain.user.AppUserRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * <b>Deux personnes ne peuvent pas porter le même pseudo, et c'est la BASE qui
 * le garantit.</b>
 *
 * <p>{@code AuthService} vérifie déjà qu'un pseudo est libre avant d'écrire -
 * mais pour la <b>phrase</b> : « Ce pseudo est déjà pris » se lit, une
 * violation d'index non. Cette vérification, seule, laisse passer deux
 * créations simultanées : chacune lit « libre », puis chacune écrit.
 *
 * <p>L'index unique de la migration V27 est ce qui rend le doublon
 * <b>impossible</b>, et non seulement improbable. Il est posé sur
 * {@code lower(pseudo)} : deux comptes ne peuvent pas non plus différer par la
 * seule casse - « Romain » et « romain » désignent la même personne pour tout
 * lecteur humain.
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

        // Le flush est explicite : sans lui, l'écriture attendrait la fin de la
        // transaction et l'échec tomberait hors du test, là où plus personne ne
        // le rattache à ce qu'il vérifie.
        assertThatThrownBy(entityManager::flush).isInstanceOf(Exception.class);
    }

    @Test
    void le_pseudo_se_relit_par_sa_forme_normalisee() {
        String pseudo = "Rémi" + UUID.randomUUID().toString().substring(0, 8);
        comptes.save(new AppUser(UUID.randomUUID(), pseudo + "@example.com", "hache", pseudo, false, null));
        entityManager.flush();

        // Chercher « RÉMI... » doit trouver « Rémi... » : c'est cette lecture
        // qui permet à la porte d'expliquer un refus au lieu de le subir.
        assertThat(comptes.findByPseudo(pseudo.toUpperCase())).isPresent();
    }
}
