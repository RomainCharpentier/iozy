package com.iozycore.core.domain.experience;

import com.iozycore.core.domain.shared.DomainEvent;

import java.time.Instant;
import java.util.UUID;

public record ExperienceRecorded(UUID experienceId, UUID entityId, String experienceType, Instant occurredAt) implements DomainEvent {
}
