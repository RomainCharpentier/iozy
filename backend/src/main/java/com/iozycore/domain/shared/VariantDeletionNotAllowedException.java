package com.iozycore.domain.shared;

import java.util.UUID;

/**
 * Levée lorsqu'on tente de supprimer un Tome (Variant) alors que des
 * Ownership ou des Experience le référencent encore - les contraintes FK
 * {@code ownership.variant_id} / {@code experience.variant_id} rejetteraient
 * sinon la suppression avec une erreur SQL brute plutôt qu'un message clair.
 * Même invariant que {@link EntityDeletionNotAllowedException} : une donnée
 * ne disparaît jamais silencieusement.
 * <p>
 * Modèle catalogue cible Série -> Édition -> Tome : un Tome existe
 * indépendamment de sa possession (voir Entity.removeVariant / VariantDeletionService)
 * - cette garde protège une suppression EXPLICITE, elle ne s'applique jamais
 * automatiquement quand une Ownership est simplement vendue/perdue/supprimée.
 */
public class VariantDeletionNotAllowedException extends RuntimeException {

    public VariantDeletionNotAllowedException(UUID variantId, long ownershipCount, long experienceCount) {
        super("Impossible de supprimer le tome %s : %d ownership(s) et %d expérience(s) le référencent encore"
                .formatted(variantId, ownershipCount, experienceCount));
    }
}
