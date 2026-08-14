package com.iozycore.application;

import com.iozycore.domain.loan.LoanRepository;
import com.iozycore.domain.ownership.OwnershipRepository;
import com.iozycore.domain.shared.OwnershipDeletionNotAllowedException;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Traduit en couche application la règle de suppression d'une Ownership -
 * même patron que {@link EntityDeletionService} : le domaine Ownership ne
 * connaît pas le repository d'un autre agrégat (Loan), donc la règle est
 * orchestrée ici plutôt que dans l'agrégat Ownership lui-même.
 * <p>
 * Contrairement à la suppression d'une Entity (bloquée tant qu'il existe la
 * moindre Ownership/Experience, jamais assouplie), supprimer UNE Ownership
 * précise est une action demandée explicitement par l'utilisateur (voir
 * "Supprimer cet exemplaire", OwnershipsSection côté web) - un exemplaire
 * ajouté par erreur, en double, ou qu'on ne souhaite plus tracer doit
 * pouvoir disparaître, contrairement à la fiche catalogue elle-même. Reste
 * bloquée seulement par un Loan existant (contrainte FK {@code
 * loan.ownership_id}, jamais assouplie celle-là) : un historique de prêt ne
 * doit jamais se retrouver à pointer vers une possession qui n'existe plus.
 */
@Service
public class OwnershipDeletionService {

    private final OwnershipRepository ownershipRepository;
    private final LoanRepository loanRepository;

    public OwnershipDeletionService(OwnershipRepository ownershipRepository, LoanRepository loanRepository) {
        this.ownershipRepository = ownershipRepository;
        this.loanRepository = loanRepository;
    }

    public void delete(UUID ownershipId) {
        long loanCount = loanRepository.findByOwnershipId(ownershipId).size();
        if (loanCount > 0) {
            throw new OwnershipDeletionNotAllowedException(ownershipId, loanCount);
        }
        ownershipRepository.deleteById(ownershipId);
    }
}
