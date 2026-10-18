package com.iozycore.manga.recognition;

import java.util.Optional;

/**
 * What a barcode designates - seen from recognition.
 *
 * <h2>Why an interface for a single method</h2>
 * {@link BarcodeImageDecoder} reads an EAN <b>without calling anything</b>. Knowing
 * which book it is, however, requires going outside: a bibliographic
 * database, therefore network, therefore a possible failure and latency.
 *
 * <p>Separating the two keeps this border visible. Decoding stays free,
 * deterministic and always available; the resolution is an external
 * dependency that tests replace, and whose failure must never cost more
 * than an unidentified barcode.
 *
 * <h2>A title, not a detail page</h2>
 * The method returns only a <b>title</b>, deliberately. Bibliographic
 * sources do not give a structured volume number - they write
 * "Naruto, Vol. 9" in a text field. This title is then read by the
 * same rules as the title of a listing ({@code ListingTextParser}), rather
 * than by a second extraction that would diverge from the first.
 */
public interface BarcodeWorkLookup {

    /**
     * @param ean             the code read on a photo, already validated by its check digit
     * @param entityTypeCode  the expected universe ("MANGA"), or {@code null}
     * @return the title of the designated print run, or empty - <b>empty is a normal
     *         result</b>: an EAN may be missing from the databases, and a book not
     *         identified does not prevent the rest of the batch from being read
     */
    Optional<String> titleFor(String ean, String entityTypeCode);
}
