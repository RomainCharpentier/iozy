package com.iozycore.recognition;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Ce que le texte d'une annonce permet de proposer, sans le moindre appel
 * externe.
 *
 * <p>C'est le gain principal de cette passe : « Platinum End intégrale tomes 1
 * à 14 » est compris pour zéro euro et zéro seconde d'attente. Solliciter un
 * moteur de vision pour retrouver ce que le vendeur a écrit noir sur blanc
 * serait payer pour deviner une information donnée.
 */
class ListingTextRecognizerTest {

    @Test
    void a_complete_run_announced_in_the_title_yields_one_item_per_volume() {
        List<RecognizedItem> propositions =
                ListingTextRecognizer.recognize("Platinum End intégrale tomes 1 à 14", null);

        assertThat(propositions).hasSize(14);
        assertThat(propositions).extracting(RecognizedItem::volumeNumber)
                .containsExactlyElementsOf(java.util.stream.IntStream.rangeClosed(1, 14).boxed().toList());
        assertThat(propositions).allSatisfy(item ->
                assertThat(item.seriesTitleRaw()).isEqualToIgnoringCase("Platinum End"));
    }

    @Test
    void a_dash_range_is_read_the_same_way() {
        assertThat(ListingTextRecognizer.recognize("Platinum End 1-4", null))
                .extracting(RecognizedItem::volumeNumber)
                .containsExactly(1, 2, 3, 4);
    }

    @Test
    void an_explicit_list_yields_exactly_those_volumes() {
        assertThat(ListingTextRecognizer.recognize("Platinum End tomes 1, 2, 4", null))
                .extracting(RecognizedItem::volumeNumber)
                .containsExactly(1, 2, 4);
    }

    @Test
    void a_vague_listing_never_invents_a_series() {
        // « Beau lot manga » ne décrit aucun tome. Inventer une intégrale à
        // partir de trois mots fabriquerait un verdict calculé sur des tomes
        // qui n'existent pas.
        assertThat(ListingTextRecognizer.recognize("Lot manga", null)).isEmpty();
        assertThat(ListingTextRecognizer.recognize("Beau lot de mangas shonen", null)).isEmpty();
        assertThat(ListingTextRecognizer.recognize("Lot manga divers 25 pièces", null)).isEmpty();
    }

    @Test
    void volumes_without_an_identifiable_series_yield_nothing() {
        // « lot mangas 1 à 10 » donne des numéros mais aucune œuvre : dix lignes
        // « ? tome N » n'aideraient personne.
        assertThat(ListingTextRecognizer.recognize("Lot mangas 1 à 10", null)).isEmpty();
    }

    @Test
    void nothing_at_all_is_a_valid_answer() {
        assertThat(ListingTextRecognizer.recognize(null, null)).isEmpty();
        assertThat(ListingTextRecognizer.recognize("", "")).isEmpty();
    }

    @Test
    void the_description_is_read_when_the_title_says_nothing_precise() {
        List<RecognizedItem> propositions = ListingTextRecognizer.recognize(
                "Vinland Saga", "Contient les tomes 1 à 3, très bon état");

        assertThat(propositions).extracting(RecognizedItem::volumeNumber).containsExactly(1, 2, 3);
    }

    @Test
    void a_text_proposal_carries_the_TEXT_source_and_no_photo() {
        RecognizedItem item = ListingTextRecognizer.recognize("Platinum End tome 7", null).get(0);

        assertThat(item.sources()).containsExactly(RecognitionSource.TEXT);
        // On ne lui invente pas une photo 0 : le texte n'en a pas.
        assertThat(item.sourceImages()).isEmpty();
    }

    @Test
    void a_text_proposal_says_why_it_exists_without_quoting_the_whole_listing() {
        RecognizedItem item = ListingTextRecognizer.recognize("Platinum End tomes 1 à 14", null).get(0);

        assertThat(item.evidence()).containsExactly("tomes 1 à 14 annoncés dans l'annonce");
    }

    @Test
    void reading_the_text_is_certain_even_though_owning_the_volumes_is_not() {
        // La LECTURE est sûre : la phrase dit « 1 à 14 ». Que le vendeur les ait
        // vraiment est une autre question, portée par la source TEXT.
        RecognizedItem item = ListingTextRecognizer.recognize("Platinum End 1-14", null).get(0);

        assertThat(item.confidence()).isEqualTo(RecognitionConfidence.HIGH);
        assertThat(item.strongestSource()).isEqualTo(RecognitionSource.TEXT);
    }

    @Test
    void an_edition_is_never_guessed_from_the_text() {
        // Le parser ne lit pas d'édition ; en supposer une serait exactement ce
        // que ce projet refuse.
        assertThat(ListingTextRecognizer.recognize("Death Note tomes 1 à 6", null))
                .allSatisfy(item -> assertThat(item.editionIsUnknown()).isTrue());
    }

    @Test
    void an_unreasonably_large_lot_is_not_unrolled_into_hundreds_of_rows() {
        // La borne du parser accepte jusqu'à 300 ; produire trois cents lignes à
        // cocher serait inutilisable. Un lot pareil se saisit autrement.
        assertThat(ListingTextRecognizer.recognize("Naruto tomes 1 à 200", null)).isEmpty();
    }

    @Test
    void an_absurd_range_yields_nothing_rather_than_a_single_wrong_volume() {
        assertThat(ListingTextRecognizer.recognize("Lot tomes 1 à 900", null)).isEmpty();
        assertThat(ListingTextRecognizer.recognize("Platinum End tomes 14 à 3", null)).isEmpty();
    }
}
