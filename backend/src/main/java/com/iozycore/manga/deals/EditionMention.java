package com.iozycore.manga.deals;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The edition named in the title of a listing — "Naruto <b>Perfect
 * Edition</b> tomes 1 à 3".
 *
 * <h2>What its absence cost, and it was not only the edition</h2>
 * The parser did not read the edition: it stayed stuck to the title. "Naruto
 * Perfect Edition" came out as a <b>series named "Naruto Perfect
 * Edition"</b>, which the catalogue obviously does not know — where "Naruto"
 * alone found its work page and its editions.
 *
 * <p>Mentioning the edition, which sellers do all the time, therefore made us
 * <b>lose the series</b>. Missing one piece of information destroyed another.
 *
 * <h2>A list, and why it cannot be avoided</h2>
 * The first version bet on the word "édition" to qualify its neighbour,
 * with no list to maintain. It read "Death Note edition" as an edition
 * <b>"Note"</b>: nothing in the phrase says which of the two words is the name
 * of the work and which is the name of the printing.
 *
 * <p>The qualifier must therefore be <b>recognised</b> — except at one position: when
 * it <b>follows</b> the word "édition". There is no ambiguity there, because nobody
 * writes the name of the work after this word; "édition Hokage" reads by itself,
 * and any qualifier is accepted there.
 *
 * <h2>Miss an edition, never make one up</h2>
 * "Dragon Ball Star Edition" is not recognised: "Star" is not in the
 * list. This is an accepted gap — the item stays "edition to confirm",
 * exactly as before, and the user decides. The opposite error would be
 * much more costly: a made-up hint makes the catalogue look for an edition
 * that does not exist, and makes a perfectly identified item look doubtful.
 *
 * <h2>What is deliberately not an edition</h2>
 * "Coffret" describes a packaging, "neuf" and "TBE" a condition, "lot" a
 * sale. These words are removed from the title by {@code MOTS_COMMERCIAUX} and have
 * no place in an edition hint.
 */
public final class EditionMention {

    /**
     * The edition qualifiers of French-language manga.
     *
     * <p>Each entry is a word that no longer belongs to work titles:
     * the list is therefore short and can be justified word by word. "Black" is not in it
     * — <i>Black Butler</i>, <i>Black Clover</i>, <i>Black Lagoon</i> are
     * series. Neither is "Star", for the same reason.
     */
    private static final Set<String> QUALIFIANTS = Set.of(
            "perfect", "deluxe", "luxe", "prestige", "collector", "integrale",
            "originale", "original", "limitee", "limite", "souple", "double",
            "simple", "anniversaire", "ultimate", "kanzenban", "bunko", "shinsoban");

    /**
     * The ranks that a seller writes alone, without the word "édition".
     *
     * <p><b>"Intégrale" is not in it</b>, and the absence is instructive. This word
     * already carries a meaning in this code: {@code MENTION_INTEGRALE} makes it a
     * <i>completeness</i> signal — "the lot contains the whole series" — not a
     * name of a printing. Adding it here was tried and rejected by the tests: on
     * "Platinum End intégrale tomes 1 à 14", the text proposed fourteen volumes
     * in the "Intégrale" edition while the photos saw twelve in
     * "Standard", and the consolidation - which rightly refuses to merge
     * two different editions - returned <b>twenty-six</b> volumes for a lot of
     * fourteen.
     *
     * <p>It stays accepted in {@link #QUALIFIANTS}, that is, only
     * next to the word "édition": "édition intégrale" does name a printing,
     * where "intégrale" alone describes a whole set.
     */
    private static final Set<String> RANGS_SEULS = Set.of(
            "perfect", "deluxe", "prestige", "collector", "kanzenban", "bunko");

    /**
     * The flags, and why they are not optional.
     *
     * <p>{@code \b} in Java relies on {@code \w}, which by default is
     * {@code [a-zA-Z0-9_]}: <b>"é" is not a word character there</b>. A word
     * boundary placed before "édition" therefore never triggers, and
     * all the French patterns failed silently — "Naruto édition
     * Hokage" returned nothing at all. {@code UNICODE_CHARACTER_CLASS} puts
     * the accented letters on the right side.
     */
    private static final int DRAPEAUX =
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE | Pattern.UNICODE_CHARACTER_CLASS;

    /**
     * "… édition Hokage": a word <b>follows</b> "édition".
     *
     * <p>This is the only position where an unknown qualifier is accepted, and it
     * is safe by construction: nobody writes the name of the work after the
     * word "édition". The ambiguity that made us drop the first version
     * was the other position — "Death Note edition", where nothing says which of
     * the two previous words is the work.
     *
     * <p>The accent is not required: sellers write "edition Hokage"
     * as often as "édition Hokage", and the construction is the same.
     */
    private static final Pattern EDITION_PUIS_MOT =
            Pattern.compile("\\b[ée]ditions?\\s+([\\p{L}0-9'’-]{2,})\\b", DRAPEAUX);

    /** "… Perfect Edition", "… édition collector" - the qualifier must be recognised. */
    private static final Pattern QUALIFIANT_ET_EDITION =
            Pattern.compile("\\b([\\p{L}0-9'’-]{2,})\\s+[ée]ditions?\\b", DRAPEAUX);

    private static final Pattern EDITION_ET_QUALIFIANT =
            Pattern.compile("\\b[ée]ditions?\\s+([\\p{L}0-9'’-]{2,})\\b", DRAPEAUX);

    private static final Pattern RANG_SEUL = Pattern.compile(
            "\\b(perfect|deluxe|prestige|collector|kanzenban|bunko)\\b", DRAPEAUX);

    /**
     * What a title says about its edition, and what is left of it without that.
     *
     * @param hint  the label read, formatted ("Perfect Edition") — {@code null}
     *              if the title names no recognisable edition
     * @param reste the title without this mention, ready for the series search
     */
    public record Lecture(String hint, String reste) {

        static Lecture aucune(String titre) {
            return new Lecture(null, titre == null ? "" : titre);
        }

        public boolean trouvee() {
            return hint != null;
        }
    }

    private EditionMention() {
    }

    /**
     * @param titre the title of the listing, <b>already without its volume
     *              expressions</b> — otherwise "tomes 1 à 3 edition" could pass
     *              for an edition named "3"
     */
    public static Lecture lire(String titre) {
        if (titre == null || titre.isBlank()) {
            return Lecture.aucune(titre);
        }

        // 1. "édition Hokage": the only case where an unknown word is accepted,
        //    because the French construction leaves no doubt about
        //    which of the two words qualifies the other.
        Matcher francaise = EDITION_PUIS_MOT.matcher(titre);
        if (francaise.find() && !estCreux(francaise.group(1))) {
            return retenir(titre, francaise, francaise.group(1));
        }

        // 2. A RECOGNISED qualifier, before or after the word "edition".
        for (Pattern motif : List.of(QUALIFIANT_ET_EDITION, EDITION_ET_QUALIFIANT)) {
            Matcher m = motif.matcher(titre);
            while (m.find()) {
                if (estUnQualifiant(m.group(1))) {
                    return retenir(titre, m, m.group(1));
                }
            }
        }

        // 3. A rank used alone: "Naruto Perfect tomes 1 à 3".
        Matcher rang = RANG_SEUL.matcher(titre);
        if (rang.find()) {
            return new Lecture(capitaliser(rang.group(1)), retirer(titre, rang.start(), rang.end()));
        }

        return Lecture.aucune(titre);
    }

    private static Lecture retenir(String titre, Matcher m, String qualifiant) {
        return new Lecture(capitaliser(qualifiant) + " Edition", retirer(titre, m.start(), m.end()));
    }

    private static String retirer(String titre, int debut, int fin) {
        return (titre.substring(0, debut) + " " + titre.substring(fin)).replaceAll("\\s+", " ").trim();
    }

    /**
     * The words that follow "édition" without qualifying it.
     *
     * <p>Two families, and both are needed since the accent
     * is no longer required:
     * <ul>
     *   <li>the <b>stop words</b> — "édition de collection" would otherwise
     *       propose an edition "De Edition";</li>
     *   <li>the <b>conditions and sale mentions</b> — "Naruto Perfect Edition
     *       neuf" would otherwise propose an edition "Neuf Edition", while "neuf"
     *       describes the copy and "Perfect" is the real qualifier.</li>
     * </ul>
     */
    private static final Set<String> QUALIFIANTS_CREUX = Set.of(
            "belle", "beau", "bel", "cette", "cet", "ce", "une", "un", "la", "le", "les",
            "des", "de", "du", "en", "et", "son", "sa", "leur", "grande", "grand",
            "petite", "petit", "bonne", "bon", "super", "tres", "avec", "sans", "pour",
            // conditions and sale mentions
            "neuf", "tbe", "be", "occasion", "complet", "complete", "complets", "completes",
            "lot", "coffret", "tome", "tomes", "volume", "volumes", "manga", "mangas",
            "livre", "livres", "serie", "series", "prix", "port", "envoi", "vends", "vendu");

    private static boolean estCreux(String mot) {
        return mot == null || QUALIFIANTS_CREUX.contains(sansAccents(mot));
    }

    private static boolean estUnQualifiant(String mot) {
        return mot != null && QUALIFIANTS.contains(sansAccents(mot));
    }

    /** "Intégrale" and "integrale" mean the same thing; the list does not have to carry them twice. */
    private static String sansAccents(String mot) {
        return Normalizer.normalize(mot.trim().toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
    }

    /**
     * Rendered as one would write it, not as it was typed: the label ends up
     * in the lot and then in the saved analysis, and "PERFECT edition" would
     * look bad there next to the catalogue editions.
     */
    private static String capitaliser(String mot) {
        String propre = mot.trim();
        if (propre.isEmpty()) {
            return propre;
        }
        return Character.toUpperCase(propre.charAt(0)) + propre.substring(1).toLowerCase(Locale.ROOT);
    }

    /** True if this label is a rank used alone - exposed for the tests. */
    static boolean estUnRangConnu(String mot) {
        return mot != null && RANGS_SEULS.contains(sansAccents(mot));
    }
}
