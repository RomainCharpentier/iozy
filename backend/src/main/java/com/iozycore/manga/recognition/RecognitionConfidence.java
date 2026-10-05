package com.iozycore.manga.recognition;

/**
 * How much IozyCore believes what it proposes on a photo.
 *
 * <h2>Three levels, not a percentage</h2>
 * No recognition engine plugged in here is <b>calibrated</b>: a model
 * that announces "97.36%" gives its own assurance, not its measured accuracy.
 * Showing this number would give the user a precision that nobody has
 * checked. Three named levels read for what they are - a sort, not
 * a measure - and stay honest as long as the system is not.
 *
 * <h2>No level allows an automatic write</h2>
 * Even {@link #HIGH} stays a proposal to confirm. The difference between
 * the levels is what the screen puts forward, never the right to write alone
 * into the catalog or the collection.
 */
public enum RecognitionConfidence {

    /** Title and volume number readable, or exact identifier (EAN) recognised. */
    HIGH,

    /** One of the two is readable, the other deduced from the context of the batch. */
    MEDIUM,

    /** A lead, not an identification - never to pre-tick on screen. */
    LOW;

    /**
     * True if the proposal deserves to be pre-selected on screen. This is
     * not a right to write: the user always confirms.
     */
    public boolean worthPreselecting() {
        return this == HIGH;
    }

    /** The most cautious of the two - used when two photos contradict each other. */
    public RecognitionConfidence lowerOf(RecognitionConfidence other) {
        if (other == null) {
            return this;
        }
        return compareTo(other) >= 0 ? this : other;
    }

    /** The most confident of the two - used when two photos support each other. */
    public RecognitionConfidence higherOf(RecognitionConfidence other) {
        if (other == null) {
            return this;
        }
        return compareTo(other) <= 0 ? this : other;
    }
}
