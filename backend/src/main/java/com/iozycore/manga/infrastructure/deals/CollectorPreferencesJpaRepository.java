package com.iozycore.manga.infrastructure.deals;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface CollectorPreferencesJpaRepository extends JpaRepository<CollectorPreferencesJpaEntity, UUID> {
}
