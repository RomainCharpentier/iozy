package com.iozycore.recognition;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Réunit en un seul élément ce qui est le même tome vu sur plusieurs photos.
 *
 * <h2>Le problème</h2>
 * Un vendeur photographie son lot de face, puis de côté, puis en gros plan. Le
 * tome 4 apparaît sur trois photos. Sans cette étape, l'analyse compterait
 * <b>trois</b> tomes 4 : le prix par tome serait divisé par trois, la
 * complétude fausse, et le verdict d'achat calculé sur un lot qui n'existe pas.
 *
 * <h2>La clé de regroupement</h2>
 * Titre normalisé + numéro de tome. La normalisation retire accents, casse,
 * ponctuation et espaces multiples : « Platinum End », « platinum end » et
 * « PLATINUM-END » se rejoignent. Elle ne va pas plus loin - pas de distance
 * d'édition, pas de synonymes : rapprocher « Naruto » et « Boruto » parce
 * qu'ils se ressemblent ferait bien plus de dégâts que de laisser deux lignes
 * à l'écran, que l'utilisateur fusionne d'un geste.
 *
 * <h2>Ce qui reste séparé, volontairement</h2>
 * Un tome <b>sans numéro lu</b> ne se fond dans aucun tome numéroté : « Death
 * Note, tome inconnu » et « Death Note tome 3 » peuvent être le même livre ou
 * deux livres différents, et rien sur la photo ne permet de trancher. Les
 * fusionner inventerait une certitude ; les laisser côte à côte laisse
 * l'utilisateur décider.
 *
 * <h2>Le numéro et l'édition ne suivent pas la même règle - et c'est voulu</h2>
 * Un numéro absent bloque la fusion, une édition absente ne la bloque pas.
 * L'asymétrie est délibérée :
 * <ul>
 *   <li>le <b>numéro de tome</b> est ce qui <i>identifie</i> un élément dans un
 *       lot. Deux « Death Note » sans numéro peuvent être les tomes 1 et 5 ;
 *       les fondre en un ferait disparaître un livre du décompte ;</li>
 *   <li>l'<b>édition</b> est un <i>attribut</i> d'un élément déjà identifié par
 *       sa série et son numéro. « Vinland Saga 7 » et « Vinland Saga 7,
 *       Standard » désignent presque toujours le même livre, dont l'édition
 *       n'était simplement pas lisible sur une des deux photos. Une édition
 *       absente est une information manquante, pas une édition différente :
 *       la compléter par la seule lecture disponible n'invente rien.</li>
 * </ul>
 * En revanche, deux éditions <b>toutes deux lues et différentes</b> restent
 * deux éléments : là, les photos se contredisent, et c'est à l'utilisateur de
 * trancher.
 */
public final class RecognitionConsolidator {

    private RecognitionConsolidator() {
    }

    /**
     * Fusionne les doublons, en conservant la trace de <b>toutes</b> les photos
     * qui ont soutenu chaque élément - l'utilisateur doit pouvoir vérifier sur
     * l'image d'où vient une proposition.
     */
    public static List<RecognizedItem> consolidate(List<RecognizedItem> bruts) {
        if (bruts == null || bruts.isEmpty()) {
            return List.of();
        }

        // LinkedHashMap : l'ordre de première apparition est celui des photos,
        // donc celui que l'utilisateur a sous les yeux.
        Map<String, List<RecognizedItem>> parSerieEtTome = new LinkedHashMap<>();
        List<RecognizedItem> sansNumero = new ArrayList<>();

        for (RecognizedItem item : bruts) {
            if (item == null) {
                continue;
            }
            if (item.volumeNumber() == null) {
                // Voir la Javadoc : un tome sans numéro ne se fond dans rien.
                // Il est seulement dédoublonné contre ses semblables exacts.
                fusionnerSansNumero(sansNumero, item);
                continue;
            }
            parSerieEtTome.computeIfAbsent(cleSerieEtTome(item), c -> new ArrayList<>()).add(item);
        }

        List<RecognizedItem> consolides = new ArrayList<>();
        parSerieEtTome.values().forEach(groupe -> consolides.addAll(fusionnerParEdition(groupe)));
        consolides.addAll(sansNumero);
        return List.copyOf(consolides);
    }

    /**
     * Dans un groupe de même série et même tome, réunit ce dont les éditions
     * sont <b>compatibles</b> - égales, ou l'une non lue. Deux éditions lues et
     * différentes restent séparées : voir la Javadoc de la classe.
     */
    private static List<RecognizedItem> fusionnerParEdition(List<RecognizedItem> groupe) {
        List<RecognizedItem> fusionnes = new ArrayList<>();
        for (RecognizedItem item : groupe) {
            boolean absorbe = false;
            for (int i = 0; i < fusionnes.size(); i++) {
                if (editionsCompatibles(fusionnes.get(i), item)) {
                    fusionnes.set(i, fusionnes.get(i).mergedWith(item));
                    absorbe = true;
                    break;
                }
            }
            if (!absorbe) {
                fusionnes.add(item);
            }
        }
        return fusionnes;
    }

    private static boolean editionsCompatibles(RecognizedItem a, RecognizedItem b) {
        if (a.editionIsUnknown() || b.editionIsUnknown()) {
            return true;
        }
        return normaliser(a.editionHint()).equals(normaliser(b.editionHint()));
    }

    /**
     * Deux « Death Note, tome inconnu » sur deux photos peuvent être deux
     * exemplaires réels. On ne les fusionne que s'ils portent le même indice
     * d'édition ET la même photo source - autrement dit s'il s'agit
     * manifestement de la même lecture rapportée deux fois.
     */
    private static void fusionnerSansNumero(List<RecognizedItem> accumules, RecognizedItem item) {
        for (int i = 0; i < accumules.size(); i++) {
            RecognizedItem existant = accumules.get(i);
            boolean memeTitre = cleTitre(existant).equals(cleTitre(item));
            boolean memeEdition = java.util.Objects.equals(existant.editionHint(), item.editionHint());
            boolean memePhoto = !java.util.Collections.disjoint(existant.sourceImages(), item.sourceImages());
            if (memeTitre && memeEdition && memePhoto) {
                accumules.set(i, existant.mergedWith(item));
                return;
            }
        }
        accumules.add(item);
    }

    /**
     * L'édition n'entre <b>pas</b> dans cette clé : elle est arbitrée ensuite
     * par {@link #fusionnerParEdition}, qui sait distinguer « non lue » de
     * « lue et différente ». La mettre ici séparerait « tome 7 » de « tome 7,
     * Standard », c'est-à-dire le doublon que cette classe existe pour éviter.
     */
    private static String cleSerieEtTome(RecognizedItem item) {
        return cleTitre(item) + "|" + item.volumeNumber();
    }

    private static String cleTitre(RecognizedItem item) {
        return normaliser(item.seriesTitleRaw());
    }

    /** Minuscules, sans accents, sans ponctuation, espaces réduits. */
    static String normaliser(String valeur) {
        if (valeur == null) {
            return "";
        }
        String sansAccents = Normalizer.normalize(valeur, Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
        return sansAccents.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", " ")
                .trim();
    }
}
