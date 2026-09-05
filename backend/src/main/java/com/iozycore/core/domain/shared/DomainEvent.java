package com.iozycore.core.domain.shared;

import java.time.Instant;

/** Marqueur commun à tous les événements de domaine d'IozyCore. */
public interface DomainEvent {
    Instant occurredAt();
}
