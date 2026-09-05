package com.iozycore.manga.recognition;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Ce qu'une annonce contient probablement, en croisant tout ce qu'on sait
 * d'elle.
 *
 * <pre>
 * titre + description ──> ListingTextRecognizer ──┐
 *                                                 │
 * photos ──> fetch borné ──> ImageRecognitionProvider ──┤──> consolidation
 *                                                 │      (RecognitionConsolidator)
 * EAN lu ─────────────────────────────────────────┘            │
 *                                                              ↓
 *                                                     CatalogResolution
 *                                                              ↓
 *                                                  propositions à confirmer
 * </pre>
 *
 * <h2>Le gratuit avant le coûteux</h2>
 * Le texte est lu <b>systématiquement</b> : c'est local, déterministe,
 * instantané et sans coût. Les photos ne sont lues que si l'appelant en
 * fournit - autrement dit sur un geste explicite de l'utilisateur. Une annonce
 * bien rédigée est donc comprise <b>sans aucun appel d'IA</b>.
 *
 * <h2>Une seule liste, plusieurs sources</h2>
 * Il n'existe pas un « résultat texte » et un « résultat photos » : les deux
 * alimentent la même consolidation, et un élément peut porter les deux
 * provenances. L'utilisateur n'a jamais deux listes à réconcilier lui-même.
 *
 * <h2>La vision enrichit, elle ne remplace pas</h2>
 * La consolidation est une <b>union</b>. Si le titre annonce les tomes 1 à 14
 * et que les photos n'en montrent que douze, les tomes 13 et 14 restent
 * proposés : une photo qui ne montre pas un livre ne prouve pas son absence.
 * Inversement, une photo qui lit « Perfect Edition » complète un tome dont le
 * texte ne disait rien de l'édition.
 *
 * <h2>Ce service ne crée jamais rien</h2>
 * Ni Ownership, ni Wishlist, ni Entity, ni Édition, ni Tome. Il rend des
 * propositions ; l'écriture vient d'un geste de l'utilisateur, ailleurs.
 */
@Service
public class ListingRecognitionService {

    private static final Logger log = LoggerFactory.getLogger(ListingRecognitionService.class);

    private final RecognitionImageFetcher fetcher;
    private final RecognitionCatalogResolver catalogResolver;
    private final List<ImageRecognitionProvider> providers;
    private final BarcodeRecognizer barcodeRecognizer;

    public ListingRecognitionService(RecognitionImageFetcher fetcher,
                                      RecognitionCatalogResolver catalogResolver,
                                      List<ImageRecognitionProvider> providers,
                                      BarcodeRecognizer barcodeRecognizer) {
        this.fetcher = fetcher;
        this.catalogResolver = catalogResolver;
        this.providers = providers == null ? List.of() : providers;
        this.barcodeRecognizer = barcodeRecognizer;
    }

    /**
     * Ce que l'écran de confirmation reçoit.
     *
     * @param visionStatus  l'issue de la lecture des photos, ou {@code null} si aucune
     *                      photo n'a été demandée - à ne pas confondre avec un échec
     * @param textItemCount combien de propositions le seul texte a produites, avant
     *                      consolidation : sert à dire « l'annonce en décrit déjà N »
     * @param announcedVolumeCount ce que l'annonce affirme contenir SANS dire lesquels
     *                      (« 9 tomes de Naruto ») - null sinon. Jamais accompagné d'items :
     *                      quand les numéros sont connus, ils font foi
     * @param announcedSeriesTitle la série nommée dans ce cas, null si le titre n'en désigne aucune
     */
    public record Analysis(RecognitionStatus visionStatus, List<ResolvedItem> items, int unidentifiedCount,
                            int textItemCount, int analyzedImageCount, int requestedImageCount,
                            Integer announcedVolumeCount, String announcedSeriesTitle) {

        public Analysis {
            items = items == null ? List.of() : List.copyOf(items);
        }
    }

    /**
     * @param imageUrls les photos à lire - <b>vide ou null</b> signifie « texte
     *                  seulement », et alors <b>aucun moteur n'est appelé</b>
     */
    public Analysis analyze(String title, String description, List<String> imageUrls, RecognitionContext context) {
        ListingTextRecognizer.TextReading texte = ListingTextRecognizer.read(title, description);

        int demandees = imageUrls == null ? 0 : imageUrls.size();
        if (demandees == 0) {
            // Chemin sans la moindre dépendance externe : ni CDN, ni moteur.
            return terminer(texte.items(), texte, null, 0, 0, 0);
        }

        // Les photos sont récupérées même sans moteur de vision : les
        // code-barres, eux, se lisent en local et gratuitement.
        return avecPhotos(texte, fetcher.fetch(imageUrls), premierMoteurDisponible(), context, demandees);
    }

    /**
     * Le même parcours, à partir de photos <b>déjà en mémoire</b> - celles que
     * l'utilisateur a envoyées lui-même.
     *
     * <h2>Pourquoi une seconde entrée plutôt qu'un paramètre de plus</h2>
     * Les deux chemins diffèrent sur un point qui n'est pas un détail : celui-ci
     * ne connaît <b>aucune URL</b>. Rien à joindre, donc rien à autoriser, donc
     * pas de liste blanche à franchir. Faire cohabiter les deux dans une seule
     * signature obligerait à écrire « si l'un est fourni, alors l'autre est
     * ignoré » - une règle qu'on finit toujours par lire de travers.
     *
     * <p>Tout ce qui suit la récupération est en revanche <b>strictement le
     * même code</b> : consolidation, arbitrage, résolution catalogue. Une photo
     * envoyée n'est pas mieux crue qu'une photo d'annonce.
     *
     * @param photos les images déjà lues et validées par {@link UploadedImageReader} ;
     *               vide signifie « texte seulement »
     * @param requestedImageCount ce que l'utilisateur a envoyé, y compris ce qui
     *                            a été écarté - l'écran doit pouvoir dire l'écart
     */
    public Analysis analyzeUploadedPhotos(String title, String description, List<RecognitionImage> photos,
                                          RecognitionContext context, int requestedImageCount) {
        ListingTextRecognizer.TextReading texte = ListingTextRecognizer.read(title, description);

        if (requestedImageCount == 0) {
            return terminer(texte.items(), texte, null, 0, 0, 0);
        }

        return avecPhotos(texte, photos, premierMoteurDisponible(), context, requestedImageCount);
    }

    /**
     * D'ici à la fin, l'origine des octets ne change plus rien.
     *
     * <h2>Les codes-barres d'abord, et même sans moteur</h2>
     * {@code moteur} peut être {@code null} : aucun moteur de vision n'est
     * configuré. Ce n'est plus une raison de ne rien faire des photos, car les
     * codes-barres se lisent <b>en local et gratuitement</b>. C'est le moment
     * où « l'IA n'est jamais obligatoire » cesse d'être une intention pour
     * devenir un comportement — sur un lot photographié de dos, la lecture des
     * EAN peut suffire à tout identifier, avec des identifiants exacts là où un
     * modèle n'aurait produit que des suppositions.
     */
    private Analysis avecPhotos(ListingTextRecognizer.TextReading texte, List<RecognitionImage> images,
                                ImageRecognitionProvider moteur, RecognitionContext context, int demandees) {
        if (images == null || images.isEmpty()) {
            return terminer(texte.items(), texte, RecognitionStatus.NO_USABLE_IMAGE, 0, 0, demandees);
        }

        List<RecognizedItem> depuisCodes = barcodeRecognizer.recognize(images, context);

        if (moteur == null) {
            // NO_ENGINE reste le statut : il décrit la VISION, et l'écran doit
            // continuer à dire qu'elle n'a pas tourné. Mais les propositions du
            // texte et des codes-barres, elles, sont bien là.
            return terminer(avec(texte.items(), depuisCodes), texte, RecognitionStatus.NO_ENGINE,
                    0, images.size(), demandees);
        }

        RecognitionResult vu = lireSansJamaisCasser(moteur, images, context);
        if (vu.status() == RecognitionStatus.UNAVAILABLE) {
            // Le moteur a échoué : ce que le texte disait reste vrai, et ce que
            // les codes-barres ont donné aussi.
            return terminer(avec(texte.items(), depuisCodes), texte, RecognitionStatus.UNAVAILABLE,
                    0, images.size(), demandees);
        }

        List<RecognizedItem> tout = avec(texte.items(), depuisCodes);
        tout.addAll(vu.items());
        return terminer(tout, texte, vu.status(), vu.unidentifiedCount(), images.size(), demandees);
    }

    private static List<RecognizedItem> avec(List<RecognizedItem> premiers, List<RecognizedItem> seconds) {
        List<RecognizedItem> tout = new ArrayList<>(premiers);
        tout.addAll(seconds);
        return tout;
    }

    /** Consolidation, arbitrage, puis catalogue - le même chemin quelles que soient les sources. */
    private Analysis terminer(List<RecognizedItem> bruts, ListingTextRecognizer.TextReading texte,
                               RecognitionStatus visionStatus,
                               int nonIdentifies, int imagesLues, int imagesDemandees) {
        List<RecognizedItem> consolides = RecognitionConsolidator.consolidate(bruts);
        List<ResolvedItem> resolus = catalogResolver.resolve(prioriser(consolides));

        // Le nombre annoncé ne survit PAS à une identification réussie : si les
        // photos ont fini par nommer les tomes, « l'annonce en annonce 9 » n'est
        // plus une question ouverte, et l'afficher encore ferait douter d'un
        // résultat désormais complet.
        boolean questionEncoreOuverte = resolus.isEmpty() && texte.announcedVolumeCount() != null;

        return new Analysis(visionStatus, resolus, nonIdentifies, texte.items().size(),
                imagesLues, imagesDemandees,
                questionEncoreOuverte ? texte.announcedVolumeCount() : null,
                questionEncoreOuverte ? texte.announcedSeriesTitle() : null);
    }

    private ImageRecognitionProvider premierMoteurDisponible() {
        for (ImageRecognitionProvider provider : providers) {
            if (provider.isAvailable()) {
                return provider;
            }
        }
        return null;
    }

    /**
     * L'interface interdit déjà de lever, mais un moteur est du code externe au
     * domaine : cette ceinture garantit qu'un bug chez lui ne se transforme
     * jamais en 500 sur le parcours d'analyse.
     */
    private RecognitionResult lireSansJamaisCasser(ImageRecognitionProvider moteur,
                                                    List<RecognitionImage> images,
                                                    RecognitionContext context) {
        try {
            RecognitionResult resultat = moteur.recognize(images, context);
            return resultat == null ? RecognitionResult.unavailable() : resultat;
        } catch (RuntimeException e) {
            log.warn("Le moteur de reconnaissance {} a échoué : {}", moteur.name(), e.getClass().getSimpleName());
            return RecognitionResult.unavailable();
        }
    }

    /**
     * L'ordre d'affichage : d'abord ce qui est le plus sûr, puis l'ordre
     * naturel d'un lot.
     * <p>
     * Un identifiant exact passe devant tout - un code-barres correspond ou ne
     * correspond pas, là où un titre lu de travers « ressemble ». Vient
     * ensuite la source la plus fiable, puis la confiance de lecture, et enfin
     * le numéro de tome : à sources égales, un lot se lit 1, 2, 3.
     */
    private List<RecognizedItem> prioriser(List<RecognizedItem> items) {
        List<RecognizedItem> tries = new ArrayList<>(items);
        tries.sort(Comparator
                .comparing(RecognizedItem::hasExactIdentifier).reversed()
                .thenComparing(Comparator.comparingInt((RecognizedItem item) ->
                        item.strongestSource().priority()).reversed())
                .thenComparing(RecognizedItem::confidence)
                .thenComparing(item -> item.volumeNumber() == null ? Integer.MAX_VALUE : item.volumeNumber()));
        return List.copyOf(tries);
    }
}
