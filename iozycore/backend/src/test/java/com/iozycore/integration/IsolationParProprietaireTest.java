package com.iozycore.integration;

import com.iozycore.core.domain.follow.FollowedWork;
import com.iozycore.core.domain.follow.FollowedWorkRepository;

import com.iozycore.core.application.auth.AppUserDetailsService;
import com.iozycore.core.application.auth.Invite;
import com.iozycore.core.application.auth.Visite;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.experience.Experience;
import com.iozycore.core.domain.experience.ExperienceRepository;
import com.iozycore.manga.domain.followededition.FollowedEdition;
import com.iozycore.manga.domain.followededition.FollowedEditionRepository;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.core.api.share.PublicShareController;
import com.iozycore.core.domain.share.ShareSettings;
import com.iozycore.core.domain.share.ShareSettingsRepository;
import com.iozycore.core.domain.shared.DefaultOwner;
import com.iozycore.core.domain.tierlist.EntityRank;
import com.iozycore.core.domain.tierlist.EntityRankRepository;
import com.iozycore.core.domain.tierlist.Rank;
import com.iozycore.core.domain.tierlist.TierList;
import com.iozycore.core.domain.tierlist.TierListRepository;
import com.iozycore.core.domain.wishlist.WishlistEntry;
import com.iozycore.core.domain.wishlist.WishlistEntryRepository;
import com.iozycore.core.infrastructure.multitenance.AuNomDe;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * <b>Everyone in their own place.</b>
 *
 * <p>This is the test that gives its meaning to all of the authentication: a door
 * that lets several people into the same room protects nothing. And
 * the leak it hunts looks like nothing - no error, no broken screen,
 * just the collection of someone else shown as one's own.
 *
 * <h2>What is private, and what is not</h2>
 * Each private aggregate is checked <b>separately</b>, because the
 * partitioning is set column by column: forgetting one breaks nothing
 * elsewhere. The <b>catalogue</b>, on the other hand, is deliberately shared - a work is
 * the same for everyone - and this test states it too, otherwise a
 * reading that is too strict would pass for an improvement.
 *
 * <h2>Two accounts, two sessions</h2>
 * We do not simulate the partitioning: we set a real session, as the security
 * filter does, and we read with the same repositories as the application.
 *
 * <h2>And a third case: the visit, which is nobody</h2>
 * A <b>visit</b> does not name any owner. So it must see the
 * catalogue - shared, and that is the whole point - and <b>no</b> ownership,
 * wish or rating of anyone. This is the border this file guards,
 * seen from outside the accounts.
 */
// Outside a transaction, unlike all the other integration tests.
// Hibernate reads the owner when a session is OPENED: in a
// single transaction, changing account on the way changes nothing,
// and the test would think it is partitioned when it is not. Each call
// therefore opens its own session, like two requests from two people.
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class IsolationParProprietaireTest extends PostgresIntegrationTest {

    /** The first account: the one that took over the original collection. */
    private static final UUID ALICE = DefaultOwner.ID;
    private static final UUID BOB = UUID.randomUUID();

    @Autowired private OwnershipRepository ownerships;
    @Autowired private WishlistEntryRepository envies;
    @Autowired private ExperienceRepository experiences;
    @Autowired private EntityRankRepository classements;
    @Autowired private TierListRepository tierLists;
    @Autowired private FollowedEditionRepository editionsSuivies;
    @Autowired private FollowedWorkRepository oeuvresSuivies;
    @Autowired private EntityRepository catalogue;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ShareSettingsRepository partages;
    @Autowired private PublicShareController partagePublic;

    /** What this test created, to be erased: nothing will be rolled back for it. */
    private final List<UUID> oeuvresCreees = new ArrayList<>();

    @AfterEach
    void nettoyerEtRefermerLaSession() {
        for (UUID oeuvre : oeuvresCreees) {
            for (String table : List.of("ownership", "experience", "wishlist_entry", "entity_rank",
                    "followed_edition", "followed_work", "tier_list_item")) {
                jdbc.update("DELETE FROM " + table + " WHERE entity_id = ?", oeuvre);
            }
            jdbc.update("DELETE FROM entity WHERE id = ?", oeuvre);
        }
        jdbc.update("DELETE FROM tier_list WHERE owner_id IN (?, ?)", ALICE, BOB);
        jdbc.update("DELETE FROM share_settings WHERE owner_id IN (?, ?)", ALICE, BOB);
        oeuvresCreees.clear();
        SecurityContextHolder.clearContext();
    }

    /** Opens a session, as the security filter does on a real request. */
    private void connecte(UUID compte) {
        AppUserDetailsService.Principal principal =
                new AppUserDetailsService.Principal(compte, compte + "@example.com", "{noop}x", "Compte", false);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, List.of()));
    }


    /** A work in the catalogue - shared, so created once for both. */
    private Entity oeuvre(String titre) {
        Entity oeuvre = catalogue.save(Entity.create(EntityTypeFixtures.MANGA.id(), titre + " " + UUID.randomUUID()));
        oeuvresCreees.add(oeuvre.id());
        return oeuvre;
    }

    @Test
    void une_possession_n_appartient_qu_a_celui_qui_l_a_saisie() {
        Entity serie = oeuvre("Berserk");

        connecte(ALICE);
        Ownership possession = ownerships.save(
                Ownership.acquire(serie.id(), null, OwnershipCondition.NEW, LocalDate.now(), null));

        connecte(BOB);
        assertThat(ownerships.findByEntityId(serie.id())).isEmpty();
        assertThat(ownerships.findAll()).noneMatch(o -> o.id().equals(possession.id()));
        // Even knowing the exact identifier: this is the case that matters, a
        // leak rarely happens through the complete list.
        assertThat(ownerships.findById(possession.id())).isEmpty();

        connecte(ALICE);
        assertThat(ownerships.findById(possession.id())).isPresent();
    }


    @Test
    void un_visiteur_voit_le_catalogue_et_aucune_possession() {
        Entity serie = oeuvre("Pluto");
        connecte(ALICE);
        Ownership chezAlice = ownerships.save(
                Ownership.acquire(serie.id(), null, OwnershipCondition.NEW, LocalDate.now(), null));

        // A visit session names NO owner: so it falls back
        // to "nobody", who owns nothing. This is exactly what we
        // want to show it - the works, which are shared, and not what
        // someone owns.
        visite();

        assertThat(catalogue.findById(serie.id())).isPresent();
        assertThat(ownerships.findById(chezAlice.id())).isEmpty();
        assertThat(ownerships.findAll()).isEmpty();
    }

    /** Opens a VISIT session, as {@code /api/auth/visite} does. */
    private void visite() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(new Invite(), null, Visite.AUTORITES));
    }

    @Test
    void une_envie_reste_a_celui_qui_la_veut() {
        Entity serie = oeuvre("Vagabond");

        connecte(ALICE);
        envies.save(WishlistEntry.add(serie.id(), LocalDate.now()));

        connecte(BOB);
        assertThat(envies.findAll()).noneMatch(e -> e.entityId().equals(serie.id()));
        assertThat(envies.findByEntityId(serie.id())).isEmpty();
    }

    @Test
    void une_experience_ne_se_lit_pas_d_un_compte_a_l_autre() {
        Entity serie = oeuvre("Pluto");

        connecte(ALICE);
        experiences.save(Experience.record_(serie.id(), null, "READ", LocalDate.now(), 5, "excellent"));

        connecte(BOB);
        assertThat(experiences.findByEntityId(serie.id())).isEmpty();
    }

    @Test
    void un_classement_general_est_personnel() {
        Entity serie = oeuvre("Blame");

        connecte(ALICE);
        classements.save(EntityRank.assign(serie.id(), Rank.S));

        connecte(BOB);
        assertThat(classements.findByEntityId(serie.id())).isEmpty();
        assertThat(classements.findByEntityIds(Set.of(serie.id()))).isEmpty();
    }

    @Test
    void une_tier_list_ne_se_voit_pas_depuis_un_autre_compte() {
        connecte(ALICE);
        TierList liste = tierLists.save(TierList.create("Mes préférés", EntityTypeFixtures.MANGA.id(), Set.of(Rank.S, Rank.A), null));

        connecte(BOB);
        assertThat(tierLists.findById(liste.id())).isEmpty();
        assertThat(tierLists.findAllUniversesLists()).noneMatch(l -> l.id().equals(liste.id()));
    }

    @Test
    void l_edition_suivie_d_une_serie_est_celle_de_chacun() {
        Entity serie = oeuvre("Naruto");

        connecte(ALICE);
        editionsSuivies.save(FollowedEdition.create(serie.id(), "Kana"));

        connecte(BOB);
        assertThat(editionsSuivies.findByEntityId(serie.id())).isEmpty();
        // And Bob can follow ANOTHER edition of the same series without hitting
        // the uniqueness constraint, which is on (series, owner).
        editionsSuivies.save(FollowedEdition.create(serie.id(), "Hachette"));
        assertThat(editionsSuivies.findByEntityId(serie.id()))
                .hasValueSatisfying(suivie -> assertThat(suivie.editionName()).isEqualTo("Hachette"));

        connecte(ALICE);
        assertThat(editionsSuivies.findByEntityId(serie.id()))
                .hasValueSatisfying(suivie -> assertThat(suivie.editionName()).isEqualTo("Kana"));
    }

    @Test
    void le_catalogue_lui_reste_partage() {
        // The opposite of the rest, and this is deliberate: a work is the same for
        // everyone. Without this check, a partitioning that is too wide would
        // pass for an improvement.
        connecte(ALICE);
        Entity serie = oeuvre("Monster");

        connecte(BOB);
        assertThat(catalogue.findById(serie.id())).isPresent();
    }

    @Test
    void lire_au_nom_d_un_autre_est_possible_mais_doit_se_dire() {
        Entity serie = oeuvre("Gantz");
        connecte(ALICE);
        ownerships.save(Ownership.acquire(serie.id(), null, OwnershipCondition.NEW, LocalDate.now(), null));

        connecte(BOB);
        assertThat(ownerships.findByEntityId(serie.id())).isEmpty();

        // The mechanism of the share link: explicit, limited, and restored when
        // leaving the block.
        List<Ownership> vueDAlice = AuNomDe.executer(ALICE, () -> ownerships.findByEntityId(serie.id()));
        assertThat(vueDAlice).hasSize(1);

        assertThat(ownerships.findByEntityId(serie.id())).isEmpty();
    }

    @Test
    void un_lien_de_partage_montre_la_collection_de_SON_proprietaire() {
        // The only path where a read crosses the border, and so the only one
        // that can break it: the recipient has no session, and what
        // they must see belongs to someone else.
        Entity serieDAlice = oeuvre("Akira");
        Entity serieDeBob = oeuvre("Dorohedoro");

        connecte(ALICE);
        ownerships.save(Ownership.acquire(serieDAlice.id(), null, OwnershipCondition.NEW, LocalDate.now(), null));

        connecte(BOB);
        ownerships.save(Ownership.acquire(serieDeBob.id(), null, OwnershipCondition.NEW, LocalDate.now(), null));
        ShareSettings lienDeBob = partages.save(ShareSettings.withNewToken(BOB));

        // Nobody anymore: exactly the situation of the link recipient.
        SecurityContextHolder.clearContext();
        var espace = partagePublic.shared(lienDeBob.token());

        List<String> titresVus = espace.collection().stream()
                .flatMap(univers -> univers.items().stream())
                .map(item -> item.title())
                .toList();
        assertThat(titresVus).contains(serieDeBob.title());
        assertThat(titresVus).doesNotContain(serieDAlice.title());
    }

    // ------------------------------------------------------------------
    // Erase: the half that matters most
    // ------------------------------------------------------------------
    //
    // A read that crosses the border shows what it should not;
    // a WRITE that crosses it DESTROYS what belongs to someone else, and
    // without leaving a trace. Each deletion is therefore tried from the
    // wrong account, knowing the exact identifiers - the case where a
    // forgotten filter is the least visible and costs the most.

    @Test
    void personne_ne_supprime_la_possession_d_un_autre() {
        Entity serie = oeuvre("Hellsing");
        connecte(ALICE);
        Ownership possession = ownerships.save(
                Ownership.acquire(serie.id(), null, OwnershipCondition.NEW, LocalDate.now(), null));

        connecte(BOB);
        ownerships.deleteById(possession.id());

        connecte(ALICE);
        assertThat(ownerships.findById(possession.id())).isPresent();
    }

    @Test
    void personne_ne_supprime_l_envie_d_un_autre() {
        Entity serie = oeuvre("Berserk maximum");
        connecte(ALICE);
        WishlistEntry envie = envies.save(WishlistEntry.add(serie.id(), LocalDate.now()));

        connecte(BOB);
        envies.deleteById(envie.id());

        connecte(ALICE);
        assertThat(envies.findByEntityId(serie.id())).isPresent();
    }

    @Test
    void personne_ne_supprime_l_experience_d_un_autre() {
        Entity serie = oeuvre("Homunculus");
        connecte(ALICE);
        Experience lecture = experiences.save(
                Experience.record_(serie.id(), null, "READ", LocalDate.now(), 4, null));

        connecte(BOB);
        experiences.deleteById(lecture.id());

        connecte(ALICE);
        assertThat(experiences.findByEntityId(serie.id())).hasSize(1);
    }

    @Test
    void personne_ne_supprime_la_tier_list_d_un_autre() {
        connecte(ALICE);
        TierList liste = tierLists.save(
                TierList.create("À relire", EntityTypeFixtures.MANGA.id(), Set.of(Rank.S), null));

        connecte(BOB);
        tierLists.deleteById(liste.id());

        connecte(ALICE);
        assertThat(tierLists.findById(liste.id())).isPresent();
    }

    @Test
    void personne_ne_deconstruit_le_classement_ni_l_edition_suivie_d_un_autre() {
        Entity serie = oeuvre("Vinland Saga");
        connecte(ALICE);
        classements.save(EntityRank.assign(serie.id(), Rank.A));
        editionsSuivies.save(FollowedEdition.create(serie.id(), "Kurokawa"));

        connecte(BOB);
        classements.deleteByEntityId(serie.id());
        editionsSuivies.deleteByEntityId(serie.id());

        connecte(ALICE);
        assertThat(classements.findByEntityId(serie.id())).isPresent();
        assertThat(editionsSuivies.findByEntityId(serie.id())).isPresent();
    }

    @Test
    void une_oeuvre_suivie_n_appartient_qu_a_celui_qui_la_suit() {
        Entity serie = oeuvre("Frieren");
        connecte(ALICE);
        oeuvresSuivies.save(FollowedWork.follow(serie.id(), LocalDate.now()));

        connecte(BOB);
        assertThat(oeuvresSuivies.findByEntityId(serie.id())).isEmpty();
        assertThat(oeuvresSuivies.findAll()).noneMatch(w -> w.entityId().equals(serie.id()));
        // Bob "no longer follows" with no effect on Alice: the removal goes through a partitioned read.
        oeuvresSuivies.deleteByEntityId(serie.id());

        connecte(ALICE);
        assertThat(oeuvresSuivies.findByEntityId(serie.id())).isPresent();
    }
}
