package com.iozycore.core.application.admin;

import com.iozycore.core.domain.user.AppUser;
import com.iozycore.core.domain.user.AppUserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Administer the INSTANCE: who has an account, and delete one.
 *
 * <h2>What this service does not do</h2>
 * It gives access to <b>no</b> data of another account. What it returns
 * is metadata - pseudo, address, date, and <b>numbers</b> - and
 * isolation by owner stays whole everywhere else. An
 * administrator is not a super-user: it is someone who answers
 * for the machine, not for the collections that live on it.
 *
 * <h2>A deletion is final, and it takes everything with it</h2>
 * It erases the eleven partitioned tables then the account itself. Nothing
 * undoes it: there is no trash, no journal, no application backup. The
 * controller therefore requires a confirmation, and the screen announces it in full
 * with what the account weighs.
 *
 * <p>The <b>catalog</b> (works, volumes, editions, tags, relationships) is not
 * touched: it is shared, a work is the same for everyone, and
 * deleting it would remove it from the collection of the others.
 */
@Service
@RequiredArgsConstructor
public class GestionDesComptes {

    private final AppUserRepository comptes;
    private final DonneesParProprietaire donnees;

    /** An account as the administration sees it: enough to decide, never enough to read. */
    public record CompteAdministre(UUID id, String pseudo, String email, boolean admin, Instant creeLe,
                                    DonneesParProprietaire.Volume volume) {
    }

    public List<CompteAdministre> lister() {
        Map<UUID, DonneesParProprietaire.Volume> volumes = donnees.compter();
        return comptes.lister().stream()
                .map(compte -> new CompteAdministre(compte.id(), compte.pseudo(), compte.email(), compte.admin(),
                        compte.createdAt(),
                        volumes.getOrDefault(compte.id(), DonneesParProprietaire.Volume.AUCUN)))
                .toList();
    }

    /**
     * Deletes an account and everything that belongs to it.
     *
     * @param demandeur the administrator who acts - they cannot delete
     *                  themselves: they would lose their session in the middle of the action, and
     *                  above all an instance must keep someone who can
     *                  administer it. This is also what guarantees that there
     *                  is always at least one administrator.
     */
    @Transactional
    public void supprimer(UUID id, UUID demandeur) {
        if (id.equals(demandeur)) {
            throw new SuppressionRefusee("Un administrateur ne peut pas supprimer son propre compte.");
        }
        AppUser compte = comptes.findById(id)
                .orElseThrow(() -> new CompteIntrouvable("Ce compte n'existe pas ou plus."));

        // The data first, the account after. The other way round, a failure
        // between the two would leave rows belonging to an id that
        // nobody carries anymore - invisible, and impossible to find.
        donnees.effacerToutCeQuiAppartientA(compte.id());
        comptes.supprimer(compte.id());
    }

    /** The targeted account does not exist (404). */
    public static class CompteIntrouvable extends RuntimeException {
        public CompteIntrouvable(String message) {
            super(message);
        }
    }

    /** A well-formed request, but that the application refuses (409). */
    public static class SuppressionRefusee extends RuntimeException {
        public SuppressionRefusee(String message) {
            super(message);
        }
    }
}
