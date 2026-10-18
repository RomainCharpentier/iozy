package com.iozycore.core.api.admin;

import com.iozycore.core.application.admin.GestionDesComptes;
import com.iozycore.core.application.auth.AppUserDetailsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
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
 * The accounts of the instance, for whoever answers for it.
 *
 * <h2>Two routes, and the guard is elsewhere</h2>
 * All of {@code /api/admin/**} requires the {@code ADMIN} role - declared once
 * in {@code SecurityConfig}, never repeated here. An annotation per method
 * would be one more chance to forget it on the next one.
 *
 * <h2>What comes out of here</h2>
 * Metadata and <b>numbers</b>. No route of this controller returns
 * a row of anyone's collection: administration is about the
 * instance, not about the data (see {@link GestionDesComptes}).
 */
@RestController
@RequestMapping("/api/admin/comptes")
@Tag(name = "Administration", description = "The accounts of the instance - reserved for administrators")
@RequiredArgsConstructor
public class ComptesAdminController {

    private final GestionDesComptes comptes;

    /**
     * @param volume what the account would destroy if it were deleted - the only
     *               way to decide knowingly
     */
    public record CompteReponse(UUID id, String pseudo, String email, boolean admin, Instant creeLe,
                                 VolumeReponse volume) {
    }

    public record VolumeReponse(long possessions, long envies, long experiences, long classements, long analyses,
                                 long total) {
    }

    @Operation(summary = "All accounts of the instance, from the oldest to the newest.")
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

    @Operation(summary = "Delete an account and ALL its data. Final. "
            + "An administrator cannot delete their own.")
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
