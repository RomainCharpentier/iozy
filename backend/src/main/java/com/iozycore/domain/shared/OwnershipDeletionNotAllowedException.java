package com.iozycore.domain.shared;

import java.util.UUID;

/**
 * Levée lorsqu'on tente de supprimer une Ownership alors qu'un Loan (prêt,
 * même déjà rendu) la référence encore - la contrainte FK {@code
 * loan.ownership_id} rejetterait sinon la suppression avec une erreur SQL
 * brute plutôt qu'un message clair. Même invariant que {@link
 * EntityDeletionNotAllowedException} : une donnée ne disparaît jamais
 * silencieusement, seulement avec une raison explicite quand ce n'est pas
 * possible.
 */
public class OwnershipDeletionNotAllowedException extends RuntimeException {

    public OwnershipDeletionNotAllowedException(UUID ownershipId, long loanCount) {
        super("Impossible de supprimer l'ownership %s : %d prêt(s) la référencent encore"
                .formatted(ownershipId, loanCount));
    }
}
