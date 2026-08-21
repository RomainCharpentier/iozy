package com.iozycore.insights;

import java.util.List;
import java.util.UUID;

/**
 * Réponse unique à la question "combien de tomes possédés sur combien",
 * pour une œuvre donnée. Voir {@link CollectionProgressService} pour les
 * règles - ce record ne fait que les transporter.
 */
public record CollectionProgress(UUID entityId, String title, List<EditionProgress> editions,
                                  EditionProgress dominantEdition, int ownedVolumeCount) {

    /**
     * Progression pour UNE édition affichable.
     *
     * @param editionName         nom affiché ("" = tomes sans édition précisée, quand ils forment un groupe à part)
     * @param sourceEditions      valeurs brutes de l'attribut "edition" couvertes par ce groupe - contient "" en plus
     *                            du nom quand une fusion a eu lieu (voir CollectionProgressService)
     * @param ownedVolumeNumbers  numéros de tome RÉELLEMENT possédés (ownership active), triés, sans doublon
     * @param cataloguedVolumeNumbers numéros de tome connus du catalogue, possédés ou non
     * @param totalVolumes        total de l'édition de référence, {@code null} si elle n'est pas renseignée -
     *                            jamais deviné à partir d'un attribut de la série (voir Lot 16)
     */
    public record EditionProgress(String editionName, List<String> sourceEditions,
                                   List<Integer> ownedVolumeNumbers, List<Integer> cataloguedVolumeNumbers,
                                   Integer totalVolumes) {

        public int ownedCount() {
            return ownedVolumeNumbers.size();
        }

        /** {@code null} tant que le total de l'édition est inconnu : "3 tomes" est alors la seule vérité disponible. */
        public Integer missingCount() {
            return totalVolumes == null ? null : Math.max(0, totalVolumes - ownedVolumeNumbers.size());
        }
    }
}
