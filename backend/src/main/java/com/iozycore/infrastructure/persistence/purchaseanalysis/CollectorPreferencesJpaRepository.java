package com.iozycore.infrastructure.persistence.purchaseanalysis;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface CollectorPreferencesJpaRepository extends JpaRepository<CollectorPreferencesJpaEntity, UUID> {
}
