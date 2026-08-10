package com.iozycore.infrastructure.persistence.purchaseanalysis;

import com.iozycore.purchaseanalysis.EditionTier;
import com.iozycore.purchaseanalysis.VerdictFactor;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Single mono-user row (see V4__purchase_analysis.sql and
 * {@link com.iozycore.domain.shared.DefaultOwner}).
 */
@Entity
@Table(name = "collector_preferences")
public class CollectorPreferencesJpaEntity {

    @Id
    @Column(name = "owner_id")
    private UUID ownerId;

    @Column(name = "prefer_completed_series", nullable = false)
    private boolean preferCompletedSeries;

    @Column(name = "avoid_ongoing_series", nullable = false)
    private boolean avoidOngoingSeries;

    @Column(name = "prefer_omnibus_integral", nullable = false)
    private boolean preferOmnibusIntegral;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "edition_tier_ranking", nullable = false, columnDefinition = "jsonb")
    private List<EditionTier> editionTierRanking;

    @Column(name = "avoid_outdated_edition_when_better_exists_or_announced", nullable = false)
    private boolean avoidOutdatedEditionWhenBetterExistsOrAnnounced;

    @Column(name = "french_language_only", nullable = false)
    private boolean frenchLanguageOnly;

    @Column(name = "prefer_easy_to_complete_collections", nullable = false)
    private boolean preferEasyToCompleteCollections;

    @Column(name = "condition_importance", nullable = false)
    private String conditionImportance;

    @Column(name = "minimum_discount_vs_retail_percent", nullable = false)
    private int minimumDiscountVsRetailPercent;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "factor_weights", nullable = false, columnDefinition = "jsonb")
    private Map<VerdictFactor, Integer> factorWeights;

    protected CollectorPreferencesJpaEntity() {
        // required by JPA
    }

    public CollectorPreferencesJpaEntity(UUID ownerId, boolean preferCompletedSeries, boolean avoidOngoingSeries,
                                          boolean preferOmnibusIntegral, List<EditionTier> editionTierRanking,
                                          boolean avoidOutdatedEditionWhenBetterExistsOrAnnounced,
                                          boolean frenchLanguageOnly, boolean preferEasyToCompleteCollections,
                                          String conditionImportance, int minimumDiscountVsRetailPercent,
                                          Map<VerdictFactor, Integer> factorWeights) {
        this.ownerId = ownerId;
        this.preferCompletedSeries = preferCompletedSeries;
        this.avoidOngoingSeries = avoidOngoingSeries;
        this.preferOmnibusIntegral = preferOmnibusIntegral;
        this.editionTierRanking = editionTierRanking;
        this.avoidOutdatedEditionWhenBetterExistsOrAnnounced = avoidOutdatedEditionWhenBetterExistsOrAnnounced;
        this.frenchLanguageOnly = frenchLanguageOnly;
        this.preferEasyToCompleteCollections = preferEasyToCompleteCollections;
        this.conditionImportance = conditionImportance;
        this.minimumDiscountVsRetailPercent = minimumDiscountVsRetailPercent;
        this.factorWeights = factorWeights;
    }

    public UUID getOwnerId() { return ownerId; }
    public boolean isPreferCompletedSeries() { return preferCompletedSeries; }
    public boolean isAvoidOngoingSeries() { return avoidOngoingSeries; }
    public boolean isPreferOmnibusIntegral() { return preferOmnibusIntegral; }
    public List<EditionTier> getEditionTierRanking() { return editionTierRanking; }
    public boolean isAvoidOutdatedEditionWhenBetterExistsOrAnnounced() { return avoidOutdatedEditionWhenBetterExistsOrAnnounced; }
    public boolean isFrenchLanguageOnly() { return frenchLanguageOnly; }
    public boolean isPreferEasyToCompleteCollections() { return preferEasyToCompleteCollections; }
    public String getConditionImportance() { return conditionImportance; }
    public int getMinimumDiscountVsRetailPercent() { return minimumDiscountVsRetailPercent; }
    public Map<VerdictFactor, Integer> getFactorWeights() { return factorWeights; }
}
