package com.iozycore.manga.recognition;

import java.util.Set;

/**
 * What a photo must respect to be analysed - whatever the door
 * through which it comes in.
 *
 * <h2>Why these limits no longer live in the fetcher</h2>
 * There are now <b>two</b> entries: the photos fetched from a
 * listing ({@link RecognitionImageFetcher}) and the ones sent by
 * the user ({@link UploadedImageReader}). Limits copied into the
 * two drift apart: the ceiling is raised on one side, forgotten on the other, and
 * the forgotten door becomes the door to force. They are therefore stated here,
 * once.
 *
 * <h2>The MIME type is observed, not declared</h2>
 * {@link #sniff(byte[])} reads the first bytes. This is the difference between
 * the two doors: a CDN that announces {@code image/jpeg} commits its
 * responsibility, a file sent from a phone announces only what
 * the client chose to write. {@code Content-Type: image/png} on an
 * executable is a line of text, not a guarantee - and these bytes then go
 * to an external engine.
 */
public final class RecognitionImageLimits {

    private RecognitionImageLimits() {
    }

    /**
     * Beyond that, the analysis costs more than it brings: a batch is read on its
     * first photos, and each additional image is one more call to the
     * engine. Aligned with the photo ceiling that the Vinted provider reports.
     */
    public static final int MAX_IMAGES = 8;

    /** A listing photo rarely exceeds 2 MB; beyond that it is something else. */
    public static final int MAX_BYTES_PER_IMAGE = 3 * 1024 * 1024;

    /** Cumulated ceiling: eight 3 MB images would fit in memory, but nothing justifies 24 MB. */
    public static final int MAX_TOTAL_BYTES = 12 * 1024 * 1024;

    /** What the engines can read, and what the listing CDNs serve. */
    public static final Set<String> ACCEPTED_MEDIA_TYPES = Set.of("image/jpeg", "image/png", "image/webp");

    /**
     * The MIME type really carried by these bytes, or {@code null} if it is
     * none of the three accepted images.
     *
     * <p>Three signatures, recognised by their header:
     * <ul>
     *   <li>JPEG: {@code FF D8 FF};</li>
     *   <li>PNG: {@code 89 50 4E 47 0D 0A 1A 0A};</li>
     *   <li>WebP: {@code RIFF} then {@code WEBP} at position 8.</li>
     * </ul>
     *
     * <p>This is not an image validator: a truncated JPEG passes, and this is
     * intended - the role here is to discard what is <b>not at all</b> an
     * image, not to guarantee that it decodes. The engine, for its part, knows how to say that it
     * saw nothing.
     */
    public static String sniff(byte[] octets) {
        if (octets == null || octets.length < 12) {
            return null;
        }
        if (u(octets[0]) == 0xFF && u(octets[1]) == 0xD8 && u(octets[2]) == 0xFF) {
            return "image/jpeg";
        }
        if (u(octets[0]) == 0x89 && octets[1] == 'P' && octets[2] == 'N' && octets[3] == 'G'
                && u(octets[4]) == 0x0D && u(octets[5]) == 0x0A && u(octets[6]) == 0x1A && u(octets[7]) == 0x0A) {
            return "image/png";
        }
        if (octets[0] == 'R' && octets[1] == 'I' && octets[2] == 'F' && octets[3] == 'F'
                && octets[8] == 'W' && octets[9] == 'E' && octets[10] == 'B' && octets[11] == 'P') {
            return "image/webp";
        }
        return null;
    }

    /** A {@code byte} is signed in Java: without this, 0xFF is -1 and no comparison comes out right. */
    private static int u(byte b) {
        return b & 0xFF;
    }
}
