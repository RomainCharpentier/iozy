package com.iozycore.integration;

import com.iozycore.api.dto.WishlistDtos.AddToWishlistRequest;
import com.iozycore.api.dto.WishlistDtos.WishlistEntryResponse;
import com.iozycore.api.wishlist.WishlistController;
import com.iozycore.application.QuickAddService;
import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityTypeFixtures;
import com.iozycore.domain.catalog.Variant;
import com.iozycore.domain.ownership.OwnershipCondition;
import com.iozycore.domain.ownership.OwnershipRepository;
import com.iozycore.domain.wishlist.WishlistEntry;
import com.iozycore.domain.wishlist.WishlistEntryRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
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
class WishlistWithoutOwnershipIntegrationTest extends PostgresIntegrationTest {

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

        wishlistController.add(new AddToWishlistRequest(entityId, null, null, null, null, null, null));

        assertThat(wishlistEntryRepository.findByEntityId(entityId)).isPresent();
        assertThat(possessionsDe(entityId)).isZero();
    }

    @Test
    void une_oeuvre_externe_inconnue_entre_au_catalogue_sans_aucune_possession() {
        String titre = unTitre();
        assertThat(entityRepository.findByTypeAndTitle(MANGA, titre)).isEmpty();

        WishlistEntryResponse creee = wishlistController.add(
                new AddToWishlistRequest(null, null, null, null, MANGA, titre, Map.of("coverImageUrl", "https://exemple/jaquette.jpg")));

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

        WishlistEntryResponse premiere = wishlistController.add(new AddToWishlistRequest(null, null, null, null, MANGA, titre, null));
        // Deuxième passage avec des espaces autour : c'est le même titre, la
        // normalisation est celle du reste de l'app.
        WishlistEntryResponse seconde = wishlistController.add(
                new AddToWishlistRequest(null, null, null, null, MANGA, "  " + titre + "  ", null));

        assertThat(seconde.entityId()).isEqualTo(premiere.entityId());
        assertThat(seconde.id()).isEqualTo(premiere.id());
        assertThat(fichesIntitulees(titre)).hasSize(1);
    }

    @Test
    void acheter_ensuite_l_oeuvre_reutilise_sa_fiche_et_referme_l_envie() {
        String titre = unTitre();
        WishlistEntryResponse envie = wishlistController.add(new AddToWishlistRequest(null, null, null, null, MANGA, titre, null));

        // Le parcours normal d'ajout à la collection, plus tard, sur la même œuvre.
        var resultat = quickAddService.addNewEntityWithOwnership(MANGA, titre, OwnershipCondition.NEW);

        assertThat(resultat.entityId()).isEqualTo(envie.entityId());
        assertThat(fichesIntitulees(titre)).hasSize(1);
        assertThat(possessionsDe(envie.entityId())).isEqualTo(1);
        // L'envie se referme à l'acquisition (décision utilisateur du
        // 2026-08-26, après un audit où « Death Note » et « Naruto »
        // s'affichaient à la fois « Possédé » et « Dans vos envies »). Ce test
        // consignait auparavant le comportement inverse - il constatait l'état
        // des lieux, il ne protégeait pas une règle.
        assertThat(wishlistEntryRepository.findByEntityId(envie.entityId())).isEmpty();
    }

    @Test
    void retirer_puis_reajouter_une_oeuvre_externe_laisse_sa_fiche_intacte() {
        String titre = unTitre();
        WishlistEntryResponse creee = wishlistController.add(new AddToWishlistRequest(null, null, null, null, MANGA, titre, null));
        UUID entityId = creee.entityId();

        wishlistController.remove(creee.id());
        assertThat(wishlistEntryRepository.findByEntityId(entityId)).isEmpty();
        // Retirer une envie ne supprime pas la fiche : c'est ce qui permet à
        // l'action « Annuler » de réajouter par identité interne.
        assertThat(entityRepository.findById(entityId)).isPresent();

        WishlistEntryResponse reajoutee = wishlistController.add(new AddToWishlistRequest(entityId, null, null, null, null, null, null));

        assertThat(reajoutee.entityId()).isEqualTo(entityId);
        assertThat(possessionsDe(entityId)).isZero();
    }

    @Test
    void une_requete_sans_identite_exploitable_est_refusee_sans_rien_creer() {
        int fichesAvant = entityRepository.findAllByType(MANGA).size();

        assertThatThrownBy(() -> wishlistController.add(new AddToWishlistRequest(null, null, null, null, null, null, null)))
                .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> wishlistController.add(new AddToWishlistRequest(null, null, null, null, MANGA, "   ", null)))
                .isInstanceOf(ResponseStatusException.class);
        // Un type de collection inexistant est refusé en 400, pas en 500 par la
        // contrainte de clé étrangère (même règle qu'un entityId inconnu).
        assertThatThrownBy(() -> wishlistController.add(new AddToWishlistRequest(null, null, null, null, UUID.randomUUID(), "Berserk", null)))
                .isInstanceOf(ResponseStatusException.class);

        assertThat(entityRepository.findAllByType(MANGA)).hasSize(fichesAvant);
    }

    @Test
    void vouloir_un_tome_non_encore_catalogue_le_fait_exister_sans_possession() {
        String titre = unTitre();
        UUID entityId = entityRepository.save(Entity.create(MANGA, titre)).id();

        // Le cas NORMAL depuis une fiche : le tome 7 n'est catalogué nulle part,
        // il n'est que déduit du total de l'édition (voir TomeResolver).
        WishlistEntryResponse envie = wishlistController.add(
                new AddToWishlistRequest(entityId, null, 7, "Perfect Edition", null, null, null));

        assertThat(envie.variantId()).isNotNull();
        Entity oeuvre = entityRepository.findById(entityId).orElseThrow();
        assertThat(oeuvre.variants()).extracting(Variant::label).containsExactly("Tome 7 — Perfect Edition");
        // La moitié qui compte : le catalogue a grossi, la collection non.
        assertThat(possessionsDe(entityId)).isZero();
    }

    @Test
    void vouloir_deux_fois_le_meme_tome_ne_cree_ni_deux_envies_ni_deux_tomes() {
        String titre = unTitre();
        UUID entityId = entityRepository.save(Entity.create(MANGA, titre)).id();

        WishlistEntryResponse premiere = wishlistController.add(
                new AddToWishlistRequest(entityId, null, 7, "Perfect Edition", null, null, null));
        WishlistEntryResponse seconde = wishlistController.add(
                new AddToWishlistRequest(entityId, null, 7, "Perfect Edition", null, null, null));

        assertThat(seconde.id()).isEqualTo(premiere.id());
        assertThat(entityRepository.findById(entityId).orElseThrow().variants()).hasSize(1);
    }

    @Test
    void deux_tomes_de_la_meme_serie_sont_deux_envies_distinctes() {
        String titre = unTitre();
        UUID entityId = entityRepository.save(Entity.create(MANGA, titre)).id();

        WishlistEntryResponse tome3 = wishlistController.add(
                new AddToWishlistRequest(entityId, null, 3, "Perfect Edition", null, null, null));
        WishlistEntryResponse tome7 = wishlistController.add(
                new AddToWishlistRequest(entityId, null, 7, "Perfect Edition", null, null, null));

        assertThat(tome7.id()).isNotEqualTo(tome3.id());
        assertThat(wishlistEntryRepository.findAllByEntityId(entityId)).hasSize(2);
        // L'ŒUVRE elle-même n'est pas voulue : ce sont deux tomes qui le sont.
        // Confondre les deux ferait dire « déjà voulue » à toute la série.
        assertThat(wishlistEntryRepository.findByEntityId(entityId)).isEmpty();
    }

    @Test
    void acheter_un_tome_voulu_ne_referme_que_cette_envie_la() {
        String titre = unTitre();
        UUID entityId = entityRepository.save(Entity.create(MANGA, titre)).id();
        WishlistEntryResponse tome3 = wishlistController.add(
                new AddToWishlistRequest(entityId, null, 3, "Perfect Edition", null, null, null));
        WishlistEntryResponse tome7 = wishlistController.add(
                new AddToWishlistRequest(entityId, null, 7, "Perfect Edition", null, null, null));

        quickAddService.addNewEntityWithOwnership(
                MANGA, titre, OwnershipCondition.NEW, Map.of(), 3, "Perfect Edition");

        // Le tome acheté retombe sur le MÊME Variant que celui créé par l'envie
        // (même libellé, même résolveur) - sans quoi l'envie ne se refermerait
        // jamais et la série resterait à la fois voulue et possédée.
        assertThat(entityRepository.findById(entityId).orElseThrow().variants()).hasSize(2);
        assertThat(wishlistEntryRepository.findAllByEntityId(entityId))
                .extracting(WishlistEntry::id)
                .containsExactly(tome7.id());
        assertThat(tome3.variantId()).isNotNull();
    }

    @Test
    void vouloir_un_tome_deja_possede_est_refuse() {
        String titre = unTitre();
        var achat = quickAddService.addNewEntityWithOwnership(
                MANGA, titre, OwnershipCondition.NEW, Map.of(), 1, "Perfect Edition");

        // « Je le veux » et « je l'ai » sont deux états du même objet, jamais deux
        // états superposés : la règle tient côté serveur, pas seulement dans l'UI.
        assertThatThrownBy(() -> wishlistController.add(
                new AddToWishlistRequest(achat.entityId(), achat.variantId(), null, null, null, null, null)))
                .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> wishlistController.add(
                new AddToWishlistRequest(achat.entityId(), null, 1, "Perfect Edition", null, null, null)))
                .isInstanceOf(ResponseStatusException.class);

        assertThat(wishlistEntryRepository.findAllByEntityId(achat.entityId())).isEmpty();
    }

    @Test
    void un_tome_appartenant_a_une_autre_oeuvre_est_refuse() {
        UUID uneOeuvre = entityRepository.save(Entity.create(MANGA, unTitre())).id();
        UUID uneAutre = entityRepository.save(Entity.create(MANGA, unTitre())).id();
        UUID tomeDeLAutre = wishlistController
                .add(new AddToWishlistRequest(uneAutre, null, 2, "Perfect Edition", null, null, null))
                .variantId();

        assertThatThrownBy(() -> wishlistController.add(
                new AddToWishlistRequest(uneOeuvre, tomeDeLAutre, null, null, null, null, null)))
                .isInstanceOf(ResponseStatusException.class);

        assertThat(wishlistEntryRepository.findAllByEntityId(uneOeuvre)).isEmpty();
    }
}
