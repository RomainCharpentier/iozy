package com.iozycore.purchaseanalysis;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * A second-hand listing as entered by the user (URL and/or manual fields -
 * there is no automated URL scraping, see {@link PriceBasis} and the
 * data-source limitations documented on {@link PurchaseAnalysisEngine}).
 *
 * @param description                 texte de l'annonce, tel qu'affiché au moment de l'analyse - lu par
 *                                    {@link ListingTrustAssessment} pour repérer les points à vérifier,
 *                                    et par {@link ListingTextParser} pour deviner le contenu du lot.
 *                                    Nullable : une annonce peut n'en avoir aucune.
 * @param photoUrls                   références EXTERNES vers les photos de la source, figées à l'instant
 *                                    de l'analyse. Ce ne sont pas des copies : la plateforme peut les faire
 *                                    expirer, et IozyCore n'en conserve aucune archive.
 * @param conditionAppliesToContainer true when {@link #condition()} describes a box/slipcase
 *                                    (e.g. a collector coffret) rather than a single standard
 *                                    volume - weighted more heavily by {@link VerdictScorer}
 */
public record Listing(UUID id, ListingPlatform platform, String url, String rawTitle, String description,
                       BigDecimal askingPrice, BigDecimal shippingFee, BigDecimal buyerProtectionFee,
                       Condition condition, boolean conditionAppliesToContainer,
                       List<ListingItem> items, List<String> photoUrls, Instant requestedAt) {
    public Listing {
        if (askingPrice == null || askingPrice.signum() < 0) {
            throw new IllegalArgumentException("Le prix demandé doit être nul ou positif");
        }
        if (items == null || items.isEmpty()) {
            throw new IllegalArgumentException("Une annonce doit contenir au moins un lot");
        }
        shippingFee = shippingFee == null ? BigDecimal.ZERO : shippingFee;
        buyerProtectionFee = buyerProtectionFee == null ? BigDecimal.ZERO : buyerProtectionFee;
        items = List.copyOf(items);
        photoUrls = photoUrls == null ? List.of() : List.copyOf(photoUrls);
    }

    /** {@code askingPrice + buyerProtectionFee + shippingFee} - never judge a listing on the displayed price alone. */
    public BigDecimal totalRealCost() {
        return askingPrice.add(buyerProtectionFee).add(shippingFee);
    }
}
