package com.iozycore.integration;

import com.iozycore.application.admin.DonneesParProprietaire;
import com.iozycore.application.admin.GestionDesComptes;
import com.iozycore.application.auth.AppUserDetailsService;
import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityTypeFixtures;
import com.iozycore.domain.ownership.Ownership;
import com.iozycore.domain.ownership.OwnershipCondition;
import com.iozycore.domain.ownership.OwnershipRepository;
import com.iozycore.domain.shared.DefaultOwner;
import com.iozycore.domain.user.AppUser;
import com.iozycore.domain.user.AppUserRepository;
import com.iozycore.domain.wishlist.WishlistEntry;
import com.iozycore.domain.wishlist.WishlistEntryRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import com.iozycore.manga.deals.Volume;

/**
 * <b>Supprimer un compte efface tout ce qui lui appartient — et RIEN d'autre.</b>
 *
 * <p>C'est le geste le plus destructeur de l'application, et le seul qu'aucune
 * annulation ne rattrape. Deux façons de le rater, opposées et toutes deux
 * silencieuses :
 * <ul>
 *   <li><b>trop peu</b> : une table oubliée dans la liste, et des possessions
 *       survivent à leur propriétaire — appartenant à un identifiant que plus
 *       personne ne porte, donc invisibles pour toujours, et comptées dans les
 *       statistiques de personne ;</li>
 *   <li><b>trop</b> : le catalogue est PARTAGÉ. Supprimer les œuvres d'un
 *       compte les retirerait de la collection des autres — une série
 *       disparaissant de chez quelqu'un qui n'a rien demandé.</li>
 * </ul>
 *
 * <p>Hors transaction, comme {@code IsolationParProprietaireTest} : Hibernate
 * lit le propriétaire à l'OUVERTURE d'une session, donc écrire au nom de
 * quelqu'un d'autre exige une session à soi. Rien ne sera annulé pour ce test,
 * qui nettoie donc lui-même.
 */
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class SuppressionDeCompteTest extends PostgresIntegrationTest {

    @Autowired private GestionDesComptes gestion;
    @Autowired private DonneesParProprietaire donnees;
    @Autowired private AppUserRepository comptes;
    @Autowired private OwnershipRepository possessions;
    @Autowired private WishlistEntryRepository envies;
    @Autowired private EntityRepository catalogue;
    @Autowired private JdbcTemplate jdbc;

    private final List<UUID> oeuvresCreees = new ArrayList<>();
    private final List<UUID> comptesCrees = new ArrayList<>();

    @AfterEach
    void nettoyer() {
        for (UUID oeuvre : oeuvresCreees) {
            for (String table : List.of("ownership", "wishlist_entry")) {
                jdbc.update("DELETE FROM " + table + " WHERE entity_id = ?", oeuvre);
            }
            jdbc.update("DELETE FROM entity WHERE id = ?", oeuvre);
        }
        for (UUID compte : comptesCrees) {
            jdbc.update("DELETE FROM app_user WHERE id = ?", compte);
        }
        oeuvresCreees.clear();
        comptesCrees.clear();
        SecurityContextHolder.clearContext();
    }

    /** Ouvre une session, comme le filtre de sécurité sur une vraie requête. */
    private void connecte(UUID compte) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new AppUserDetailsService.Principal(compte, compte + "@example.com", "{noop}x", "Compte", false),
                null, List.of()));
    }

    private AppUser compte(String pseudo) {
        AppUser cree = comptes.save(AppUser.nouveau(
                pseudo + UUID.randomUUID() + "@example.com", "hache", pseudo + UUID.randomUUID().toString().substring(0, 6)));
        comptesCrees.add(cree.id());
        return cree;
    }

    private long lignesDe(String table, UUID proprietaire) {
        Long compte = jdbc.queryForObject("SELECT count(*) FROM " + table + " WHERE owner_id = ?", Long.class,
                proprietaire);
        return compte == null ? 0 : compte;
    }

    @Test
    void tout_ce_qui_appartient_au_compte_disparait_et_le_catalogue_reste() {
        AppUser bob = compte("bob");
        Entity serie = catalogue.save(Entity.create(EntityTypeFixtures.MANGA.id(), "Akira " + UUID.randomUUID()));
        oeuvresCreees.add(serie.id());

        connecte(bob.id());
        possessions.save(Ownership.acquire(serie.id(), null, OwnershipCondition.NEW, LocalDate.now(), null));
        envies.save(WishlistEntry.add(serie.id(), LocalDate.now()));

        // Ce que l'administration annonce AVANT de supprimer : c'est sur ce
        // nombre-là que quelqu'un décide.
        DonneesParProprietaire.Volume avant = donnees.compter().get(bob.id());
        assertThat(avant.possessions()).isEqualTo(1);
        assertThat(avant.envies()).isEqualTo(1);

        connecte(DefaultOwner.ID);
        gestion.supprimer(bob.id(), DefaultOwner.ID);

        // --- Trop peu : rien ne doit survivre à son propriétaire
        assertThat(lignesDe("ownership", bob.id())).isZero();
        assertThat(lignesDe("wishlist_entry", bob.id())).isZero();
        assertThat(comptes.findById(bob.id())).isEmpty();
        assertThat(donnees.compter()).doesNotContainKey(bob.id());

        // --- Trop : l'œuvre est PARTAGÉE, elle n'appartenait pas à Bob
        assertThat(catalogue.findById(serie.id())).isPresent();
    }

    @Test
    void supprimer_un_compte_ne_touche_a_rien_de_ce_qui_appartient_a_un_autre() {
        AppUser bob = compte("bob");
        AppUser claire = compte("claire");
        Entity serie = catalogue.save(Entity.create(EntityTypeFixtures.MANGA.id(), "Pluto " + UUID.randomUUID()));
        oeuvresCreees.add(serie.id());

        connecte(bob.id());
        possessions.save(Ownership.acquire(serie.id(), null, OwnershipCondition.NEW, LocalDate.now(), null));
        connecte(claire.id());
        possessions.save(Ownership.acquire(serie.id(), null, OwnershipCondition.NEW, LocalDate.now(), null));

        connecte(DefaultOwner.ID);
        gestion.supprimer(bob.id(), DefaultOwner.ID);

        assertThat(lignesDe("ownership", bob.id())).isZero();
        // La même œuvre, la même table, un voisin de ligne : c'est exactement là
        // qu'un DELETE trop large se voit - et nulle part ailleurs.
        assertThat(lignesDe("ownership", claire.id())).isEqualTo(1);
        assertThat(comptes.findById(claire.id())).isPresent();
    }
}
