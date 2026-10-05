package com.iozycore.manga.recognition;

import com.iozycore.manga.deals.ListingTextParser;

import java.util.ArrayList;
import java.util.List;

/**
 * Turns what the <b>text</b> of a listing already announces into proposals,
 * in the same form as the ones coming from the photos.
 *
 * <h2>Why the text first</h2>
 * "Platinum End intégrale tomes 1 à 14" says everything. Understanding it needs
 * no network call, no model, no euro, no second of waiting: written rules
 * are enough. Asking a vision engine to find again what the
 * seller wrote in black and white would be paying to guess information
 * that is already given.
 *
 * <h2>The sharing with {@link ListingTextParser}</h2>
 * This class was first a simple adapter: the parser read, it
 * converted its {@code Detection} into {@link RecognizedItem}, nothing more.
 * Since then it has taken on one responsibility, and only one - <b>splitting a title
 * that lists several works</b> ({@code plusieursSeries}).
 *
 * <p>This splitting lives here and not in the parser because it reads nothing: it
 * <i>re-reads</i> each segment with the rules of the parser, unchanged. The
 * border therefore still holds, but it is no longer "no logic here":
 * it is <b>"every reading of a text is done in the parser"</b>. The
 * numbers, the volumes, the probable title and the edition all come from it.
 *
 * <h2>Extraction is not truth</h2>
 * The proposals returned here carry {@link RecognitionConfidence#HIGH}
 * because the <b>reading</b> is certain: the sentence says "1 to 14". This does not
 * mean the seller has these fourteen volumes in hand. It is
 * {@link RecognitionSource#TEXT} that carries this nuance, and the screen that
 * shows it - never a score that would mix the two.
 */
public final class ListingTextRecognizer {

    /**
     * Beyond that, we do not unroll: "volumes 1 to 300" is already bounded by the
     * parser, but producing three hundred lines to tick would be unusable.
     * A batch of this size is entered another way.
     */
    static final int MAX_ELEMENTS = 60;

    private ListingTextRecognizer() {
    }

    /**
     * What the title and the description allow us to propose - empty if the
     * text says nothing precise.
     *
     * <p>Returning an empty list is a perfectly normal result: "nice batch
     * of mangas" describes no volume, and inventing a complete set from
     * three words would produce a purchase verdict computed on volumes that
     * do not exist.
     */
    public static List<RecognizedItem> recognize(String title, String description) {
        return read(title, description).items();
    }

    /**
     * What the text delivered: the proposals, <b>and</b> what it says about the batch
     * without allowing us to propose anything from it.
     *
     * <h2>"9 tomes de Naruto"</h2>
     * This listing says two true things - a series, and a size - and one
     * thing it does not say: <b>which ones</b>. Until now everything was lost:
     * no readable number, so empty list, so silent screen.
     *
     * <p>Unrolling 1 to 9 would have been the easy gesture and the wrong one: the seller
     * may have volumes 14 to 22, and a purchase verdict computed on invented
     * volumes would be wrong with the confidence of a calculation. These two facts are therefore
     * reported <b>next to</b> the proposals, never inside them - it is up to the screen to
     * ask the only question that remains open.
     *
     * @param items the confirmable proposals - empty when nothing is identifiable
     * @param announcedVolumeCount how many volumes the listing says it contains without saying which ones,
     *                             {@code null} otherwise. Never set at the same time as {@code items}
     * @param announcedSeriesTitle the series named by the title when only the number was missing,
     *                             {@code null} if the title names no plausible work
     */
    public record TextReading(List<RecognizedItem> items, Integer announcedVolumeCount,
                              String announcedSeriesTitle) {

        public TextReading {
            items = items == null ? List.of() : List.copyOf(items);
        }

        static TextReading rien() {
            return new TextReading(List.of(), null, null);
        }
    }

    public static TextReading read(String title, String description) {
        // A title that lists SEVERAL series is read segment by segment.
        // Tried first, and dropped silently if it does not hold: see
        // plusieursSeries.
        List<RecognizedItem> multi = plusieursSeries(title);
        if (!multi.isEmpty()) {
            return new TextReading(multi, null, null);
        }

        ListingTextParser.Detection detection = ListingTextParser.parse(title, description);

        // Neither readable numbers nor a usable wording: we stay silent, and the
        // photos or manual entry take over.
        if (!detection.hasVolumes()) {
            return detection.hasAnnouncedCountOnly()
                    ? nombreSeul(title, detection.announcedVolumeCount())
                    : TextReading.rien();
        }

        String serie = ListingTextParser.probableSeriesTitle(title);
        if (!estUnTitreDeSerie(serie)) {
            // Numbers without an identifiable work do not make proposals:
            // "lot mangas 1 à 10" does not say WHAT it is about, and ten lines
            // "mangas · tome N" would help nobody - they would even harm,
            // by making up a series that does not exist.
            return TextReading.rien();
        }

        List<Integer> numeros = ListingTextParser.sorted(detection.volumeNumbers());
        if (numeros.size() > MAX_ELEMENTS) {
            return TextReading.rien();
        }

        String raison = evidence(numeros);
        // The edition that the title names, if it names one. Always a simple
        // hint: the catalog will say whether it knows this edition for this
        // series, and nothing is assumed when the title is silent.
        String edition = ListingTextParser.probableEdition(title);
        List<RecognizedItem> propositions = new ArrayList<>(numeros.size());
        for (Integer numero : numeros) {
            propositions.add(RecognizedItem.fromText(serie, numero, edition, raison));
        }
        return new TextReading(propositions, null, null);
    }

    /**
     * The separators that a listing puts <b>between two works</b>.
     *
     * <p>The dash is deliberately absent: it separates volumes much more
     * often than series ("1-3"), and it belongs to whole titles
     * ("Kaguya-sama"). Splitting on it would break more than it would fix.
     */
    private static final java.util.regex.Pattern SEPARATEURS_DE_SERIES =
            java.util.regex.Pattern.compile("(?i)\\s*(?:\\+|,|;|/|&|\\bet\\b)\\s*");

    /** Beyond that, it is no longer an enumeration of works but a shopping list. */
    private static final int MAX_SERIES = 8;

    /**
     * The proposals of a title that lists <b>several</b> series.
     *
     * <h2>What happened before</h2>
     * "Death Note 1-3 + Bakuman 1-2" did not return "one series out of two":
     * it returned <b>three volumes attributed to a series named "Death Note +
     * Bakuman"</b>. Two damages at once - a title that will never match
     * the catalog, and above all <b>two books gone</b> from the count,
     * volumes 1-2 of Bakuman having been merged into the range 1-3. A batch of
     * five books counted five times cheaper per volume gives a flattering
     * price per volume, hence a purchase verdict that is too favourable.
     *
     * <h2>The rule, deliberately timid</h2>
     * The title is split, each segment re-read by the rules <b>already
     * written</b>, and the multi-series reading is kept only if <b>at least
     * two</b> segments each deliver a plausible series <i>and</i> its
     * own volumes. Otherwise we return an empty list and the caller takes the
     * previous path, identically.
     *
     * <p>This requirement of two valid segments is what makes the splitting
     * safe. The separators are also used <b>inside</b> a
     * normal reading - "volumes 1, 2, 4" is a list, "1/5" a range,
     * "Jojo's Bizarre Adventure, Part 4" a title - but none of these cases
     * produces two segments that each carry a work and volumes. They
     * therefore all fall back on the existing behaviour.
     */
    private static List<RecognizedItem> plusieursSeries(String title) {
        if (title == null || title.isBlank()) {
            return List.of();
        }
        String[] segments = SEPARATEURS_DE_SERIES.split(title);
        if (segments.length < 2 || segments.length > MAX_SERIES * 2) {
            return List.of();
        }

        // Each segment is re-read ALONE: its volumes belong only to it,
        // which is exactly what the global reading could not do.
        List<RecognizedItem> propositions = new ArrayList<>();
        int seriesValides = 0;
        for (String segment : segments) {
            ListingTextParser.Detection lu = ListingTextParser.parse(segment, null);
            if (!lu.hasVolumes()) {
                continue;
            }
            String serie = ListingTextParser.probableSeriesTitle(segment);
            if (!estUnTitreDeSerie(serie)) {
                continue;
            }

            List<Integer> numeros = ListingTextParser.sorted(lu.volumeNumbers());
            String raison = evidence(numeros);
            // Per segment: in "Naruto Perfect Edition 1-3 + Bleach 1-2",
            // the edition belongs only to the first series.
            String edition = ListingTextParser.probableEdition(segment);
            for (Integer numero : numeros) {
                propositions.add(RecognizedItem.fromText(serie, numero, edition, raison));
            }
            seriesValides++;
        }

        // A single recognised series does not prove there were several:
        // the separator was then playing another role. We touch nothing.
        if (seriesValides < 2 || propositions.size() > MAX_ELEMENTS) {
            return List.of();
        }
        return List.copyOf(propositions);
    }

    /**
     * The case "the listing says how many, not which ones".
     *
     * <p>No proposal is produced - there is nothing to tick. What is
     * reported is what the listing really claims: a size, and a
     * series if the title names one. If the title names no plausible
     * work ("lot de 9 mangas"), the number is kept alone: it stays
     * true, and it will be used to check what the user enters.
     */
    private static TextReading nombreSeul(String title, Integer nombre) {
        String serie = ListingTextParser.probableSeriesTitle(title);
        return new TextReading(List.of(), nombre, estUnTitreDeSerie(serie) ? serie : null);
    }

    /**
     * The words that often remain after cleaning without naming a work.
     * {@code ListingTextParser.probableSeriesTitle} already removes "lot",
     * "intégrale", the numbers and the punctuation, but not the name of the medium
     * nor the isolated connectors: "Lot mangas 1 à 10" leaves it
     * "mangas à". This is not a series title.
     */
    private static final java.util.Set<String> MOTS_SANS_OEUVRE = java.util.Set.of(
            "manga", "mangas", "livre", "livres", "bd", "bds", "tome", "tomes", "volume", "volumes",
            "serie", "série", "series", "séries", "collection", "edition", "édition", "editions", "éditions",
            "a", "à", "au", "aux", "de", "des", "du", "et", "en", "le", "la", "les", "un", "une");

    /**
     * True if what remains after cleaning can reasonably name a
     * work. We require at least one word that is neither a medium name, nor a
     * connector, nor a condition abbreviation - otherwise we prefer to stay silent and
     * let the photos or manual entry answer.
     */
    private static boolean estUnTitreDeSerie(String candidat) {
        if (candidat == null || candidat.isBlank()) {
            return false;
        }
        for (String mot : candidat.toLowerCase(java.util.Locale.ROOT).split("\\s+")) {
            String propre = mot.trim();
            if (propre.length() >= 2 && !MOTS_SANS_OEUVRE.contains(propre)) {
                return true;
            }
        }
        return false;
    }

    /**
     * A short and readable reason, without copying the text of the listing: we
     * say what was understood, not what was read word for word.
     */
    private static String evidence(List<Integer> numeros) {
        if (numeros.size() == 1) {
            return "tome %d annoncé dans l'annonce".formatted(numeros.get(0));
        }
        int premier = numeros.get(0);
        int dernier = numeros.get(numeros.size() - 1);
        boolean continu = dernier - premier + 1 == numeros.size();
        return continu
                ? "tomes %d à %d annoncés dans l'annonce".formatted(premier, dernier)
                : "%d tomes annoncés dans l'annonce".formatted(numeros.size());
    }
}
