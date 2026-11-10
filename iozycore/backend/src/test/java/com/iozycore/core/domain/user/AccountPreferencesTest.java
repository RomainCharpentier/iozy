package com.iozycore.core.domain.user;

import com.iozycore.core.domain.user.AccountPreferences.Accent;
import com.iozycore.core.domain.user.AccountPreferences.Appearance;
import com.iozycore.core.domain.user.AccountPreferences.BlindtestSound;
import com.iozycore.core.domain.user.AccountPreferences.TitleChoice;
import com.iozycore.core.domain.user.AccountPreferences.TitleLanguage;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AccountPreferencesTest {

    private static final List<TitleChoice> ROMAJI_FIRST = List.of(
            new TitleChoice(TitleLanguage.ROMAJI, true),
            new TitleChoice(TitleLanguage.FRENCH, true),
            new TitleChoice(TitleLanguage.ENGLISH, false));

    @Test
    void a_change_replaces_only_the_fields_it_names() {
        AccountPreferences before = new AccountPreferences(Accent.TERRACOTTA, Appearance.LIGHT, ROMAJI_FIRST,
                new BlindtestSound(true, 70));

        AccountPreferences after = before.merge(new AccountPreferences(null, Appearance.DARK, null, null));

        assertThat(after).isEqualTo(new AccountPreferences(Accent.TERRACOTTA, Appearance.DARK, ROMAJI_FIRST,
                new BlindtestSound(true, 70)));
    }

    @Test
    void the_composition_is_stored_in_order_with_disabled_languages_marked() {
        String stored = AccountPreferences.encodeComposition(ROMAJI_FIRST);

        assertThat(stored).isEqualTo("ROMAJI,FRENCH,-ENGLISH");
        assertThat(AccountPreferences.decodeComposition(stored)).isEqualTo(ROMAJI_FIRST);
        assertThat(AccountPreferences.decodeComposition(null)).isNull();
    }

    @Test
    void a_composition_needs_the_three_languages_once_and_one_of_them_on() {
        assertThatThrownBy(() -> new AccountPreferences(null, null, List.of(
                new TitleChoice(TitleLanguage.FRENCH, true),
                new TitleChoice(TitleLanguage.ROMAJI, true)), null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new AccountPreferences(null, null, List.of(
                new TitleChoice(TitleLanguage.FRENCH, true),
                new TitleChoice(TitleLanguage.FRENCH, false),
                new TitleChoice(TitleLanguage.ENGLISH, true)), null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new AccountPreferences(null, null, List.of(
                new TitleChoice(TitleLanguage.FRENCH, false),
                new TitleChoice(TitleLanguage.ROMAJI, false),
                new TitleChoice(TitleLanguage.ENGLISH, false)), null))
                .hasMessage("Au moins une langue de titre doit rester cochée.");
    }

    @Test
    void the_volume_stays_between_0_and_100() {
        assertThat(new BlindtestSound(false, 0).volume()).isZero();
        assertThat(new BlindtestSound(true, 100).volume()).isEqualTo(100);
        assertThatThrownBy(() -> new BlindtestSound(true, 101)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new BlindtestSound(true, -1)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void a_value_is_read_whatever_its_case_and_an_unknown_one_is_named() {
        assertThat(Accent.parse("terracotta")).isEqualTo(Accent.TERRACOTTA);
        assertThat(Appearance.parse(" system ")).isEqualTo(Appearance.SYSTEM);
        assertThatThrownBy(() -> Accent.parse("violet")).hasMessage("Couleur inconnue : violet");
    }

    @Test
    void a_pseudo_change_keeps_the_sign_up_form() {
        AppUser account = AppUser.nouveau("a@example.com", "{noop}x", "Alice");

        assertThat(account.withPseudo("  Rémi_2 ").pseudo()).isEqualTo("Rémi_2");
        assertThat(account.withPseudo("Rémi_2").id()).isEqualTo(account.id());
        assertThatThrownBy(() -> account.withPseudo("a b c")).hasMessage(AppUser.PSEUDO_RULE);
        assertThatThrownBy(() -> account.withPseudo(null)).isInstanceOf(IllegalArgumentException.class);
    }
}
