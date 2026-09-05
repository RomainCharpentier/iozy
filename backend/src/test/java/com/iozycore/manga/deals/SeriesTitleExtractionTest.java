package com.iozycore.manga.deals;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Extraire ce qu'une annonce dit des tomes <b>sans détruire le nom de
 * l'œuvre</b>.
 *
 * <p>Le parser supprimait auparavant tous les chiffres et toute la ponctuation
 * avant d'espérer que le reste soit le titre. « 20th Century Boys » y devenait
 * « th Century Boys », et aucune normalisation en aval ne pouvait le
 * reconstruire : l'information était perdue à la source.
 *
 * <p>Les chiffres et la ponctuation appartiennent souvent à l'identité d'une
 * série. Ce qui doit partir, c'est le <b>segment reconnu comme expression de
 * tomes</b>, et lui seul.
 */
class SeriesTitleExtractionTest {

    private static String titre(String annonce) {
        return ListingTextParser.probableSeriesTitle(annonce);
    }

    private static java.util.List<Integer> tomes(String annonce) {
        return ListingTextParser.sorted(ListingTextParser.parse(annonce, null).volumeNumbers());
    }

    // ====================================================== Chiffres du titre

    @Test
    void a_number_that_belongs_to_the_title_survives() {
        assertThat(titre("20th Century Boys tomes 1 à 5")).isEqualTo("20th Century Boys");
        assertThat(tomes("20th Century Boys tomes 1 à 5")).containsExactly(1, 2, 3, 4, 5);
    }

    @Test
    void a_long_range_does_not_swallow_the_number_in_the_title() {
        assertThat(titre("20th Century Boys tomes 1 à 22")).isEqualTo("20th Century Boys");
        assertThat(tomes("20th Century Boys tomes 1 à 22")).hasSize(22).startsWith(1).endsWith(22);
    }

    @Test
    void a_title_made_of_a_number_is_not_erased() {
        assertThat(titre("86 tome 3")).isEqualTo("86");
        assertThat(tomes("86 tome 3")).containsExactly(3);
    }

    @Test
    void a_number_inside_a_title_is_left_alone_when_no_volume_is_announced() {
        assertThat(titre("Area 51")).isEqualTo("Area 51");
        assertThat(titre("7 Seeds")).isEqualTo("7 Seeds");
        assertThat(titre("009 Re:Cyborg")).isEqualTo("009 Re:Cyborg");
    }

    // ====================================================== Ponctuation légitime

    @Test
    void a_colon_and_a_hyphen_inside_a_title_are_part_of_it() {
        assertThat(titre("Kaguya-sama: Love Is War tomes 1-4")).isEqualTo("Kaguya-sama: Love Is War");
        assertThat(tomes("Kaguya-sama: Love Is War tomes 1-4")).containsExactly(1, 2, 3, 4);
    }

    @Test
    void dots_and_hyphens_survive() {
        assertThat(titre("D.Gray-man tomes 1 à 3")).isEqualTo("D.Gray-man");
        assertThat(tomes("D.Gray-man tomes 1 à 3")).containsExactly(1, 2, 3);
    }

    @Test
    void a_slash_inside_a_title_is_part_of_it() {
        assertThat(titre("Fate/stay night tomes 1 et 2")).isEqualTo("Fate/stay night");
        assertThat(tomes("Fate/stay night tomes 1 et 2")).containsExactly(1, 2);
    }

    @Test
    void a_trailing_exclamation_mark_is_part_of_the_title() {
        assertThat(titre("K-ON! tomes 1-4")).isEqualTo("K-ON!");
        assertThat(tomes("K-ON! tomes 1-4")).containsExactly(1, 2, 3, 4);
    }

    @Test
    void an_apostrophe_and_a_colon_together_survive() {
        assertThat(titre("JoJo's Bizarre Adventure: Part 5 tomes 1 à 3"))
                .isEqualTo("JoJo's Bizarre Adventure: Part 5");
    }

    // ====================================================== Séparateurs d'annonce

    @Test
    void a_commercial_separator_at_the_edge_is_trimmed() {
        // Le tiret sépare ici l'œuvre de l'information de lot ; celui de
        // « Kaguya-sama » lui appartient. La différence est sa position, pas
        // sa nature - d'où un rognage aux bords seulement.
        assertThat(titre("Hell's Paradise – Tomes 6 à 10")).isEqualTo("Hell's Paradise");
        assertThat(titre("Hell's Paradise - Tomes 6 à 10")).isEqualTo("Hell's Paradise");
        assertThat(titre("Death Note : tomes 1 à 6")).isEqualTo("Death Note");
        assertThat(titre("Death Note | tomes 1 à 6")).isEqualTo("Death Note");
    }

    @Test
    void an_inclusive_range_is_read_whatever_its_form() {
        assertThat(tomes("Hell's Paradise – Tomes 6 à 10")).containsExactly(6, 7, 8, 9, 10);
        assertThat(tomes("Death Note T1 à T6")).containsExactly(1, 2, 3, 4, 5, 6);
        assertThat(tomes("Death Note 1-6")).containsExactly(1, 2, 3, 4, 5, 6);
        assertThat(tomes("Death Note tomes 1,2,3,5")).containsExactly(1, 2, 3, 5);
    }

    @Test
    void a_volume_prefix_on_both_bounds_is_removed_from_the_title() {
        assertThat(titre("Death Note T1 à T6")).isEqualTo("Death Note");
    }

    // ====================================================== Mentions commerciales

    @Test
    void commercial_words_are_still_removed() {
        assertThat(titre("Lot Platinum End tomes 1 à 14 TBE")).isEqualTo("Platinum End");
        assertThat(titre("Death Note intégrale tomes 1 à 12")).isEqualTo("Death Note");
        assertThat(titre("Vinland Saga intégrale")).isEqualTo("Vinland Saga");
    }

    // ====================================================== Faux positifs

    @Test
    void a_vague_lot_never_produces_a_series_and_a_volume() {
        // « 20 » est ici un nombre de pièces, pas un tome : rien ne l'introduit
        // comme tel. Préférer aucune proposition à une fausse.
        assertThat(tomes("Lot manga 20 tomes")).isEmpty();
    }

    @Test
    void an_absurd_range_still_yields_nothing() {
        assertThat(tomes("Lot tomes 1 à 900")).isEmpty();
        assertThat(tomes("Platinum End tomes 14 à 3")).isEmpty();
    }

    @Test
    void a_title_without_any_volume_expression_is_returned_untouched() {
        assertThat(titre("Platinum End")).isEqualTo("Platinum End");
        assertThat(titre("Kaguya-sama: Love Is War")).isEqualTo("Kaguya-sama: Love Is War");
        assertThat(titre(null)).isEmpty();
        assertThat(titre("")).isEmpty();
    }
}
