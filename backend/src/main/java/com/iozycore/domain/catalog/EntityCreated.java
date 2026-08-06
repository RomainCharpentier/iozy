package com.iozycore.domain.catalog;

import com.iozycore.domain.shared.DomainEvent;

import java.time.Instant;
import java.util.UUID;

public record EntityCreated(UUID entityId, UUID entityTypeId, String title, Instant occurredAt) implements DomainEvent {
}
