package com.iozycore.domain.loan;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LoanRepository {

    Loan save(Loan loan);

    Optional<Loan> findById(UUID id);

    /** Historique des prêts (rendus compris) d'une possession précise. */
    List<Loan> findByOwnershipId(UUID ownershipId);

    /** "Prêts en cours" (voir Mon profil côté web) - tous propriétaires confondus tant qu'il n'y a qu'un seul owner réel. */
    List<Loan> findAllActive();
}
