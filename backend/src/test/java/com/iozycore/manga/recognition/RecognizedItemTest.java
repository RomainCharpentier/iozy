package com.iozycore.manga.recognition;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RecognizedItemTest {

    private static RecognizedItem item(String titre, Integer tome, String edition, String ean,
                                        RecognitionConfidence confiance) {
        return RecognizedItem.fromVision(titre, tome, edition, ean, confiance, List.of(), Set.of(0));
    }

    @Test
    void an_item_without_a_read_title_is_not_an_item() {
        assertThatThrownBy(() -> item(null, 1, null, null, RecognitionConfidence.HIGH))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> item("   ", 1, null, null, RecognitionConfidence.HIGH))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void an_absurd_volume_number_is_dropped_rather_than_propagated() {
        // Un « tome 4000 » mal lu diviserait le prix par tome par 4000 s'il
        // arrivait jusqu'au calcul. On préfère « numéro non lu ».
        assertThat(item("Platinum End", 4000, null, null, RecognitionConfidence.HIGH).volumeNumber()).isNull();
        assertThat(item("Platinum End", 0, null, null, RecognitionConfidence.HIGH).volumeNumber()).isNull();
        assertThat(item("Platinum End", -3, null, null, RecognitionConfidence.HIGH).volumeNumber()).isNull();
    }

    @Test
    void a_plausible_volume_number_is_kept() {
        assertThat(item("Platinum End", 14, null, null, RecognitionConfidence.HIGH).volumeNumber()).isEqualTo(14);
    }

    @Test
    void a_missing_confidence_defaults_to_the_most_cautious_level() {
        assertThat(item("Platinum End", 1, null, null, null).confidence()).isEqualTo(RecognitionConfidence.LOW);
    }

    @Test
    void a_blank_edition_hint_is_an_unknown_edition_not_an_empty_one() {
        assertThat(item("Death Note", 1, "  ", null, RecognitionConfidence.HIGH).editionIsUnknown()).isTrue();
        assertThat(item("Death Note", 1, "Black Edition", null, RecognitionConfidence.HIGH).editionIsUnknown()).isFalse();
    }

    @Test
    void an_ean_makes_the_reading_exact_rather_than_similar() {
        assertThat(item("Death Note", 1, null, "9782505000000", RecognitionConfidence.LOW).hasExactIdentifier()).isTrue();
        assertThat(item("Death Note", 1, null, null, RecognitionConfidence.HIGH).hasExactIdentifier()).isFalse();
    }

    @Test
    void only_high_confidence_is_worth_preselecting() {
        assertThat(RecognitionConfidence.HIGH.worthPreselecting()).isTrue();
        assertThat(RecognitionConfidence.MEDIUM.worthPreselecting()).isFalse();
        assertThat(RecognitionConfidence.LOW.worthPreselecting()).isFalse();
    }

    @Test
    void the_bytes_of_an_image_never_appear_in_its_string_form() {
        // Un record afficherait le tableau par défaut, et cette ligne finirait
        // dans une trace d'exception ou un journal.
        RecognitionImage image = new RecognitionImage(0, "https://exemple.invalid/1.jpg",
                new byte[] {1, 2, 3, 4}, "image/jpeg");

        assertThat(image.toString()).contains("bytes=4").doesNotContain("[B@");
    }
}
