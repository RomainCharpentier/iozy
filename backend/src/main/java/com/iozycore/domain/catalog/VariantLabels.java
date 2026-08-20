package com.iozycore.domain.catalog;

/**
 * Convention de libellé d'un Tome ("Tome 3 — Black Édition"). Extraite ici
 * parce qu'elle n'est PAS cosmétique : QuickAddService déduplique les tomes
 * par ce libellé exact (voir {@link Entity#findVariantByLabel}). Deux
 * endroits qui la calculeraient chacun de leur côté finiraient par diverger,
 * et un tome renuméroté d'un côté serait re-créé en double de l'autre.
 */
public final class VariantLabels {

    private VariantLabels() {
    }

    /** {@code edition} nul/vide : "Tome 3" tout court - une série dont les tomes
     * n'ont pas d'édition précisée reste un cas normal (voir EditionGroup). */
    public static String of(int volumeNumber, String edition) {
        String base = "Tome " + volumeNumber;
        return (edition == null || edition.isBlank()) ? base : base + " — " + edition.trim();
    }
}
