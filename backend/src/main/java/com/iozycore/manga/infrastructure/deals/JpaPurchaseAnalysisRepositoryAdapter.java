package com.iozycore.manga.infrastructure.deals;

import com.iozycore.manga.deals.PurchaseAnalysis;
import com.iozycore.manga.deals.PurchaseAnalysisRepository;
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
        return jpaRepository.findOneById(id).map(PurchaseAnalysisMapper::toDomain);
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
