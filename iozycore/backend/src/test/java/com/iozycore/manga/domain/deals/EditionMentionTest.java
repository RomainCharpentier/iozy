package com.iozycore.manga.domain.deals;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The edition named in a listing title.
 *
 * <p>The tests that matter most here are not the ones that read an
 * edition: they are the ones that <b>refuse</b> to read one. An invented hint
 * would make the catalogue look for an edition that does not exist, and would turn
 * a perfectly identified item into an "edition to confirm".
 */
class EditionMentionTest {

    // ============================================ With the word "édition"

    @Test
    void reads_an_edition_named_before_the_word() {
        EditionMention.Lecture lue = EditionMention.lire("Naruto Perfect Edition");

        assertThat(lue.hint()).isEqualTo("Perfect Edition");
        assertThat(lue.reste()).isEqualTo("Naruto");
    }

    @Test
    void reads_an_edition_named_after_the_word() {
        EditionMention.Lecture lue = EditionMention.lire("Naruto édition Hokage");

        assertThat(lue.hint()).isEqualTo("Hokage Edition");
        assertThat(lue.reste()).isEqualTo("Naruto");
    }

    @Test
    void an_unknown_qualifier_is_accepted_only_AFTER_the_word_edition() {
        // This position removes the ambiguity by itself: nobody writes the name
        // of the work after the word "edition". The accent changes nothing -
        // sellers write "edition Hokage" as often as "édition".
        assertThat(EditionMention.lire("Naruto édition Hokage").hint()).isEqualTo("Hokage Edition");
        assertThat(EditionMention.lire("Naruto edition Hokage").hint()).isEqualTo("Hokage Edition");

        // Elsewhere, the qualifier must be recognised. "Star" is not, and
        // this is an accepted gap: the item will stay "edition to confirm",
        // which is far better than an invented edition.
        assertThat(EditionMention.lire("Dragon Ball Star Edition").trouvee()).isFalse();
    }

    @Test
    void a_two_word_series_is_not_mistaken_for_an_edition() {
        // The trap that made us drop the first version: nothing in
        // "Death Note edition" says which of the two words is the work.
        // "Note" is not a known qualifier, so nothing is proposed.
        assertThat(EditionMention.lire("Death Note edition").trouvee()).isFalse();
    }

    @Test
    void the_common_french_qualifiers_are_recognised() {
        assertThat(EditionMention.lire("One Piece édition originale").hint()).isEqualTo("Originale Edition");
        assertThat(EditionMention.lire("Berserk edition deluxe").hint()).isEqualTo("Deluxe Edition");
        assertThat(EditionMention.lire("Gunnm édition collector").hint()).isEqualTo("Collector Edition");
    }

    @Test
    void the_label_is_written_as_one_would_write_it_not_as_it_was_typed() {
        // This label ends up in the batch and then in the saved analysis: "PERFECT
        // edition" would look bad next to the editions of the catalogue.
        assertThat(EditionMention.lire("Naruto PERFECT EDITION").hint()).isEqualTo("Perfect Edition");
    }

    // ============================================ A rank used alone

    @Test
    void reads_a_tier_used_on_its_own() {
        EditionMention.Lecture lue = EditionMention.lire("Naruto Perfect");

        assertThat(lue.hint()).isEqualTo("Perfect");
        assertThat(lue.reste()).isEqualTo("Naruto");
    }

    @Test
    void the_standalone_tiers_are_the_ones_the_catalog_already_knows() {
        for (String rang : new String[]{"perfect", "deluxe", "prestige", "collector"}) {
            assertThat(EditionMention.estUnRangConnu(rang)).as(rang).isTrue();
        }
    }

    @Test
    void integrale_alone_is_a_completeness_claim_not_an_edition() {
        // This word already has a meaning here: MENTION_INTEGRALE makes it a signal
        // of completeness. Treating it as an edition made the engine return
        // TWENTY-SIX volumes for "Platinum End integrale tomes 1 a 14" - the
        // text proposing fourteen "Integrale" and the photos twelve
        // "Standard", which the consolidation rightly refuses to merge.
        assertThat(EditionMention.estUnRangConnu("intégrale")).isFalse();
        assertThat(EditionMention.lire("Platinum End intégrale").trouvee()).isFalse();

        // Attached to the word "edition", it does name a print run.
        assertThat(EditionMention.lire("Platinum End édition intégrale").hint())
                .isEqualTo("Intégrale Edition");
    }

    // ============================================ What must be REFUSED

    @Test
    void a_series_whose_name_contains_a_tier_like_word_is_not_amputated() {
        // "Black" is NOT a rank used alone, and this is deliberate: Black
        // Butler, Black Clover, Black Lagoon are series. One more word
        // in the list is one more word that stops belonging to titles.
        assertThat(EditionMention.lire("Black Butler").trouvee()).isFalse();
        assertThat(EditionMention.lire("Black Clover").trouvee()).isFalse();
    }

    @Test
    void an_empty_qualifier_is_refused() {
        // "belle édition" names no edition. Proposing "Belle Edition"
        // would make the catalogue look for something that is not there.
        assertThat(EditionMention.lire("Naruto belle édition").trouvee()).isFalse();
        assertThat(EditionMention.lire("Naruto cette édition").trouvee()).isFalse();
    }

    @Test
    void packaging_and_condition_are_not_editions() {
        // "Coffret" describes a packaging, "TBE" a condition. Neither
        // is an edition, and the catalogue knows none with that name.
        assertThat(EditionMention.lire("Naruto coffret").trouvee()).isFalse();
        assertThat(EditionMention.lire("Naruto TBE").trouvee()).isFalse();
        assertThat(EditionMention.lire("Naruto neuf").trouvee()).isFalse();
    }

    @Test
    void a_title_that_names_nothing_yields_nothing() {
        assertThat(EditionMention.lire("Naruto").trouvee()).isFalse();
        assertThat(EditionMention.lire("").trouvee()).isFalse();
        assertThat(EditionMention.lire(null).trouvee()).isFalse();
    }

    @Test
    void the_remainder_is_always_usable_as_a_series_title() {
        assertThat(EditionMention.lire("Naruto Perfect Edition").reste()).isEqualTo("Naruto");
        assertThat(EditionMention.lire("Naruto édition collector").reste()).isEqualTo("Naruto");
        assertThat(EditionMention.lire("Naruto").reste()).isEqualTo("Naruto");
    }
}
