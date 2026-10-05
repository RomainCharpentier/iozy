package com.iozycore.manga.recognition;

import java.util.List;

/**
 * An engine able to read photos and propose works from them.
 *
 * <h2>Deliberately tiny</h2>
 * Same spirit as {@code ListingProvider} and {@code MetadataProvider}: this
 * interface exists so that a second engine is one more class and nothing
 * else - a local barcode decoder, a self-hosted model, another
 * cloud provider. It does not try to describe all possible engines.
 *
 * <h2>Why an abstraction rather than a direct call</h2>
 * Without it, the name of the provider of the day would end up in the service, the
 * controller and the tests, and changing it would mean reopening them all. Here,
 * an engine is replaced by changing the bean - this is also what lets the
 * tests call <b>no real AI</b>.
 *
 * <h2>Does not throw for a failure</h2>
 * A failure, an exceeded quota, an elapsed timeout return
 * {@link RecognitionResult#unavailable()}, never an exception: IozyCore must
 * stay usable without recognition, and an exception that bubbles up
 * would break the manual analysis flow.
 */
public interface ImageRecognitionProvider {

    /**
     * True if this engine is really usable now - typically
     * "an API key is configured". An engine that is not configured is not an
     * error: IozyCore works without it, the screen says so and manual entry
     * stays whole.
     */
    boolean isAvailable();

    /** What it thinks it sees. Must never throw, see the Javadoc of the interface. */
    RecognitionResult recognize(List<RecognitionImage> images, RecognitionContext context);

    /** What will appear in the evidence and the logs - never a key, never a call URL. */
    String name();
}
