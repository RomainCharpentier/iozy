package com.iozycore.infrastructure.persistence.purchaseanalysis;

import com.iozycore.domain.shared.DefaultOwner;
import com.iozycore.purchaseanalysis.CollectorPreferences;
import com.iozycore.purchaseanalysis.CollectorPreferencesRepository;
import com.iozycore.purchaseanalysis.WeightLevel;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
@Transactional
public class JpaCollectorPreferencesRepositoryAdapter implements CollectorPreferencesRepository {

    private final CollectorPreferencesJpaRepository jpaRepository;

    public JpaCollectorPreferencesRepositoryAdapter(CollectorPreferencesJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public CollectorPreferences find() {
        return jpaRepository.findById(DefaultOwner.ID)
                .map(this::toDomain)
                .orElseGet(CollectorPreferences::defaults);
    }

    @Override
    public CollectorPreferences save(CollectorPreferences preferences) {
        CollectorPreferencesJpaEntity jpa = new CollectorPreferencesJpaEntity(
                DefaultOwner.ID, preferences.preferCompletedSeries(), preferences.avoidOngoingSeries(),
                preferences.preferOmnibusIntegral(), preferences.editionTierRanking(),
                preferences.avoidOutdatedEditionWhenBetterExistsOrAnnounced(), preferences.frenchLanguageOnly(),
                preferences.preferEasyToCompleteCollections(), preferences.conditionImportance().name(),
                preferences.minimumDiscountVsRetailPercent(), preferences.factorWeights());
        return toDomain(jpaRepository.save(jpa));
    }

    private CollectorPreferences toDomain(CollectorPreferencesJpaEntity jpa) {
        return new CollectorPreferences(jpa.isPreferCompletedSeries(), jpa.isAvoidOngoingSeries(),
                jpa.isPreferOmnibusIntegral(), jpa.getEditionTierRanking(),
                jpa.isAvoidOutdatedEditionWhenBetterExistsOrAnnounced(), jpa.isFrenchLanguageOnly(),
                jpa.isPreferEasyToCompleteCollections(), WeightLevel.valueOf(jpa.getConditionImportance()),
                jpa.getMinimumDiscountVsRetailPercent(), jpa.getFactorWeights());
    }
}
