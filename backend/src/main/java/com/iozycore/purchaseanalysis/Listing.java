package com.iozycore.purchaseanalysis;

import com.iozycore.listing.ShippingEstimateKind;

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
                       BigDecimal askingPrice, BigDecimal shippingFee, ShippingEstimateKind shippingKind,
                       BigDecimal buyerProtectionFee,
                       Condition condition, boolean conditionAppliesToContainer,
                       List<ListingItem> items, List<String> photoUrls, Instant requestedAt) {
    public Listing {
        if (askingPrice == null || askingPrice.signum() < 0) {
            throw new IllegalArgumentException("Le prix demandé doit être nul ou positif");
        }
        if (items == null || items.isEmpty()) {
            throw new IllegalArgumentException("Une annonce doit contenir au moins un lot");
        }
        // Le zero par defaut reste, sinon le total serait incalculable - mais la
        // NATURE, elle, n'est jamais supposee : une livraison illisible reste
        // UNKNOWN, et l'ecran doit le dire plutot que de laisser croire a un
        // port offert.
        shippingKind = shippingKind == null
                ? (shippingFee == null ? ShippingEstimateKind.UNKNOWN : ShippingEstimateKind.EXACT)
                : shippingKind;
        shippingFee = shippingFee == null ? BigDecimal.ZERO : shippingFee;
        buyerProtectionFee = buyerProtectionFee == null ? BigDecimal.ZERO : buyerProtectionFee;
        items = List.copyOf(items);
        photoUrls = photoUrls == null ? List.of() : List.copyOf(photoUrls);
    }

    /**
     * Ce que l'achat coûtera : article + protection + livraison.
     * <p>
     * <b>C'est un coût d'acquisition ESTIMÉ, pas un montant facturé.</b> Quand
     * la livraison n'est qu'un plancher (plusieurs modes disponibles, voir
     * {@link #shippingKind()}), ce total est lui-même un minimum -
     * {@link #acquisitionCostIsLowerBound()} le dit, et l'interface doit le
     * dire aussi. Le nom historique de ce champ dans les analyses déjà
     * enregistrées est {@code totalRealCost} ; sa signification est celle-ci.
     * <p>
     * Ne jamais confondre avec {@link #askingPrice()} : c'est le prix de
     * l'article seul qui se compare aux prix d'autres annonces, lesquels sont
     * eux aussi hors frais. Comparer un total frais compris à des prix hors
     * frais reviendrait à comparer deux grandeurs différentes.
     */
    public BigDecimal totalRealCost() {
        return askingPrice.add(buyerProtectionFee).add(shippingFee);
    }

    /** Vrai quand le coût d'acquisition n'est qu'un minimum, la livraison étant un « à partir de ». */
    @com.fasterxml.jackson.annotation.JsonIgnore
    public boolean acquisitionCostIsLowerBound() {
        return shippingKind == ShippingEstimateKind.FROM;
    }
}
