package com.iozycore.core.listing;

import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Le garde-fou SSRF : c'est le backend qui va chercher une URL saisie par
 * quelqu'un d'autre, donc c'est ici que se referme la porte vers tout ce que le
 * serveur peut atteindre et que l'extérieur ne peut pas.
 * <p>
 * Ces tests décrivent un refus, jamais un contournement. Ils vérifient
 * notamment le cas le plus vicieux : un hôte <b>présent sur la liste blanche</b>
 * qui résout vers une adresse interne - la liste blanche seule ne suffit pas.
 */
class ListingUrlGuardTest {

    private static final Set<String> HOTES_AUTORISES = Set.of("www.vinted.fr", "vinted.fr");

    @Test
    void accepte_une_url_https_dont_l_hote_est_sur_la_liste_blanche() {
        ListingUrlGuard.Result result = ListingUrlGuard.check("https://www.vinted.fr/items/42", HOTES_AUTORISES);

        assertThat(result.isAllowed()).isTrue();
        assertThat(result.uri().getHost()).isEqualTo("www.vinted.fr");
    }

    @Test
    void refuse_tout_ce_qui_n_est_pas_https() {
        assertThat(ListingUrlGuard.check("http://www.vinted.fr/items/42", HOTES_AUTORISES).rejection())
                .isEqualTo(ListingUrlGuard.Rejection.MALFORMED);
        assertThat(ListingUrlGuard.check("file:///etc/passwd", HOTES_AUTORISES).rejection())
                .isEqualTo(ListingUrlGuard.Rejection.MALFORMED);
        assertThat(ListingUrlGuard.check("ftp://www.vinted.fr/x", HOTES_AUTORISES).rejection())
                .isEqualTo(ListingUrlGuard.Rejection.MALFORMED);
        assertThat(ListingUrlGuard.check("pas une url", HOTES_AUTORISES).rejection())
                .isEqualTo(ListingUrlGuard.Rejection.MALFORMED);
        assertThat(ListingUrlGuard.check("/items/42", HOTES_AUTORISES).rejection())
                .isEqualTo(ListingUrlGuard.Rejection.MALFORMED);
    }

    @Test
    void refuse_un_hote_absent_de_la_liste_blanche() {
        assertThat(ListingUrlGuard.check("https://exemple.invalid/items/42", HOTES_AUTORISES).rejection())
                .isEqualTo(ListingUrlGuard.Rejection.HOST_NOT_ALLOWED);
    }

    @Test
    void refuse_un_hote_qui_imite_un_domaine_autorise() {
        // Une liste blanche par MOTIF ("contient vinted") accepterait ces deux-là.
        // C'est pourquoi elle est faite d'hôtes exacts.
        assertThat(ListingUrlGuard.check("https://www.vinted.fr.attaquant.invalid/x", HOTES_AUTORISES).rejection())
                .isEqualTo(ListingUrlGuard.Rejection.HOST_NOT_ALLOWED);
        assertThat(ListingUrlGuard.check("https://attaquant.invalid/www.vinted.fr/x", HOTES_AUTORISES).rejection())
                .isEqualTo(ListingUrlGuard.Rejection.HOST_NOT_ALLOWED);
    }

    @Test
    void refuse_localhost_et_les_adresses_privees_meme_inscrites_sur_la_liste_blanche() {
        // Le scénario du DNS détourné : le nom est « légitime », l'adresse ne
        // l'est pas. La liste blanche dit que le nom est attendu, la résolution
        // dit qu'il ne mène pas chez nous - il faut les deux contrôles.
        assertThat(ListingUrlGuard.check("https://localhost/items/1", Set.of("localhost")).rejection())
                .isEqualTo(ListingUrlGuard.Rejection.PRIVATE_ADDRESS);
        assertThat(ListingUrlGuard.check("https://127.0.0.1/items/1", Set.of("127.0.0.1")).rejection())
                .isEqualTo(ListingUrlGuard.Rejection.PRIVATE_ADDRESS);
        assertThat(ListingUrlGuard.check("https://192.168.1.1/items/1", Set.of("192.168.1.1")).rejection())
                .isEqualTo(ListingUrlGuard.Rejection.PRIVATE_ADDRESS);
        assertThat(ListingUrlGuard.check("https://10.0.0.5/items/1", Set.of("10.0.0.5")).rejection())
                .isEqualTo(ListingUrlGuard.Rejection.PRIVATE_ADDRESS);
    }

    @Test
    void refuse_l_endpoint_de_metadonnees_des_hebergeurs_cloud() {
        // 169.254.169.254 délivre des identifiants d'instance sur les principaux
        // hébergeurs : c'est LA cible classique d'une SSRF.
        assertThat(ListingUrlGuard.check("https://169.254.169.254/latest/meta-data/", Set.of("169.254.169.254"))
                .rejection())
                .isEqualTo(ListingUrlGuard.Rejection.PRIVATE_ADDRESS);
    }

    @Test
    void refuse_un_hote_qui_ne_resout_pas_plutot_que_de_le_supposer_inoffensif() {
        assertThat(ListingUrlGuard.check("https://hote.inexistant.invalid/x", Set.of("hote.inexistant.invalid"))
                .rejection())
                .isEqualTo(ListingUrlGuard.Rejection.PRIVATE_ADDRESS);
    }

    @Test
    void une_liste_blanche_vide_n_autorise_rien() {
        assertThat(ListingUrlGuard.check("https://www.vinted.fr/items/42", Set.of()).rejection())
                .isEqualTo(ListingUrlGuard.Rejection.HOST_NOT_ALLOWED);
    }
}
