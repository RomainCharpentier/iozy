package com.iozycore.manga.recognition;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Merges into a single item what is the same volume seen on several photos.
 *
 * <h2>The problem</h2>
 * A seller photographs their batch from the front, then from the side, then in close-up.
 * Volume 4 appears on three photos. Without this step, the analysis would count
 * <b>three</b> volumes 4: the price per volume would be divided by three, the
 * completeness wrong, and the purchase verdict computed on a batch that does not exist.
 *
 * <h2>The grouping key</h2>
 * Normalised title + volume number. The normalisation removes accents, case,
 * punctuation and multiple spaces: "Platinum End", "platinum end" and
 * "PLATINUM-END" come together. It goes no further - no edition
 * distance, no synonyms: matching "Naruto" and "Boruto" because
 * they look alike would do far more damage than leaving two lines
 * on screen, which the user merges with one action.
 *
 * <h2>What stays separate, deliberately</h2>
 * A volume <b>with no number read</b> does not merge into any numbered volume: "Death
 * Note, tome inconnu" and "Death Note tome 3" may be the same book or
 * two different books, and nothing on the photo allows us to decide. Merging
 * them would invent a certainty; leaving them side by side lets
 * the user decide.
 *
 * <h2>The number and the edition do not follow the same rule - and this is intended</h2>
 * A missing number blocks the merge, a missing edition does not block it.
 * The asymmetry is deliberate:
 * <ul>
 *   <li>the <b>volume number</b> is what <i>identifies</i> an item in a
 *       batch. Two "Death Note" with no number may be volumes 1 and 5;
 *       merging them into one would make a book disappear from the count;</li>
 *   <li>the <b>edition</b> is an <i>attribute</i> of an item already identified by
 *       its series and its number. "Vinland Saga 7" and "Vinland Saga 7,
 *       Standard" almost always designate the same book, whose edition
 *       was simply not readable on one of the two photos. A missing
 *       edition is missing information, not a different edition:
 *       completing it with the only available reading invents nothing.</li>
 * </ul>
 * On the other hand, two editions <b>both read and different</b> stay
 * two items: there, the photos contradict each other, and it is up to the user to
 * decide.
 */
public final class RecognitionConsolidator {

    private RecognitionConsolidator() {
    }

    /**
     * Merges the duplicates, keeping the trace of <b>all</b> the photos
     * that supported each item - the user must be able to check on
     * the image where a proposal comes from.
     */
    public static List<RecognizedItem> consolidate(List<RecognizedItem> bruts) {
        if (bruts == null || bruts.isEmpty()) {
            return List.of();
        }

        // LinkedHashMap: the order of first appearance is that of the photos,
        // hence the one the user has in front of them.
        Map<String, List<RecognizedItem>> parSerieEtTome = new LinkedHashMap<>();
        List<RecognizedItem> sansNumero = new ArrayList<>();

        for (RecognizedItem item : bruts) {
            if (item == null) {
                continue;
            }
            if (item.volumeNumber() == null) {
                // See the Javadoc: a volume with no number does not merge into anything.
                // It is only deduplicated against its exact equals.
                fusionnerSansNumero(sansNumero, item);
                continue;
            }
            parSerieEtTome.computeIfAbsent(cleSerieEtTome(item), c -> new ArrayList<>()).add(item);
        }

        List<RecognizedItem> consolides = new ArrayList<>();
        parSerieEtTome.values().forEach(groupe -> consolides.addAll(fusionnerParEdition(groupe)));
        consolides.addAll(sansNumero);
        return List.copyOf(consolides);
    }

    /**
     * In a group of the same series and the same volume, merges the ones whose editions
     * are <b>compatible</b> - equal, or one not read. Two editions that were read and
     * are different stay separate: see the Javadoc of the class.
     */
    private static List<RecognizedItem> fusionnerParEdition(List<RecognizedItem> groupe) {
        List<RecognizedItem> fusionnes = new ArrayList<>();
        for (RecognizedItem item : groupe) {
            boolean absorbe = false;
            for (int i = 0; i < fusionnes.size(); i++) {
                if (editionsCompatibles(fusionnes.get(i), item)) {
                    fusionnes.set(i, fusionnes.get(i).mergedWith(item));
                    absorbe = true;
                    break;
                }
            }
            if (!absorbe) {
                fusionnes.add(item);
            }
        }
        return fusionnes;
    }

    private static boolean editionsCompatibles(RecognizedItem a, RecognizedItem b) {
        if (a.editionIsUnknown() || b.editionIsUnknown()) {
            return true;
        }
        return normaliser(a.editionHint()).equals(normaliser(b.editionHint()));
    }

    /**
     * Two "Death Note, tome inconnu" on two photos may be two
     * real copies. We merge them only if they carry the same edition
     * hint AND the same source photo - in other words if it is
     * obviously the same reading reported twice.
     */
    private static void fusionnerSansNumero(List<RecognizedItem> accumules, RecognizedItem item) {
        for (int i = 0; i < accumules.size(); i++) {
            RecognizedItem existant = accumules.get(i);
            boolean memeTitre = cleTitre(existant).equals(cleTitre(item));
            boolean memeEdition = java.util.Objects.equals(existant.editionHint(), item.editionHint());
            boolean memePhoto = !java.util.Collections.disjoint(existant.sourceImages(), item.sourceImages());
            if (memeTitre && memeEdition && memePhoto) {
                accumules.set(i, existant.mergedWith(item));
                return;
            }
        }
        accumules.add(item);
    }

    /**
     * The edition does <b>not</b> enter this key: it is arbitrated afterwards
     * by {@link #fusionnerParEdition}, which knows how to tell "not read" from
     * "read and different". Putting it here would separate "volume 7" from "volume 7,
     * Standard", that is, the duplicate that this class exists to avoid.
     */
    private static String cleSerieEtTome(RecognizedItem item) {
        return cleTitre(item) + "|" + item.volumeNumber();
    }

    private static String cleTitre(RecognizedItem item) {
        return normaliser(item.seriesTitleRaw());
    }

    /** Lowercase, without accents, without punctuation, spaces reduced. */
    static String normaliser(String valeur) {
        if (valeur == null) {
            return "";
        }
        String sansAccents = Normalizer.normalize(valeur, Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
        return sansAccents.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", " ")
                .trim();
    }
}
