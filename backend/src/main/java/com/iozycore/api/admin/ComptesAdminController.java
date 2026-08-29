package com.iozycore.api.admin;

import com.iozycore.application.admin.GestionDesComptes;
import com.iozycore.application.auth.AppUserDetailsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Les comptes de l'instance, pour qui en répond.
 *
 * <h2>Deux routes, et la garde est ailleurs</h2>
 * Tout {@code /api/admin/**} exige le rôle {@code ADMIN} - déclaré une fois
 * dans {@code SecurityConfig}, jamais répété ici. Une annotation par méthode
 * serait une occasion de plus de l'oublier sur la prochaine.
 *
 * <h2>Ce qui sort d'ici</h2>
 * Des métadonnées et des <b>nombres</b>. Aucune route de ce contrôleur ne rend
 * une ligne de la collection de qui que ce soit : l'administration porte sur
 * l'instance, pas sur les données (voir {@link GestionDesComptes}).
 */
@RestController
@RequestMapping("/api/admin/comptes")
@Tag(name = "Administration", description = "Les comptes de l'instance - réservé aux administrateurs")
public class ComptesAdminController {

    private final GestionDesComptes comptes;

    public ComptesAdminController(GestionDesComptes comptes) {
        this.comptes = comptes;
    }

    /**
     * @param volume ce que le compte détruirait s'il était supprimé - le seul
     *               moyen de décider en connaissance de cause
     */
    public record CompteReponse(UUID id, String pseudo, String email, boolean admin, Instant creeLe,
                                 VolumeReponse volume) {
    }

    public record VolumeReponse(long possessions, long envies, long experiences, long classements, long analyses,
                                 long total) {
    }

    @Operation(summary = "Tous les comptes de l'instance, du plus ancien au plus récent.")
    @GetMapping
    public List<CompteReponse> lister() {
        return comptes.lister().stream()
                .map(compte -> new CompteReponse(compte.id(), compte.pseudo(), compte.email(), compte.admin(),
                        compte.creeLe(),
                        new VolumeReponse(compte.volume().possessions(), compte.volume().envies(),
                                compte.volume().experiences(), compte.volume().classements(),
                                compte.volume().analyses(), compte.volume().total())))
                .toList();
    }

    @Operation(summary = "Supprimer un compte et TOUTES ses données. Définitif. "
            + "Un administrateur ne peut pas supprimer le sien.")
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void supprimer(@PathVariable UUID id,
                           @AuthenticationPrincipal AppUserDetailsService.Principal demandeur) {
        try {
            comptes.supprimer(id, demandeur.id());
        } catch (GestionDesComptes.CompteIntrouvable introuvable) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, introuvable.getMessage());
        } catch (GestionDesComptes.SuppressionRefusee refusee) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, refusee.getMessage());
        }
    }
}
