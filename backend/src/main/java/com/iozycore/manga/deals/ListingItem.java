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
     * Ce que porte un lot dont l'utilisateur ne sait pas nommer l'édition.
     *
     * <h2>Pourquoi une valeur plutôt qu'un {@code null}</h2>
     * L'édition reste obligatoire ici - c'est la clé qui relie un lot à une
     * fiche d'édition, et la rendre nullable toucherait un invariant du
     * domaine pour un gain que le choix explicite obtient déjà. Ce que le
     * produit corrige, c'est l'<b>obligation de deviner</b> : plutôt que de
     * taper « Standard » au hasard - étiquette qui pourrait correspondre par
     * accident à une autre édition et fausser la référence marché -
     * l'utilisateur déclare ne pas savoir, et le moteur en tire les
     * conséquences honnêtement.
     * <p>
     * Aucune fiche d'édition ne porte ce nom, donc la résolution échoue
     * <b>volontairement</b> : complétude inconnue, valeur neuve non calculée,
     * confiance basse. Exactement le comportement déjà prévu par
     * {@link PurchaseAnalysisEngine} pour une édition introuvable - voir le
     * message dédié qu'il produit dans ce cas.
     */
    public static final String EDITION_INCONNUE = "Édition inconnue";

    /** Vrai si l'utilisateur a explicitement déclaré ne pas connaître l'édition. */
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
