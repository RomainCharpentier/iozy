package com.iozycore.manga.shelfimport;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * A volume that the user confirmed from the review screen.
 *
 * <p>The server keeps nothing between the analysis and the import: it is the screen that
 * sends back, for each volume, what it showed - the chosen title, the number
 * (read or typed), the chosen edition, and the attributes of the proposed detail page if
 * the user kept it. Same contract as the quick add of the Catalog.
 *
 * @param seriesTitle   the title under which the series is found or created
 * @param volumeNumber  the volume number, greater than or equal to 1
 * @param edition       the edition, or {@code null}/empty when it is not known
 * @param attributes    the attributes of the source detail page (author, year...) - empty if none
 * @param coverImageUrl the cover of the series proposed by the source, or {@code null}
 */
public record ItemToImport(String seriesTitle, int volumeNumber, String edition,
                           Map<String, Object> attributes, String coverImageUrl) {

    public static final String COVER_IMAGE_ATTRIBUTE = "coverImageUrl";

    public ItemToImport {
        if (seriesTitle == null || seriesTitle.isBlank()) {
            throw new IllegalArgumentException("Le titre de la série est requis");
        }
        if (volumeNumber < 1) {
            throw new IllegalArgumentException("Le numéro de tome doit être supérieur ou égal à 1");
        }
        attributes = attributes == null ? Map.of() : Map.copyOf(attributes);
    }

    String editionOrNull() {
        return edition == null || edition.isBlank() ? null : edition.trim();
    }

    /**
     * The attributes to set on the series: those of the detail page, plus the cover
     * under the key that the Catalog and the scan already use. A key already
     * present in the attributes is not overwritten by the cover.
     */
    Map<String, Object> attributesForEntity() {
        Map<String, Object> resultat = new LinkedHashMap<>(attributes);
        if (coverImageUrl != null && !coverImageUrl.isBlank()) {
            resultat.putIfAbsent(COVER_IMAGE_ATTRIBUTE, coverImageUrl.trim());
        }
        return resultat;
    }
}
