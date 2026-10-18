package com.iozycore.core.application;

import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;

/**
 * Use cases of the copies (UC2): status changes (sold, lost, back in the
 * collection). The deletion has its own rules, see {@link OwnershipDeletionService}.
 */
@Service
@RequiredArgsConstructor
public class OwnershipService {

    private final OwnershipRepository ownershipRepository;

    /** The copies of a work, or all of them when {@code entityId} is null. */
    public List<Ownership> list(UUID entityId) {
        return entityId != null ? ownershipRepository.findByEntityId(entityId) : ownershipRepository.findAll();
    }

    @Transactional
    public Ownership markSold(UUID id) {
        return change(id, Ownership::markSold);
    }

    @Transactional
    public Ownership markLost(UUID id) {
        return change(id, Ownership::markLost);
    }

    /** Undoes "sold" or "lost". The domain refuses it for an active copy (409). */
    @Transactional
    public Ownership restore(UUID id) {
        return change(id, Ownership::restore);
    }

    private Ownership change(UUID id, Consumer<Ownership> transition) {
        Ownership ownership = ownershipRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Ownership introuvable : " + id));
        transition.accept(ownership);
        return ownershipRepository.save(ownership);
    }
}
