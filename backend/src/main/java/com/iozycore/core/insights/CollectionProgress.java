package com.iozycore.core.insights;

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

    /** La clé (œuvre, édition) sous laquelle un prix neuf, une progression ou une édition suivie se retrouvent. */
    /**
     * L'identité d'une édition : (œuvre, nom), à la casse et aux espaces près.
     *
     * <p>Publique parce qu'elle était RECOPIÉE - {@code StatsService} en avait
     * sa propre version pour valoriser la collection au prix neuf (Lot 56).
     * Deux copies d'une clé sont deux occasions de diverger, et c'est
     * exactement ce qui a produit les écarts de progression des Lots 31 et 49 :
     * la règle vit ici, avec le calcul qu'elle sert.
     */
    public static String editionKey(UUID entityId, String editionName) {
        return entityId + "|" + editionName.trim().toLowerCase();
    }
}
