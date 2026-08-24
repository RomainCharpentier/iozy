package com.iozycore.recognition;

import com.iozycore.purchaseanalysis.ListingTextParser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Des codes-barres lus sur les photos aux propositions à confirmer.
 *
 * <h2>La chaîne, et ce qu'elle réutilise</h2>
 * <ol>
 *   <li>{@link BarcodeImageDecoder} lit les EAN sur les pixels — local, gratuit ;</li>
 *   <li>{@link BarcodeWorkLookup} donne le <b>titre</b> du tirage — la seule
 *       étape qui sort ;</li>
 *   <li>{@code ListingTextParser} en extrait série et numéro de tome — <b>les
 *       mêmes règles</b> que pour le titre d'une annonce.</li>
 * </ol>
 *
 * <p>Le troisième point mérite d'être dit : « Naruto, Vol. 9 » renvoyé par une
 * base bibliographique et « Naruto tome 9 » écrit par un vendeur posent
 * exactement le même problème de lecture. Écrire une seconde extraction ici
 * aurait garanti qu'elle diverge de la première — et c'est déjà arrivé dans ce
 * projet, avec des doubles de {@code SeriesMatcher} qui avaient dérivé du vrai.
 *
 * <h2>Une seule sortie possible : se taire</h2>
 * Un EAN introuvable, un titre illisible, un service en panne : la proposition
 * n'existe pas, et le reste du lot est rendu quand même. Un code-barres qu'on
 * ne sait pas nommer ne vaut pas une ligne « EAN 9782505011118 » à l'écran,
 * qui n'apprendrait rien à personne.
 */
@Component
public class BarcodeRecognizer {

    private static final Logger log = LoggerFactory.getLogger(BarcodeRecognizer.class);

    /**
     * Au-delà, ce n'est plus une lecture de lot mais une session de scan, et
     * chaque code coûte un aller-retour vers une base externe.
     */
    static final int MAX_CODES = 20;

    private final BarcodeWorkLookup lookup;

    public BarcodeRecognizer(BarcodeWorkLookup lookup) {
        this.lookup = lookup;
    }

    /**
     * @param images les photos déjà en mémoire, quelle que soit la porte par
     *               laquelle elles sont entrées
     * @return les propositions issues des seuls codes-barres, vides si aucun
     *         n'a été lu ou identifié — <b>ne lève jamais</b>
     */
    public List<RecognizedItem> recognize(List<RecognitionImage> images, RecognitionContext context) {
        if (images == null || images.isEmpty()) {
            return List.of();
        }

        // Quel code sur quelle photo : l'écran doit pouvoir le dire, et un même
        // code vu sur deux photos reste un seul tome.
        Map<String, Set<Integer>> photosParCode = new LinkedHashMap<>();
        for (RecognitionImage image : images) {
            for (String code : BarcodeImageDecoder.decode(image)) {
                photosParCode.computeIfAbsent(code, c -> new java.util.LinkedHashSet<>()).add(image.index());
            }
        }
        if (photosParCode.isEmpty()) {
            return List.of();
        }

        List<RecognizedItem> propositions = new ArrayList<>();
        int traites = 0;
        for (Map.Entry<String, Set<Integer>> entree : photosParCode.entrySet()) {
            if (traites++ >= MAX_CODES) {
                break;
            }
            RecognizedItem proposition = identifier(entree.getKey(), entree.getValue(), context);
            if (proposition != null) {
                propositions.add(proposition);
            }
        }
        return List.copyOf(propositions);
    }

    private RecognizedItem identifier(String ean, Set<Integer> photos, RecognitionContext context) {
        Optional<String> titre;
        try {
            titre = lookup.titleFor(ean,
                    context == null ? null : context.expectedEntityTypeCode());
        } catch (RuntimeException e) {
            // Une base bibliographique indisponible est un code-barres non
            // identifié, pas une analyse interrompue.
            log.info("Identification d'un code-barres abandonnée : {}", e.getClass().getSimpleName());
            return null;
        }
        if (titre.isEmpty() || titre.get().isBlank()) {
            return null;
        }

        // Les mêmes règles que pour le titre d'une annonce - voir la javadoc.
        String serie = ListingTextParser.probableSeriesTitle(titre.get());
        if (serie.isBlank()) {
            return null;
        }
        List<Integer> numeros = ListingTextParser.sorted(
                ListingTextParser.parse(titre.get(), null).volumeNumbers());

        // Un tirage porte UN numéro. Plusieurs veut dire que le titre décrivait
        // autre chose qu'un tome (« Naruto tomes 1 à 3 » pour un coffret) :
        // mieux vaut la série sans numéro qu'un numéro choisi au hasard.
        Integer numero = numeros.size() == 1 ? numeros.get(0) : null;

        return RecognizedItem.fromEan(serie, numero, ean, raison(numero), photos);
    }

    /** Ce qui a été compris, pas le code recopié : « EAN 978… » n'apprend rien. */
    private static String raison(Integer numero) {
        return numero == null
                ? "code-barres lu sur une photo"
                : "code-barres du tome %d lu sur une photo".formatted(numero);
    }
}
