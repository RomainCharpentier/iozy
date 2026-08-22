package com.iozycore.purchaseanalysis;

import com.iozycore.domain.catalog.MangaEdition;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Le repère auquel se compare le <b>prix d'une annonce</b>, avec tout ce qu'il
 * faut pour en juger : combien de comparables, d'où ils viennent, à quelle
 * forme de lot ils correspondent, et à quel point ils s'accordent entre eux.
 *
 * <h2>Un chiffre ne suffit pas</h2>
 * « 70 € » ne se discute pas. « 70 €, à partir de 4 lots comparables de 10 à
 * 14 tomes, relevés dans les six derniers mois, resserrés à 12 % près » se
 * discute - et se corrige. C'est pour ça que l'échantillon, la source et la
 * dispersion voyagent avec le prix au lieu de rester dans le calcul.
 *
 * <h2>Ce qu'elle refuse de faire</h2>
 * Se fabriquer à partir d'autre chose que de prix réellement relevés. Une
 * estimation IA et un prix neuf catalogue restent utiles ailleurs (coût pour
 * compléter, négociation, verdict), mais aucune des deux ne devient « le
 * marché » : voir {@link MarketReferenceSource}.
 *
 * @param price          référence pour le lot évalué entier, hors frais - {@code null} si indisponible
 * @param sampleSize     comparables RETENUS ; pour un lot multi-séries, celui de la série la moins documentée
 * @param examinedCount  relevés examinés avant filtrage - dire « 3 existent, 0 comparable » plutôt que « aucune donnée »
 * @param spreadPercent  écart haut/bas rapporté à la médiane, {@code null} sous deux comparables
 */
public record MarketReference(BigDecimal price, MarketReferenceConfidence confidence, int sampleSize,
                               int examinedCount, MarketReferenceSource source, LotShape comparedShape,
                               Integer spreadPercent, LocalDate mostRecentObservation, ReferenceGap gap) {

    /** Au-delà, les comparables racontent des choses trop différentes pour qu'on en tire une médiane sûre. */
    static final int DISPERSION_FORTE_PERCENT = 60;

    /** À partir de ce nombre de comparables, l'échantillon cesse d'être anecdotique. */
    static final int ECHANTILLON_SOLIDE = 3;

    public MarketReference {
        if (price == null && confidence != null && confidence.allowsPositioning()) {
            throw new IllegalArgumentException("Une référence sans prix ne peut pas servir à positionner");
        }
        confidence = confidence == null ? MarketReferenceConfidence.UNAVAILABLE : confidence;
        source = source == null ? MarketReferenceSource.NOT_RECORDED : source;
        gap = gap == null ? ReferenceGap.NOT_RECORDED : gap;
    }

    /** Aucune référence, et la raison exacte de son absence. */
    public static MarketReference unavailable(ReferenceGap gap, int examinedCount) {
        return new MarketReference(null, MarketReferenceConfidence.UNAVAILABLE, 0, examinedCount,
                MarketReferenceSource.NONE, null, null, null, gap);
    }

    /**
     * Construit la référence d'UNE série à partir de comparables déjà filtrés
     * par {@link MarketComparableSelector}.
     * <p>
     * La normalisation au tome subsiste, mais elle ne s'applique plus qu'entre
     * produits de même forme et de taille voisine : y ramener un tome seul et
     * une intégrale, c'était le défaut ; l'appliquer d'un lot de 10 à un lot de
     * 14 reste une approximation raisonnable, et la confiance en tient compte.
     *
     * @param targetVolumeCount tomes de l'annonce évaluée - la référence est rendue pour CE volume-là
     */
    public static MarketReference fromComparables(MangaEdition edition, int targetVolumeCount,
                                                   MarketComparableSelector.Selection selection, LocalDate today) {
        if (selection.isEmpty()) {
            return unavailable(selection.gap(), selection.examined());
        }

        List<BigDecimal> parTome = new ArrayList<>();
        LocalDate plusRecent = null;
        for (MarketPriceObservation observation : selection.retained()) {
            int tomes = MarketComparableSelector.nombreDeTomes(observation, edition);
            if (tomes <= 0) {
                continue;
            }
            parTome.add(observation.observedPrice().divide(BigDecimal.valueOf(tomes), 2, RoundingMode.HALF_UP));
            if (plusRecent == null || observation.observedAt().isAfter(plusRecent)) {
                plusRecent = observation.observedAt();
            }
        }
        if (parTome.isEmpty()) {
            return unavailable(ReferenceGap.NO_COMPARABLE_SHAPE, selection.examined());
        }

        Collections.sort(parTome);
        BigDecimal mediane = mediane(parTome);
        Integer dispersion = dispersionPercent(parTome, mediane);

        MarketReferenceConfidence confiance = confiance(parTome.size(), dispersion,
                MarketComparableSelector.toutEstAncien(selection.retained(), today), edition);

        BigDecimal prixDuLot = mediane.multiply(BigDecimal.valueOf(targetVolumeCount))
                .setScale(2, RoundingMode.HALF_UP);

        return new MarketReference(prixDuLot, confiance, parTome.size(), selection.examined(),
                MarketReferenceSource.OBSERVED_COMPARABLES,
                LotShape.of(targetVolumeCount, edition.totalVolumes()), dispersion, plusRecent, ReferenceGap.NONE);
    }

    /**
     * La confiance, construite puis dégradée - jamais l'inverse.
     * <p>
     * Le point de départ est l'échantillon, parce que c'est ce qui fait qu'une
     * médiane veut dire quelque chose. Chaque réserve ensuite fait descendre
     * d'un cran : des comparables qui se contredisent, des comparables vieux
     * d'un an, une édition dont on ignore le nombre de tomes - donc dont on ne
     * peut pas affirmer qu'un lot n'est pas une intégrale.
     */
    private static MarketReferenceConfidence confiance(int taille, Integer dispersion, boolean toutAncien,
                                                        MangaEdition edition) {
        MarketReferenceConfidence niveau = taille >= ECHANTILLON_SOLIDE
                ? MarketReferenceConfidence.HIGH
                : (taille >= 2 ? MarketReferenceConfidence.MEDIUM : MarketReferenceConfidence.LOW);

        if (dispersion != null && dispersion > DISPERSION_FORTE_PERCENT) {
            niveau = niveau.degraded();
        }
        if (toutAncien) {
            niveau = niveau.degraded();
        }
        if (edition.totalVolumes() == null || edition.totalVolumes() <= 0) {
            niveau = niveau.cappedAt(MarketReferenceConfidence.MEDIUM);
        }
        return niveau;
    }

    /**
     * Somme les références des séries d'un lot.
     * <p>
     * Rend indisponible dès qu'une seule série n'a pas la sienne : additionner
     * ce qu'on connaît en ignorant le reste produirait une référence
     * systématiquement trop basse, donc un lot systématiquement « trop cher ».
     * Et le total ne dépasse jamais MEDIUM au-delà d'une série - juxtaposer des
     * références unitaires pour juger un lot reste une approximation, même
     * quand chaque terme est solide.
     */
    public static MarketReference sum(List<MarketReference> parSerie) {
        if (parSerie == null || parSerie.isEmpty()) {
            return unavailable(ReferenceGap.NO_OBSERVATION, 0);
        }
        // Une seule série : rien à sommer, et surtout rien à écraser. Une
        // référence LOW - un comparable unique, des comparables dispersés -
        // reste une information : elle ne positionne pas de prix, mais elle
        // permet de dire « un seul comparable » plutôt que « aucune donnée ».
        if (parSerie.size() == 1) {
            return parSerie.get(0);
        }
        BigDecimal total = BigDecimal.ZERO;
        MarketReferenceConfidence pire = MarketReferenceConfidence.HIGH;
        int echantillonMin = Integer.MAX_VALUE;
        int examines = 0;
        LotShape forme = parSerie.size() == 1 ? parSerie.get(0).comparedShape() : null;
        Integer dispersionMax = null;
        LocalDate plusRecent = null;

        for (MarketReference reference : parSerie) {
            examines += reference.examinedCount();
            if (reference.price() == null || !reference.confidence().allowsPositioning()) {
                // Une série sans référence utilisable suffit à disqualifier le lot.
                return new MarketReference(null, MarketReferenceConfidence.UNAVAILABLE, 0, examines,
                        MarketReferenceSource.NONE, null, null, null, ReferenceGap.INCOMPLETE_LOT_COVERAGE);
            }
            total = total.add(reference.price());
            if (reference.confidence().compareTo(pire) > 0) {
                pire = reference.confidence();
            }
            echantillonMin = Math.min(echantillonMin, reference.sampleSize());
            if (reference.spreadPercent() != null
                    && (dispersionMax == null || reference.spreadPercent() > dispersionMax)) {
                dispersionMax = reference.spreadPercent();
            }
            if (reference.mostRecentObservation() != null
                    && (plusRecent == null || reference.mostRecentObservation().isAfter(plusRecent))) {
                plusRecent = reference.mostRecentObservation();
            }
        }

        MarketReferenceConfidence confiance = parSerie.size() > 1
                ? pire.cappedAt(MarketReferenceConfidence.MEDIUM)
                : pire;
        return new MarketReference(total, confiance, echantillonMin, examines,
                MarketReferenceSource.OBSERVED_COMPARABLES, forme, dispersionMax, plusRecent, ReferenceGap.NONE);
    }

    private static BigDecimal mediane(List<BigDecimal> triees) {
        int taille = triees.size();
        if (taille % 2 == 1) {
            return triees.get(taille / 2);
        }
        return triees.get(taille / 2 - 1).add(triees.get(taille / 2))
                .divide(BigDecimal.valueOf(2), 2, RoundingMode.HALF_UP);
    }

    /** L'amplitude des comparables, rapportée à leur médiane. Sous deux valeurs, la notion n'existe pas. */
    private static Integer dispersionPercent(List<BigDecimal> triees, BigDecimal mediane) {
        if (triees.size() < 2 || mediane.signum() <= 0) {
            return null;
        }
        return triees.get(triees.size() - 1).subtract(triees.get(0))
                .multiply(BigDecimal.valueOf(100))
                .divide(mediane, 0, RoundingMode.HALF_UP)
                .intValue();
    }

    /** Vrai quand cette référence peut servir à situer un prix - le seul test à faire avant de comparer. */
    @com.fasterxml.jackson.annotation.JsonIgnore
    public boolean isUsable() {
        return price != null && confidence.allowsPositioning();
    }
}
