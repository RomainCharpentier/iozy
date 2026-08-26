package com.iozycore.api.followededition;

import com.iozycore.api.dto.FollowedEditionDtos.FollowEditionRequest;
import com.iozycore.api.dto.FollowedEditionDtos.FollowedEditionResponse;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.followededition.FollowedEdition;
import com.iozycore.domain.followededition.FollowedEditionRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * « L'édition que je collectionne » pour une série (voir
 * com.iozycore.domain.followededition, et le badge SUIVIE de la maquette
 * « Fiche série - multi-éditions »).
 */
@RestController
@RequestMapping("/api/followed-editions")
@Tag(name = "Followed editions", description = "L'édition d'une série que l'utilisateur collectionne")
public class FollowedEditionController {

    private final FollowedEditionRepository followedEditionRepository;
    private final EntityRepository entityRepository;

    public FollowedEditionController(FollowedEditionRepository followedEditionRepository,
                                     EntityRepository entityRepository) {
        this.followedEditionRepository = followedEditionRepository;
        this.entityRepository = entityRepository;
    }

    /**
     * PUT et non POST : suivre une édition est IDEMPOTENT - il n'y en a
     * qu'une par série, et redemander la même ne doit rien créer de nouveau.
     * L'upsert passe par {@code suivreALaPlace}, qui garde la même ligne
     * plutôt que d'enchaîner un DELETE et un INSERT (voir FollowedEdition).
     */
    @Operation(summary = "Suivre une édition d'une série (remplace celle déjà suivie, s'il y en a une)")
    @PutMapping
    public FollowedEditionResponse follow(@RequestBody FollowEditionRequest request) {
        entityRepository.findById(request.entityId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Entité introuvable : " + request.entityId()));
        FollowedEdition aEnregistrer = followedEditionRepository.findByEntityId(request.entityId())
                .map(existante -> existante.suivreALaPlace(request.editionName()))
                .orElseGet(() -> FollowedEdition.create(request.entityId(), request.editionName()));
        return FollowedEditionResponse.from(followedEditionRepository.save(aEnregistrer));
    }

    @Operation(summary = "Ne plus suivre d'édition pour cette série")
    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unfollow(@RequestParam UUID entityId) {
        followedEditionRepository.deleteByEntityId(entityId);
    }

    /**
     * Renvoie une LISTE et non un objet ou un 404 : « aucune édition suivie »
     * est un état parfaitement normal (une série à édition unique n'a rien à
     * choisir), et le client n'a pas à distinguer ce cas d'une panne. Une
     * liste vide se lit sans traitement d'erreur, là où un 404 obligerait
     * chaque appelant à le neutraliser - piège déjà rencontré avec
     * {@code findEdition}, dont tous les appels portent un {@code retry:false}
     * pour cette seule raison.
     */
    @Operation(summary = "L'édition suivie d'une série (liste vide si aucune)")
    @GetMapping
    public List<FollowedEditionResponse> byEntity(@RequestParam UUID entityId) {
        return followedEditionRepository.findByEntityId(entityId).stream()
                .map(FollowedEditionResponse::from)
                .collect(Collectors.toList());
    }
}
