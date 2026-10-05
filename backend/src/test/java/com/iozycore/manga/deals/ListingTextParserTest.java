package com.iozycore.manga.deals;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * What the text of a listing lets us deduce — and above all what it does not
 * let us deduce.
 * <p>
 * Half of these tests check an <b>absence</b>: "lot manga divers" must
 * produce no volume. Inventing a complete set from a vague phrase
 * would compute a price per volume, a duplicate rate and a buying verdict
 * on volumes that do not exist — a wrong figure is much worse than an
 * "to confirm".
 * <p>
 * All the texts below are made up: no real listing in the repository.
 */
class ListingTextParserTest {

    // ------------------------------------------------------------- What we read

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
        // The title is much more reliable: a description may mention
        // other series, a purchase history, another listing of the seller.
        ListingTextParser.Detection detection =
                ListingTextParser.parse("Platinum End tomes 1 à 3", "j'ai aussi les tomes 8 à 12 d'une autre série");

        assertThat(detection.volumeNumbers()).containsExactly(1, 2, 3);
    }

    // ------------------------------------------------ What we refuse to guess

    @Test
    void un_lot_annonce_comme_divers_ne_produit_aucun_tome() {
        ListingTextParser.Detection detection = ListingTextParser.parse("Lot manga divers 25 pièces", null);

        // "25" is the number of pieces, not a volume. A vague wording
        // poisons everything around it.
        assertThat(detection.volumeNumbers()).isEmpty();
        assertThat(detection.vague()).isTrue();
        assertThat(detection.needsConfirmation()).isTrue();
    }

    @Test
    void une_integrale_sans_bornes_est_signalee_mais_ne_fabrique_pas_de_tomes() {
        ListingTextParser.Detection detection = ListingTextParser.parse("Platinum End intégrale complète", null);

        assertThat(detection.mentionsComplete()).isTrue();
        // We do NOT know how many volumes the series has: deducing it here
        // would mean inventing the size of the batch.
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
        // "1 à 900" is not a batch of mangas: without a limit, the price per volume
        // would become tiny and the verdict absurd.
        assertThat(ListingTextParser.parse("Lot tomes 1 à 900", null).volumeNumbers()).isEmpty();
    }

    @Test
    void une_plage_descendante_est_ignoree() {
        assertThat(ListingTextParser.parse("tomes 14 à 3", null).volumeNumbers()).isEmpty();
    }

    @Test
    void des_nombres_isoles_ne_deviennent_pas_des_tomes() {
        // Neither the year, nor the price, nor the weight are volume numbers: without
        // the word "tome" or an explicit range, we keep nothing.
        assertThat(ListingTextParser.parse("Manga 2019 édition 20 euros", null).volumeNumbers()).isEmpty();
    }

    @Test
    void an_inclusive_range_counts_both_bounds() {
        // "6 à 10" means 6, 7, 8, 9 AND 10: five volumes. No rule
        // must rely on a number announced elsewhere in the listing.
        assertThat(ListingTextParser.parse("Hell's Paradise tomes 6 à 10", null).volumeNumbers())
                .containsExactly(6, 7, 8, 9, 10);
    }

    // --------------------------------------------------------- Series title

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


    // ------------------------------------- "9 tomes": how many, not which

    @Test
    void lit_le_nombre_de_tomes_annonce_sans_inventer_leurs_numeros() {
        ListingTextParser.Detection d = ListingTextParser.parse("9 tomes de Naruto", null);

        // The core of the matter: the seller may have volumes 14 to 22. Unrolling
        // 1 to 9 would build a buying verdict computed on volumes that
        // nobody has seen.
        assertThat(d.announcedVolumeCount()).isEqualTo(9);
        assertThat(d.volumeNumbers()).isEmpty();
        assertThat(d.hasAnnouncedCountOnly()).isTrue();
    }

    @Test
    void reconnait_les_formulations_courantes_du_nombre() {
        assertThat(ListingTextParser.parse("Lot de 9 tomes Naruto", null).announcedVolumeCount()).isEqualTo(9);
        assertThat(ListingTextParser.parse("Naruto 9 tomes", null).announcedVolumeCount()).isEqualTo(9);
        assertThat(ListingTextParser.parse("12 volumes de One Piece", null).announcedVolumeCount()).isEqualTo(12);
        assertThat(ListingTextParser.parse("Naruto - lot de 9 mangas", null).announcedVolumeCount()).isEqualTo(9);
    }

    @Test
    void des_numeros_lus_font_toujours_foi_sur_un_nombre_annonce() {
        // "Naruto tomes 1 à 9" gives the two possible readings; keeping both
        // would show "9 volumes announced" next to nine volumes already
        // identified, as if something were still missing.
        ListingTextParser.Detection d = ListingTextParser.parse("Naruto tomes 1 à 9", null);

        assertThat(d.volumeNumbers()).containsExactlyElementsOf(nombres(1, 9));
        assertThat(d.announcedVolumeCount()).isNull();
        assertThat(d.hasAnnouncedCountOnly()).isFalse();
    }

    @Test
    void la_longueur_de_l_oeuvre_n_est_pas_la_taille_du_lot() {
        // Seen on a real Vinted listing: "Manga Your evil past -
        // Seinen thriller - Serie en 14 tomes", for a batch that contained
        // SIX. The screen announced "14 volumes, without saying which", then
        // blamed the user for entering too few: a perfectly
        // honest sentence of the seller became a reproach.
        ListingTextParser.Detection d = ListingTextParser.parse(
                "Manga Your evil past - Seinen thriller",
                "Manga Your evil past - Seinen thriller - Série en 14 tomes");

        assertThat(d.announcedVolumeCount()).isNull();
        assertThat(d.hasAnnouncedCountOnly()).isFalse();
    }

    @Test
    void les_autres_facons_de_decrire_l_oeuvre_sont_ecartees_aussi() {
        assertThat(ListingTextParser.parse("Naruto", "Collection complète en 72 tomes")
                .announcedVolumeCount()).isNull();
        assertThat(ListingTextParser.parse("Naruto", "Saga de 72 tomes")
                .announcedVolumeCount()).isNull();
    }

    @Test
    void une_taille_de_lot_reste_lue_meme_apres_une_mention_de_l_oeuvre() {
        // "Serie en 14 tomes" describes the work; "je vends 6 tomes" describes the
        // sale. The first must not make us miss the second.
        ListingTextParser.Detection d = ListingTextParser.parse(
                "Your evil past", "Série en 14 tomes. Je vends 6 tomes.");

        assertThat(d.announcedVolumeCount()).isEqualTo(6);
    }

    @Test
    void un_seul_tome_n_est_pas_un_lot() {
        assertThat(ListingTextParser.parse("1 tome de Naruto", null).announcedVolumeCount()).isNull();
    }

    @Test
    void une_formulation_vague_ne_livre_aucun_nombre_non_plus() {
        // "lot manga divers 25 pièces" describes neither volumes 25, nor a batch
        // of 25 identifiable volumes: the wording poisons everything.
        ListingTextParser.Detection d = ListingTextParser.parse("Lot manga divers 25 mangas", null);

        assertThat(d.vague()).isTrue();
        assertThat(d.announcedVolumeCount()).isNull();
    }

    @Test
    void le_nombre_annonce_est_retire_du_titre_de_serie() {
        // Without this removal, "9 tomes de Naruto" could not match
        // any series of the catalogue, and the work, though named, stayed invisible.
        assertThat(ListingTextParser.probableSeriesTitle("9 tomes de Naruto")).isEqualTo("Naruto");
        assertThat(ListingTextParser.probableSeriesTitle("Lot de 9 tomes Naruto")).isEqualTo("Naruto");
        assertThat(ListingTextParser.probableSeriesTitle("12 volumes de One Piece")).isEqualTo("One Piece");
    }

    @Test
    void un_titre_dont_le_chiffre_appartient_a_l_oeuvre_n_est_pas_ampute() {
        // The pattern requires a support word AFTER the number: "20th Century
        // Boys" and "3 mètres au-dessus du ciel" keep theirs.
        assertThat(ListingTextParser.probableSeriesTitle("20th Century Boys tomes 1 à 3"))
                .isEqualTo("20th Century Boys");
        assertThat(ListingTextParser.parse("20th Century Boys", null).announcedVolumeCount()).isNull();
    }

    private static java.util.List<Integer> nombres(int de, int a) {
        return java.util.stream.IntStream.rangeClosed(de, a).boxed().toList();
    }
}
