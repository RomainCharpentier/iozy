package com.iozycore.core.domain.user;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * What a person chose for both apps (lot 218): read by IozyCore and by
 * IozyTest, so it follows them from one browser to another.
 *
 * <h2>Every field can be empty, and empty is a value</h2>
 * {@code null} means "never chosen on the account". The client then keeps
 * what the device already had (its local setting), instead of being reset to
 * a default the person never picked. A change names only the fields it
 * changes: {@link #merge} keeps the others.
 *
 * <h2>Only what is wired</h2>
 * The accent has two values because the charter has one brand accent: the
 * cover colors, or terracotta. The title languages are the three the add
 * search really composes (see web lib/titleLanguage).
 *
 * @param accent           the accent color: the cover's, or the brand's
 * @param appearance       light, dark, or what the system says
 * @param titleComposition the title languages, in order, each on or off
 * @param blindtestSound   the IozyTest sound effects
 */
public record AccountPreferences(Accent accent, Appearance appearance, List<TitleChoice> titleComposition,
                                 BlindtestSound blindtestSound) {

    public static final AccountPreferences NONE = new AccountPreferences(null, null, null, null);

    public AccountPreferences {
        if (titleComposition != null) {
            titleComposition = List.copyOf(titleComposition);
            checkComposition(titleComposition);
        }
    }

    /** These preferences, with each field the change names replaced. */
    public AccountPreferences merge(AccountPreferences change) {
        if (change == null) {
            return this;
        }
        return new AccountPreferences(
                change.accent != null ? change.accent : accent,
                change.appearance != null ? change.appearance : appearance,
                change.titleComposition != null ? change.titleComposition : titleComposition,
                change.blindtestSound != null ? change.blindtestSound : blindtestSound);
    }

    public enum Accent {
        /** The two tones read from the cover on screen (the default look). */
        AUTO,
        /** The brand accent of the charter, whatever the cover. */
        TERRACOTTA;

        public static Accent parse(String value) {
            return parseEnum(Accent.class, value, "Couleur inconnue : ");
        }
    }

    public enum Appearance {
        SYSTEM, DARK, LIGHT;

        public static Appearance parse(String value) {
            return parseEnum(Appearance.class, value, "Apparence inconnue : ");
        }
    }

    public enum TitleLanguage {
        FRENCH, ENGLISH, ROMAJI;

        public static TitleLanguage parse(String value) {
            return parseEnum(TitleLanguage.class, value, "Langue de titre inconnue : ");
        }
    }

    /** One title language and whether it is used. */
    public record TitleChoice(TitleLanguage language, boolean enabled) {
        public TitleChoice {
            if (language == null) {
                throw new IllegalArgumentException("Chaque langue de titre doit être nommée.");
            }
        }
    }

    /** The sound effects of IozyTest: on or off, and how loud (0 to 100). */
    public record BlindtestSound(boolean enabled, int volume) {
        public BlindtestSound {
            if (volume < 0 || volume > 100) {
                throw new IllegalArgumentException("Le volume du blindtest va de 0 à 100.");
            }
        }
    }

    /**
     * The composition as stored: "FRENCH,ROMAJI,-ENGLISH", a disabled language
     * prefixed by "-". Null stays null.
     */
    public static String encodeComposition(List<TitleChoice> composition) {
        if (composition == null) {
            return null;
        }
        List<String> parts = new ArrayList<>();
        for (TitleChoice choice : composition) {
            parts.add((choice.enabled() ? "" : "-") + choice.language().name());
        }
        return String.join(",", parts);
    }

    /** The reverse of {@link #encodeComposition}. */
    public static List<TitleChoice> decodeComposition(String stored) {
        if (stored == null || stored.isBlank()) {
            return null;
        }
        List<TitleChoice> choices = new ArrayList<>();
        for (String part : stored.split(",")) {
            String trimmed = part.trim();
            boolean enabled = !trimmed.startsWith("-");
            choices.add(new TitleChoice(TitleLanguage.parse(enabled ? trimmed : trimmed.substring(1)), enabled));
        }
        return choices;
    }

    /**
     * The three languages, each once, at least one on: with none on, the add
     * search would have no title to save.
     */
    private static void checkComposition(List<TitleChoice> composition) {
        Set<TitleLanguage> seen = EnumSet.noneOf(TitleLanguage.class);
        for (TitleChoice choice : composition) {
            if (choice == null || !seen.add(choice.language())) {
                throw new IllegalArgumentException("Chaque langue de titre doit apparaître une seule fois.");
            }
        }
        if (seen.size() != TitleLanguage.values().length) {
            throw new IllegalArgumentException("Les trois langues de titre doivent être rangées.");
        }
        if (composition.stream().noneMatch(TitleChoice::enabled)) {
            throw new IllegalArgumentException("Au moins une langue de titre doit rester cochée.");
        }
    }

    private static <E extends Enum<E>> E parseEnum(Class<E> type, String value, String message) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(message + "(vide)");
        }
        try {
            return Enum.valueOf(type, value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException unknown) {
            throw new IllegalArgumentException(message + value);
        }
    }
}
