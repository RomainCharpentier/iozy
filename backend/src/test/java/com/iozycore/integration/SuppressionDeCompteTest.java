package com.iozycore.integration;

import com.iozycore.core.application.admin.DonneesParProprietaire;
import com.iozycore.core.application.admin.GestionDesComptes;
import com.iozycore.core.application.auth.AppUserDetailsService;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.core.domain.shared.DefaultOwner;
import com.iozycore.core.domain.user.AppUser;
import com.iozycore.core.domain.user.AppUserRepository;
import com.iozycore.core.domain.wishlist.WishlistEntry;
import com.iozycore.core.domain.wishlist.WishlistEntryRepository;
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
 * <b>Deleting an account erases everything that belongs to it - and NOTHING else.</b>
 *
 * <p>This is the most destructive action of the application, and the only one that no
 * undo can recover. Two ways to get it wrong, opposite and both
 * silent:
 * <ul>
 *   <li><b>too little</b>: a table forgotten in the list, and ownerships
 *       survive their owner - belonging to an identifier that nobody
 *       carries anymore, so invisible forever, and counted in
 *       the statistics of nobody;</li>
 *   <li><b>too much</b>: the catalogue is SHARED. Deleting the works of an
 *       account would remove them from the collection of the others - a series
 *       disappearing from the home of someone who asked for nothing.</li>
 * </ul>
 *
 * <p>Outside a transaction, like {@code IsolationParProprietaireTest}: Hibernate
 * reads the owner when a session is OPENED, so writing in the name of
 * someone else requires a session of its own. Nothing will be rolled back for this test,
 * which therefore cleans up by itself.
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

    /** Opens a session, as the security filter does on a real request. */
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

        // What the administration announces BEFORE deleting: it is on this
        // number that someone decides.
        DonneesParProprietaire.Volume avant = donnees.compter().get(bob.id());
        assertThat(avant.possessions()).isEqualTo(1);
        assertThat(avant.envies()).isEqualTo(1);

        connecte(DefaultOwner.ID);
        gestion.supprimer(bob.id(), DefaultOwner.ID);

        // --- Too little: nothing must survive its owner
        assertThat(lignesDe("ownership", bob.id())).isZero();
        assertThat(lignesDe("wishlist_entry", bob.id())).isZero();
        assertThat(comptes.findById(bob.id())).isEmpty();
        assertThat(donnees.compter()).doesNotContainKey(bob.id());

        // --- Too much: the work is SHARED, it did not belong to Bob
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
        // The same work, the same table, a neighbour row: this is exactly where
        // a DELETE that is too wide can be seen - and nowhere else.
        assertThat(lignesDe("ownership", claire.id())).isEqualTo(1);
        assertThat(comptes.findById(claire.id())).isPresent();
    }
}
