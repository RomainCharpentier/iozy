package com.iozycore.purchaseanalysis;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Ce que le texte d'une annonce permet de déduire — et surtout ce qu'il ne
 * permet pas.
 * <p>
 * La moitié de ces tests vérifient une <b>absence</b> : « lot manga divers » ne
 * doit produire aucun tome. Inventer une intégrale à partir d'une formule vague
 * ferait calculer un prix par tome, un taux de doublons et un verdict d'achat
 * sur des tomes qui n'existent pas — un chiffre faux est bien pire qu'un
 * « à confirmer ».
 * <p>
 * Tous les textes ci-dessous sont fabriqués : aucune annonce réelle dans le dépôt.
 */
class ListingTextParserTest {

    // ------------------------------------------------------------- Ce qu'on lit

    @Test
    void lit_une_plage_ecrite_en_toutes_lettres() {
        assertThat(ListingTextParser.parse("Platinum End intégrale 1 à 14", null).volumeNumbers())
                .containsExactlyElementsOf(nombres(1, 14));
    }

    @Test
    void lit_une_plage_avec_un_tiret() {
        assertThat(ListingTextParser.parse("Platinum End tomes 1-14", null).volumeNumbers())
                .containsExactlyElementsOf(nombres(1, 14));
    }

    @Test
    void lit_une_plage_partielle() {
        assertThat(ListingTextParser.parse("Lot Platinum End tomes 4 à 8", null).volumeNumbers())
                .containsExactlyElementsOf(nombres(4, 8));
    }

    @Test
    void lit_une_liste_introduite_par_le_mot_tome() {
        assertThat(ListingTextParser.parse("Platinum End tomes 1,2,3,4,5", null).volumeNumbers())
                .containsExactly(1, 2, 3, 4, 5);
    }

    @Test
    void lit_un_tome_unique() {
        assertThat(ListingTextParser.parse("Platinum End tome 7", null).volumeNumbers()).containsExactly(7);
    }

    @Test
    void se_rabat_sur_la_description_quand_le_titre_ne_dit_rien() {
        ListingTextParser.Detection detection =
                ListingTextParser.parse("Beau lot manga", "Contient les tomes 1 à 6, très bon état");

        assertThat(detection.volumeNumbers()).containsExactlyElementsOf(nombres(1, 6));
    }

    @Test
    void le_titre_prime_sur_la_description() {
        // Le titre est bien plus fiable : une description peut mentionner
        // d'autres séries, un historique d'achat, une autre annonce du vendeur.
        ListingTextParser.Detection detection =
                ListingTextParser.parse("Platinum End tomes 1 à 3", "j'ai aussi les tomes 8 à 12 d'une autre série");

        assertThat(detection.volumeNumbers()).containsExactly(1, 2, 3);
    }

    // ------------------------------------------------ Ce qu'on refuse de deviner

    @Test
    void un_lot_annonce_comme_divers_ne_produit_aucun_tome() {
        ListingTextParser.Detection detection = ListingTextParser.parse("Lot manga divers 25 pièces", null);

        // « 25 » est le nombre de pièces, pas un tome. Une formulation vague
        // empoisonne tout ce qui l'entoure.
        assertThat(detection.volumeNumbers()).isEmpty();
        assertThat(detection.vague()).isTrue();
        assertThat(detection.needsConfirmation()).isTrue();
    }

    @Test
    void une_integrale_sans_bornes_est_signalee_mais_ne_fabrique_pas_de_tomes() {
        ListingTextParser.Detection detection = ListingTextParser.parse("Platinum End intégrale complète", null);

        assertThat(detection.mentionsComplete()).isTrue();
        // On ne sait PAS combien de tomes compte la série : le déduire ici
        // reviendrait à inventer la taille du lot.
        assertThat(detection.volumeNumbers()).isEmpty();
        assertThat(detection.needsConfirmation()).isTrue();
    }

    @Test
    void un_titre_sans_aucun_numero_demande_confirmation() {
        ListingTextParser.Detection detection = ListingTextParser.parse("Beau lot de mangas shonen", null);

        assertThat(detection.hasVolumes()).isFalse();
        assertThat(detection.needsConfirmation()).isTrue();
    }

    @Test
    void un_texte_vide_ne_produit_rien() {
        assertThat(ListingTextParser.parse(null, null).hasVolumes()).isFalse();
        assertThat(ListingTextParser.parse("", "").hasVolumes()).isFalse();
    }

    @Test
    void une_plage_absurde_est_ignoree() {
        // « 1 à 900 » n'est pas un lot de mangas : sans borne, le prix par tome
        // deviendrait dérisoire et le verdict absurde.
        assertThat(ListingTextParser.parse("Lot tomes 1 à 900", null).volumeNumbers()).isEmpty();
    }

    @Test
    void une_plage_descendante_est_ignoree() {
        assertThat(ListingTextParser.parse("tomes 14 à 3", null).volumeNumbers()).isEmpty();
    }

    @Test
    void des_nombres_isoles_ne_deviennent_pas_des_tomes() {
        // Ni l'année, ni le prix, ni le poids ne sont des numéros de tome : sans
        // le mot « tome » ni plage explicite, on ne retient rien.
        assertThat(ListingTextParser.parse("Manga 2019 édition 20 euros", null).volumeNumbers()).isEmpty();
    }

    @Test
    void an_inclusive_range_counts_both_bounds() {
        // « 6 à 10 » veut dire 6, 7, 8, 9 ET 10 : cinq tomes. Aucune règle ne
        // doit se fonder sur un nombre annoncé ailleurs dans l'annonce.
        assertThat(ListingTextParser.parse("Hell's Paradise tomes 6 à 10", null).volumeNumbers())
                .containsExactly(6, 7, 8, 9, 10);
    }

    // --------------------------------------------------------- Titre de série

    @Test
    void degage_un_titre_de_serie_exploitable() {
        assertThat(ListingTextParser.probableSeriesTitle("Lot Platinum End tomes 1 à 14 TBE"))
                .isEqualTo("Platinum End");
        assertThat(ListingTextParser.probableSeriesTitle("Vinland Saga intégrale"))
                .isEqualTo("Vinland Saga");
    }

    @Test
    void un_titre_absent_rend_une_chaine_vide_pas_null() {
        assertThat(ListingTextParser.probableSeriesTitle(null)).isEmpty();
    }

    private static java.util.List<Integer> nombres(int de, int a) {
        return java.util.stream.IntStream.rangeClosed(de, a).boxed().toList();
    }
}
