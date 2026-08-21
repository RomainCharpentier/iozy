package com.iozycore.integration;

import com.iozycore.api.dto.WishlistDtos.AddToWishlistRequest;
import com.iozycore.api.dto.WishlistDtos.WishlistEntryResponse;
import com.iozycore.api.wishlist.WishlistController;
import com.iozycore.application.QuickAddService;
import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityTypeFixtures;
import com.iozycore.domain.ownership.OwnershipCondition;
import com.iozycore.domain.ownership.OwnershipRepository;
import com.iozycore.domain.wishlist.WishlistEntryRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Le point métier de ce module : <b>vouloir une œuvre n'est pas la posséder.</b>
 * <p>
 * Une œuvre trouvée par une recherche externe ou un scan n'avait aucun moyen
 * d'entrer dans les envies : l'unique chemin qui faisait exister une fiche
 * (QuickAddService) créait toujours une Ownership dans la foulée. Ces tests
 * vérifient donc les deux moitiés de la règle, ensemble : la fiche catalogue
 * existe bien, et <b>aucune possession n'apparaît</b> - ce dernier point est
 * l'assertion qui compte, un test qui l'oublierait passerait aussi avec une
 * possession fictive.
 * <p>
 * Ils vérifient aussi que ce second chemin ne fabrique pas un catalogue
 * parallèle : la même œuvre, quelle que soit la porte d'entrée, retombe sur la
 * même Entity.
 */
@Testcontainers
@SpringBootTest
@Transactional
class WishlistWithoutOwnershipIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("iozycore_test")
            .withUsername("iozycore")
            .withPassword("iozycore");

    @DynamicPropertySource
    static void configureDatasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired
    private WishlistController wishlistController;

    @Autowired
    private WishlistEntryRepository wishlistEntryRepository;

    @Autowired
    private EntityRepository entityRepository;

    @Autowired
    private OwnershipRepository ownershipRepository;

    @Autowired
    private QuickAddService quickAddService;

    private static final UUID MANGA = EntityTypeFixtures.MANGA.id();

    /** Titre unique par exécution : la déduplication porte justement sur (type, titre). */
    private String unTitre() {
        return "Vinland Saga " + UUID.randomUUID();
    }

    /** Toutes les fiches de ce type portant exactement ce titre - un doublon se verrait ici. */
    private java.util.List<Entity> fichesIntitulees(String titre) {
        return entityRepository.findAllByType(MANGA).stream().filter(e -> e.title().equals(titre)).toList();
    }

    private long possessionsDe(UUID entityId) {
        return ownershipRepository.findAll().stream().filter(o -> o.entityId().equals(entityId)).count();
    }

    @Test
    void une_oeuvre_deja_fichee_mais_non_possedee_peut_etre_mise_en_envies() {
        UUID entityId = entityRepository.save(Entity.create(MANGA, unTitre())).id();
        assertThat(possessionsDe(entityId)).isZero();

        wishlistController.add(new AddToWishlistRequest(entityId, null, null, null));

        assertThat(wishlistEntryRepository.findByEntityId(entityId)).isPresent();
        assertThat(possessionsDe(entityId)).isZero();
    }

    @Test
    void une_oeuvre_externe_inconnue_entre_au_catalogue_sans_aucune_possession() {
        String titre = unTitre();
        assertThat(entityRepository.findByTypeAndTitle(MANGA, titre)).isEmpty();

        WishlistEntryResponse creee = wishlistController.add(
                new AddToWishlistRequest(null, MANGA, titre, Map.of("coverImageUrl", "https://exemple/jaquette.jpg")));

        Entity fiche = entityRepository.findById(creee.entityId()).orElseThrow();
        assertThat(fiche.title()).isEqualTo(titre);
        // Les attributs de la source externe sont conservés : sans eux, l'œuvre
        // apparaîtrait sans jaquette dans les envies et la liste partagée.
        assertThat(fiche.attributes()).containsEntry("coverImageUrl", "https://exemple/jaquette.jpg");
        assertThat(wishlistEntryRepository.findByEntityId(creee.entityId())).isPresent();
        // L'assertion centrale du module.
        assertThat(possessionsDe(creee.entityId())).isZero();
    }

    @Test
    void la_meme_oeuvre_ajoutee_deux_fois_ne_cree_ni_deuxieme_fiche_ni_deuxieme_envie() {
        String titre = unTitre();

        WishlistEntryResponse premiere = wishlistController.add(new AddToWishlistRequest(null, MANGA, titre, null));
        // Deuxième passage avec des espaces autour : c'est le même titre, la
        // normalisation est celle du reste de l'app.
        WishlistEntryResponse seconde = wishlistController.add(
                new AddToWishlistRequest(null, MANGA, "  " + titre + "  ", null));

        assertThat(seconde.entityId()).isEqualTo(premiere.entityId());
        assertThat(seconde.id()).isEqualTo(premiere.id());
        assertThat(fichesIntitulees(titre)).hasSize(1);
    }

    @Test
    void acheter_ensuite_l_oeuvre_reutilise_sa_fiche_au_lieu_d_en_creer_une_seconde() {
        String titre = unTitre();
        WishlistEntryResponse envie = wishlistController.add(new AddToWishlistRequest(null, MANGA, titre, null));

        // Le parcours normal d'ajout à la collection, plus tard, sur la même œuvre.
        var resultat = quickAddService.addNewEntityWithOwnership(MANGA, titre, OwnershipCondition.NEW);

        assertThat(resultat.entityId()).isEqualTo(envie.entityId());
        assertThat(fichesIntitulees(titre)).hasSize(1);
        // Elle est désormais possédée ET toujours en envies : rien ne retire
        // automatiquement une envie à l'achat, ce comportement est inchangé.
        assertThat(possessionsDe(envie.entityId())).isEqualTo(1);
        assertThat(wishlistEntryRepository.findByEntityId(envie.entityId())).isPresent();
    }

    @Test
    void retirer_puis_reajouter_une_oeuvre_externe_laisse_sa_fiche_intacte() {
        String titre = unTitre();
        WishlistEntryResponse creee = wishlistController.add(new AddToWishlistRequest(null, MANGA, titre, null));
        UUID entityId = creee.entityId();

        wishlistController.remove(creee.id());
        assertThat(wishlistEntryRepository.findByEntityId(entityId)).isEmpty();
        // Retirer une envie ne supprime pas la fiche : c'est ce qui permet à
        // l'action « Annuler » de réajouter par identité interne.
        assertThat(entityRepository.findById(entityId)).isPresent();

        WishlistEntryResponse reajoutee = wishlistController.add(new AddToWishlistRequest(entityId, null, null, null));

        assertThat(reajoutee.entityId()).isEqualTo(entityId);
        assertThat(possessionsDe(entityId)).isZero();
    }

    @Test
    void une_requete_sans_identite_exploitable_est_refusee_sans_rien_creer() {
        int fichesAvant = entityRepository.findAllByType(MANGA).size();

        assertThatThrownBy(() -> wishlistController.add(new AddToWishlistRequest(null, null, null, null)))
                .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> wishlistController.add(new AddToWishlistRequest(null, MANGA, "   ", null)))
                .isInstanceOf(ResponseStatusException.class);
        // Un type de collection inexistant est refusé en 400, pas en 500 par la
        // contrainte de clé étrangère (même règle qu'un entityId inconnu).
        assertThatThrownBy(() -> wishlistController.add(new AddToWishlistRequest(null, UUID.randomUUID(), "Berserk", null)))
                .isInstanceOf(ResponseStatusException.class);

        assertThat(entityRepository.findAllByType(MANGA)).hasSize(fichesAvant);
    }
}
