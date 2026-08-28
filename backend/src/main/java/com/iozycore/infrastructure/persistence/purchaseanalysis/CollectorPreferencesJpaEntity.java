package com.iozycore.infrastructure.persistence.purchaseanalysis;

import com.iozycore.domain.catalog.EditionTier;
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
 * <p>
 * Cinq colonnes ont ete retirees au Lot 84 (voir
 * V24__drop_inert_collector_preferences.sql) : aucune ligne du moteur ne les
 * lisait.
 */
@Entity
@Table(name = "collector_preferences")
public class CollectorPreferencesJpaEntity {

    @Id
    @Column(name = "owner_id")
    private UUID ownerId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "edition_tier_ranking", nullable = false, columnDefinition = "jsonb")
    private List<EditionTier> editionTierRanking;

    @Column(name = "avoid_outdated_edition_when_better_exists_or_announced", nullable = false)
    private boolean avoidOutdatedEditionWhenBetterExistsOrAnnounced;

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

    public CollectorPreferencesJpaEntity(UUID ownerId, List<EditionTier> editionTierRanking,
                                          boolean avoidOutdatedEditionWhenBetterExistsOrAnnounced,
                                          String conditionImportance, int minimumDiscountVsRetailPercent,
                                          Map<VerdictFactor, Integer> factorWeights) {
        this.ownerId = ownerId;
        this.editionTierRanking = editionTierRanking;
        this.avoidOutdatedEditionWhenBetterExistsOrAnnounced = avoidOutdatedEditionWhenBetterExistsOrAnnounced;
        this.conditionImportance = conditionImportance;
        this.minimumDiscountVsRetailPercent = minimumDiscountVsRetailPercent;
        this.factorWeights = factorWeights;
    }

    public UUID getOwnerId() { return ownerId; }
    public List<EditionTier> getEditionTierRanking() { return editionTierRanking; }
    public boolean isAvoidOutdatedEditionWhenBetterExistsOrAnnounced() { return avoidOutdatedEditionWhenBetterExistsOrAnnounced; }
    public String getConditionImportance() { return conditionImportance; }
    public int getMinimumDiscountVsRetailPercent() { return minimumDiscountVsRetailPercent; }
    public Map<VerdictFactor, Integer> getFactorWeights() { return factorWeights; }
}
