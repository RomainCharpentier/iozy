package com.iozycore.integration;

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
 * <b>Chacun chez soi.</b>
 *
 * <p>C'est le test qui donne son sens à toute l'authentification : une porte
 * qui laisse entrer plusieurs personnes dans la même pièce ne protège rien. Et
 * la fuite qu'il traque ne ressemble à rien - aucune erreur, aucun écran cassé,
 * juste la collection de quelqu'un d'autre affichée comme la sienne.
 *
 * <h2>Ce qui est privé, et ce qui ne l'est pas</h2>
 * Chaque agrégat privé est vérifié <b>séparément</b>, parce que le
 * cloisonnement se pose colonne par colonne : en oublier un ne casse rien
 * ailleurs. Le <b>catalogue</b>, lui, est délibérément partagé - une œuvre est
 * la même pour tout le monde - et ce test l'affirme aussi, sans quoi une
 * lecture trop stricte passerait pour une amélioration.
 *
 * <h2>Deux comptes, deux sessions</h2>
 * On ne simule pas le cloisonnement : on pose une vraie session, comme le fait
 * le filtre de sécurité, et on lit avec les mêmes dépôts que l'application.
 *
 * <h2>Et un troisième cas : la visite, qui n'est personne</h2>
 * Une <b>visite</b> ne nomme aucun propriétaire. Elle doit donc voir le
 * catalogue - partagé, et c'est tout l'intérêt - et <b>aucune</b> possession,
 * envie ou note de qui que ce soit. C'est la frontière que ce fichier borde,
 * vue depuis l'extérieur des comptes.
 */
// Hors transaction, contrairement à tous les autres tests d'intégration.
// Hibernate lit le propriétaire à l'OUVERTURE d'une session : dans une
// transaction unique, changer de compte en cours de route ne change rien,
// et le test se croirait cloisonné alors qu'il ne l'est pas. Chaque appel
// ouvre donc sa propre session, comme deux requêtes de deux personnes.
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class IsolationParProprietaireTest extends PostgresIntegrationTest {

    /** Le premier compte : celui qui a repris la collection d'origine. */
    private static final UUID ALICE = DefaultOwner.ID;
    private static final UUID BOB = UUID.randomUUID();

    @Autowired private OwnershipRepository ownerships;
    @Autowired private WishlistEntryRepository envies;
    @Autowired private ExperienceRepository experiences;
    @Autowired private EntityRankRepository classements;
    @Autowired private TierListRepository tierLists;
    @Autowired private FollowedEditionRepository editionsSuivies;
    @Autowired private EntityRepository catalogue;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ShareSettingsRepository partages;
    @Autowired private PublicShareController partagePublic;

    /** Ce que ce test a créé, à effacer : rien ne sera annulé pour lui. */
    private final List<UUID> oeuvresCreees = new ArrayList<>();

    @AfterEach
    void nettoyerEtRefermerLaSession() {
        for (UUID oeuvre : oeuvresCreees) {
            for (String table : List.of("ownership", "experience", "wishlist_entry", "entity_rank",
                    "followed_edition", "tier_list_item")) {
                jdbc.update("DELETE FROM " + table + " WHERE entity_id = ?", oeuvre);
            }
            jdbc.update("DELETE FROM entity WHERE id = ?", oeuvre);
        }
        jdbc.update("DELETE FROM tier_list WHERE owner_id IN (?, ?)", ALICE, BOB);
        jdbc.update("DELETE FROM share_settings WHERE owner_id IN (?, ?)", ALICE, BOB);
        oeuvresCreees.clear();
        SecurityContextHolder.clearContext();
    }

    /** Ouvre une session, comme le filtre de sécurité le fait sur une vraie requête. */
    private void connecte(UUID compte) {
        AppUserDetailsService.Principal principal =
                new AppUserDetailsService.Principal(compte, compte + "@example.com", "{noop}x", "Compte", false);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, List.of()));
    }


    /** Une œuvre au catalogue - partagée, donc créée une fois pour les deux. */
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
        // Même en connaissant l'identifiant exact : c'est le cas qui compte, une
        // fuite se fait rarement par la liste complète.
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

        // Une session de visite ne nomme AUCUN propriétaire : elle retombe donc
        // sur « personne », à qui rien n'appartient. C'est exactement ce qu'on
        // veut lui montrer - les œuvres, qui sont partagées, et pas ce que
        // quelqu'un en possède.
        visite();

        assertThat(catalogue.findById(serie.id())).isPresent();
        assertThat(ownerships.findById(chezAlice.id())).isEmpty();
        assertThat(ownerships.findAll()).isEmpty();
    }

    /** Ouvre une session de VISITE, comme {@code /api/auth/visite} le fait. */
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
        // Et Bob peut suivre une AUTRE édition de la même série sans se heurter
        // à la contrainte d'unicité, qui porte sur (série, propriétaire).
        editionsSuivies.save(FollowedEdition.create(serie.id(), "Hachette"));
        assertThat(editionsSuivies.findByEntityId(serie.id()))
                .hasValueSatisfying(suivie -> assertThat(suivie.editionName()).isEqualTo("Hachette"));

        connecte(ALICE);
        assertThat(editionsSuivies.findByEntityId(serie.id()))
                .hasValueSatisfying(suivie -> assertThat(suivie.editionName()).isEqualTo("Kana"));
    }

    @Test
    void le_catalogue_lui_reste_partage() {
        // L'inverse du reste, et c'est délibéré : une œuvre est la même pour
        // tout le monde. Sans cette vérification, un cloisonnement trop large
        // passerait pour une amélioration.
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

        // Le mécanisme du lien de partage : explicite, borné, et rétabli en
        // sortant du bloc.
        List<Ownership> vueDAlice = AuNomDe.executer(ALICE, () -> ownerships.findByEntityId(serie.id()));
        assertThat(vueDAlice).hasSize(1);

        assertThat(ownerships.findByEntityId(serie.id())).isEmpty();
    }

    @Test
    void un_lien_de_partage_montre_la_collection_de_SON_proprietaire() {
        // Le seul chemin où une lecture traverse la frontière, et donc le seul
        // qui puisse la percer : le destinataire n'a aucune session, et ce
        // qu'il doit voir appartient à quelqu'un d'autre.
        Entity serieDAlice = oeuvre("Akira");
        Entity serieDeBob = oeuvre("Dorohedoro");

        connecte(ALICE);
        ownerships.save(Ownership.acquire(serieDAlice.id(), null, OwnershipCondition.NEW, LocalDate.now(), null));

        connecte(BOB);
        ownerships.save(Ownership.acquire(serieDeBob.id(), null, OwnershipCondition.NEW, LocalDate.now(), null));
        ShareSettings lienDeBob = partages.save(ShareSettings.withNewToken(BOB));

        // Plus personne : exactement la situation du destinataire du lien.
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
    // Effacer : la moitié qui compte le plus
    // ------------------------------------------------------------------
    //
    // Une lecture qui traverse la frontière montre ce qu'elle ne devrait pas ;
    // une ÉCRITURE qui la traverse DÉTRUIT ce qui appartient à un autre, et
    // sans laisser de trace. Chaque suppression est donc essayée depuis le
    // mauvais compte, en connaissant les identifiants exacts - le cas où un
    // filtre oublié se voit le moins et coûte le plus.

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
}
