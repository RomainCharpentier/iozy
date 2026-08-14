package com.iozycore.application;

import com.iozycore.domain.loan.Loan;
import com.iozycore.domain.loan.LoanRepository;
import com.iozycore.domain.ownership.Ownership;
import com.iozycore.domain.ownership.OwnershipCondition;
import com.iozycore.domain.ownership.OwnershipRepository;
import com.iozycore.domain.shared.OwnershipDeletionNotAllowedException;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OwnershipDeletionServiceTest {

    private final InMemoryOwnershipRepository ownershipRepository = new InMemoryOwnershipRepository();
    private final InMemoryLoanRepository loanRepository = new InMemoryLoanRepository();
    private final OwnershipDeletionService service = new OwnershipDeletionService(ownershipRepository, loanRepository);

    @Test
    void an_ownership_with_no_loan_is_deleted() {
        Ownership ownership = Ownership.acquire(UUID.randomUUID(), null, OwnershipCondition.NEW, LocalDate.now(), null);
        ownershipRepository.save(ownership);

        service.delete(ownership.id());

        assertThat(ownershipRepository.findById(ownership.id())).isEmpty();
    }

    @Test
    void an_ownership_referenced_by_a_loan_is_never_deleted() {
        Ownership ownership = Ownership.acquire(UUID.randomUUID(), null, OwnershipCondition.NEW, LocalDate.now(), null);
        ownershipRepository.save(ownership);
        loanRepository.save(Loan.lend(ownership.id(), "Alex", LocalDate.now(), null));

        assertThatThrownBy(() -> service.delete(ownership.id()))
                .isInstanceOf(OwnershipDeletionNotAllowedException.class)
                .hasMessageContaining("1 prêt");

        // Jamais de suppression partielle : la garde bloque AVANT tout appel à ownershipRepository.deleteById.
        assertThat(ownershipRepository.findById(ownership.id())).isPresent();
    }

    private static class InMemoryOwnershipRepository implements OwnershipRepository {
        private final Map<UUID, Ownership> store = new HashMap<>();

        @Override
        public Ownership save(Ownership ownership) {
            store.put(ownership.id(), ownership);
            return ownership;
        }

        @Override
        public Optional<Ownership> findById(UUID id) {
            return Optional.ofNullable(store.get(id));
        }

        @Override
        public List<Ownership> findByEntityId(UUID entityId) {
            return store.values().stream().filter(o -> o.entityId().equals(entityId)).toList();
        }

        @Override
        public boolean existsByEntityId(UUID entityId) {
            return !findByEntityId(entityId).isEmpty();
        }

        @Override
        public List<Ownership> findAll() {
            return new ArrayList<>(store.values());
        }

        @Override
        public void deleteById(UUID id) {
            store.remove(id);
        }
    }

    private static class InMemoryLoanRepository implements LoanRepository {
        private final Map<UUID, Loan> store = new HashMap<>();

        @Override
        public Loan save(Loan loan) {
            store.put(loan.id(), loan);
            return loan;
        }

        @Override
        public Optional<Loan> findById(UUID id) {
            return Optional.ofNullable(store.get(id));
        }

        @Override
        public List<Loan> findByOwnershipId(UUID ownershipId) {
            return store.values().stream().filter(l -> l.ownershipId().equals(ownershipId)).toList();
        }

        @Override
        public List<Loan> findAllActive() {
            return store.values().stream().filter(l -> l.returnedAt().isEmpty()).toList();
        }
    }
}
