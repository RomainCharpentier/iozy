package com.iozycore.core.domain.ownership;

import com.iozycore.core.domain.shared.DomainEvent;

import java.time.Instant;
import java.util.UUID;

public record OwnershipReleased(UUID ownershipId, UUID entityId, OwnershipStatus newStatus, Instant occurredAt) implements DomainEvent {
}
