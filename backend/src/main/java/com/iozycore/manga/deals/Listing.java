package com.iozycore.manga.deals;

import com.iozycore.listing.ShippingEstimateKind;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import com.iozycore.listing.ListingPlatform;

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
        // La NATURE n'est jamais supposee, et c'est ici qu'elle se normalise -
        // un seul endroit pour tous les appelants : API, moteur, et relecture
        // JSONB d'une analyse ancienne.
        //
        // Nature absente mais montant present : personne n'a affirme que ce
        // tarif etait ferme, donc ESTIMATED. Attribuer EXACT donnerait a un
        // nombre recu la valeur d'un tarif constate.
        //
        // Un ZERO sans nature ne dit rien, en revanche : il ne se distingue pas
        // d'un champ laisse vide. Le lire "0,00 EUR estimes" affirmerait qu'une
        // livraison gratuite a ete constatee alors que personne ne l'a dite -
        // une livraison reellement offerte arrive avec FREE. Ce cas concerne
        // surtout la relecture des analyses anterieures a cette nature, dont le
        // port valait zero par defaut.
        if (shippingKind == null) {
            shippingKind = (shippingFee == null || shippingFee.signum() == 0)
                    ? ShippingEstimateKind.UNKNOWN
                    : ShippingEstimateKind.ESTIMATED;
        }
        // UNKNOWN portant un montant est une contradiction : le total
        // l'inclurait pendant que l'ecran annoncerait « non communiquee ».
        // Le montant existe, il n'est simplement pas garanti - c'est
        // exactement ESTIMATED. Cette regle repare aussi, a la relecture, les
        // analyses enregistrees avant que ce cas ait un nom.
        if (shippingKind == ShippingEstimateKind.UNKNOWN && shippingFee != null
                && shippingFee.signum() != 0) {
            shippingKind = ShippingEstimateKind.ESTIMATED;
        }
        // Le zero par defaut reste, sinon le total serait incalculable ; mais
        // sous UNKNOWN c'est un zero de calcul, pas un port offert, et
        // acquisitionCostIncludesShipping() empeche de le lire autrement.
        shippingFee = shippingFee == null ? BigDecimal.ZERO : shippingFee;
        buyerProtectionFee = buyerProtectionFee == null ? BigDecimal.ZERO : buyerProtectionFee;
        items = List.copyOf(items);
        photoUrls = photoUrls == null ? List.of() : List.copyOf(photoUrls);
    }

    /**
     * Ce que l'achat coûtera : article + protection + livraison.
     * <p>
     * <b>C'est un coût d'acquisition ESTIMÉ, pas un montant facturé.</b> Deux
     * réserves peuvent l'affecter, et l'interface doit les reprendre :
     * <ul>
     *   <li>livraison en « à partir de » : le total est un <b>minimum</b>
     *       ({@link #acquisitionCostIsLowerBound()}) ;</li>
     *   <li>livraison inconnue : le total est <b>incomplet</b>, il ne contient
     *       aucune livraison ({@link #acquisitionCostIncludesShipping()}) et ne
     *       doit pas être annoncé comme un coût d'acquisition.</li>
     * </ul>
     * Le nom historique de ce champ dans les analyses déjà enregistrées est
     * {@code totalRealCost} ; sa signification est celle-ci.
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
        return shippingKind.isLowerBound();
    }

    /**
     * Vrai quand une livraison a pu être prise en compte - offerte, ferme,
     * plancher ou estimée. Faux sous {@link ShippingEstimateKind#UNKNOWN} : le
     * total n'est alors qu'un <b>sous-total connu</b>, et l'annoncer comme un
     * coût d'acquisition laisserait croire à un achat à 11,20 € qui coûtera
     * plus.
     */
    @com.fasterxml.jackson.annotation.JsonIgnore
    public boolean acquisitionCostIncludesShipping() {
        return shippingKind.hasAmount();
    }
}
