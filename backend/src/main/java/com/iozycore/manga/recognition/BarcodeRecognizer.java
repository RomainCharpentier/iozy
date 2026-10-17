package com.iozycore.manga.recognition;

import com.iozycore.manga.domain.deals.ListingTextParser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
 * From barcodes read on the photos to proposals to confirm.
 *
 * <h2>The chain, and what it reuses</h2>
 * <ol>
 *   <li>{@link BarcodeImageDecoder} reads the EANs on the pixels - local, free;</li>
 *   <li>{@link BarcodeWorkLookup} gives the <b>title</b> of the print run - the only
 *       step that goes outside;</li>
 *   <li>{@code ListingTextParser} extracts series and volume number from it - <b>the
 *       same rules</b> as for the title of a listing.</li>
 * </ol>
 *
 * <p>The third point deserves to be said: "Naruto, Vol. 9" returned by a
 * bibliographic database and "Naruto tome 9" written by a seller pose
 * exactly the same reading problem. Writing a second extraction here
 * would have guaranteed that it diverges from the first - and this has already happened in this
 * project, with copies of {@code SeriesMatcher} that had drifted from the real one.
 *
 * <h2>Only one possible output: stay silent</h2>
 * An EAN not found, an unreadable title, a service down: the proposal
 * does not exist, and the rest of the batch is returned anyway. A barcode that we
 * cannot name is not worth an "EAN 9782505011118" line on screen,
 * which would teach nothing to anybody.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class BarcodeRecognizer {

    /**
     * Beyond that, it is no longer a batch reading but a scan session, and
     * each code costs a round trip to an external database.
     */
    static final int MAX_CODES = 12;

    /**
     * How many identifications run side by side.
     *
     * <h2>Why this is not a detail</h2>
     * Measured on this instance: <b>1.4 to 5.5 seconds</b> per code, and
     * failures are not cached - only successes are. Twelve codes
     * in a queue, on a <b>synchronous</b> route, is a minute of waiting
     * behind a click, with nothing on screen saying why.
     *
     * <p>The identifications are independent from each other and the cache
     * is a {@code ConcurrentHashMap}: nothing justified putting them in a
     * queue. Four at a time bring the worst case from about a minute to about
     * fifteen seconds.
     *
     * <h2>Why four, and not twelve</h2>
     * These databases are free and shared - Google Books runs on a worldwide
     * anonymous quota "frequently exhausted", and the scanner of the page
     * "Scanner" like the iOS client hit the same place. Releasing twelve
     * simultaneous requests to gain a few seconds would amount to
     * degrading another feature to speed up this one.
     */
    private static final int IDENTIFICATIONS_DE_FRONT = 4;

    private final BarcodeWorkLookup lookup;

    /**
     * @param images the photos already in memory, whatever the door
     *               through which they came in
     * @return the proposals coming from the barcodes alone, empty if none
     *         was read or identified - <b>never throws</b>
     */
    public List<RecognizedItem> recognize(List<RecognitionImage> images, RecognitionContext context) {
        if (images == null || images.isEmpty()) {
            return List.of();
        }

        // Which code on which photo: the screen must be able to say it, and the same
        // code seen on two photos stays a single volume.
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
     * The identifications run a few at a time, then put back in
     * the order in which the codes were read.
     *
     * <p>The order matters: it follows that of the photos, hence the one the screen
     * shows. Returning it as the answers come would make the list dance from one
     * analysis to the next for the same photos.
     */
    private List<RecognizedItem> identifierEnParallele(
            List<Map.Entry<String, Set<Integer>>> codes, RecognitionContext context) {

        if (codes.size() == 1) {
            // No scheduler for a single code: the most common case must not
            // pay for setting up a pool.
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
                    // Interrupted: we return what was identified, never an error.
                    break;
                } catch (ExecutionException e) {
                    // identifier() already lets nothing through; this safety net covers
                    // what a pool can throw around it.
                    log.info("Barcode identification abandoned: {}",
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
            // A bibliographic database that is unavailable is a barcode not
            // identified, not an interrupted analysis.
            log.info("Barcode identification abandoned: {}", e.getClass().getSimpleName());
            return null;
        }
        if (titre.isEmpty() || titre.get().isBlank()) {
            return null;
        }

        // The same rules as for the title of a listing - see the javadoc.
        String serie = ListingTextParser.probableSeriesTitle(titre.get());
        if (serie.isBlank()) {
            return null;
        }
        List<Integer> numeros = ListingTextParser.sorted(
                ListingTextParser.parse(titre.get(), null).volumeNumbers());

        // A print run carries ONE number. Several means the title described
        // something other than a volume ("Naruto tomes 1 à 3" for a box set):
        // better the series without a number than a number chosen at random.
        Integer numero = numeros.size() == 1 ? numeros.get(0) : null;

        return RecognizedItem.fromEan(serie, numero, ean, raison(numero), photos);
    }

    /** What was understood, not the copied code: "EAN 978..." teaches nothing. */
    private static String raison(Integer numero) {
        return numero == null
                ? "code-barres lu sur une photo"
                : "code-barres du tome %d lu sur une photo".formatted(numero);
    }
}
