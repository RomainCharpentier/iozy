package com.iozycore.manga.recognition;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * What a listing probably contains, by cross-checking everything we know
 * about it.
 *
 * <pre>
 * title + description ──> ListingTextRecognizer ──┐
 *                                                 │
 * photos ──> bounded fetch ──> ImageRecognitionProvider ──┤──> consolidation
 *                                                 │      (RecognitionConsolidator)
 * EAN read ───────────────────────────────────────┘            │
 *                                                              ↓
 *                                                     CatalogResolution
 *                                                              ↓
 *                                                  proposals to confirm
 * </pre>
 *
 * <h2>The free before the costly</h2>
 * The text is read <b>systematically</b>: it is local, deterministic,
 * instant and free. The photos are read only if the caller
 * provides some - in other words on an explicit action of the user. A listing
 * that is well written is therefore understood <b>without any AI call</b>.
 *
 * <h2>One single list, several sources</h2>
 * There is no "text result" and "photo result": both
 * feed the same consolidation, and an item can carry both
 * origins. The user never has two lists to reconcile by themselves.
 *
 * <h2>Vision enriches, it does not replace</h2>
 * The consolidation is a <b>union</b>. If the title announces volumes 1 to 14
 * and the photos show only twelve, volumes 13 and 14 stay
 * proposed: a photo that does not show a book does not prove its absence.
 * Conversely, a photo that reads "Perfect Edition" completes a volume whose
 * text said nothing about the edition.
 *
 * <h2>This service never creates anything</h2>
 * No Ownership, no Wishlist, no Entity, no Edition, no Volume. It returns
 * proposals; writing comes from an action of the user, elsewhere.
 */
@Service
@Slf4j
public class ListingRecognitionService {

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
     * What the confirmation screen receives.
     *
     * @param visionStatus  the outcome of reading the photos, or {@code null} if no
     *                      photo was requested - not to be confused with a failure
     * @param textItemCount how many proposals the text alone produced, before
     *                      consolidation: used to say "the listing already describes N"
     * @param announcedVolumeCount what the listing claims to contain WITHOUT saying which ones
     *                      ("9 tomes de Naruto") - null otherwise. Never accompanied by items:
     *                      when the numbers are known, they are authoritative
     * @param announcedSeriesTitle the series named in this case, null if the title names none
     */
    public record Analysis(RecognitionStatus visionStatus, List<ResolvedItem> items, int unidentifiedCount,
                            int textItemCount, int analyzedImageCount, int requestedImageCount,
                            Integer announcedVolumeCount, String announcedSeriesTitle) {

        public Analysis {
            items = items == null ? List.of() : List.copyOf(items);
        }
    }

    /**
     * @param imageUrls the photos to read - <b>empty or null</b> means "text
     *                  only", and then <b>no engine is called</b>
     */
    public Analysis analyze(String title, String description, List<String> imageUrls, RecognitionContext context) {
        ListingTextRecognizer.TextReading texte = ListingTextRecognizer.read(title, description);

        int demandees = imageUrls == null ? 0 : imageUrls.size();
        if (demandees == 0) {
            // Path without the slightest external dependency: no CDN, no engine.
            return terminer(texte.items(), texte, null, 0, 0, 0);
        }

        // The photos are fetched even without a vision engine: the
        // barcodes, for their part, are read locally and for free.
        return avecPhotos(texte, fetcher.fetch(imageUrls), premierMoteurDisponible(), context, demandees);
    }

    /**
     * The same flow, from photos <b>already in memory</b> - the ones
     * the user sent themselves.
     *
     * <h2>Why a second entry rather than one more parameter</h2>
     * The two paths differ on a point that is not a detail: this one
     * knows <b>no URL</b>. Nothing to attach, so nothing to authorise, so
     * no whitelist to cross. Making the two coexist in a single
     * signature would force us to write "if one is provided, then the other is
     * ignored" - a rule that one always ends up reading wrongly.
     *
     * <p>Everything that follows the fetching is, however, <b>strictly the
     * same code</b>: consolidation, arbitration, catalog resolution. A sent
     * photo is not believed more than a listing photo.
     *
     * @param photos the images already read and validated by {@link UploadedImageReader};
     *               empty means "text only"
     * @param requestedImageCount what the user sent, including what
     *                            was dropped - the screen must be able to say the gap
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
     * From here to the end, the origin of the bytes changes nothing anymore.
     *
     * <h2>Barcodes first, and even without an engine</h2>
     * {@code moteur} can be {@code null}: no vision engine is
     * configured. This is no longer a reason to do nothing with the photos, because
     * barcodes are read <b>locally and for free</b>. This is the moment
     * where "AI is never mandatory" stops being an intention and
     * becomes a behaviour - on a batch photographed from the back, reading the
     * EANs can be enough to identify everything, with exact identifiers where a
     * model would have produced only guesses.
     */
    private Analysis avecPhotos(ListingTextRecognizer.TextReading texte, List<RecognitionImage> images,
                                ImageRecognitionProvider moteur, RecognitionContext context, int demandees) {
        if (images == null || images.isEmpty()) {
            return terminer(texte.items(), texte, RecognitionStatus.NO_USABLE_IMAGE, 0, 0, demandees);
        }

        List<RecognizedItem> depuisCodes = barcodeRecognizer.recognize(images, context);

        if (moteur == null) {
            // NO_ENGINE stays the status: it describes the VISION, and the screen must
            // keep saying that it did not run. But the proposals from the
            // text and the barcodes are indeed there.
            return terminer(avec(texte.items(), depuisCodes), texte, RecognitionStatus.NO_ENGINE,
                    0, images.size(), demandees);
        }

        RecognitionResult vu = lireSansJamaisCasser(moteur, images, context);
        if (vu.status() == RecognitionStatus.UNAVAILABLE || vu.status() == RecognitionStatus.QUOTA_EXCEEDED) {
            // The engine failed, or is no longer allowed to answer: what the
            // text said stays true, and what the barcodes gave too.
            // The status is returned as is - "try again" and "quota reached"
            // do not call for the same sentence on screen.
            return terminer(avec(texte.items(), depuisCodes), texte, vu.status(),
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

    /** Consolidation, arbitration, then catalog - the same path whatever the sources. */
    private Analysis terminer(List<RecognizedItem> bruts, ListingTextRecognizer.TextReading texte,
                               RecognitionStatus visionStatus,
                               int nonIdentifies, int imagesLues, int imagesDemandees) {
        List<RecognizedItem> consolides = RecognitionConsolidator.consolidate(bruts);
        List<ResolvedItem> resolus = catalogResolver.resolve(prioriser(consolides));

        // The announced number does NOT survive a successful identification: if the
        // photos ended up naming the volumes, "the listing announces 9" is
        // no longer an open question, and showing it again would cast doubt on a
        // result that is now complete.
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
     * The interface already forbids throwing, but an engine is code external to the
     * domain: this belt guarantees that a bug on its side never turns
     * into a 500 on the analysis flow.
     */
    private RecognitionResult lireSansJamaisCasser(ImageRecognitionProvider moteur,
                                                    List<RecognitionImage> images,
                                                    RecognitionContext context) {
        try {
            RecognitionResult resultat = moteur.recognize(images, context);
            return resultat == null ? RecognitionResult.unavailable() : resultat;
        } catch (RuntimeException e) {
            log.warn("Recognition engine {} failed: {}", moteur.name(), e.getClass().getSimpleName());
            return RecognitionResult.unavailable();
        }
    }

    /**
     * The display order: first what is most certain, then the natural
     * order of a batch.
     * <p>
     * An exact identifier goes before everything - a barcode matches or does not
     * match, where a title read wrongly "looks like" one. Next comes
     * the most reliable source, then the reading confidence, and finally
     * the volume number: with equal sources, a batch reads 1, 2, 3.
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
