package com.iozycore.integration;

import com.iozycore.core.api.dto.ShareDtos.ShareResponse;
import com.iozycore.core.application.share.SharedSpace;
import com.iozycore.core.api.dto.ShareDtos.UpdateShareRequest;
import com.iozycore.core.api.share.PublicShareController;
import com.iozycore.core.api.share.ShareController;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.core.domain.wishlist.WishlistEntry;
import com.iozycore.core.domain.wishlist.WishlistEntryRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Space sharing end to end: <b>one link, sections of your choice</b>.
 * <p>
 * There were two parallel systems, each with its token, its public controller
 * and its page - two URLs to look at the same personal space. These
 * tests describe the unified system, and above all its refusals: what a link
 * holder must NOT receive.
 * <p>
 * The most important test is {@link #aucune_donnee_privee_ne_sort_jamais()}:
 * it serialises the public response and looks for the private data inside, rather
 * than just checking the visible fields. A client that hides things
 * on display would not be a confidentiality barrier - the backend
 * is one.
 */
class SharedSpaceIntegrationTest extends PostgresIntegrationTest {

    @Autowired
    private ShareController shareController;

    @Autowired
    private PublicShareController publicShareController;

    @Autowired
    private EntityRepository entityRepository;

    @Autowired
    private OwnershipRepository ownershipRepository;

    @Autowired
    private WishlistEntryRepository wishlistEntryRepository;

    /** The one of the application, not a bare mapper: we want to see EXACTLY what
     * the network carries. */
    @Autowired
    private ObjectMapper objectMapper;

    private static final UUID MANGA = EntityTypeFixtures.MANGA.id();

    private UUID uneOeuvre(String prefixe) {
        return entityRepository.save(Entity.create(MANGA, prefixe + " " + UUID.randomUUID())).id();
    }

    /** An owned work: it belongs to the collection. */
    private UUID unePossession(String prefixe) {
        UUID entityId = uneOeuvre(prefixe);
        ownershipRepository.save(Ownership.acquire(entityId, null, OwnershipCondition.NEW, LocalDate.now(), null));
        return entityId;
    }

    /** A wish WITHOUT ownership: the normal case of a work that one wants. */
    private UUID uneEnvie(String prefixe) {
        UUID entityId = uneOeuvre(prefixe);
        wishlistEntryRepository.save(WishlistEntry.add(entityId, LocalDate.now()));
        return entityId;
    }

    private String unLien() {
        return shareController.generate().token();
    }

    // ------------------------------------------------------- Chosen sections

    @Test
    void un_lien_neuf_expose_les_deux_sections() {
        unePossession("Naruto");
        uneEnvie("Berserk");

        SharedSpace partage = publicShareController.shared(unLien());

        assertThat(partage.collection()).isNotNull();
        assertThat(partage.wishlist()).isNotNull();
        // The rankings stay excluded as long as they have not been requested.
        assertThat(partage.tierLists()).isNull();
    }

    @Test
    void collection_seule_rend_les_envies_totalement_inaccessibles() {
        unePossession("Naruto");
        uneEnvie("Berserk");
        String token = unLien();
        shareController.update(new UpdateShareRequest(true, false, null));

        SharedSpace partage = publicShareController.shared(token);

        assertThat(partage.collection()).isNotEmpty();
        // null, not an empty list: the section is not computed, it
        // does not exist in the response. Nothing to hide on the client side.
        assertThat(partage.wishlist()).isNull();
    }

    @Test
    void envies_seules_rendent_la_collection_totalement_inaccessible() {
        unePossession("Naruto");
        uneEnvie("Berserk");
        String token = unLien();
        shareController.update(new UpdateShareRequest(false, true, null));

        SharedSpace partage = publicShareController.shared(token);

        assertThat(partage.wishlist()).isNotEmpty();
        assertThat(partage.collection()).isNull();
        // The rankings follow the collection: without it, they do not come out.
        assertThat(partage.tierLists()).isNull();
    }

    @Test
    void changer_les_sections_ne_change_pas_le_lien_deja_envoye() {
        unePossession("Naruto");
        uneEnvie("Berserk");
        String token = unLien();

        ShareResponse apres = shareController.update(new UpdateShareRequest(false, true, null));

        assertThat(apres.token()).isEqualTo(token);
        assertThat(publicShareController.shared(token).wishlist()).isNotNull();
    }

    @Test
    void tout_decocher_est_refuse_plutot_que_de_laisser_un_lien_vers_le_vide() {
        unLien();

        assertThatThrownBy(() -> shareController.update(new UpdateShareRequest(false, false, null)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // ------------------------------------------------- One single shared space

    @Test
    void entrer_par_la_collection_ou_par_les_envies_donne_le_meme_lien() {
        String depuisUnEcran = unLien();

        // The shortcut of the other screen reads the SAME share: this is the whole
        // point of the unification, two entries do not create two tokens.
        assertThat(shareController.current().token()).isEqualTo(depuisUnEcran);
    }

    @Test
    void une_oeuvre_a_la_fois_possedee_et_souhaitee_apparait_dans_les_deux_sections() {
        UUID entityId = unePossession("Vinland Saga");
        wishlistEntryRepository.save(WishlistEntry.add(entityId, LocalDate.now()));
        String titre = entityRepository.findById(entityId).orElseThrow().title();

        SharedSpace partage = publicShareController.shared(unLien());

        // Owning a volume and wanting the next one are two different
        // intentions: we do not deduplicate between the sections.
        assertThat(partage.collection()).anySatisfy(universe ->
                assertThat(universe.items()).anySatisfy(item -> assertThat(item.title()).isEqualTo(titre)));
        assertThat(partage.wishlist()).anySatisfy(item -> assertThat(item.title()).isEqualTo(titre));
    }

    @Test
    void une_envie_sans_aucune_possession_apparait_bien_dans_le_partage() {
        UUID entityId = uneEnvie("Monster");
        String titre = entityRepository.findById(entityId).orElseThrow().title();
        assertThat(ownershipRepository.findAll()).noneMatch(o -> o.entityId().equals(entityId));

        SharedSpace partage = publicShareController.shared(unLien());

        // Wanting is not owning: assuming that a wish has a copy
        // would make the most common case disappear.
        assertThat(partage.wishlist()).anySatisfy(item -> assertThat(item.title()).isEqualTo(titre));
    }

    @Test
    void une_oeuvre_seulement_cataloguee_n_apparait_pas_dans_la_collection() {
        UUID entityId = uneOeuvre("Ashita no Joe");
        String titre = entityRepository.findById(entityId).orElseThrow().title();

        SharedSpace partage = publicShareController.shared(unLien());

        // The collection shows what one OWNS, never the simple catalogue.
        assertThat(partage.collection()).allSatisfy(universe ->
                assertThat(universe.items()).noneSatisfy(item -> assertThat(item.title()).isEqualTo(titre)));
    }

    @Test
    void le_partage_reflete_l_etat_courant_sans_rien_regenerer() {
        String token = unLien();
        assertThat(publicShareController.shared(token).wishlist()).isEmpty();

        UUID entityId = uneEnvie("Pluto");
        String titre = entityRepository.findById(entityId).orElseThrow().title();

        // Live view, not a photograph: the link already given shows the
        // next volumes without anything to redo.
        assertThat(publicShareController.shared(token).wishlist())
                .anySatisfy(item -> assertThat(item.title()).isEqualTo(titre));
    }

    // --------------------------------------------------- Revocation and tokens

    @Test
    void desactiver_le_partage_rend_l_ancien_lien_inutilisable() {
        unePossession("Naruto");
        String token = unLien();
        assertThat(publicShareController.shared(token)).isNotNull();

        shareController.remove();

        assertThatThrownBy(() -> publicShareController.shared(token))
                .isInstanceOf(ResponseStatusException.class);
        assertThat(shareController.current().token()).isNull();
    }

    @Test
    void regenerer_invalide_immediatement_l_ancien_jeton() {
        unePossession("Naruto");
        String ancien = unLien();

        String nouveau = shareController.generate().token();

        assertThat(nouveau).isNotEqualTo(ancien);
        assertThatThrownBy(() -> publicShareController.shared(ancien))
                .isInstanceOf(ResponseStatusException.class);
        assertThat(publicShareController.shared(nouveau)).isNotNull();
    }

    @Test
    void un_jeton_inconnu_vide_ou_absent_ne_rend_aucune_donnee() {
        unePossession("Naruto");
        unLien();

        for (String jeton : new String[] {UUID.randomUUID().toString(), "", "   ", "null"}) {
            assertThatThrownBy(() -> publicShareController.shared(jeton))
                    .as(jeton)
                    .isInstanceOf(ResponseStatusException.class);
        }
    }

    @Test
    void un_jeton_vide_ne_retombe_jamais_sur_la_ligne_d_un_lien_supprime() {
        unePossession("Naruto");
        shareController.remove();

        // The token column is null after revocation: without a guard, a call
        // without a token would "match" this row and reopen the sharing.
        assertThatThrownBy(() -> publicShareController.shared(""))
                .isInstanceOf(ResponseStatusException.class);
    }

    // -------------------------------------------------------- Confidentiality

    @Test
    void aucune_donnee_privee_ne_sort_jamais() throws Exception {
        UUID entityId = uneOeuvre("Death Note");
        // Clearly private data, attached to this ownership.
        Ownership possession = Ownership.acquire(entityId, null, OwnershipCondition.NEW,
                LocalDate.of(2024, 3, 14), null);
        possession.updateNote("Cadeau de ma soeur, ne jamais revendre");
        possession.updatePurchasePrice(new BigDecimal("249.99"));
        ownershipRepository.save(possession);
        wishlistEntryRepository.save(WishlistEntry.add(entityId, LocalDate.now()));

        String json = objectMapper.writeValueAsString(publicShareController.shared(unLien()));

        // We look for the private data IN THE SERIALISED RESPONSE, not in
        // the fields we thought of checking: this is what someone who
        // inspects the network would see.
        assertThat(json)
                .doesNotContain("249.99")                              // paid price
                .doesNotContain("Cadeau de ma soeur")                  // personal note
                .doesNotContain("2024-03-14")                          // acquisition date
                .doesNotContain(entityId.toString())                   // internal identifier
                .doesNotContain("purchasePrice")
                .doesNotContain("acquiredAt")
                .doesNotContain("entityId")
                .doesNotContain("ownership");
        // And yet the work is there, under its title.
        assertThat(json).contains(entityRepository.findById(entityId).orElseThrow().title());
    }
}
