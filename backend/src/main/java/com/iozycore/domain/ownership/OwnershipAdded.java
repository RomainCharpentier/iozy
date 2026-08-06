package com.iozycore.domain.ownership;

import com.iozycore.domain.shared.DomainEvent;

import java.time.Instant;
import java.util.UUID;

public record OwnershipAdded(UUID ownershipId, UUID entityId, Instant occurredAt) implements DomainEvent {
}
