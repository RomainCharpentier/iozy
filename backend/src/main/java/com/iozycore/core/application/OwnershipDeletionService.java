package com.iozycore.core.application;

import com.iozycore.core.domain.ownership.OwnershipRepository;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Supprime une Ownership - la couture d'application où vivent les règles de
 * suppression d'un exemplaire, pendant symétrique de
 * {@link EntityDeletionService}.
 * <p>
 * Contrairement à la suppression d'une Entity (bloquée tant qu'il existe la
 * moindre Ownership/Experience, jamais assouplie), supprimer UNE Ownership
 * précise est une action demandée explicitement par l'utilisateur (voir
 * "Supprimer cet exemplaire", OwnershipsSection côté web) - un exemplaire
 * ajouté par erreur, en double, ou qu'on ne souhaite plus tracer doit
 * pouvoir disparaître, contrairement à la fiche catalogue elle-même.
 * <p>
 * <b>Plus aucune garde depuis le retrait des prêts.</b> Ce service refusait
 * la suppression d'une possession référencée par un {@code Loan}, pour
 * qu'un historique de prêt ne pointe jamais vers une possession disparue.
 * La fonctionnalité de prêt ayant été retirée du produit (voir
 * {@code V19__drop_loan.sql}), cette règle n'avait plus d'objet : elle
 * protégeait un concept qui n'existe plus, pas une donnée encore présente.
 * <p>
 * <b>Supprimer une Ownership ne supprime jamais le Tome catalogué</b> qu'elle
 * référence : le Variant et l'Entity survivent, seule la possession
 * disparaît. C'est l'invariant « Classer ≠ Posséder », affirmé par
 * {@code OwnershipHttpContractTest.deletes_an_ownership_without_touching_its_variant}.
 * <p>
 * La suppression reste <b>idempotente</b> : un identifiant inconnu ou déjà
 * supprimé ne lève rien, la route rend 204 dans tous les cas.
 */
@Service
public class OwnershipDeletionService {

    private final OwnershipRepository ownershipRepository;

    public OwnershipDeletionService(OwnershipRepository ownershipRepository) {
        this.ownershipRepository = ownershipRepository;
    }

    public void delete(UUID ownershipId) {
        ownershipRepository.deleteById(ownershipId);
    }
}
