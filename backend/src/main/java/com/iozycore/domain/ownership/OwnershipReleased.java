package com.iozycore.domain.ownership;

import com.iozycore.domain.shared.DomainEvent;

import java.time.Instant;
import java.util.UUID;

public record OwnershipReleased(UUID ownershipId, UUID entityId, OwnershipStatus newStatus, Instant occurredAt) implements DomainEvent {
}
