package com.iozycore.manga.recognition;

import java.util.ArrayList;
import java.util.Collections;
import java.util.EnumSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

/**
 * An item that IozyCore thinks it sees in a listing - <b>before</b> any
 * matching with the catalog.
 *
 * <h2>One single form, several sources</h2>
 * The same record describes what was read in the title, what was seen on a
 * photo, and what a barcode confirmed. This is deliberate: two twin models
 * ("TextCandidate", "VisionCandidate") would force us to write the consolidation
 * twice, and the user sees only one list.
 *
 * <h2>Text, not yet a work</h2>
 * {@code seriesTitleRaw} is what was read, as is: "Platinum end",
 * "PLATINUM END". The matching with a catalog Entity comes later
 * and elsewhere (see {@link RecognitionCatalogResolver}). Mixing the two
 * would bring an approximate reading directly into the catalog.
 *
 * <h2>What can be missing, and must be allowed to be missing</h2>
 * A volume whose title is read but not the number is a useful result.
 * {@code volumeNumber} and {@code editionHint} are therefore nullable, and
 * <b>never guessed</b>: see "Death Note tome 1, édition à confirmer"
 * rather than choosing Black Edition at random.
 *
 * @param seriesTitleRaw  the title read, raw - never null or empty
 * @param volumeNumber    the volume number read, or {@code null} if it is not known
 * @param editionHint     an edition hint read ("Perfect"), or {@code null}
 * @param ean             an EAN/ISBN code read, or {@code null} - see {@link #hasExactIdentifier()}
 * @param confidence      how sure the READING is - see {@link RecognitionConfidence}
 * @param sources         how we know it - see {@link RecognitionSource}
 * @param evidence        why this item is proposed, in plain words - may be empty
 * @param sourceImages    index of the photos that supported it, 0-based. <b>Empty</b> for a
 *                        proposal coming from the text alone: we do not invent a photo for it
 * @param boxes           where it was seen on these photos - at most one box per photo, often
 *                        none: the text and the barcodes have no place on an image
 */
public record RecognizedItem(String seriesTitleRaw, Integer volumeNumber, String editionHint, String ean,
                              RecognitionConfidence confidence, Set<RecognitionSource> sources,
                              List<String> evidence, Set<Integer> sourceImages, List<RecognizedBox> boxes) {

    /** Beyond that, it is a wrong reading, not a volume - same limit as ListingTextParser. */
    public static final int NUMERO_DE_TOME_MAX = 300;

    public RecognizedItem {
        if (seriesTitleRaw == null || seriesTitleRaw.isBlank()) {
            throw new IllegalArgumentException("Un élément reconnu doit porter un titre lu");
        }
        seriesTitleRaw = seriesTitleRaw.trim();
        editionHint = blankToNull(editionHint);
        ean = blankToNull(ean);
        // An absurd number is a failed reading, not a volume: we forget it
        // rather than propagate it to the price per volume of the analysis.
        if (volumeNumber != null && (volumeNumber < 1 || volumeNumber > NUMERO_DE_TOME_MAX)) {
            volumeNumber = null;
        }
        confidence = confidence == null ? RecognitionConfidence.LOW : confidence;
        // A read EAN implies the EAN source, wherever it was read: it is the
        // presence of the identifier that counts, not who spotted it.
        Set<RecognitionSource> provenances = sources == null || sources.isEmpty()
                ? EnumSet.of(RecognitionSource.VISION)
                : EnumSet.copyOf(sources);
        if (ean != null) {
            provenances.add(RecognitionSource.EAN);
        }
        sources = Collections.unmodifiableSet(provenances);
        evidence = evidence == null ? List.of() : List.copyOf(evidence);
        // LinkedHashSet fed by a TreeSet, and not Set.copyOf: the latter
        // returns an UNORDERED Set, which would give back "seen on photos 3 and 1".
        // The order of the photos is the one the user has in front of them.
        sourceImages = sourceImages == null
                ? Set.of()
                : Collections.unmodifiableSet(new LinkedHashSet<>(new TreeSet<>(sourceImages)));
        boxes = boxes == null ? List.of() : List.copyOf(boxes);
    }

    /** Without a box: what the text and the barcodes produce, and what most tests build. */
    public RecognizedItem(String seriesTitleRaw, Integer volumeNumber, String editionHint, String ean,
                          RecognitionConfidence confidence, Set<RecognitionSource> sources,
                          List<String> evidence, Set<Integer> sourceImages) {
        this(seriesTitleRaw, volumeNumber, editionHint, ean, confidence, sources, evidence, sourceImages, List.of());
    }

    private static String blankToNull(String valeur) {
        return valeur == null || valeur.isBlank() ? null : valeur.trim();
    }

    /** A proposal coming from the text of the listing alone - with no photo behind it. */
    public static RecognizedItem fromText(String seriesTitle, Integer volumeNumber, String evidence) {
        return fromText(seriesTitle, volumeNumber, null, evidence);
    }

    /**
     * A proposal coming from the text, with the edition that this text names.
     *
     * <p>{@code editionHint} stays a <b>hint</b>: "Perfect Edition" read
     * in a title does not prove that the catalog knows this edition for
     * this series. It is {@code RecognitionCatalogResolver} that decides, and
     * the item stays "édition à confirmer" if it recognises nothing.
     */
    public static RecognizedItem fromText(String seriesTitle, Integer volumeNumber, String editionHint,
                                           String evidence) {
        return new RecognizedItem(seriesTitle, volumeNumber, editionHint, null,
                // The text was read by written rules: the READING is certain.
                // That the seller really owns this volume is another question,
                // carried by the TEXT source and not by the confidence.
                RecognitionConfidence.HIGH, EnumSet.of(RecognitionSource.TEXT),
                evidence == null ? List.of() : List.of(evidence), Set.of());
    }

    /** A proposal coming from a photo. */
    public static RecognizedItem fromVision(String seriesTitle, Integer volumeNumber, String editionHint, String ean,
                                             RecognitionConfidence confidence, List<String> evidence,
                                             Set<Integer> sourceImages) {
        return new RecognizedItem(seriesTitle, volumeNumber, editionHint, ean, confidence,
                EnumSet.of(RecognitionSource.VISION), evidence, sourceImages);
    }

    /** The reading of a photo, with the place where the engine saw the book. */
    public static RecognizedItem fromVision(String seriesTitle, Integer volumeNumber, String editionHint, String ean,
                                             RecognitionConfidence confidence, List<String> evidence,
                                             Set<Integer> sourceImages, List<RecognizedBox> boxes) {
        return new RecognizedItem(seriesTitle, volumeNumber, editionHint, ean, confidence,
                EnumSet.of(RecognitionSource.VISION), evidence, sourceImages, boxes);
    }

    /**
     * A proposal coming from a <b>barcode read on a photo</b>.
     *
     * <p>Always {@link RecognitionConfidence#HIGH}, and it is the only source
     * for which this is literally true: an EAN carries its check
     * digit, it matches or it does not match. The text announces what
     * the seller <i>says</i>, vision proposes what a model <i>thinks</i> it
     * sees; the barcode designates a precise print run.
     *
     * <p>{@code sourceImages} is kept: the screen must be able to say on
     * which photo the code was found, exactly as for vision.
     */
    public static RecognizedItem fromEan(String seriesTitle, Integer volumeNumber, String ean,
                                          String evidence, Set<Integer> sourceImages) {
        return new RecognizedItem(seriesTitle, volumeNumber, null, ean,
                RecognitionConfidence.HIGH, EnumSet.of(RecognitionSource.EAN),
                evidence == null ? List.of() : List.of(evidence),
                sourceImages == null ? Set.of() : sourceImages);
    }

    /**
     * True when an exact identifier was read. An EAN reading does not
     * "look like": it matches or not. This is what allows the
     * service to prefer the existing barcode pipeline to a visual
     * guess - see {@link ListingRecognitionService}.
     */
    public boolean hasExactIdentifier() {
        return ean != null;
    }

    /** True when the edition was not read: the screen must ask, not choose. */
    public boolean editionIsUnknown() {
        return editionHint == null;
    }

    /** The highest priority source of this item - see {@link RecognitionSource#priority()}. */
    public RecognitionSource strongestSource() {
        return sources.stream().max(java.util.Comparator.comparingInt(RecognitionSource::priority))
                .orElse(RecognitionSource.VISION);
    }

    /** The same thing known from another source - see {@link RecognitionConsolidator}. */
    RecognizedItem mergedWith(RecognizedItem autre) {
        Set<Integer> images = new TreeSet<>(sourceImages);
        images.addAll(autre.sourceImages());

        // Seen on two photos: two frames, one per photo. The same frame twice
        // (the same reading returned twice) counts only once.
        List<RecognizedBox> boites = new ArrayList<>(boxes);
        autre.boxes().stream().filter(boite -> !boites.contains(boite)).forEach(boites::add);

        List<String> raisons = new ArrayList<>(evidence);
        autre.evidence().stream().filter(raison -> !raisons.contains(raison)).forEach(raisons::add);

        Set<RecognitionSource> provenances = EnumSet.copyOf(sources);
        provenances.addAll(autre.sources());

        return new RecognizedItem(
                seriesTitleRaw,
                volumeNumber != null ? volumeNumber : autre.volumeNumber(),
                // A missing edition is missing information, not a different
                // edition: the one that was read completes it.
                editionHint != null ? editionHint : autre.editionHint(),
                ean != null ? ean : autre.ean(),
                // Two sources that say the same thing support each other.
                confidence.higherOf(autre.confidence()),
                provenances,
                raisons,
                images,
                boites);
    }
}
