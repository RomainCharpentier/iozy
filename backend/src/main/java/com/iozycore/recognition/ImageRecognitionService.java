package com.iozycore.recognition;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Le pipeline complet : des URL de photos à des propositions confrontées au
 * catalogue.
 *
 * <pre>
 * URL de photos
 *   -> récupération bornée et sur liste blanche  (RecognitionImageFetcher)
 *   -> lecture par un moteur                     (ImageRecognitionProvider)
 *   -> consolidation entre photos                (RecognitionConsolidator)
 *   -> confrontation au catalogue                (RecognitionCatalogResolver)
 *   -> propositions à confirmer
 * </pre>
 *
 * <h2>Ce que ce service ne fait jamais</h2>
 * Il ne crée <b>rien</b> : ni Ownership, ni Wishlist, ni Entity, ni Édition, ni
 * Tome. Il rend des propositions. L'écriture, s'il doit y en avoir une, vient
 * d'un geste de l'utilisateur, ailleurs.
 *
 * <h2>Priorité au déterministe</h2>
 * Un identifiant exact lu sur une photo (EAN/ISBN) l'emporte sur une lecture
 * visuelle : un code-barres correspond ou ne correspond pas, là où un titre
 * lu de travers « ressemble ». Les éléments porteurs d'un EAN sont donc
 * remontés en tête et leur confiance ne peut pas être dégradée. Le décodage
 * d'un code-barres <b>depuis les pixels</b> n'est pas fait ici (voir la note
 * d'architecture dans docs/) : la règle de priorité existe et est testée, et
 * le jour où un décodeur local est branché, il alimente ce même champ sans
 * qu'aucun appelant ne bouge.
 *
 * <h2>Sans moteur, IozyCore marche</h2>
 * Aucun moteur configuré rend {@link RecognitionStatus#NO_ENGINE} et une liste
 * vide. Le parcours d'analyse manuelle est intact : c'est la règle « l'IA
 * améliore IozyCore, IozyCore ne dépend pas de l'IA ».
 */
@Service
public class ImageRecognitionService {

    private static final Logger log = LoggerFactory.getLogger(ImageRecognitionService.class);

    private final RecognitionImageFetcher fetcher;
    private final RecognitionCatalogResolver catalogResolver;
    private final List<ImageRecognitionProvider> providers;

    public ImageRecognitionService(RecognitionImageFetcher fetcher,
                                    RecognitionCatalogResolver catalogResolver,
                                    List<ImageRecognitionProvider> providers) {
        this.fetcher = fetcher;
        this.catalogResolver = catalogResolver;
        this.providers = providers == null ? List.of() : providers;
    }

    /** Ce que l'écran de confirmation reçoit. */
    public record Analysis(RecognitionStatus status, List<ResolvedItem> items, int unidentifiedCount,
                            int analyzedImageCount, int requestedImageCount) {

        public Analysis {
            items = items == null ? List.of() : List.copyOf(items);
        }

        static Analysis of(RecognitionStatus status, int requested) {
            return new Analysis(status, List.of(), 0, 0, requested);
        }
    }

    public Analysis analyze(List<String> imageUrls, RecognitionContext context) {
        int demandees = imageUrls == null ? 0 : imageUrls.size();
        if (demandees == 0) {
            return Analysis.of(RecognitionStatus.NO_USABLE_IMAGE, 0);
        }

        ImageRecognitionProvider moteur = premierMoteurDisponible();
        if (moteur == null) {
            // Aucun moteur : on ne télécharge même pas les photos. Inutile de
            // solliciter un CDN pour un résultat qu'on ne peut pas produire.
            return Analysis.of(RecognitionStatus.NO_ENGINE, demandees);
        }

        List<RecognitionImage> images = fetcher.fetch(imageUrls);
        if (images.isEmpty()) {
            return Analysis.of(RecognitionStatus.NO_USABLE_IMAGE, demandees);
        }

        RecognitionResult brut = lireSansJamaisCasser(moteur, images, context);
        if (brut.status() == RecognitionStatus.UNAVAILABLE) {
            return new Analysis(RecognitionStatus.UNAVAILABLE, List.of(), 0, images.size(), demandees);
        }

        List<RecognizedItem> consolides = RecognitionConsolidator.consolidate(brut.items());
        List<ResolvedItem> resolus = catalogResolver.resolve(prioriserIdentifiantsExacts(consolides));

        return new Analysis(brut.status(), resolus, brut.unidentifiedCount(), images.size(), demandees);
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

    /** Les identifiants exacts d'abord, puis la confiance décroissante, puis l'ordre des photos. */
    private List<RecognizedItem> prioriserIdentifiantsExacts(List<RecognizedItem> items) {
        List<RecognizedItem> tries = new ArrayList<>(items);
        tries.sort(Comparator
                .comparing(RecognizedItem::hasExactIdentifier).reversed()
                .thenComparing(RecognizedItem::confidence)
                .thenComparing(item -> item.sourceImages().stream().min(Integer::compareTo).orElse(Integer.MAX_VALUE)));
        return List.copyOf(tries);
    }
}
