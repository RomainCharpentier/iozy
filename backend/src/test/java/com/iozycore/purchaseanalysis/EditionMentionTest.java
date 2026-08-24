package com.iozycore.purchaseanalysis;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * L'édition nommée dans un titre d'annonce.
 *
 * <p>Les tests qui comptent le plus ici ne sont pas ceux qui lisent une
 * édition : ce sont ceux qui <b>refusent</b> d'en lire une. Un indice inventé
 * ferait chercher au catalogue une édition qui n'existe pas, et ferait passer
 * un élément parfaitement identifié en « édition à confirmer ».
 */
class EditionMentionTest {

    // ============================================ Avec le mot « édition »

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
    void an_unknown_qualifier_is_accepted_only_after_an_accented_edition() {
        // La construction française lève l'ambiguïté à elle seule : dans
        // « édition Hokage », impossible de confondre l'œuvre et le tirage.
        assertThat(EditionMention.lire("Naruto édition Hokage").hint()).isEqualTo("Hokage Edition");

        // Ailleurs, le qualifiant doit être reconnu. « Star » ne l'est pas, et
        // c'est un manque assumé : l'élément restera « édition à confirmer »,
        // ce qui vaut infiniment mieux qu'une édition inventée.
        assertThat(EditionMention.lire("Dragon Ball Star Edition").trouvee()).isFalse();
    }

    @Test
    void a_two_word_series_is_not_mistaken_for_an_edition() {
        // Le piège qui a fait abandonner la première version : rien dans
        // « Death Note edition » ne dit lequel des deux mots est l'œuvre.
        // « Note » n'étant pas un qualifiant connu, rien n'est proposé.
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
        // Ce libellé finit dans le lot puis dans l'analyse enregistrée : « PERFECT
        // edition » y ferait tache à côté des éditions du catalogue.
        assertThat(EditionMention.lire("Naruto PERFECT EDITION").hint()).isEqualTo("Perfect Edition");
    }

    // ============================================ Un rang employé seul

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
        // Ce mot porte deja un sens ici : MENTION_INTEGRALE en fait un signal
        // de completude. L'avoir traite comme une edition faisait rendre
        // VINGT-SIX tomes pour « Platinum End integrale tomes 1 a 14 » - le
        // texte proposant quatorze « Integrale » et les photos douze
        // « Standard », que la consolidation refuse a juste titre de fondre.
        assertThat(EditionMention.estUnRangConnu("intégrale")).isFalse();
        assertThat(EditionMention.lire("Platinum End intégrale").trouvee()).isFalse();

        // Accole au mot « edition », il nomme bien un tirage.
        assertThat(EditionMention.lire("Platinum End édition intégrale").hint())
                .isEqualTo("Intégrale Edition");
    }

    // ============================================ Ce qu'il faut REFUSER

    @Test
    void a_series_whose_name_contains_a_tier_like_word_is_not_amputated() {
        // « Black » n'est PAS un rang employé seul, et c'est délibéré : Black
        // Butler, Black Clover, Black Lagoon sont des séries. Un mot de plus
        // dans la liste, c'est un mot qui cesse d'appartenir aux titres.
        assertThat(EditionMention.lire("Black Butler").trouvee()).isFalse();
        assertThat(EditionMention.lire("Black Clover").trouvee()).isFalse();
    }

    @Test
    void an_empty_qualifier_is_refused() {
        // « belle édition » ne nomme aucune édition. Proposer « Belle Edition »
        // ferait chercher au catalogue une chose qui n'y est pas.
        assertThat(EditionMention.lire("Naruto belle édition").trouvee()).isFalse();
        assertThat(EditionMention.lire("Naruto cette édition").trouvee()).isFalse();
    }

    @Test
    void packaging_and_condition_are_not_editions() {
        // « Coffret » décrit un emballage, « TBE » un état. Ni l'un ni l'autre
        // n'est une édition, et le catalogue n'en connaît aucune de ce nom.
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
