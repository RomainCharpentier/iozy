package com.iozycore.manga.recognition;

import java.util.List;

/**
 * Un moteur capable de lire des photos et d'y proposer des œuvres.
 *
 * <h2>Volontairement minuscule</h2>
 * Même esprit que {@code ListingProvider} et {@code MetadataProvider} : cette
 * interface existe pour qu'un second moteur soit une classe de plus et rien
 * d'autre - un décodeur de code-barres local, un modèle auto-hébergé, un autre
 * fournisseur cloud. Elle ne cherche pas à décrire tous les moteurs possibles.
 *
 * <h2>Pourquoi une abstraction plutôt qu'un appel direct</h2>
 * Sans elle, le nom du fournisseur du jour se retrouverait dans le service, le
 * contrôleur et les tests, et en changer voudrait dire les rouvrir tous. Ici,
 * un moteur se remplace en changeant le bean - c'est aussi ce qui permet aux
 * tests de n'appeler <b>aucune IA réelle</b>.
 *
 * <h2>Ne lève pas pour une panne</h2>
 * Une panne, un quota dépassé, un délai écoulé rendent
 * {@link RecognitionResult#unavailable()}, jamais une exception : IozyCore doit
 * rester utilisable sans reconnaissance, et une exception qui remonte
 * casserait le parcours d'analyse manuelle.
 */
public interface ImageRecognitionProvider {

    /**
     * Vrai si ce moteur est réellement utilisable maintenant - typiquement
     * « une clé d'API est configurée ». Un moteur non configuré n'est pas une
     * erreur : IozyCore fonctionne sans, l'écran le dit et la saisie manuelle
     * reste entière.
     */
    boolean isAvailable();

    /** Ce qu'il croit voir. Ne doit jamais lever, voir la Javadoc de l'interface. */
    RecognitionResult recognize(List<RecognitionImage> images, RecognitionContext context);

    /** Ce qui apparaîtra dans l'évidence et les journaux - jamais une clé, jamais une URL d'appel. */
    String name();
}
