package com.iozycore.application;

import com.iozycore.domain.ownership.Ownership;
import com.iozycore.domain.ownership.OwnershipCondition;
import com.iozycore.domain.ownership.OwnershipRepository;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * Ce service refusait autrefois de supprimer une possession référencée par un
 * prêt. Les prêts ayant été retirés du produit (voir {@code V19__drop_loan.sql}),
 * il ne reste plus aucune garde - ce que ces tests affirment explicitement,
 * pour qu'un retrait de règle reste un fait vérifié et non un oubli constaté
 * plus tard.
 */
class OwnershipDeletionServiceTest {

    private final InMemoryOwnershipRepository ownershipRepository = new InMemoryOwnershipRepository();
    private final OwnershipDeletionService service = new OwnershipDeletionService(ownershipRepository);

    @Test
    void an_ownership_is_deleted_on_demand() {
        Ownership ownership = Ownership.acquire(UUID.randomUUID(), null, OwnershipCondition.NEW, LocalDate.now(), null);
        ownershipRepository.save(ownership);

        service.delete(ownership.id());

        assertThat(ownershipRepository.findById(ownership.id())).isEmpty();
    }

    @Test
    void deleting_an_unknown_ownership_is_silent_because_the_route_is_idempotent() {
        // DELETE /api/ownerships/{id} annonce 204 pour un identifiant inconnu ou
        // déjà supprimé. Ce service ne doit donc jamais lever pour cette raison.
        assertThatCode(() -> service.delete(UUID.randomUUID())).doesNotThrowAnyException();
    }

    @Test
    void deleting_one_ownership_leaves_the_others_untouched() {
        UUID entityId = UUID.randomUUID();
        Ownership supprime = ownershipRepository.save(
                Ownership.acquire(entityId, null, OwnershipCondition.NEW, LocalDate.now(), null));
        Ownership conserve = ownershipRepository.save(
                Ownership.acquire(entityId, null, OwnershipCondition.USED, LocalDate.now(), null));

        service.delete(supprime.id());

        assertThat(ownershipRepository.findById(supprime.id())).isEmpty();
        assertThat(ownershipRepository.findById(conserve.id())).isPresent();
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
}
