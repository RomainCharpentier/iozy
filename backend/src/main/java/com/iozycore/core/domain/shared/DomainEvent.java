package com.iozycore.core.domain.shared;

import java.time.Instant;

/** Marker common to all domain events of IozyCore. */
public interface DomainEvent {
    Instant occurredAt();
}
