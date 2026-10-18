package com.iozycore.core.domain.catalog;

import com.iozycore.core.domain.shared.DomainEvent;

import java.time.Instant;
import java.util.UUID;

public record EntityCreated(UUID entityId, UUID entityTypeId, String title, Instant occurredAt) implements DomainEvent {
}
