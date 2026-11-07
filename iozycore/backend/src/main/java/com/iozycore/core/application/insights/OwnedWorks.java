package com.iozycore.core.application.insights;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * The works of one type that the current account really owns.
 *
 * <p>The catalog is shared by all accounts: a work exists there as soon as
 * someone added it, wished it or followed it. Only an active ownership says
 * that this account has it, and ownerships are read for the current account
 * only. Discovery sources start from here, so that "similar to what you own"
 * never comes from another account's shelf.
 */
@Component
@RequiredArgsConstructor
public class OwnedWorks {

    private final EntityRepository entityRepository;
    private final OwnershipRepository ownershipRepository;

    public List<Entity> ofType(UUID entityTypeId) {
        Set<UUID> ownedIds = ownershipRepository.findAll().stream()
                .filter(Ownership::isActive)
                .map(Ownership::entityId)
                .collect(Collectors.toSet());
        if (ownedIds.isEmpty()) {
            return List.of();
        }
        return entityRepository.findAllByType(entityTypeId).stream()
                .filter(entity -> ownedIds.contains(entity.id()))
                .toList();
    }
}
