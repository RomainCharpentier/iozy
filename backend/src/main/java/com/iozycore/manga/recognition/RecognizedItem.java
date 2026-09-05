package com.iozycore.manga.recognition;

import java.util.ArrayList;
import java.util.Collections;
import java.util.EnumSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

/**
 * Un élément qu'IozyCore croit voir dans une annonce - <b>avant</b> toute
 * confrontation au catalogue.
 *
 * <h2>Une seule forme, plusieurs sources</h2>
 * Le même record décrit ce qui a été lu dans le titre, ce qui a été vu sur une
 * photo, et ce qu'un code-barres a confirmé. C'est délibéré : deux modèles
 * jumeaux (« TextCandidate », « VisionCandidate ») obligeraient à écrire deux
 * fois la consolidation, et l'utilisateur, lui, ne voit qu'une liste.
 *
 * <h2>Du texte, pas encore une œuvre</h2>
 * {@code seriesTitleRaw} est ce qui a été lu, tel quel : « Platinum end »,
 * « PLATINUM END ». Le rapprochement avec une Entity du catalogue vient plus
 * tard et ailleurs (voir {@link RecognitionCatalogResolver}). Mélanger les deux
 * ferait entrer une lecture approximative directement dans le catalogue.
 *
 * <h2>Ce qui peut manquer, et doit pouvoir manquer</h2>
 * Un tome dont on lit le titre mais pas le numéro est un résultat utile.
 * {@code volumeNumber} et {@code editionHint} sont donc nullables, et
 * <b>jamais devinés</b> : voir « Death Note tome 1, édition à confirmer »
 * plutôt que de choisir Black Edition au hasard.
 *
 * @param seriesTitleRaw  le titre lu, brut - jamais null ni vide
 * @param volumeNumber    le numéro de tome lu, ou {@code null} s'il n'est pas connu
 * @param editionHint     un indice d'édition lu (« Perfect »), ou {@code null}
 * @param ean             un code EAN/ISBN lu, ou {@code null} - voir {@link #hasExactIdentifier()}
 * @param confidence      à quel point la LECTURE est sûre - voir {@link RecognitionConfidence}
 * @param sources         comment on l'a su - voir {@link RecognitionSource}
 * @param evidence        pourquoi cet élément est proposé, en clair - peut être vide
 * @param sourceImages    index des photos qui l'ont soutenu, 0-based. <b>Vide</b> pour une
 *                        proposition venue du seul texte : on ne lui invente pas une photo
 */
public record RecognizedItem(String seriesTitleRaw, Integer volumeNumber, String editionHint, String ean,
                              RecognitionConfidence confidence, Set<RecognitionSource> sources,
                              List<String> evidence, Set<Integer> sourceImages) {

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
        // Un EAN lu implique la source EAN, où qu'il ait été lu : c'est la
        // présence de l'identifiant qui compte, pas qui l'a repéré.
        Set<RecognitionSource> provenances = sources == null || sources.isEmpty()
                ? EnumSet.of(RecognitionSource.VISION)
                : EnumSet.copyOf(sources);
        if (ean != null) {
            provenances.add(RecognitionSource.EAN);
        }
        sources = Collections.unmodifiableSet(provenances);
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

    /** Une proposition venue du seul texte de l'annonce - sans photo derrière. */
    public static RecognizedItem fromText(String seriesTitle, Integer volumeNumber, String evidence) {
        return fromText(seriesTitle, volumeNumber, null, evidence);
    }

    /**
     * Une proposition venue du texte, avec l'édition que ce texte nomme.
     *
     * <p>{@code editionHint} reste un <b>indice</b> : « Perfect Edition » lu
     * dans un titre ne prouve pas que le catalogue connaisse cette édition pour
     * cette série. C'est {@code RecognitionCatalogResolver} qui tranche, et
     * l'élément reste « édition à confirmer » s'il ne reconnaît rien.
     */
    public static RecognizedItem fromText(String seriesTitle, Integer volumeNumber, String editionHint,
                                           String evidence) {
        return new RecognizedItem(seriesTitle, volumeNumber, editionHint, null,
                // Le texte a été lu par des règles écrites : la LECTURE est sûre.
                // Que le vendeur possède réellement ce tome est une autre question,
                // que porte la source TEXT et non la confiance.
                RecognitionConfidence.HIGH, EnumSet.of(RecognitionSource.TEXT),
                evidence == null ? List.of() : List.of(evidence), Set.of());
    }

    /** Une proposition venue d'une photo. */
    public static RecognizedItem fromVision(String seriesTitle, Integer volumeNumber, String editionHint, String ean,
                                             RecognitionConfidence confidence, List<String> evidence,
                                             Set<Integer> sourceImages) {
        return new RecognizedItem(seriesTitle, volumeNumber, editionHint, ean, confidence,
                EnumSet.of(RecognitionSource.VISION), evidence, sourceImages);
    }

    /**
     * Une proposition venue d'un <b>code-barres lu sur une photo</b>.
     *
     * <p>Toujours {@link RecognitionConfidence#HIGH}, et c'est la seule source
     * pour laquelle ce soit littéralement vrai : un EAN porte sa clé de
     * contrôle, il correspond ou il ne correspond pas. Le texte annonce ce que
     * le vendeur <i>dit</i>, la vision propose ce qu'un modèle <i>croit</i>
     * voir ; le code-barres désigne un tirage précis.
     *
     * <p>{@code sourceImages} est conservé : l'écran doit pouvoir dire sur
     * quelle photo le code a été trouvé, exactement comme pour la vision.
     */
    public static RecognizedItem fromEan(String seriesTitle, Integer volumeNumber, String ean,
                                          String evidence, Set<Integer> sourceImages) {
        return new RecognizedItem(seriesTitle, volumeNumber, null, ean,
                RecognitionConfidence.HIGH, EnumSet.of(RecognitionSource.EAN),
                evidence == null ? List.of() : List.of(evidence),
                sourceImages == null ? Set.of() : sourceImages);
    }

    /**
     * Vrai quand un identifiant exact a été lu. Une lecture d'EAN ne se
     * « ressemble » pas : elle correspond ou non. C'est ce qui autorise le
     * service à préférer le pipeline code-barres existant à une supposition
     * visuelle - voir {@link ListingRecognitionService}.
     */
    public boolean hasExactIdentifier() {
        return ean != null;
    }

    /** Vrai quand l'édition n'a pas été lue : l'écran doit demander, pas choisir. */
    public boolean editionIsUnknown() {
        return editionHint == null;
    }

    /** La source la plus prioritaire de cet élément - voir {@link RecognitionSource#priority()}. */
    public RecognitionSource strongestSource() {
        return sources.stream().max(java.util.Comparator.comparingInt(RecognitionSource::priority))
                .orElse(RecognitionSource.VISION);
    }

    /** La même chose sue par une autre source - voir {@link RecognitionConsolidator}. */
    RecognizedItem mergedWith(RecognizedItem autre) {
        Set<Integer> images = new TreeSet<>(sourceImages);
        images.addAll(autre.sourceImages());

        List<String> raisons = new ArrayList<>(evidence);
        autre.evidence().stream().filter(raison -> !raisons.contains(raison)).forEach(raisons::add);

        Set<RecognitionSource> provenances = EnumSet.copyOf(sources);
        provenances.addAll(autre.sources());

        return new RecognizedItem(
                seriesTitleRaw,
                volumeNumber != null ? volumeNumber : autre.volumeNumber(),
                // Une édition non lue est une information manquante, pas une
                // édition différente : celle qui a été lue la complète.
                editionHint != null ? editionHint : autre.editionHint(),
                ean != null ? ean : autre.ean(),
                // Deux sources qui disent la même chose se confortent.
                confidence.higherOf(autre.confidence()),
                provenances,
                raisons,
                images);
    }
}
