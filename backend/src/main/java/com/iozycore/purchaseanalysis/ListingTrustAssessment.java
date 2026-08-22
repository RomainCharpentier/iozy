package com.iozycore.purchaseanalysis;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Les points à vérifier sur une annonce, et rien d'autre.
 *
 * <h2>Une dimension séparée, à dessein</h2>
 * « Ce prix est-il bon ? » et « cette annonce est-elle nette ? » sont deux
 * questions différentes, et les fondre en un seul chiffre fait perdre les deux.
 * Un lot bradé par quelqu'un qui déménage et un lot bradé qui n'arrivera jamais
 * portent le même prix ; ce qui les distingue tient dans les détails que cette
 * classe relève. Elle n'influence donc jamais l'évaluation du prix, et
 * réciproquement.
 *
 * <h2>Ce qu'elle ne regarde pas</h2>
 * Rien sur le vendeur - ni note, ni ancienneté, ni nombre de ventes. Ces
 * données existent chez Vinted, mais seulement derrière une session
 * authentifiée : IozyCore ne les récupère pas (voir docs/LISTING_SOURCES.md).
 * Une annonce saisie à la main n'en a d'ailleurs aucune, et l'évaluation doit
 * marcher là aussi.
 *
 * <h2>Domaine pur</h2>
 * Aucun accès réseau, base ni Spring : du texte, un nombre de photos, un prix
 * et une référence. Testable tel quel.
 */
public record ListingTrustAssessment(TrustLevel level, List<TrustSignal> signals) {

    /** En deçà, une description ne dit rien de ce qu'on achète. */
    private static final int LONGUEUR_DESCRIPTION_MINIMALE = 40;

    /** Un lot montré sous deux angles au plus laisse trop de zones d'ombre. */
    private static final int PHOTOS_INSUFFISANTES = 2;

    /**
     * En dessous de cette fraction de la référence, l'écart mérite qu'on
     * regarde pourquoi. Seuil de <b>vigilance</b>, pas de rejet : le prix, lui,
     * reste évalué comme une bonne affaire (voir {@link PricePosition}).
     */
    private static final BigDecimal SEUIL_PRIX_TRES_BAS = new BigDecimal("0.40");

    /**
     * Mentions de paiement ou de contact hors plateforme. Liste explicite et
     * testable plutôt qu'un modèle : ces formulations sont stables, et une
     * détection qu'on peut lire est une détection qu'on peut corriger.
     */
    private static final Pattern HORS_PLATEFORME = Pattern.compile(
            "\\b(?:paypal|payp[ao]l|virement|whatsapp|whats app|telegram|snapchat|"
                    + "paiement (?:en )?(?:direct|dehors|hors)|hors vinted|en dehors de vinted|"
                    + "main ?propre uniquement|contacte[- ]moi (?:au|sur)|mon num[ée]ro|par sms)\\b",
            Pattern.CASE_INSENSITIVE);

    public ListingTrustAssessment {
        signals = signals == null ? List.of() : List.copyOf(signals);
    }

    /**
     * Examine ce qui est réellement disponible.
     *
     * @param description    texte de l'annonce, éventuellement absent
     * @param photoCount     nombre de photos réellement récupérées
     * @param askingPrice    prix demandé
     * @param referencePrice référence marché, ou {@code null} si aucune n'est fiable -
     *                       sans elle, aucun jugement sur « prix anormalement bas » n'est possible
     */
    public static ListingTrustAssessment assess(String description, int photoCount,
                                                 BigDecimal askingPrice, BigDecimal referencePrice) {
        List<TrustSignal> signaux = new ArrayList<>();

        if (photoCount == 0) {
            signaux.add(TrustSignal.NO_PHOTO);
        } else if (photoCount <= PHOTOS_INSUFFISANTES) {
            signaux.add(TrustSignal.VERY_FEW_PHOTOS);
        }
        // Volontairement muet au-delà : beaucoup de photos ne prouve rien, et
        // transformer l'abondance en gage de sérieux serait exactement le genre
        // de raccourci qu'un vendeur malintentionné exploite.

        String texte = description == null ? "" : description.trim();
        if (texte.length() < LONGUEUR_DESCRIPTION_MINIMALE) {
            signaux.add(TrustSignal.SHORT_DESCRIPTION);
        }
        if (HORS_PLATEFORME.matcher(texte.toLowerCase(Locale.ROOT)).find()) {
            signaux.add(TrustSignal.OFF_PLATFORM_PAYMENT_MENTION);
        }

        if (referencePrice != null && referencePrice.signum() > 0 && askingPrice != null
                && askingPrice.compareTo(referencePrice.multiply(SEUIL_PRIX_TRES_BAS)) < 0) {
            signaux.add(TrustSignal.PRICE_FAR_BELOW_REFERENCE);
        }

        signaux.sort(Comparator.comparing((TrustSignal s) -> s.severity()).reversed());
        return new ListingTrustAssessment(niveau(signaux), signaux);
    }

    /**
     * Le niveau découle de ce qui a été relevé, sans arithmétique cachée : un
     * signal fort suffit à faire regarder de près, l'accumulation de signaux
     * faibles compte moins qu'un seul signal fort.
     */
    private static TrustLevel niveau(List<TrustSignal> signaux) {
        if (signaux.isEmpty()) {
            return TrustLevel.NO_OBVIOUS_SIGNAL;
        }
        long forts = signaux.stream().filter(s -> s.severity() == TrustSignalSeverity.HIGH).count();
        if (forts >= 2) {
            return TrustLevel.CONCERNING;
        }
        if (forts == 1) {
            return TrustLevel.EXAMINE_CAREFULLY;
        }
        long moyens = signaux.stream().filter(s -> s.severity() == TrustSignalSeverity.MEDIUM).count();
        return moyens >= 2 ? TrustLevel.EXAMINE_CAREFULLY : TrustLevel.A_FEW_THINGS_TO_CHECK;
    }

    public boolean hasSignal(TrustSignal signal) {
        return signals.contains(signal);
    }
}
