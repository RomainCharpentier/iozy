package com.iozycore.recognition;

import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

/**
 * Un élément qu'un moteur croit voir sur une ou plusieurs photos - <b>avant</b>
 * toute confrontation au catalogue IozyCore.
 *
 * <h2>Du texte, pas encore une œuvre</h2>
 * {@code seriesTitleRaw} est ce qui a été lu, tel quel : « Platinum end »,
 * « PLATINUM END », « Platinum End vol.4 ». Le rapprochement avec une Entity
 * du catalogue vient plus tard et ailleurs (voir
 * {@link RecognitionCatalogResolver}). Mélanger les deux ferait entrer une
 * lecture approximative directement dans le catalogue.
 *
 * <h2>Ce qui peut manquer, et doit pouvoir manquer</h2>
 * Un tome dont on lit le titre mais pas le numéro est un résultat utile.
 * {@code volumeNumber} et {@code editionHint} sont donc nullables, et
 * <b>jamais devinés</b> : voir « Death Note tome 1, édition à confirmer »
 * plutôt que de choisir Black Edition au hasard.
 *
 * @param seriesTitleRaw  le titre lu, brut - jamais null ni vide
 * @param volumeNumber    le numéro de tome lu, ou {@code null} s'il n'est pas lisible
 * @param editionHint     un indice d'édition lu (« Perfect », « Black Edition »), ou {@code null}
 * @param ean             un code EAN/ISBN lu sur la photo, ou {@code null} - voir {@link #hasExactIdentifier()}
 * @param confidence      voir {@link RecognitionConfidence} - trois niveaux, jamais un pourcentage
 * @param evidence        pourquoi le moteur propose ça, en clair (« 04 visible sur la tranche ») - peut être vide
 * @param sourceImages    index des photos qui ont soutenu cette proposition, 0-based
 */
public record RecognizedItem(String seriesTitleRaw, Integer volumeNumber, String editionHint, String ean,
                              RecognitionConfidence confidence, List<String> evidence, Set<Integer> sourceImages) {

    /** Au-delà, c'est une lecture erronée, pas un tome - même borne que ListingTextParser. */
    public static final int NUMERO_DE_TOME_MAX = 300;

    public RecognizedItem {
        if (seriesTitleRaw == null || seriesTitleRaw.isBlank()) {
            throw new IllegalArgumentException("Un élément reconnu doit porter un titre lu");
        }
        seriesTitleRaw = seriesTitleRaw.trim();
        editionHint = blankToNull(editionHint);
        ean = blankToNull(ean);
        // Un numéro absurde est une lecture ratée, pas un tome : on l'oublie
        // plutôt que de le propager jusqu'au prix par tome de l'analyse.
        if (volumeNumber != null && (volumeNumber < 1 || volumeNumber > NUMERO_DE_TOME_MAX)) {
            volumeNumber = null;
        }
        confidence = confidence == null ? RecognitionConfidence.LOW : confidence;
        evidence = evidence == null ? List.of() : List.copyOf(evidence);
        // LinkedHashSet alimenté par un TreeSet, et non Set.copyOf : ce dernier
        // rend un Set NON ordonné, qui restituerait « vu sur les photos 3 et 1 ».
        // L'ordre des photos est celui que l'utilisateur a sous les yeux.
        sourceImages = sourceImages == null
                ? Set.of()
                : Collections.unmodifiableSet(new LinkedHashSet<>(new TreeSet<>(sourceImages)));
    }

    private static String blankToNull(String valeur) {
        return valeur == null || valeur.isBlank() ? null : valeur.trim();
    }

    /**
     * Vrai quand un identifiant exact a été lu. Une lecture d'EAN ne se
     * « ressemble » pas : elle correspond ou non. C'est ce qui autorise le
     * service à préférer le pipeline code-barres existant à une supposition
     * visuelle - voir {@link ImageRecognitionService}.
     */
    public boolean hasExactIdentifier() {
        return ean != null;
    }

    /** Vrai quand l'édition n'a pas été lue : l'écran doit demander, pas choisir. */
    public boolean editionIsUnknown() {
        return editionHint == null;
    }

    /** La même chose vue sur une autre photo - voir {@link RecognitionConsolidator}. */
    RecognizedItem mergedWith(RecognizedItem autre) {
        Set<Integer> images = new TreeSet<>(sourceImages);
        images.addAll(autre.sourceImages());

        List<String> raisons = new java.util.ArrayList<>(evidence);
        autre.evidence().stream().filter(raison -> !raisons.contains(raison)).forEach(raisons::add);

        return new RecognizedItem(
                seriesTitleRaw,
                volumeNumber != null ? volumeNumber : autre.volumeNumber(),
                editionHint != null ? editionHint : autre.editionHint(),
                ean != null ? ean : autre.ean(),
                // Deux photos qui montrent la même chose se confortent.
                confidence.higherOf(autre.confidence()),
                raisons,
                images);
    }
}
