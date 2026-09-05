package com.iozycore.manga.recognition;

import com.iozycore.manga.deals.ListingTextParser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

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
    static final int MAX_CODES = 12;

    /**
     * Combien d'identifications mènent de front.
     *
     * <h2>Pourquoi ce n'est pas un détail</h2>
     * Mesuré sur cette instance : <b>1,4 à 5,5 secondes</b> par code, et les
     * échecs ne sont pas mis en cache — seuls les succès le sont. Douze codes
     * en file, sur une route <b>synchrone</b>, c'est une minute d'attente
     * derrière un clic, sans que rien à l'écran n'en dise la raison.
     *
     * <p>Les identifications sont indépendantes les unes des autres et le cache
     * est un {@code ConcurrentHashMap} : rien ne justifiait de les mettre en
     * file. Quatre de front ramènent le pire cas d'environ une minute à une
     * quinzaine de secondes.
     *
     * <h2>Pourquoi quatre, et pas douze</h2>
     * Ces bases sont gratuites et partagées — Google Books tourne sur un quota
     * anonyme mondial « fréquemment épuisé », et le scanner de la page
     * « Scanner » comme le client iOS tapent au même endroit. Lâcher douze
     * requêtes simultanées pour gagner quelques secondes reviendrait à
     * dégrader une autre fonctionnalité pour accélérer celle-ci.
     */
    private static final int IDENTIFICATIONS_DE_FRONT = 4;

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

        List<Map.Entry<String, Set<Integer>>> aIdentifier =
                photosParCode.entrySet().stream().limit(MAX_CODES).toList();

        return List.copyOf(identifierEnParallele(aIdentifier, context));
    }

    /**
     * Les identifications menées quelques-unes de front, puis remises dans
     * l'ordre où les codes ont été lus.
     *
     * <p>L'ordre compte : il suit celui des photos, donc celui que l'écran
     * affiche. Le rendre au gré des réponses ferait danser la liste d'une
     * analyse à l'autre pour les mêmes photos.
     */
    private List<RecognizedItem> identifierEnParallele(
            List<Map.Entry<String, Set<Integer>>> codes, RecognitionContext context) {

        if (codes.size() == 1) {
            // Pas d'ordonnanceur pour un seul code : le cas le plus courant ne
            // doit pas payer la mise en place d'un pool.
            RecognizedItem seul = identifier(codes.get(0).getKey(), codes.get(0).getValue(), context);
            return seul == null ? List.of() : List.of(seul);
        }

        ExecutorService pool = Executors.newFixedThreadPool(
                Math.min(IDENTIFICATIONS_DE_FRONT, codes.size()));
        try {
            List<Future<RecognizedItem>> enCours = codes.stream()
                    .map(entree -> pool.submit(
                            () -> identifier(entree.getKey(), entree.getValue(), context)))
                    .toList();

            List<RecognizedItem> propositions = new ArrayList<>(codes.size());
            for (Future<RecognizedItem> future : enCours) {
                try {
                    RecognizedItem proposition = future.get();
                    if (proposition != null) {
                        propositions.add(proposition);
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    // Interrompu : on rend ce qui a été identifié, jamais une erreur.
                    break;
                } catch (ExecutionException e) {
                    // identifier() ne laisse déjà rien passer ; ce filet couvre
                    // ce qu'un pool peut lever autour d'elle.
                    log.info("Identification d'un code-barres abandonnée : {}",
                            e.getCause() == null ? e.getClass().getSimpleName()
                                    : e.getCause().getClass().getSimpleName());
                }
            }
            return propositions;
        } finally {
            pool.shutdown();
        }
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
