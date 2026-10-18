package com.iozycore.manga.recognition;

/**
 * Where a proposal comes from. The same item can be supported by several
 * sources at once - this is even the most useful case.
 *
 * <h2>Why a dimension separate from confidence</h2>
 * It would be tempting to add a {@code DETERMINISTIC} level to
 * {@link RecognitionConfidence}. That would stack two different questions
 * in a single scale:
 * <ul>
 *   <li>{@link RecognitionConfidence} answers "how sure am I of what
 *       I read?";</li>
 *   <li>{@code RecognitionSource} answers "<b>how</b> did I read it?".</li>
 * </ul>
 * Keeping them distinct lets us say "the title announces volumes 1 to 14"
 * (certain reading, declarative source) without making people believe that the seller has
 * <b>necessarily</b> these fourteen volumes in hand. The text says what it says;
 * the extraction is sure, the real content is not.
 *
 * <h2>Order matters</h2>
 * See {@link #priority()}: it decides between two sources that describe the same
 * thing, without ever being used to erase one that describes <b>something else</b>.
 * A text that gives the number and a photo that gives the edition do not
 * compete, they complete each other.
 */
public enum RecognitionSource {

    /**
     * Read in the title or the description, by written rules - local,
     * free, immediate, reproducible. See
     * {@code ListingTextParser}: "tomes 1 à 14" gives 1..14 because the
     * sentence says so, not because a score estimates it.
     */
    TEXT,

    /** Read on a photo by a recognition engine. */
    VISION,

    /**
     * Confirmed by an exact identifier (EAN/ISBN). A barcode matches
     * or does not match; it does not "look like".
     * <p>
     * <b>Current limit</b>: no decoder reads a barcode yet
     * from the pixels. This source therefore appears only when a vision
     * engine managed to read the printed digits. The day a local decoder
     * exists, it feeds the same field.
     */
    EAN;

    /**
     * Which one wins when two sources describe <b>the same dimension</b> in an
     * incompatible way. Higher = takes priority.
     * <p>
     * The correction by the user is not in this scale: it lives
     * above everything, and the screen takes care of it - a value typed by hand
     * is never recomputed.
     */
    public int priority() {
        return switch (this) {
            case EAN -> 3;
            case TEXT -> 2;
            case VISION -> 1;
        };
    }

    /** The label shown to the user - never the name of the AI provider. */
    public String label() {
        return switch (this) {
            case TEXT -> "annonce";
            case VISION -> "photos";
            case EAN -> "code-barres";
        };
    }
}
