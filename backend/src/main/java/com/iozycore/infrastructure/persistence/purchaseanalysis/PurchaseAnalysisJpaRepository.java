package com.iozycore.infrastructure.persistence.purchaseanalysis;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PurchaseAnalysisJpaRepository extends JpaRepository<PurchaseAnalysisJpaEntity, UUID> {
    List<PurchaseAnalysisJpaEntity> findAllByOrderByCreatedAtDesc();
}
