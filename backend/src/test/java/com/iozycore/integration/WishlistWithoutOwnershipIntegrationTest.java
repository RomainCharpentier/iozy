package com.iozycore.integration;

import com.iozycore.core.api.dto.WishlistDtos.AddToWishlistRequest;
import com.iozycore.core.api.dto.WishlistDtos.WishlistEntryResponse;
import com.iozycore.core.api.wishlist.WishlistController;
import com.iozycore.core.application.QuickAddService;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.catalog.Variant;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.core.domain.wishlist.WishlistEntry;
import com.iozycore.core.domain.wishlist.WishlistEntryRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The business point of this module: <b>wanting a work is not owning it.</b>
 * <p>
 * A work found by an external search or a scan had no way
 * to enter the wishes: the only path that made a detail page exist
 * (QuickAddService) always created an Ownership right after. These tests
 * therefore check both halves of the rule, together: the catalogue page
 * does exist, and <b>no ownership appears</b> - this last point is
 * the assertion that matters, a test that forgot it would also pass with a
 * fake ownership.
 * <p>
 * They also check that this second path does not build a parallel
 * catalogue: the same work, whatever the entry door, falls back on the
 * same Entity.
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

    /** Unique title per run: the deduplication is precisely on (type, title). */
    private String unTitre() {
        return "Vinland Saga " + UUID.randomUUID();
    }

    /** All the detail pages of this type with exactly this title - a duplicate would be seen here. */
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
        // The attributes of the external source are kept: without them, the work
        // would appear without cover in the wishes and the shared list.
        assertThat(fiche.attributes()).containsEntry("coverImageUrl", "https://exemple/jaquette.jpg");
        assertThat(wishlistEntryRepository.findByEntityId(creee.entityId())).isPresent();
        // The central assertion of the module.
        assertThat(possessionsDe(creee.entityId())).isZero();
    }

    @Test
    void la_meme_oeuvre_ajoutee_deux_fois_ne_cree_ni_deuxieme_fiche_ni_deuxieme_envie() {
        String titre = unTitre();

        WishlistEntryResponse premiere = wishlistController.add(new AddToWishlistRequest(null, null, null, null, MANGA, titre, null));
        // Second pass with spaces around: it is the same title, the
        // normalisation is the one of the rest of the app.
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

        // The normal path to add to the collection, later, on the same work.
        var resultat = quickAddService.addNewEntityWithOwnership(MANGA, titre, OwnershipCondition.NEW);

        assertThat(resultat.entityId()).isEqualTo(envie.entityId());
        assertThat(fichesIntitulees(titre)).hasSize(1);
        assertThat(possessionsDe(envie.entityId())).isEqualTo(1);
        // The wish closes at acquisition (user decision of
        // 2026-08-26, after an audit where "Death Note" and "Naruto"
        // were shown at the same time as "Possédé" and "Dans vos envies"). This test
        // used to record the opposite behaviour - it noted the state
        // of things, it did not protect a rule.
        assertThat(wishlistEntryRepository.findByEntityId(envie.entityId())).isEmpty();
    }

    @Test
    void retirer_puis_reajouter_une_oeuvre_externe_laisse_sa_fiche_intacte() {
        String titre = unTitre();
        WishlistEntryResponse creee = wishlistController.add(new AddToWishlistRequest(null, null, null, null, MANGA, titre, null));
        UUID entityId = creee.entityId();

        wishlistController.remove(creee.id());
        assertThat(wishlistEntryRepository.findByEntityId(entityId)).isEmpty();
        // Removing a wish does not delete the detail page: this is what lets
        // the "Annuler" action add it again by internal identity.
        assertThat(entityRepository.findById(entityId)).isPresent();

        WishlistEntryResponse reajoutee = wishlistController.add(new AddToWishlistRequest(entityId, null, null, null, null, null, null));

        assertThat(reajoutee.entityId()).isEqualTo(entityId);
        assertThat(possessionsDe(entityId)).isZero();
    }

    @Test
    void une_requete_sans_identite_exploitable_est_refusee_sans_rien_creer() {
        int fichesAvant = entityRepository.findAllByType(MANGA).size();

        assertThatThrownBy(() -> wishlistController.add(new AddToWishlistRequest(null, null, null, null, null, null, null)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> wishlistController.add(new AddToWishlistRequest(null, null, null, null, MANGA, "   ", null)))
                .isInstanceOf(IllegalArgumentException.class);
        // A non-existent collection type is refused with 400, not with 500 by the
        // foreign key constraint (same rule as an unknown entityId).
        assertThatThrownBy(() -> wishlistController.add(new AddToWishlistRequest(null, null, null, null, UUID.randomUUID(), "Berserk", null)))
                .isInstanceOf(IllegalArgumentException.class);

        assertThat(entityRepository.findAllByType(MANGA)).hasSize(fichesAvant);
    }

    @Test
    void vouloir_un_tome_non_encore_catalogue_le_fait_exister_sans_possession() {
        String titre = unTitre();
        UUID entityId = entityRepository.save(Entity.create(MANGA, titre)).id();

        // The NORMAL case from a detail page: volume 7 is catalogued nowhere,
        // it is only deduced from the total of the edition (see TomeResolver).
        WishlistEntryResponse envie = wishlistController.add(
                new AddToWishlistRequest(entityId, null, 7, "Perfect Edition", null, null, null));

        assertThat(envie.variantId()).isNotNull();
        Entity oeuvre = entityRepository.findById(entityId).orElseThrow();
        assertThat(oeuvre.variants()).extracting(Variant::label).containsExactly("Tome 7 — Perfect Edition");
        // The half that matters: the catalogue grew, the collection did not.
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
        // The WORK itself is not wanted: it is two volumes that are.
        // Mixing the two would make the whole series say "already wanted".
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

        // The bought volume falls back on the SAME Variant as the one created by the wish
        // (same label, same resolver) - otherwise the wish would never close
        // and the series would stay both wanted and owned.
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

        // "I want it" and "I have it" are two states of the same object, never two
        // overlapping states: the rule holds on the server side, not only in the UI.
        assertThatThrownBy(() -> wishlistController.add(
                new AddToWishlistRequest(achat.entityId(), achat.variantId(), null, null, null, null, null)))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> wishlistController.add(
                new AddToWishlistRequest(achat.entityId(), null, 1, "Perfect Edition", null, null, null)))
                .isInstanceOf(IllegalStateException.class);

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
                .isInstanceOf(IllegalArgumentException.class);

        assertThat(wishlistEntryRepository.findAllByEntityId(uneOeuvre)).isEmpty();
    }
}
