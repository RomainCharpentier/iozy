package com.iozycore.insights;

import java.util.List;
import java.util.UUID;

/**
 * Ce qu'il reste a lire dans la collection : par serie, le prochain tome
 * possede sur lequel aucune experience n'a encore ete enregistree.
 *
 * <p>Entierement CALCULE (voir {@link ReadingListService}) - aucune table,
 * aucune liste a tenir a jour. Un tome entre dans cette liste en etant
 * achete, en sort en etant lu, et l'ordre des series repond a une question
 * precise : « qu'est-ce que je reprends ? » avant « qu'est-ce que je
 * commence ? ».
 */
public record ReadingList(List<Serie> series, int tomesARelire) {

    /**
     * @param prochain le plus petit numero possede et non vecu
     * @param restants combien de tomes possedes attendent encore, celui-ci compris
     * @param lus      combien de tomes de cette serie portent deja une experience
     * @param commencee vrai des qu'un tome a ete vecu - c'est ce qui met la serie en tete
     */
    public record Serie(UUID entityId, String titre, String typeLabel, String couvertureUrl,
                        Tome prochain, int restants, int lus, boolean commencee) {
    }

    public record Tome(UUID variantId, String libelle, Integer numero, String edition, String couvertureUrl) {
    }
}
