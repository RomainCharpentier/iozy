package com.iozycore.manga.deals;

import com.iozycore.manga.domain.MangaEditionRepository;

import java.util.Set;

/**
 * One series within a listing (a multi-series lot has one {@link ListingItem}
 * per series - see the specification's worked example: 20th Century Boys +
 * 21st Century Boys + Sanctuary in a single Vinted listing).
 *
 * @param editionNameRaw   free-text edition name as typed by the user, resolved against
 *                         {@link MangaEditionRepository} by {@link PurchaseAnalysisService}.
 *                         May be {@link #EDITION_INCONNUE} when the user cannot name it -
 *                         see that constant
 * @param includedVolumes  volume numbers included in the listing for this series/edition,
 *                         already expanded from any {@link VolumeRange}s entered
 * @param itemConditionOverride condition specific to this item, if it differs from the listing's
 *                              overall condition - nullable, falls back to {@link Listing#condition()}
 */
public record ListingItem(MangaSeries series, String editionNameRaw, Set<Integer> includedVolumes,
                           Condition itemConditionOverride) {

    /**
     * What a lot carries when the user cannot name the edition.
     *
     * <h2>Why a value rather than a {@code null}</h2>
     * The edition stays mandatory here - it is the key that links a lot to an
     * edition page, and making it nullable would touch a domain invariant
     * for a gain that the explicit choice already gets. What the
     * product fixes is the <b>obligation to guess</b>: instead of
     * typing "Standard" at random - a label that could match another
     * edition by accident and distort the market reference -
     * the user says they do not know, and the engine honestly draws
     * the consequences.
     * <p>
     * No edition page has this name, so the resolution fails
     * <b>on purpose</b>: completeness unknown, new value not computed,
     * low confidence. Exactly the behaviour already planned by
     * {@link PurchaseAnalysisEngine} for an edition that cannot be found - see the
     * dedicated message it produces in this case.
     */
    public static final String EDITION_INCONNUE = "Édition inconnue";

    /** True if the user explicitly said they do not know the edition. */
    public boolean editionIsUnknown() {
        return EDITION_INCONNUE.equalsIgnoreCase(editionNameRaw);
    }

    public ListingItem {
        if (editionNameRaw == null || editionNameRaw.isBlank()) {
            throw new IllegalArgumentException("Chaque lot de l'annonce doit indiquer un nom d'édition");
        }
        if (includedVolumes == null || includedVolumes.isEmpty()) {
            throw new IllegalArgumentException("Chaque lot de l'annonce doit inclure au moins un tome");
        }
        includedVolumes = Set.copyOf(includedVolumes);
    }
}
