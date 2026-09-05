package com.iozycore.application.admin;

import com.iozycore.domain.user.AppUser;
import com.iozycore.domain.user.AppUserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import com.iozycore.manga.deals.Volume;

/**
 * Administrer l'INSTANCE : qui a un compte, et en supprimer un.
 *
 * <h2>Ce que ce service ne fait pas</h2>
 * Il ne donne accès à <b>aucune</b> donnée d'un autre compte. Ce qu'il rend,
 * ce sont des métadonnées - pseudo, adresse, date, et des <b>nombres</b> - et
 * l'isolation par propriétaire reste entière partout ailleurs. Un
 * administrateur n'est pas un super-utilisateur : c'est quelqu'un qui répond
 * de la machine, pas des collections qui y vivent.
 *
 * <h2>Une suppression est définitive, et elle emporte tout</h2>
 * Elle efface les onze tables cloisonnées puis le compte lui-même. Rien ne la
 * défait : il n'y a ni corbeille, ni journal, ni sauvegarde applicative. Le
 * contrôleur exige donc une confirmation, et l'écran l'annonce en toutes
 * lettres avec ce que le compte pèse.
 *
 * <p>Le <b>catalogue</b> (œuvres, tomes, éditions, tags, relations) n'est pas
 * touché : il est partagé, une œuvre est la même pour tout le monde, et la
 * supprimer la retirerait de la collection des autres.
 */
@Service
public class GestionDesComptes {

    private final AppUserRepository comptes;
    private final DonneesParProprietaire donnees;

    public GestionDesComptes(AppUserRepository comptes, DonneesParProprietaire donnees) {
        this.comptes = comptes;
        this.donnees = donnees;
    }

    /** Un compte tel que l'administration le voit : de quoi décider, jamais de quoi lire. */
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
     * Supprime un compte et tout ce qui lui appartient.
     *
     * @param demandeur l'administrateur qui agit - il ne peut pas se supprimer
     *                  lui-même : il perdrait sa session au milieu du geste, et
     *                  surtout une instance doit garder quelqu'un qui puisse
     *                  l'administrer. C'est aussi ce qui garantit qu'il reste
     *                  toujours au moins un administrateur.
     */
    @Transactional
    public void supprimer(UUID id, UUID demandeur) {
        if (id.equals(demandeur)) {
            throw new SuppressionRefusee("Un administrateur ne peut pas supprimer son propre compte.");
        }
        AppUser compte = comptes.findById(id)
                .orElseThrow(() -> new CompteIntrouvable("Ce compte n'existe pas ou plus."));

        // Les données d'abord, le compte ensuite. Dans l'autre sens, un échec
        // entre les deux laisserait des lignes appartenant à un identifiant que
        // plus personne ne porte - invisibles, et impossibles à retrouver.
        donnees.effacerToutCeQuiAppartientA(compte.id());
        comptes.supprimer(compte.id());
    }

    /** Le compte visé n'existe pas (404). */
    public static class CompteIntrouvable extends RuntimeException {
        public CompteIntrouvable(String message) {
            super(message);
        }
    }

    /** Une demande bien formée, mais que l'application refuse (409). */
    public static class SuppressionRefusee extends RuntimeException {
        public SuppressionRefusee(String message) {
            super(message);
        }
    }
}
