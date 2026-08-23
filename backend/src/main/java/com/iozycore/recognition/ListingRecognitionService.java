package com.iozycore.recognition;

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

    public ListingRecognitionService(RecognitionImageFetcher fetcher,
                                      RecognitionCatalogResolver catalogResolver,
                                      List<ImageRecognitionProvider> providers) {
        this.fetcher = fetcher;
        this.catalogResolver = catalogResolver;
        this.providers = providers == null ? List.of() : providers;
    }

    /**
     * Ce que l'écran de confirmation reçoit.
     *
     * @param visionStatus  l'issue de la lecture des photos, ou {@code null} si aucune
     *                      photo n'a été demandée - à ne pas confondre avec un échec
     * @param textItemCount combien de propositions le seul texte a produites, avant
     *                      consolidation : sert à dire « l'annonce en décrit déjà N »
     */
    public record Analysis(RecognitionStatus visionStatus, List<ResolvedItem> items, int unidentifiedCount,
                            int textItemCount, int analyzedImageCount, int requestedImageCount) {

        public Analysis {
            items = items == null ? List.of() : List.copyOf(items);
        }
    }

    /**
     * @param imageUrls les photos à lire - <b>vide ou null</b> signifie « texte
     *                  seulement », et alors <b>aucun moteur n'est appelé</b>
     */
    public Analysis analyze(String title, String description, List<String> imageUrls, RecognitionContext context) {
        List<RecognizedItem> depuisTexte = ListingTextRecognizer.recognize(title, description);

        int demandees = imageUrls == null ? 0 : imageUrls.size();
        if (demandees == 0) {
            // Chemin sans la moindre dépendance externe : ni CDN, ni moteur.
            return terminer(depuisTexte, null, depuisTexte.size(), 0, 0, 0);
        }

        ImageRecognitionProvider moteur = premierMoteurDisponible();
        if (moteur == null) {
            // Aucun moteur : on ne télécharge même pas les photos. Inutile de
            // solliciter un CDN pour un résultat qu'on ne peut pas produire -
            // et les propositions du texte restent, elles.
            return terminer(depuisTexte, RecognitionStatus.NO_ENGINE, depuisTexte.size(), 0, 0, demandees);
        }

        List<RecognitionImage> images = fetcher.fetch(imageUrls);
        if (images.isEmpty()) {
            return terminer(depuisTexte, RecognitionStatus.NO_USABLE_IMAGE, depuisTexte.size(), 0, 0, demandees);
        }

        RecognitionResult vu = lireSansJamaisCasser(moteur, images, context);
        if (vu.status() == RecognitionStatus.UNAVAILABLE) {
            // Le moteur a échoué : ce que le texte disait reste vrai.
            return terminer(depuisTexte, RecognitionStatus.UNAVAILABLE, depuisTexte.size(),
                    0, images.size(), demandees);
        }

        List<RecognizedItem> tout = new ArrayList<>(depuisTexte);
        tout.addAll(vu.items());
        return terminer(tout, vu.status(), depuisTexte.size(), vu.unidentifiedCount(), images.size(), demandees);
    }

    /** Consolidation, arbitrage, puis catalogue - le même chemin quelles que soient les sources. */
    private Analysis terminer(List<RecognizedItem> bruts, RecognitionStatus visionStatus, int depuisTexte,
                               int nonIdentifies, int imagesLues, int imagesDemandees) {
        List<RecognizedItem> consolides = RecognitionConsolidator.consolidate(bruts);
        List<ResolvedItem> resolus = catalogResolver.resolve(prioriser(consolides));
        return new Analysis(visionStatus, resolus, nonIdentifies, depuisTexte, imagesLues, imagesDemandees);
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
