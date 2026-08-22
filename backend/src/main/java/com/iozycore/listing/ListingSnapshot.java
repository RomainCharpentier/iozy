package com.iozycore.listing;

import com.iozycore.purchaseanalysis.ListingPlatform;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Ce qu'IozyCore a réellement pu lire d'une annonce en ligne, à un instant
 * donné, sous une forme indépendante de la plateforme d'origine.
 * <p>
 * <b>Tout est facultatif sauf la source et l'URL.</b> Une annonce dont seuls le
 * titre et le prix sont lisibles produit un snapshot avec ces deux champs et
 * rien d'autre - jamais un échec, jamais une valeur inventée pour combler un
 * trou. {@link #retrievedFields()} dit exactement ce qui a été trouvé, ce qui
 * permet au client de ne pré-remplir que ça, et à l'utilisateur de savoir ce
 * qu'il lui reste à saisir.
 * <p>
 * <b>C'est une photographie, pas un lien vivant.</b> {@code retrievedAt} date
 * la lecture ; si le vendeur change son prix ensuite, ce snapshot ne bouge pas
 * et l'analyse qui s'appuie dessus non plus. Aucune synchronisation n'existe.
 * <p>
 * Volontairement dépourvu de données personnelles du vendeur : pseudo, avatar,
 * localisation précise n'apportent rien au verdict d'achat et n'ont donc pas à
 * être récupérés ni conservés.
 *
 * @param externalId identifiant de l'annonce chez la source, quand il est lisible - sert à reconnaître deux URL de la même annonce
 * @param price              prix affiché, hors frais - le formulaire d'analyse les tient séparés
 * @param shippingFee        frais de port annoncés. C'est un prix <b>« à partir de »</b> : quand plusieurs
 *                           modes de livraison existent, la source affiche le moins cher, et le montant
 *                           réel peut être supérieur selon le point relais choisi. Zéro quand la livraison
 *                           est annoncée gratuite - un vrai zéro, pas une absence.
 * @param buyerProtectionFee frais de protection acheteur, montant réellement facturé (après remise
 *                           éventuelle), pas le tarif affiché avant promotion
 * @param imageUrls  photos de l'annonce elle-même, dans l'ordre d'affichage - jamais les avatars ni les vignettes d'articles similaires
 */
public record ListingSnapshot(ListingPlatform source, String sourceUrl, String externalId, String title,
                               String description, BigDecimal price, String currency,
                               BigDecimal shippingFee, BigDecimal buyerProtectionFee,
                               List<String> imageUrls, Instant retrievedAt, List<ListingField> retrievedFields) {

    public ListingSnapshot {
        imageUrls = imageUrls == null ? List.of() : List.copyOf(imageUrls);
        retrievedFields = retrievedFields == null ? List.of() : List.copyOf(retrievedFields);
    }

    /** Les champs qu'un provider peut rapporter - sert à dire ce qui a été trouvé, pas ce qui existe. */
    public enum ListingField {
        TITLE,
        DESCRIPTION,
        PRICE,
        /** Frais de port - voir la réserve « à partir de » sur {@link ListingSnapshot#shippingFee()}. */
        SHIPPING_FEE,
        BUYER_PROTECTION_FEE,
        IMAGES
    }

    /** Rien de lisible : ni titre, ni prix, ni description, ni photo. Le parcours manuel reprend la main. */
    public boolean isEmpty() {
        return retrievedFields.isEmpty();
    }
}
