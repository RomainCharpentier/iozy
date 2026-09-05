package com.iozycore.manga.deals;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Retirer la décoration d'une annonce sans abîmer le nom d'une œuvre.
 *
 * <p>Les deux moitiés comptent autant : laisser un emoji fait rater un
 * appariement, mais rogner un tiret ou un point d'exclamation fabrique un titre
 * qui n'existe pas - et cette seconde erreur est silencieuse.
 */
class SeriesTitleNormalizerTest {

    // ====================================================== Décoration retirée

    @Test
    void a_leading_emoji_is_not_part_of_the_work_title() {
        assertThat(SeriesTitleNormalizer.normalize("🔥 Hell's Paradise")).isEqualTo("Hell's Paradise");
    }

    @Test
    void emoji_on_both_sides_are_removed() {
        assertThat(SeriesTitleNormalizer.normalize("✨ Death Note ✨")).isEqualTo("Death Note");
        assertThat(SeriesTitleNormalizer.normalize("📚 Platinum End 📚")).isEqualTo("Platinum End");
    }

    @Test
    void several_stacked_decorations_are_all_removed() {
        assertThat(SeriesTitleNormalizer.normalize("✨✨ Death Note")).isEqualTo("Death Note");
        assertThat(SeriesTitleNormalizer.normalize("⭐ ⭐ Fullmetal Alchemist ⭐")).isEqualTo("Fullmetal Alchemist");
    }

    @Test
    void brackets_and_trailing_dashes_are_decoration_too() {
        assertThat(SeriesTitleNormalizer.normalize("【】 Death Note")).isEqualTo("Death Note");
        assertThat(SeriesTitleNormalizer.normalize("Hell's Paradise —")).isEqualTo("Hell's Paradise");
        assertThat(SeriesTitleNormalizer.normalize("« Death Note »")).isEqualTo("Death Note");
    }

    @Test
    void an_emoji_with_its_invisible_baggage_leaves_nothing_behind() {
        // Un emoji traîne souvent un sélecteur de variante (U+FE0F) : le
        // laisser derrière rendrait le titre différent sans que rien ne se voie.
        assertThat(SeriesTitleNormalizer.normalize("❤️ Nana")).isEqualTo("Nana");
        assertThat(SeriesTitleNormalizer.normalize("Nana ❤️")).isEqualTo("Nana");
    }

    @Test
    void whitespace_left_by_the_decoration_is_collapsed() {
        assertThat(SeriesTitleNormalizer.normalize("🔥   Hell's   Paradise")).isEqualTo("Hell's Paradise");
    }

    // ====================================================== Titres légitimes intacts

    @Test
    void a_trailing_exclamation_mark_belongs_to_the_title() {
        assertThat(SeriesTitleNormalizer.normalize("K-ON!")).isEqualTo("K-ON!");
    }

    @Test
    void colons_hyphens_dots_and_apostrophes_survive() {
        assertThat(SeriesTitleNormalizer.normalize("Kaguya-sama: Love Is War"))
                .isEqualTo("Kaguya-sama: Love Is War");
        assertThat(SeriesTitleNormalizer.normalize("Don't Call It Mystery")).isEqualTo("Don't Call It Mystery");
        assertThat(SeriesTitleNormalizer.normalize("D.Gray-man")).isEqualTo("D.Gray-man");
    }

    @Test
    void digits_and_mixed_case_are_never_touched() {
        assertThat(SeriesTitleNormalizer.normalize("20th Century Boys")).isEqualTo("20th Century Boys");
        assertThat(SeriesTitleNormalizer.normalize("xxxHOLiC")).isEqualTo("xxxHOLiC");
        assertThat(SeriesTitleNormalizer.normalize("7SEEDS")).isEqualTo("7SEEDS");
    }

    @Test
    void japanese_titles_pass_through_untouched() {
        assertThat(SeriesTitleNormalizer.normalize("鋼の錬金術師")).isEqualTo("鋼の錬金術師");
        assertThat(SeriesTitleNormalizer.normalize("🔥 鋼の錬金術師")).isEqualTo("鋼の錬金術師");
    }

    @Test
    void a_symbol_INSIDE_a_title_is_left_alone() {
        // Rien ne permet d'affirmer qu'il décore plutôt qu'il ne nomme : dans le
        // doute, on garde. Un appariement manqué se corrige, un titre inventé non.
        assertThat(SeriesTitleNormalizer.normalize("Fate/stay night")).isEqualTo("Fate/stay night");
        assertThat(SeriesTitleNormalizer.normalize("Nana ★ Seven")).isEqualTo("Nana ★ Seven");
    }

    @Test
    void an_untouched_title_comes_back_identical() {
        assertThat(SeriesTitleNormalizer.normalize("Platinum End")).isEqualTo("Platinum End");
        assertThat(SeriesTitleNormalizer.normalize("Vinland Saga")).isEqualTo("Vinland Saga");
    }

    // ====================================================== Bords

    @Test
    void nothing_in_gives_an_empty_string_never_a_failure() {
        assertThat(SeriesTitleNormalizer.normalize(null)).isEmpty();
        assertThat(SeriesTitleNormalizer.normalize("")).isEmpty();
        assertThat(SeriesTitleNormalizer.normalize("   ")).isEmpty();
    }

    @Test
    void a_title_made_only_of_decoration_keeps_its_original_form() {
        // Inexploitable de toute façon - mais le vider ferait perdre la seule
        // information disponible, et un titre vide lève plus loin.
        assertThat(SeriesTitleNormalizer.normalize("🔥🔥🔥")).isEqualTo("🔥🔥🔥");
    }
}
