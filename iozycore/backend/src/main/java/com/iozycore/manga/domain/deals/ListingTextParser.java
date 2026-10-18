package com.iozycore.manga.domain.deals;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Guesses what a listing contains, from its text alone.
 *
 * <h2>Deterministic, never a guesser</h2>
 * Written rules, not a model: "tomes 1 à 14" gives 1..14 because the
 * sentence says so, not because a likelihood score estimates it. A listing
 * that announces nothing precise - "lot manga divers" - produces
 * <b>nothing</b>. Making up a complete set of 12 volumes from three words
 * would build a purchase verdict computed on volumes that do not exist,
 * which is much worse than proposing nothing.
 *
 * <h2>A proposal, never a truth</h2>
 * The result is meant to be <b>confirmed by the user</b> before
 * it enters the analysis. {@link Detection#needsConfirmation()} says when the
 * doubt is such that it must be shown on the screen.
 *
 * <h2>What this class does not do</h2>
 * It does not consult the catalogue, the collection or the network: it is a
 * function from text to numbers. Matching with a known series
 * is the job of {@link SeriesMatcher}, and comparing with the owned items is the job of
 * {@link CollectionFit}.
 */
public final class ListingTextParser {

    /**
     * Above this, we refuse: "tomes 1 à 900" is a typo or another
     * use of the word, not a lot. Without this limit, an absurd range would make
     * the price per volume calculation explode.
     */
    private static final int NUMERO_DE_TOME_MAX = 300;

    /** What announces a volume number: "tome", "tomes", "volume", "vol.", "t.", "T". */
    private static final String PREFIXE_TOME = "(?:tomes?|volumes?|vol\\.?|t\\.?)";

    /**
     * "tome 1 à 14", "1 à 14", "du 1 au 14", "T1 à T6", "1-6".
     * <p>
     * The prefix is accepted <b>on both sides</b>: "T1 à T6" is as
     * common as "tomes 1 à 6", and without this the "T6" stayed stuck to the
     * title.
     */
    private static final Pattern PLAGE_EN_LETTRES = Pattern.compile(
            "(?i)\\b" + PREFIXE_TOME + "?\\s*(?:du\\s*)?(\\d{1,3})\\s*(?:à|a|au|-|–|/)\\s*"
                    + PREFIXE_TOME + "?\\s*(\\d{1,3})\\b");

    /**
     * "tomes 1, 2, 3, 5", "tomes 1 et 2" - the list must be introduced,
     * otherwise any number in the text would be a volume.
     */
    private static final Pattern LISTE_INTRODUITE = Pattern.compile(
            "(?i)\\b" + PREFIXE_TOME + "\\s*((?:\\d{1,3}\\s*(?:,|\\+|&|et)\\s*)+\\d{1,3})\\b");

    /** "tome 7" alone. */
    private static final Pattern TOME_UNIQUE = Pattern.compile(
            "(?i)\\b" + PREFIXE_TOME + "\\s*(\\d{1,3})\\b");

    /**
     * "9 tomes", "12 volumes", "9 mangas" - the number comes <b>before</b> the
     * word, and that is the whole difference: it gives the <b>size</b> of the lot, not
     * the identity of the volumes.
     *
     * <p>"9 tomes de Naruto" does not say that these are volumes 1 to 9: the
     * seller may well have volumes 14 to 22. This number is therefore read and
     * reported, <b>never unrolled into numbers</b> - making up 1 to 9 would build
     * a purchase verdict computed on volumes that nobody has seen.
     *
     * <p>The connector is swallowed <b>on both sides</b>: "9 tomes <b>de</b>
     * Naruto" puts it after, "Lot <b>de</b> 9 tomes Naruto" puts it before.
     * Without this the probable title kept an orphan "de" that no series
     * carries, and the catalogue match failed on a linking word.
     */
    private static final Pattern NOMBRE_DE_TOMES = Pattern.compile(
            "(?i)(?:\\b(?:de|du|des|d')\\s+)?\\b(\\d{1,3})\\s*(?:tomes|volumes|mangas|livres|bds)\\b"
                    + "(?:\\s+(?:de|du|des|d'))?");

    /**
     * The commercial mentions of a listing, which are not part of the name
     * of a work. Removed as <b>whole words</b>: "lot" disappears from
     * "Lot Death Note", not from "Camelot".
     */
    private static final Pattern MOTS_COMMERCIAUX = Pattern.compile(
            "(?i)\\b(?:int[ée]grale|s[ée]rie compl[èe]te|collection compl[èe]te|lot complet|coffret|lot"
                    + "|neuf|comme neuf|tbe|be)\\b");

    /**
     * The separators that a listing puts <b>around</b> its information.
     * Trimmed at the ends only: "Hell's Paradise – " loses its dash,
     * "Kaguya-sama: Love Is War" keeps its own, and a "-" in the middle of a
     * title is never touched because we cannot prove that it separates.
     *
     * <p>{@code +} and {@code &} are in it since a title like "Naruto
     * 1-3 + TBE" came out as "Naruto <b>+</b>": a string that no
     * series of the catalogue carries, so a match lost on a punctuation
     * sign left alone at the end of the line.
     */
    private static final Pattern SEPARATEURS_AUX_BORDS =
            Pattern.compile("^[\\s\\-–—|:;,/+&]+|[\\s\\-–—|:;,/+&]+$");

    /** Announces a whole set without giving its limits: we note it, we do not deduce numbers from it. */
    private static final Pattern MENTION_INTEGRALE = Pattern.compile(
            "int[ée]grale|s[ée]rie compl[èe]te|collection compl[èe]te|lot complet|coffret complet");

    /** Wordings too vague for a number found next to them to mean anything. */
    private static final Pattern MENTION_VAGUE = Pattern.compile(
            "lot (?:de )?mangas? divers|lot divers|mangas? divers|lot vari[ée]|divers mangas?|lot de livres divers");

    private ListingTextParser() {
    }

    /**
     * What the text delivered.
     *
     * @param volumeNumbers    numbers read explicitly - empty when the text does not give them
     * @param mentionsComplete the listing says "intégrale" / "série complète" without giving the limits
     * @param vague            wording too imprecise to identify anything
     * @param announcedVolumeCount how many volumes the listing says it contains, <b>without saying which</b>
     *                         ("9 tomes de Naruto") - {@code null} when it does not say.
     *                         Filled <b>only</b> when there are no numbers: when these are
     *                         known, their number can be counted, and two sources for the same quantity
     *                         would end up contradicting each other
     */
    public record Detection(Set<Integer> volumeNumbers, boolean mentionsComplete, boolean vague,
                            Integer announcedVolumeCount) {

        public Detection {
            volumeNumbers = volumeNumbers == null ? Set.of() : new TreeSet<>(volumeNumbers);
            // A number announced NEXT TO numbers that were read would be redundant at best,
            // contradictory at worst: the numbers are the reference.
            announcedVolumeCount = volumeNumbers.isEmpty() ? announcedVolumeCount : null;
        }

        public static Detection rien() {
            return new Detection(Set.of(), false, false, null);
        }

        /** The text says how many, without saying which - the only question that stays open. */
        public boolean hasAnnouncedCountOnly() {
            return volumeNumbers.isEmpty() && announcedVolumeCount != null;
        }

        public boolean hasVolumes() {
            return !volumeNumbers.isEmpty();
        }

        /**
         * True when the user must look closely before starting the analysis:
         * either nothing was identified, or the text announces a complete set
         * whose size is unknown ("intégrale" without numbers), or it is
         * deliberately vague.
         */
        public boolean needsConfirmation() {
            return vague || !hasVolumes();
        }
    }

    /** Reads the title and then, only if it gave nothing, the description - the title is far more reliable. */
    public static Detection parse(String title, String description) {
        String titre = normaliser(title);
        String texte = normaliser(description);

        boolean vague = MENTION_VAGUE.matcher(titre).find()
                || (titre.isBlank() && MENTION_VAGUE.matcher(texte).find());
        if (vague) {
            // A vague wording poisons everything around it: "lot manga
            // divers 25 pièces" does not describe volume 25.
            return new Detection(Set.of(), false, true, null);
        }

        Set<Integer> depuisTitre = numeros(titre);
        Set<Integer> numeros = !depuisTitre.isEmpty() ? depuisTitre : numeros(texte);
        boolean complete = MENTION_INTEGRALE.matcher(titre).find() || MENTION_INTEGRALE.matcher(texte).find();

        // Searched only when there are no numbers, and in the title first:
        // a chatty description often talks about something other than the lot.
        Integer nombreAnnonce = numeros.isEmpty() ? premierNombreDeTomes(titre) : null;
        if (nombreAnnonce == null && numeros.isEmpty()) {
            nombreAnnonce = premierNombreDeTomes(texte);
        }

        return new Detection(numeros, complete, false, nombreAnnonce);
    }

    /**
     * What, just before a number of volumes, describes <b>the work</b> and not the lot.
     *
     * <p>Seen on a real listing: "Manga Your evil past - Seinen
     * thriller — <b>Série en 14 tomes</b>", for a lot that contained
     * <b>six</b>. Without this guard, the screen said "the listing says 14 volumes,
     * without saying which", then blamed the user for entering
     * too few. A perfectly honest sentence from the seller became a reproach.
     *
     * <p>"Série en 14 tomes" says the <i>length of the work</i>; "lot de 9
     * tomes" says the <i>size of the sale</i>. The two look alike and do not
     * mean the same thing.
     */
    private static final Pattern DECRIT_L_OEUVRE_PAS_LE_LOT = Pattern.compile(
            "(?i)\\b(?:s[ée]ries?|collections?|sagas?|œuvres?|oeuvres?)\\b[^.;!?]{0,20}$");

    /**
     * The announced number of volumes, or {@code null}.
     *
     * <p>Only the <b>first</b>: "lot de 9 tomes, 3 séries" describes nine
     * volumes, not three. Taking the largest, or adding them up, would mean
     * interpreting a sentence that we do not understand.
     */
    private static Integer premierNombreDeTomes(String texte) {
        if (texte == null || texte.isBlank()) {
            return null;
        }
        Matcher m = NOMBRE_DE_TOMES.matcher(texte);
        while (m.find()) {
            if (DECRIT_L_OEUVRE_PAS_LE_LOT.matcher(texte.substring(0, m.start())).find()) {
                // This number describes the work, not the sale. We keep
                // reading: the same listing may then give the size of the lot.
                continue;
            }
            int n = Integer.parseInt(m.group(1));
            // 1 volume is not a lot, and above the ceiling of the numbers it
            // is no longer a lot size but another number that was misread.
            return n >= 2 && n <= NUMERO_DE_TOME_MAX ? n : null;
        }
        return null;
    }

    /**
     * What a text says about the volumes, <b>and</b> what is left of it once these
     * expressions are removed.
     *
     * <p>Returning both together is the whole point: the probable title
     * is obtained by removing <b>exactly the recognised segment</b>, never by
     * deleting all the digits and all the punctuation. "20th Century
     * Boys tomes 1 à 5" loses "tomes 1 à 5" and keeps its "20".
     *
     * @param numeros the volumes read - empty if the text describes none
     * @param reste   the text without the recognised volume expressions
     */
    record ExpressionsDeTomes(Set<Integer> numeros, String reste) {
    }

    /**
     * The numbers of a text, in order of decreasing reliability: an explicit
     * range, otherwise a list introduced by "tomes", otherwise volumes
     * quoted one by one. We go down to the next level only if the previous one gave
     * nothing - mixing the three would let in numbers that are not
     * volumes (year, price, number of pieces).
     */
    static ExpressionsDeTomes extraire(String texte) {
        if (texte == null || texte.isBlank()) {
            return new ExpressionsDeTomes(Set.of(), "");
        }
        // A range that was RECOGNISED but rejected (absurd limits, reversed order) stops
        // everything: the text clearly describes an interval that we could not read.
        // Without this guard, "tomes 1 à 900" fell back to the isolated volume
        // heuristic and returned [1] - a lot of a single volume where the listing
        // announces hundreds, so a wrong price per volume and a wrong verdict.
        //
        // The segment is still removed from the title in all cases: it does describe
        // volumes, even badly formed.
        if (PLAGE_EN_LETTRES.matcher(texte).find()) {
            return new ExpressionsDeTomes(depuisPlages(texte),
                    PLAGE_EN_LETTRES.matcher(texte).replaceAll(" "));
        }
        Set<Integer> listes = depuisListes(texte);
        if (!listes.isEmpty()) {
            return new ExpressionsDeTomes(listes, LISTE_INTRODUITE.matcher(texte).replaceAll(" "));
        }
        Set<Integer> isoles = depuisTomesIsoles(texte);
        if (!isoles.isEmpty()) {
            return new ExpressionsDeTomes(isoles, TOME_UNIQUE.matcher(texte).replaceAll(" "));
        }
        return new ExpressionsDeTomes(Set.of(), texte);
    }

    private static Set<Integer> numeros(String texte) {
        return extraire(texte).numeros();
    }

    private static Set<Integer> depuisPlages(String texte) {
        Set<Integer> numeros = new TreeSet<>();
        Matcher m = PLAGE_EN_LETTRES.matcher(texte);
        while (m.find()) {
            int debut = Integer.parseInt(m.group(1));
            int fin = Integer.parseInt(m.group(2));
            // A descending or out-of-limits range is not a range of volumes.
            if (debut >= 1 && fin >= debut && fin <= NUMERO_DE_TOME_MAX) {
                for (int i = debut; i <= fin; i++) {
                    numeros.add(i);
                }
            }
        }
        return numeros;
    }

    private static Set<Integer> depuisListes(String texte) {
        Set<Integer> numeros = new TreeSet<>();
        Matcher m = LISTE_INTRODUITE.matcher(texte);
        while (m.find()) {
            for (String morceau : m.group(1).split("(?i)\\s*(?:,|\\+|&|et)\\s*")) {
                ajouterSiValide(numeros, morceau.trim());
            }
        }
        return numeros;
    }

    private static Set<Integer> depuisTomesIsoles(String texte) {
        Set<Integer> numeros = new TreeSet<>();
        Matcher m = TOME_UNIQUE.matcher(texte);
        while (m.find()) {
            ajouterSiValide(numeros, m.group(1));
        }
        return numeros;
    }

    /**
     * The edition named in this title, or {@code null}.
     *
     * <p>Read <b>after</b> removing the volume expressions, otherwise "tomes 1 à 3
     * edition" would make "3" pass for the name of an edition.
     *
     * <p>It is only a hint: the catalogue will say whether it matches
     * an edition that is really known for the series.
     */
    public static String probableEdition(String title) {
        if (title == null || title.isBlank()) {
            return null;
        }
        String sansTomes = NOMBRE_DE_TOMES.matcher(extraire(title).reste()).replaceAll(" ");
        return EditionMention.lire(sansTomes).hint();
    }

    /**
     * Like {@link #probableEdition}, but the mention as the title writes it
     * ("Édition originale" rather than "Originale Edition").
     *
     * <p>For a book source: its title is the name of a real print run, so
     * its wording is the name of the edition, not a hint to confirm.
     */
    public static String editionAsWritten(String title) {
        if (title == null || title.isBlank()) {
            return null;
        }
        String sansTomes = NOMBRE_DE_TOMES.matcher(extraire(title).reste()).replaceAll(" ");
        return EditionMention.lire(sansTomes).ecrit();
    }

    private static void ajouterSiValide(Set<Integer> numeros, String brut) {
        if (!brut.matches("\\d{1,3}")) {
            return;
        }
        int n = Integer.parseInt(brut);
        if (n >= 1 && n <= NUMERO_DE_TOME_MAX) {
            numeros.add(n);
        }
    }

    /**
     * The probable series title: what is left once the numbers,
     * the lot words and the punctuation are removed. Handed as is to
     * {@link SeriesMatcher}, which will decide whether it matches a known series -
     * this method does not pretend to know the catalogue.
     */
    public static String probableSeriesTitle(String title) {
        if (title == null || title.isBlank()) {
            return "";
        }
        // Remove ONLY what was recognised as a volume expression, then
        // the commercial mentions, then the separators at the edges.
        //
        // This method used to remove ALL the digits and ALL the punctuation
        // before hoping that the rest was the title. "20th Century
        // Boys" became "th Century Boys" there, "Kaguya-sama: Love Is War"
        // became "Kaguya sama Love Is War", and no normalisation downstream
        // could rebuild what was destroyed. Digits and
        // punctuation often belong to the identity of a work.
        String reste = extraire(title).reste();
        // "9 tomes de Naruto" must return "Naruto", not "9 tomes de Naruto":
        // without this removal, no catalogue match was possible, and the
        // series, though named in black and white, stayed invisible.
        reste = NOMBRE_DE_TOMES.matcher(reste).replaceAll(" ");
        // Same reasoning for the edition: "Naruto Perfect Edition" came out
        // as a SERIES of this name, which the catalogue does not know - while
        // "Naruto" alone found its work page. Naming the edition, which sellers
        // do all the time, made us lose the series.
        reste = EditionMention.lire(reste).reste();
        reste = MOTS_COMMERCIAUX.matcher(reste).replaceAll(" ");
        reste = reste.replaceAll("\\s+", " ").trim();
        reste = SEPARATEURS_AUX_BORDS.matcher(reste).replaceAll("");
        return reste.replaceAll("\\s+", " ").trim();
    }

    private static String normaliser(String valeur) {
        return valeur == null ? "" : valeur.toLowerCase(Locale.ROOT);
    }

    /** Reading helper: the numbers sorted, for display and tests. */
    public static List<Integer> sorted(Set<Integer> numeros) {
        return new ArrayList<>(new LinkedHashSet<>(new TreeSet<>(numeros)));
    }
}
