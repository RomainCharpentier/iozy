package com.iozycore.api.loan;

import com.iozycore.api.dto.LoanDtos.ActiveLoanResponse;
import com.iozycore.api.dto.LoanDtos.LendRequest;
import com.iozycore.api.dto.LoanDtos.LoanResponse;
import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.Variant;
import com.iozycore.domain.loan.Loan;
import com.iozycore.domain.loan.LoanRepository;
import com.iozycore.domain.ownership.Ownership;
import com.iozycore.domain.ownership.OwnershipRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/** À qui un manga ou un jeu a été prêté (voir com.iozycore.domain.loan). */
@RestController
@RequestMapping("/api/loans")
@Tag(name = "Loans", description = "Prêts d'une possession précise à quelqu'un")
public class LoanController {

    private final LoanRepository loanRepository;
    private final OwnershipRepository ownershipRepository;
    private final EntityRepository entityRepository;

    public LoanController(LoanRepository loanRepository, OwnershipRepository ownershipRepository,
                           EntityRepository entityRepository) {
        this.loanRepository = loanRepository;
        this.ownershipRepository = ownershipRepository;
        this.entityRepository = entityRepository;
    }

    @Operation(summary = "Prêter une possession précise - refusé si elle a déjà un prêt en cours")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public LoanResponse lend(@RequestBody LendRequest request) {
        Ownership ownership = ownershipRepository.findById(request.ownershipId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Possession introuvable : " + request.ownershipId()));

        boolean alreadyLent = loanRepository.findByOwnershipId(ownership.id()).stream().anyMatch(Loan::isActive);
        if (alreadyLent) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cette possession a déjà un prêt en cours");
        }

        Loan loan = Loan.lend(request.ownershipId(), request.borrowerName(),
                request.lentAt() != null ? request.lentAt() : LocalDate.now(), request.note());
        return LoanResponse.from(loanRepository.save(loan));
    }

    @Operation(summary = "Marquer un prêt comme rendu")
    @PostMapping("/{id}/return")
    public LoanResponse markReturned(@PathVariable UUID id) {
        Loan loan = loanRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Prêt introuvable : " + id));
        loan.markReturned(LocalDate.now());
        return LoanResponse.from(loanRepository.save(loan));
    }

    @Operation(summary = "Historique des prêts (rendus compris) d'une possession précise")
    @GetMapping
    public List<LoanResponse> byOwnership(@RequestParam UUID ownershipId) {
        return loanRepository.findByOwnershipId(ownershipId).stream()
                .map(LoanResponse::from)
                .collect(Collectors.toList());
    }

    @Operation(summary = "Tous les prêts en cours (\"Prêts en cours\", Mon profil), enrichis du titre/tome pour l'affichage")
    @GetMapping("/active")
    public List<ActiveLoanResponse> active() {
        return loanRepository.findAllActive().stream()
                .map(this::enrich)
                .filter(Optional::isPresent)
                .map(Optional::get)
                .collect(Collectors.toList());
    }

    /** Vide si l'Ownership ou l'Entity référencée a disparu depuis (ne devrait pas arriver en usage normal, mais un prêt ne doit jamais faire planter cet écran). */
    private Optional<ActiveLoanResponse> enrich(Loan loan) {
        Optional<Ownership> ownership = ownershipRepository.findById(loan.ownershipId());
        if (ownership.isEmpty()) {
            return Optional.empty();
        }
        Optional<Entity> entity = entityRepository.findById(ownership.get().entityId());
        if (entity.isEmpty()) {
            return Optional.empty();
        }
        String variantLabel = ownership.get().variantId()
                .flatMap(variantId -> entity.get().variants().stream().filter(v -> v.id().equals(variantId)).findFirst())
                .map(Variant::label)
                .orElse(null);
        return Optional.of(new ActiveLoanResponse(loan.id(), loan.ownershipId(), entity.get().id(), entity.get().title(),
                variantLabel, loan.borrowerName(), loan.lentAt(), loan.note()));
    }
}
