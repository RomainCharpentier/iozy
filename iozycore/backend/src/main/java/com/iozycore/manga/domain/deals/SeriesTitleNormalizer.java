package com.iozycore.manga.domain.deals;

/**
 * Removes the <b>listing decoration</b> around a series title, before
 * looking it up in the catalogue.
 *
 * <h2>The flaw that was fixed</h2>
 * A listing is titled "🔥 Hell's Paradise — Tomes 6 à 10". The probable
 * title taken from it keeps its emoji, and "🔥 Hell's Paradise" does not
 * match any "Hell's Paradise" page: the series exists in the
 * catalogue, but it comes out as "not yet in your catalogue". The seller
 * decorated their listing, not the name of the work.
 *
 * <h2>Edges only - the rule that holds this whole file together</h2>
 * We only remove what <b>surrounds</b> the title, never what it is made of.
 * A real title legitimately contains apostrophes, dashes, colons, exclamation
 * or question marks: {@code K-ON!},
 * {@code Kaguya-sama: Love Is War}, {@code D.Gray-man},
 * {@code Don't Call It Mystery}. Trimming them "to simplify" would replace
 * a title that cannot be found with another one.
 *
 * <p>A symbol <b>in the middle</b> of a title is therefore kept without discussion:
 * nothing allows us to say that it decorates rather than names.
 *
 * <h2>What "decorative" means, precisely</h2>
 * The Unicode categories of symbols ({@code So}, {@code Sk} - emoji, stars,
 * pictograms), opening/closing brackets and quotation marks, dashes, and
 * the invisible formatting characters (variation selectors, zero-width joiners)
 * that an emoji drags behind it. Ordinary punctuation is
 * <b>not</b> part of it: this is what saves {@code K-ON!}.
 *
 * <h2>Normalising is not rewriting</h2>
 * The original text stays available elsewhere (see
 * {@code RecognizedItem.seriesTitleRaw}): this class produces the candidate
 * sent to the catalogue, not the trace of what the listing said.
 */
public final class SeriesTitleNormalizer {

    private SeriesTitleNormalizer() {
    }

    /**
     * The title without its edge decoration.
     *
     * <p>Returns the original title (simply trimmed) if the cleaning left
     * nothing: a title made entirely of symbols cannot be used,
     * but replacing it with an empty string would lose the only information
     * available.
     */
    public static String normalize(String rawTitle) {
        if (rawTitle == null) {
            return "";
        }
        String titre = rawTitle.trim();
        if (titre.isEmpty()) {
            return "";
        }

        int debut = 0;
        int fin = titre.length();

        while (debut < fin) {
            int codePoint = titre.codePointAt(debut);
            if (!estDecoratif(codePoint)) {
                break;
            }
            debut += Character.charCount(codePoint);
        }

        while (fin > debut) {
            int codePoint = titre.codePointBefore(fin);
            if (!estDecoratif(codePoint)) {
                break;
            }
            fin -= Character.charCount(codePoint);
        }

        // The multiple spaces left by the removed decoration: "🔥  Hell's
        // Paradise" must not become "␣Hell's Paradise".
        String nettoye = titre.substring(debut, fin).replaceAll("\\s+", " ").trim();
        return nettoye.isEmpty() ? titre : nettoye;
    }

    /**
     * True for a character that decorates a title without being part of it.
     *
     * <p>Deliberately restrictive: everything that is not listed here survives.
     * Being wrong by keeping a character costs a missed match; being
     * wrong by removing it builds a title that does not exist.
     */
    private static boolean estDecoratif(int codePoint) {
        if (Character.isWhitespace(codePoint) || estSelecteurDeVariante(codePoint)) {
            return true;
        }
        return switch (Character.getType(codePoint)) {
            // Emoji, stars, pictograms, modifier symbols.
            case Character.OTHER_SYMBOL, Character.MODIFIER_SYMBOL -> true;
            // 【 】 ( ) [ ] « » “ ” - a real title neither opens nor closes on its edges.
            case Character.START_PUNCTUATION, Character.END_PUNCTUATION,
                 Character.INITIAL_QUOTE_PUNCTUATION, Character.FINAL_QUOTE_PUNCTUATION -> true;
            // Dashes and em dashes used as separators: "Hell's Paradise — " .
            case Character.DASH_PUNCTUATION -> true;
            // Zero-width joiners and other formatting characters: the invisible
            // junk that an emoji leaves behind it.
            case Character.FORMAT, Character.CONTROL, Character.UNASSIGNED -> true;
            default -> false;
        };
    }

    /**
     * The variation selectors, targeted <b>by name</b> rather than by their
     * Unicode category.
     *
     * <p>U+FE0F - the one that follows "❤" to make it a coloured emoji - is
     * classed {@code Mn}, like combining accents. Removing the whole
     * category would turn a decomposed "Café" (e + acute accent) into
     * "Cafe" when the accent is in last position. A decoration fix
     * must not change the spelling of a title.
     */
    private static boolean estSelecteurDeVariante(int codePoint) {
        return (codePoint >= 0xFE00 && codePoint <= 0xFE0F)
                || (codePoint >= 0xE0100 && codePoint <= 0xE01EF);
    }
}
