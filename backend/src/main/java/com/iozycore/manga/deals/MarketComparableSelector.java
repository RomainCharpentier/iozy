package com.iozycore.manga.deals;

import com.iozycore.manga.domain.MangaEdition;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Décide si deux offres sont <b>le même produit</b>, avant de comparer leurs
 * prix.
 *
 * <h2>Le défaut que cette classe supprime</h2>
 * Jusqu'ici, tout relevé rattaché à l'édition entrait dans la médiane, ramené
 * à un prix au tome. Sur <i>Platinum End</i>, un T.1 à 8 €, un lot 1-4 à 20 €
 * et un lot 7-10 à 18 € donnaient 8,00 / 5,00 / 4,50 € le tome, médiane 5,00 €,
 * et trois relevés suffisaient à décrocher la confiance HIGH. Une annonce 1-14
 * héritait donc d'une référence de 70 € présentée comme solide, alors qu'aucun
 * des trois relevés ne décrit ce qu'est un lot de 14 tomes.
 *
 * <h2>Les règles, dans l'ordre</h2>
 * <ol>
 *   <li><b>Même édition.</b> Déjà garanti en amont : un relevé se rattache à
 *       une {@link MangaEdition}, laquelle porte la série ET l'édition. Une
 *       Perfect Edition ne compare pas avec une Standard.</li>
 *   <li><b>Même forme</b> ({@link LotShape}) : tome seul avec tome seul, lot
 *       partiel avec lot partiel, intégrale avec intégrale.</li>
 *   <li><b>Taille comparable</b> pour les lots partiels : le nombre de tomes ne
 *       varie pas de plus du simple au double. Un lot de 10 éclaire un lot de
 *       14 ; un lot de 4, non.</li>
 *   <li><b>Fraîcheur</b> : au-delà de {@value #ANCIENNETE_MAX_MOIS} mois, un
 *       relevé décrit un autre marché et sort.</li>
 *   <li><b>Une annonce, un comparable</b> : les relevés issus d'une même
 *       annonce sont regroupés, et seul le plus récent est retenu. Trois
 *       analyses de la même URL, ce n'est pas trois vendeurs.</li>
 *   <li><b>L'annonce en cours d'évaluation est exclue</b> : une offre ne se
 *       compare pas à elle-même.</li>
 * </ol>
 *
 * <h2>Ce qui n'est délibérément pas une règle</h2>
 * L'<b>état</b> ({@link Condition}) n'écarte aucun comparable. C'est un
 * modificateur de prix, pas une différence de produit, et filtrer dessus
 * viderait des échantillons déjà petits. La dispersion qui en résulte est
 * mesurée et fait baisser la confiance - la réserve est dite plutôt que le
 * relevé jeté. La <b>plateforme</b> non plus : les écarts entre Vinted et
 * Leboncoin sont réels mais mal documentés ici, et les inventer serait pire.
 *
 * <h2>Domaine pur</h2>
 * Aucun accès base, réseau ou Spring. La date du jour est un paramètre, pas un
 * appel caché : c'est ce qui rend la règle de fraîcheur testable.
 */
public final class MarketComparableSelector {

    private MarketComparableSelector() {
    }

    /** Au-delà, le relevé décrit un marché révolu. */
    static final int ANCIENNETE_MAX_MOIS = 24;

    /** En deçà, le relevé est considéré comme actuel ; au-delà, la confiance baisse d'un cran. */
    static final int FRAICHEUR_MOIS = 12;

    /**
     * Rapport de taille maximal entre deux lots partiels comparables. 2 signifie
     * « du simple au double » : au-delà, ce n'est plus le même produit.
     */
    static final int RAPPORT_TAILLE_MAX = 2;

    /**
     * Les relevés retenus, et - s'il n'y en a aucun - la raison exacte.
     *
     * @param examined nombre de relevés examinés : dire « 3 relevés existent, aucun comparable »
     *                 vaut mieux que « pas de données », qui serait faux
     */
    /**
     * @param retained      un relevé par annonce - ce sont les comparables INDEPENDANTS
     * @param examined      relevés examinés avant filtrage
     * @param temporalCount relevés comparables avant regroupement par annonce : cinq relevés
     *                      d'une même offre suivie dans le temps font toujours un comparable
     */
    public record Selection(List<MarketPriceObservation> retained, int examined, int temporalCount,
                            ReferenceGap gap) {
        public Selection {
            retained = retained == null ? List.of() : List.copyOf(retained);
        }

        public boolean isEmpty() {
            return retained.isEmpty();
        }
    }

    /**
     * @param edition           l'édition visée, {@code null} si elle n'est pas au catalogue
     * @param targetVolumeCount nombre de tomes de l'annonce évaluée
     * @param candidates        tous les relevés connus pour cette édition
     * @param today             la date de référence pour la fraîcheur - paramètre, jamais {@code LocalDate.now()} ici
     */
    public static Selection selectFor(MangaEdition edition, int targetVolumeCount,
                                       List<MarketPriceObservation> candidates, LocalDate today) {
        return selectFor(edition, targetVolumeCount, candidates, today, null);
    }

    /**
     * @param currentListing identité de l'annonce en cours d'évaluation, exclue de ses propres
     *                       comparables ; {@code null} quand aucune annonce précise n'est évaluée
     */
    public static Selection selectFor(MangaEdition edition, int targetVolumeCount,
                                       List<MarketPriceObservation> candidates, LocalDate today,
                                       String currentListing) {
        if (edition == null) {
            return new Selection(List.of(), 0, 0, ReferenceGap.EDITION_NOT_IN_CATALOGUE);
        }
        if (candidates == null || candidates.isEmpty()) {
            return new Selection(List.of(), 0, 0, ReferenceGap.NO_OBSERVATION);
        }

        LotShape formeCible = LotShape.of(targetVolumeCount, edition.totalVolumes());
        if (!formeCible.isComparable()) {
            return new Selection(List.of(), candidates.size(), 0, ReferenceGap.NO_COMPARABLE_SHAPE);
        }

        List<MarketPriceObservation> memeProduit = new ArrayList<>();
        boolean ecarteUniquementParAge = false;
        boolean seuleLAnnonceCourante = false;

        for (MarketPriceObservation observation : candidates) {
            // Une annonce ne se compare pas a elle-meme. Le cas se produit des
            // qu'on reanalyse une URL deja analysee : sans cette exclusion, la
            // reference vaudrait le prix demande, et n'importe quelle annonce se
            // dirait alors "au prix du marche" - le sien.
            if (currentListing != null && currentListing.equals(observation.listingIdentity())) {
                seuleLAnnonceCourante = true;
                continue;
            }
            int tomes = nombreDeTomes(observation, edition);
            LotShape forme = LotShape.of(tomes, edition.totalVolumes());
            if (forme != formeCible || !tailleCompatible(formeCible, tomes, targetVolumeCount)) {
                continue;
            }
            // La forme correspond : si seul l'âge le disqualifie, on saura le
            // dire précisément plutôt que de conclure « aucun comparable ».
            if (tropAncien(observation, today)) {
                ecarteUniquementParAge = true;
                continue;
            }
            memeProduit.add(observation);
        }

        if (memeProduit.isEmpty()) {
            // Nommer la BONNE absence. « Aucun lot comparable » enverrait relever
            // un prix de plus sur une annonce qu'on a déjà relevée ; ce qui
            // manque ici, c'est une AUTRE offre.
            return new Selection(List.of(), candidates.size(), 0, manqueA(ecarteUniquementParAge, seuleLAnnonceCourante));
        }
        return new Selection(unParAnnonce(memeProduit), candidates.size(), memeProduit.size(), ReferenceGap.NONE);
    }

    /**
     * L'absence la plus précise que la sélection permette d'affirmer. L'ordre
     * compte : si l'annonce courante a été écartée, c'est l'explication la plus
     * proche de ce que voit l'utilisateur.
     */
    private static ReferenceGap manqueA(boolean ecarteParAge, boolean seuleLAnnonceCourante) {
        if (seuleLAnnonceCourante) {
            return ReferenceGap.ONLY_CURRENT_LISTING;
        }
        return ecarteParAge ? ReferenceGap.ONLY_STALE_OBSERVATIONS : ReferenceGap.NO_COMPARABLE_SHAPE;
    }

    /**
     * Réduit les relevés à <b>un par annonce</b>, en gardant le plus récent.
     *
     * <h2>Le piège que ça supprime</h2>
     * Une même annonce suivie dans le temps produit plusieurs relevés : c'est
     * une information de prix utile, et elle reste en base. Mais un échantillon
     * compte des <b>offres indépendantes</b>, pas des lignes. Sans ce
     * regroupement, analyser cinq fois la même URL suffirait à décrocher une
     * confiance HIGH sur un seul vendeur - un chiffre précis tiré d'une seule
     * observation du marché.
     * <p>
     * Le plus récent l'emporte parce qu'il décrit l'état actuel de cette offre :
     * une annonce passée de 70 à 60 EUR vaut 60 EUR aujourd'hui. À date égale,
     * le relevé enregistré en dernier tranche.
     */
    private static List<MarketPriceObservation> unParAnnonce(List<MarketPriceObservation> observations) {
        Map<String, MarketPriceObservation> parAnnonce = new LinkedHashMap<>();
        for (MarketPriceObservation observation : observations) {
            parAnnonce.merge(observation.comparableKey(), observation,
                    (existant, candidat) -> PLUS_RECENT.compare(candidat, existant) > 0 ? candidat : existant);
        }
        return List.copyOf(parAnnonce.values());
    }

    /** Le relevé qui décrit le mieux l'état actuel d'une offre. */
    private static final Comparator<MarketPriceObservation> PLUS_RECENT =
            Comparator.comparing(MarketPriceObservation::observedAt)
                    .thenComparing(MarketPriceObservation::createdAt);

    /**
     * Un relevé sans portée couvre l'édition entière : son nombre de tomes est
     * celui de l'édition. Inconnu, il vaut 0 et sera classé
     * {@link LotShape#INDETERMINATE} - jamais deviné.
     */
    static int nombreDeTomes(MarketPriceObservation observation, MangaEdition edition) {
        if (observation.scope() != null) {
            return observation.scope().expand().size();
        }
        Integer total = edition.totalVolumes();
        return total != null && total > 0 ? total : 0;
    }

    /**
     * Seuls les lots partiels ont besoin de cette vérification : un tome seul
     * fait toujours un tome, et deux intégrales de la même édition font le même
     * nombre de tomes.
     */
    private static boolean tailleCompatible(LotShape forme, int tomes, int cible) {
        if (forme != LotShape.PARTIAL_LOT) {
            return true;
        }
        int petit = Math.min(tomes, cible);
        int grand = Math.max(tomes, cible);
        return (long) petit * RAPPORT_TAILLE_MAX >= grand;
    }

    private static boolean tropAncien(MarketPriceObservation observation, LocalDate today) {
        return observation.observedAt().isBefore(today.minusMonths(ANCIENNETE_MAX_MOIS));
    }

    /** Vrai quand le plus récent des relevés retenus a dépassé la fenêtre de fraîcheur. */
    static boolean toutEstAncien(List<MarketPriceObservation> retenus, LocalDate today) {
        LocalDate limite = today.minusMonths(FRAICHEUR_MOIS);
        return retenus.stream().noneMatch(observation -> !observation.observedAt().isBefore(limite));
    }
}
