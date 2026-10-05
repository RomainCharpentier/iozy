package com.iozycore.manga.recognition;

/**
 * A photo really fetched, ready to be analysed.
 *
 * <h2>Bytes, not a URL</h2>
 * The engine never receives a URL: it is {@link RecognitionImageFetcher} that
 * decides what can be attached and reports it as bytes. An engine therefore cannot,
 * by construction, go and fetch an arbitrary address - the
 * whitelist is crossed only once, in one place.
 *
 * <h2>These bytes are never logged</h2>
 * Neither here, nor in the providers. A base64 image in the logs is the
 * content of a listing - sometimes an interior, a face - copied into a
 * file that nobody watches.
 *
 * @param index      0-based position in the request, the one the screen shows
 * @param sourceUrl  where it comes from - kept for display, never joined by an
 *                   engine. <b>{@code null}</b> for a photo sent by the user:
 *                   it comes from no address, and inventing one would make us believe
 *                   that we could go back to it
 * @param bytes      the content, bounded by the fetcher
 * @param mediaType  MIME type observed, already validated
 */
public record RecognitionImage(int index, String sourceUrl, byte[] bytes, String mediaType) {

    public RecognitionImage {
        if (bytes == null || bytes.length == 0) {
            throw new IllegalArgumentException("Une image à analyser doit avoir un contenu");
        }
        if (mediaType == null || mediaType.isBlank()) {
            throw new IllegalArgumentException("Une image à analyser doit avoir un type MIME constaté");
        }
    }

    /**
     * {@code toString} without the bytes: a record would show them by default,
     * and this line would end up in an exception trace.
     */
    @Override
    public String toString() {
        return "RecognitionImage[index=%d, mediaType=%s, bytes=%d]".formatted(index, mediaType, bytes.length);
    }
}
