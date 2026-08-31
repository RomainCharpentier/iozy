package com.iozycore.integration;

import com.iozycore.api.dto.ShareDtos.ShareResponse;
import com.iozycore.api.dto.ShareDtos.SharedSpaceResponse;
import com.iozycore.api.dto.ShareDtos.UpdateShareRequest;
import com.iozycore.api.share.PublicShareController;
import com.iozycore.api.share.ShareController;
import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityTypeFixtures;
import com.iozycore.domain.ownership.Ownership;
import com.iozycore.domain.ownership.OwnershipCondition;
import com.iozycore.domain.ownership.OwnershipRepository;
import com.iozycore.domain.wishlist.WishlistEntry;
import com.iozycore.domain.wishlist.WishlistEntryRepository;
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
 * Le partage d'espace de bout en bout : <b>un lien, des sections au choix</b>.
 * <p>
 * Il y avait deux systèmes parallèles, chacun avec son jeton, son contrôleur
 * public et sa page - deux URL pour regarder le même espace personnel. Ces
 * tests décrivent le système unifié, et surtout ses refus : ce qu'un porteur
 * de lien ne doit PAS recevoir.
 * <p>
 * Le test le plus important est {@link #aucune_donnee_privee_ne_sort_jamais()} :
 * il sérialise la réponse publique et cherche les données privées dedans, plutôt
 * que de se contenter de vérifier les champs visibles. Un client qui masquerait
 * à l'affichage ne serait pas une barrière de confidentialité - le backend en
 * est une.
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

    /** Celui de l'application, pas un mapper nu : on veut voir EXACTEMENT ce
     * que le réseau transporte. */
    @Autowired
    private ObjectMapper objectMapper;

    private static final UUID MANGA = EntityTypeFixtures.MANGA.id();

    private UUID uneOeuvre(String prefixe) {
        return entityRepository.save(Entity.create(MANGA, prefixe + " " + UUID.randomUUID())).id();
    }

    /** Une œuvre possédée : elle appartient à la collection. */
    private UUID unePossession(String prefixe) {
        UUID entityId = uneOeuvre(prefixe);
        ownershipRepository.save(Ownership.acquire(entityId, null, OwnershipCondition.NEW, LocalDate.now(), null));
        return entityId;
    }

    /** Une envie SANS possession : le cas normal d'une œuvre qu'on souhaite. */
    private UUID uneEnvie(String prefixe) {
        UUID entityId = uneOeuvre(prefixe);
        wishlistEntryRepository.save(WishlistEntry.add(entityId, LocalDate.now()));
        return entityId;
    }

    private String unLien() {
        return shareController.generate().token();
    }

    // ------------------------------------------------------- Sections au choix

    @Test
    void un_lien_neuf_expose_les_deux_sections() {
        unePossession("Naruto");
        uneEnvie("Berserk");

        SharedSpaceResponse partage = publicShareController.shared(unLien());

        assertThat(partage.collection()).isNotNull();
        assertThat(partage.wishlist()).isNotNull();
        // Les classements restent exclus tant qu'ils n'ont pas été demandés.
        assertThat(partage.tierLists()).isNull();
    }

    @Test
    void collection_seule_rend_les_envies_totalement_inaccessibles() {
        unePossession("Naruto");
        uneEnvie("Berserk");
        String token = unLien();
        shareController.update(new UpdateShareRequest(true, false, null));

        SharedSpaceResponse partage = publicShareController.shared(token);

        assertThat(partage.collection()).isNotEmpty();
        // null, pas une liste vide : la section n'est pas calculée, elle
        // n'existe pas dans la réponse. Rien à masquer côté client.
        assertThat(partage.wishlist()).isNull();
    }

    @Test
    void envies_seules_rendent_la_collection_totalement_inaccessible() {
        unePossession("Naruto");
        uneEnvie("Berserk");
        String token = unLien();
        shareController.update(new UpdateShareRequest(false, true, null));

        SharedSpaceResponse partage = publicShareController.shared(token);

        assertThat(partage.wishlist()).isNotEmpty();
        assertThat(partage.collection()).isNull();
        // Les classements suivent la collection : sans elle, ils ne sortent pas.
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
                .isInstanceOf(ResponseStatusException.class);
    }

    // ------------------------------------------------- Un seul espace partagé

    @Test
    void entrer_par_la_collection_ou_par_les_envies_donne_le_meme_lien() {
        String depuisUnEcran = unLien();

        // Le raccourci de l'autre écran lit le MÊME partage : c'est tout
        // l'objet de l'unification, deux entrées ne créent pas deux jetons.
        assertThat(shareController.current().token()).isEqualTo(depuisUnEcran);
    }

    @Test
    void une_oeuvre_a_la_fois_possedee_et_souhaitee_apparait_dans_les_deux_sections() {
        UUID entityId = unePossession("Vinland Saga");
        wishlistEntryRepository.save(WishlistEntry.add(entityId, LocalDate.now()));
        String titre = entityRepository.findById(entityId).orElseThrow().title();

        SharedSpaceResponse partage = publicShareController.shared(unLien());

        // Posséder un tome et vouloir la suite sont deux intentions
        // différentes : on ne déduplique pas entre les sections.
        assertThat(partage.collection()).anySatisfy(universe ->
                assertThat(universe.items()).anySatisfy(item -> assertThat(item.title()).isEqualTo(titre)));
        assertThat(partage.wishlist()).anySatisfy(item -> assertThat(item.title()).isEqualTo(titre));
    }

    @Test
    void une_envie_sans_aucune_possession_apparait_bien_dans_le_partage() {
        UUID entityId = uneEnvie("Monster");
        String titre = entityRepository.findById(entityId).orElseThrow().title();
        assertThat(ownershipRepository.findAll()).noneMatch(o -> o.entityId().equals(entityId));

        SharedSpaceResponse partage = publicShareController.shared(unLien());

        // Vouloir n'est pas posséder : supposer qu'une envie a un exemplaire
        // ferait disparaître le cas le plus courant.
        assertThat(partage.wishlist()).anySatisfy(item -> assertThat(item.title()).isEqualTo(titre));
    }

    @Test
    void une_oeuvre_seulement_cataloguee_n_apparait_pas_dans_la_collection() {
        UUID entityId = uneOeuvre("Ashita no Joe");
        String titre = entityRepository.findById(entityId).orElseThrow().title();

        SharedSpaceResponse partage = publicShareController.shared(unLien());

        // La collection montre ce qu'on POSSÈDE, jamais le simple catalogue.
        assertThat(partage.collection()).allSatisfy(universe ->
                assertThat(universe.items()).noneSatisfy(item -> assertThat(item.title()).isEqualTo(titre)));
    }

    @Test
    void le_partage_reflete_l_etat_courant_sans_rien_regenerer() {
        String token = unLien();
        assertThat(publicShareController.shared(token).wishlist()).isEmpty();

        UUID entityId = uneEnvie("Pluto");
        String titre = entityRepository.findById(entityId).orElseThrow().title();

        // Vue vivante, pas photographie : le lien déjà distribué montre la
        // suite sans qu'il y ait quoi que ce soit à refaire.
        assertThat(publicShareController.shared(token).wishlist())
                .anySatisfy(item -> assertThat(item.title()).isEqualTo(titre));
    }

    // --------------------------------------------------- Révocation et jetons

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

        // La colonne token vaut null après révocation : sans garde, un appel
        // sans jeton « matcherait » cette ligne et rouvrirait le partage.
        assertThatThrownBy(() -> publicShareController.shared(""))
                .isInstanceOf(ResponseStatusException.class);
    }

    // -------------------------------------------------------- Confidentialité

    @Test
    void aucune_donnee_privee_ne_sort_jamais() throws Exception {
        UUID entityId = uneOeuvre("Death Note");
        // Des données franchement privées, attachées à cette possession.
        Ownership possession = Ownership.acquire(entityId, null, OwnershipCondition.NEW,
                LocalDate.of(2024, 3, 14), null);
        possession.updateNote("Cadeau de ma soeur, ne jamais revendre");
        possession.updatePurchasePrice(new BigDecimal("249.99"));
        ownershipRepository.save(possession);
        wishlistEntryRepository.save(WishlistEntry.add(entityId, LocalDate.now()));

        String json = objectMapper.writeValueAsString(publicShareController.shared(unLien()));

        // On cherche les données privées DANS LA RÉPONSE SÉRIALISÉE, pas dans
        // les champs qu'on a pensé à regarder : c'est ce que verrait quelqu'un
        // qui inspecte le réseau.
        assertThat(json)
                .doesNotContain("249.99")                              // prix payé
                .doesNotContain("Cadeau de ma soeur")                  // note personnelle
                .doesNotContain("2024-03-14")                          // date d'acquisition
                .doesNotContain(entityId.toString())                   // identifiant interne
                .doesNotContain("purchasePrice")
                .doesNotContain("acquiredAt")
                .doesNotContain("entityId")
                .doesNotContain("ownership");
        // Et pourtant l'œuvre est bien là, sous son titre.
        assertThat(json).contains(entityRepository.findById(entityId).orElseThrow().title());
    }
}
