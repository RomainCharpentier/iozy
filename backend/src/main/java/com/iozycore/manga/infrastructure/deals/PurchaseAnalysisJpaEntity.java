package com.iozycore.manga.infrastructure.deals;

import com.iozycore.manga.deals.PurchaseAnalysis;
import jakarta.persistence.Column;
import lombok.Getter;
import org.hibernate.annotations.TenantId;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * See V4__purchase_analysis.sql - {@code payload} is the full serialized
 * {@link PurchaseAnalysis} (same JSONB-snapshot pattern as
 * VolumeSearchCacheJpaEntity.volumes), the other columns only exist as an
 * indexed projection for the history list, never re-derived from the
 * payload at read time.
 */
@Entity
@Table(name = "purchase_analysis")
@Getter
public class PurchaseAnalysisJpaEntity {

    @Id
    private UUID id;

    // Separation by owner (V26): Hibernate adds this column
    // to the WHERE clause of every query on this entity, and fills it in at
    // insert time from ProprietaireCourant.
    @TenantId
    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "listing_url")
    private String listingUrl;

    @Column(name = "listing_platform")
    private String listingPlatform;

    @Column(name = "listing_title")
    private String listingTitle;

    @Column(name = "asking_price")
    private BigDecimal askingPrice;

    @Column(name = "shipping_fee")
    private BigDecimal shippingFee;

    @Column(name = "buyer_protection_fee")
    private BigDecimal buyerProtectionFee;

    @Column(name = "total_real_cost")
    private BigDecimal totalRealCost;

    @Column(name = "listing_condition")
    private String listingCondition;

    private String verdict;

    @Column(name = "verdict_score")
    private Integer verdictScore;

    @Column(name = "recommended_offer")
    private BigDecimal recommendedOffer;

    @Column(name = "target_price_min")
    private BigDecimal targetPriceMin;

    @Column(name = "target_price_max")
    private BigDecimal targetPriceMax;

    @Column(name = "max_price")
    private BigDecimal maxPrice;

    @Column(name = "negotiation_advice")
    private String negotiationAdvice;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "result_payload", nullable = false, columnDefinition = "jsonb")
    private PurchaseAnalysis payload;

    protected PurchaseAnalysisJpaEntity() {
        // required by JPA
    }

    public PurchaseAnalysisJpaEntity(UUID id, Instant createdAt, String listingUrl, String listingPlatform,
                                      String listingTitle, BigDecimal askingPrice, BigDecimal shippingFee,
                                      BigDecimal buyerProtectionFee, BigDecimal totalRealCost, String listingCondition,
                                      String verdict, Integer verdictScore, BigDecimal recommendedOffer,
                                      BigDecimal targetPriceMin, BigDecimal targetPriceMax, BigDecimal maxPrice,
                                      String negotiationAdvice, PurchaseAnalysis payload) {
        this.id = id;
        this.createdAt = createdAt;
        this.listingUrl = listingUrl;
        this.listingPlatform = listingPlatform;
        this.listingTitle = listingTitle;
        this.askingPrice = askingPrice;
        this.shippingFee = shippingFee;
        this.buyerProtectionFee = buyerProtectionFee;
        this.totalRealCost = totalRealCost;
        this.listingCondition = listingCondition;
        this.verdict = verdict;
        this.verdictScore = verdictScore;
        this.recommendedOffer = recommendedOffer;
        this.targetPriceMin = targetPriceMin;
        this.targetPriceMax = targetPriceMax;
        this.maxPrice = maxPrice;
        this.negotiationAdvice = negotiationAdvice;
        this.payload = payload;
    }
}
