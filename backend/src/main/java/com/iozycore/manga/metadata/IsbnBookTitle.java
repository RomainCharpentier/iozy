package com.iozycore.manga.metadata;

import com.iozycore.core.metadata.MetadataCandidate;
import com.iozycore.manga.deals.ListingTextParser;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Turns what a book database says about ONE volume into a candidate for its
 * SERIES.
 *
 * <h2>The bug this fixes</h2>
 * An ISBN names one print run, and its title is the title of a volume:
 * "One Piece - Édition originale Tome 01". This text was taken as the name
 * of the work. Adding the scanned volume created a series of that name, and
 * scanning volume 2 created another one. The publisher list also starts
 * with the collection label ("Shônen Manga"), which was taken as the edition.
 *
 * <h2>The same rules as everywhere else</h2>
 * Series, volume number and edition are read by {@link ListingTextParser},
 * which already reads the barcodes of a shelf photo and the title of a
 * listing. A second set of rules would drift from the first.
 *
 * <h2>Never more than the source says</h2>
 * No number in the title: no number. A title the rules would empty: the
 * source title stays as it is.
 */
public final class IsbnBookTitle {

    /**
     * The words a collection label is made of. A label made ONLY of these
     * words names a shelf of the publisher ("Shônen Manga", "Seinen"), never a
     * publisher or an edition. "Glénat Manga" or "Kana Shonen" keep a real
     * name, so they stay.
     */
    private static final Set<String> COLLECTION_WORDS = Set.of(
            "shonen", "shounen", "seinen", "shojo", "shoujo", "josei", "kodomo",
            "manga", "mangas", "collection");

    private IsbnBookTitle() {
    }

    /**
     * A candidate whose title is the series, and whose volume is the one the
     * source describes.
     *
     * @param publishers the publisher names in the source order; the first one
     *                   that is not a collection label becomes {@code publisher}
     */
    public static MetadataCandidate candidate(String source, String isbn, String sourceTitle, String imageUrl,
                                              Map<String, Object> attributes, List<String> publishers) {
        publishers.stream()
                .filter(name -> name != null && !name.isBlank() && !isCollectionLabel(name))
                .findFirst()
                .ifPresent(name -> attributes.put("publisher", name.trim()));

        String series = ListingTextParser.probableSeriesTitle(sourceTitle);
        if (series.isBlank()) {
            series = sourceTitle.trim();
        }
        // A print run carries ONE number. Several means the title described
        // something else (a box set "tomes 1 à 3"): no number then.
        List<Integer> numbers = ListingTextParser.sorted(
                ListingTextParser.parse(sourceTitle, null).volumeNumbers());
        Integer number = numbers.size() == 1 ? numbers.get(0) : null;
        String edition = ListingTextParser.editionAsWritten(sourceTitle);

        return new MetadataCandidate(source, isbn, series, imageUrl, attributes,
                new MetadataCandidate.Volume(sourceTitle, number, edition));
    }

    /** True for a name made only of collection words ("Shônen Manga"). */
    static boolean isCollectionLabel(String name) {
        String plain = Normalizer.normalize(name.toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        String[] words = plain.split("[^a-z0-9]+");
        boolean foundOne = false;
        for (String word : words) {
            if (word.isEmpty()) {
                continue;
            }
            if (!COLLECTION_WORDS.contains(word)) {
                return false;
            }
            foundOne = true;
        }
        return foundOne;
    }
}
