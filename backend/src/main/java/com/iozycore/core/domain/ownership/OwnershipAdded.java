package com.iozycore.core.domain.ownership;

import com.iozycore.core.domain.shared.DomainEvent;

import java.time.Instant;
import java.util.UUID;

public record OwnershipAdded(UUID ownershipId, UUID entityId, Instant occurredAt) implements DomainEvent {
}
