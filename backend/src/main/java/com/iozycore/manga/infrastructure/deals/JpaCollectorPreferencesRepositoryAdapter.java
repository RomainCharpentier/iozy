package com.iozycore.manga.infrastructure.deals;

import com.iozycore.core.application.auth.UtilisateurCourant;
import com.iozycore.manga.domain.deals.CollectorPreferences;
import com.iozycore.manga.domain.deals.CollectorPreferencesRepository;
import com.iozycore.manga.domain.deals.WeightLevel;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
@Transactional
@RequiredArgsConstructor
public class JpaCollectorPreferencesRepositoryAdapter implements CollectorPreferencesRepository {

    private final CollectorPreferencesJpaRepository jpaRepository;
    private final UtilisateurCourant utilisateurCourant;

    @Override
    public CollectorPreferences find() {
        // The primary key IS the owner: no @TenantId here, the
        // question "whose ones?" is already that of the row to read.
        return jpaRepository.findById(utilisateurCourant.proprietaire())
                .map(this::toDomain)
                .orElseGet(CollectorPreferences::defaults);
    }

    @Override
    public CollectorPreferences save(CollectorPreferences preferences) {
        CollectorPreferencesJpaEntity jpa = new CollectorPreferencesJpaEntity(
                utilisateurCourant.proprietaire(), preferences.editionTierRanking(),
                preferences.avoidOutdatedEditionWhenBetterExistsOrAnnounced(),
                preferences.conditionImportance().name(),
                preferences.minimumDiscountVsRetailPercent(), preferences.factorWeights());
        return toDomain(jpaRepository.save(jpa));
    }

    private CollectorPreferences toDomain(CollectorPreferencesJpaEntity jpa) {
        return new CollectorPreferences(jpa.getEditionTierRanking(),
                jpa.isAvoidOutdatedEditionWhenBetterExistsOrAnnounced(),
                WeightLevel.valueOf(jpa.getConditionImportance()),
                jpa.getMinimumDiscountVsRetailPercent(), jpa.getFactorWeights());
    }
}
