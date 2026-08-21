package com.iozycore.infrastructure.persistence.purchaseanalysis;

import com.iozycore.purchaseanalysis.PurchaseAnalysis;
import com.iozycore.purchaseanalysis.PurchaseAnalysisRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
@Transactional
public class JpaPurchaseAnalysisRepositoryAdapter implements PurchaseAnalysisRepository {

    private final PurchaseAnalysisJpaRepository jpaRepository;

    public JpaPurchaseAnalysisRepositoryAdapter(PurchaseAnalysisJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public PurchaseAnalysis save(PurchaseAnalysis analysis) {
        return PurchaseAnalysisMapper.toDomain(jpaRepository.save(PurchaseAnalysisMapper.toJpa(analysis)));
    }

    @Override
    public Optional<PurchaseAnalysis> findById(UUID id) {
        return jpaRepository.findById(id).map(PurchaseAnalysisMapper::toDomain);
    }

    @Override
    public void deleteById(UUID id) {
        jpaRepository.deleteById(id);
    }

    @Override
    public List<PurchaseAnalysis> findAll() {
        return jpaRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(PurchaseAnalysisMapper::toDomain)
                .toList();
    }
}
