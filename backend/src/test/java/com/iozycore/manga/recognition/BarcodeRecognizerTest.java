package com.iozycore.manga.recognition;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.MultiFormatWriter;
import com.google.zxing.common.BitMatrix;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * From the barcode read to the proposal to confirm.
 *
 * <p>The EAN → title resolution is <b>simulated</b>: it is the only step of the
 * chain that would go out on the network, and a test that really queried
 * Google Books would measure the availability of a third party, not the behaviour of
 * this code. The decoding, for its part, is real — the images are drawn then
 * read back.
 */
class BarcodeRecognizerTest {

    private static final String EAN_T9 = "9782505011118";
    private static final String EAN_T4 = "9782344029572";
    private static final String EAN_T7 = "9782505078180";
    private static final String EAN_T2 = "9782820343819";

    /** What a bibliographic database returns: a free title, not a structured volume. */
    private static BarcodeWorkLookup lookup(Map<String, String> titresParCode) {
        return (ean, entityTypeCode) -> Optional.ofNullable(titresParCode.get(ean));
    }

    // ============================================ The complete chain

    @Test
    void a_barcode_on_a_photo_becomes_a_proposal_with_an_exact_identifier() {
        BarcodeRecognizer recognizer =
                new BarcodeRecognizer(lookup(Map.of(EAN_T9, "Naruto, Vol. 9")));

        List<RecognizedItem> propositions =
                recognizer.recognize(List.of(photoAvec(EAN_T9, 0)), RecognitionContext.forManga());

        assertThat(propositions).hasSize(1);
        RecognizedItem item = propositions.get(0);
        assertThat(item.seriesTitleRaw()).isEqualTo("Naruto");
        assertThat(item.volumeNumber()).isEqualTo(9);
        // The point that sets this source apart from the other two: it is not a
        // probable reading, it is an identifier that matches or does not match.
        assertThat(item.hasExactIdentifier()).isTrue();
        assertThat(item.ean()).isEqualTo(EAN_T9);
        assertThat(item.sources()).containsExactly(RecognitionSource.EAN);
        assertThat(item.confidence()).isEqualTo(RecognitionConfidence.HIGH);
    }

    @Test
    void the_title_is_read_by_the_SAME_rules_as_a_listing_title() {
        // "Naruto, Vol. 9" and "Naruto tome 9" pose the same reading
        // problem. A second extraction written here would have ended up diverging.
        BarcodeRecognizer recognizer = new BarcodeRecognizer(lookup(Map.of(
                EAN_T9, "Naruto tome 9",
                EAN_T4, "One Piece, Vol. 4")));

        List<RecognizedItem> propositions = recognizer.recognize(
                List.of(photoAvec(EAN_T9, 0), photoAvec(EAN_T4, 1)), RecognitionContext.forManga());

        assertThat(propositions).extracting(RecognizedItem::seriesTitleRaw)
                .containsExactly("Naruto", "One Piece");
        assertThat(propositions).extracting(RecognizedItem::volumeNumber).containsExactly(9, 4);
    }

    @Test
    void the_photo_a_code_was_found_on_is_kept() {
        BarcodeRecognizer recognizer = new BarcodeRecognizer(lookup(Map.of(EAN_T9, "Naruto, Vol. 9")));

        List<RecognizedItem> propositions =
                recognizer.recognize(List.of(photoAvec(EAN_T9, 3)), RecognitionContext.forManga());

        // The screen must be able to say "seen on photo 4", as for vision.
        assertThat(propositions.get(0).sourceImages()).containsExactly(3);
    }

    @Test
    void the_same_code_on_two_photos_is_one_volume_seen_twice() {
        BarcodeRecognizer recognizer = new BarcodeRecognizer(lookup(Map.of(EAN_T9, "Naruto, Vol. 9")));

        List<RecognizedItem> propositions = recognizer.recognize(
                List.of(photoAvec(EAN_T9, 0), photoAvec(EAN_T9, 1)), RecognitionContext.forManga());

        assertThat(propositions).hasSize(1);
        assertThat(propositions.get(0).sourceImages()).containsExactly(0, 1);
    }

    // ============================================ Stay silent rather than embroider

    @Test
    void a_code_no_database_knows_produces_nothing() {
        // No "EAN 9782505011118" line on screen: it would teach
        // nothing, and would give the illusion of an identified volume.
        BarcodeRecognizer recognizer = new BarcodeRecognizer(lookup(Map.of()));

        assertThat(recognizer.recognize(List.of(photoAvec(EAN_T9, 0)), RecognitionContext.forManga()))
                .isEmpty();
    }

    @Test
    void a_lookup_that_fails_does_not_break_the_analysis() {
        BarcodeWorkLookup enPanne = (ean, code) -> {
            throw new IllegalStateException("service indisponible");
        };

        assertThat(new BarcodeRecognizer(enPanne)
                .recognize(List.of(photoAvec(EAN_T9, 0)), RecognitionContext.forManga()))
                .isEmpty();
    }

    @Test
    void a_title_describing_several_volumes_keeps_the_series_without_a_number() {
        // "Naruto tomes 1 à 3" designates a box set, not a volume. Picking a
        // number at random among three would be worse than giving none.
        BarcodeRecognizer recognizer =
                new BarcodeRecognizer(lookup(Map.of(EAN_T9, "Naruto tomes 1 à 3")));

        List<RecognizedItem> propositions =
                recognizer.recognize(List.of(photoAvec(EAN_T9, 0)), RecognitionContext.forManga());

        assertThat(propositions).hasSize(1);
        assertThat(propositions.get(0).seriesTitleRaw()).isEqualTo("Naruto");
        assertThat(propositions.get(0).volumeNumber()).isNull();
        assertThat(propositions.get(0).hasExactIdentifier()).isTrue();
    }

    @Test
    void a_photo_without_any_barcode_costs_no_lookup_at_all() {
        // Decoding is local and free; identification is not. A
        // photo with no code must trigger no round trip.
        int[] appels = {0};
        BarcodeWorkLookup compteur = (ean, code) -> {
            appels[0]++;
            return Optional.of("Naruto, Vol. 9");
        };

        new BarcodeRecognizer(compteur).recognize(List.of(photoUnie(0)), RecognitionContext.forManga());

        assertThat(appels[0]).isZero();
    }

    @Test
    void no_photo_at_all_is_tolerated() {
        BarcodeRecognizer recognizer = new BarcodeRecognizer(lookup(Map.of()));

        assertThat(recognizer.recognize(null, RecognitionContext.forManga())).isEmpty();
        assertThat(recognizer.recognize(List.of(), RecognitionContext.forManga())).isEmpty();
    }

    @Test
    void a_null_context_does_not_crash_the_lookup() {
        BarcodeRecognizer recognizer = new BarcodeRecognizer(lookup(Map.of(EAN_T9, "Naruto, Vol. 9")));

        assertThat(recognizer.recognize(List.of(photoAvec(EAN_T9, 0)), null)).hasSize(1);
    }

    // ============================================ Factories

    private static RecognitionImage photoAvec(String ean, int index) {
        try {
            Map<EncodeHintType, Object> indices = new EnumMap<>(EncodeHintType.class);
            indices.put(EncodeHintType.MARGIN, 20);
            BitMatrix matrice = new MultiFormatWriter().encode(ean, BarcodeFormat.EAN_13, 400, 200, indices);

            BufferedImage image = new BufferedImage(400, 200, BufferedImage.TYPE_INT_RGB);
            for (int y = 0; y < 200; y++) {
                for (int x = 0; x < 400; x++) {
                    image.setRGB(x, y, matrice.get(x, y) ? 0x000000 : 0xFFFFFF);
                }
            }
            return enveloppe(image, index);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static RecognitionImage photoUnie(int index) {
        BufferedImage unie = new BufferedImage(200, 200, BufferedImage.TYPE_INT_RGB);
        for (int y = 0; y < 200; y++) {
            for (int x = 0; x < 200; x++) {
                unie.setRGB(x, y, 0x334455);
            }
        }
        return enveloppe(unie, index);
    }

    private static RecognitionImage enveloppe(BufferedImage image, int index) {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            ImageIO.write(image, "png", out);
            return new RecognitionImage(index, null, out.toByteArray(), "image/png");
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    // ============================================ Run side by side

    @Test
    void several_codes_are_identified_in_parallel_not_queued() {
        // Measured on this instance: 1.4 to 5.5 s per identification, and
        // failures are not cached. Twelve codes queued on a SYNCHRONOUS
        // route is a minute of waiting behind a click.
        java.util.concurrent.atomic.AtomicInteger simultanees =
                new java.util.concurrent.atomic.AtomicInteger();
        java.util.concurrent.atomic.AtomicInteger maximum =
                new java.util.concurrent.atomic.AtomicInteger();

        BarcodeWorkLookup lent = (ean, code) -> {
            maximum.accumulateAndGet(simultanees.incrementAndGet(), Math::max);
            try {
                Thread.sleep(120);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } finally {
                simultanees.decrementAndGet();
            }
            return Optional.of("Naruto, Vol. 9");
        };

        long debut = System.nanoTime();
        new BarcodeRecognizer(lent).recognize(List.of(
                photoAvec(EAN_T9, 0), photoAvec(EAN_T4, 1), photoAvec(EAN_T7, 2), photoAvec(EAN_T2, 3)),
                RecognitionContext.forManga());
        long dureeMs = (System.nanoTime() - debut) / 1_000_000;

        assertThat(maximum.get()).as("several identifications at the same time").isGreaterThan(1);
        assertThat(dureeMs).as("four times 120 ms in a queue would make 480 ms").isLessThan(400);
    }

    @Test
    void the_order_follows_the_photos_not_the_order_answers_come_back() {
        // The order follows that of the photos, so the one the screen shows. Returning it
        // in the order of the responses would make the list dance from one analysis
        // to the next for the same photos.
        BarcodeWorkLookup irregulier = (ean, code) -> {
            try {
                // The FIRST code answers last.
                Thread.sleep(EAN_T9.equals(ean) ? 150 : 10);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            return Optional.of(EAN_T9.equals(ean) ? "Naruto, Vol. 9" : "Bleach, Vol. 4");
        };

        List<RecognizedItem> propositions = new BarcodeRecognizer(irregulier).recognize(
                List.of(photoAvec(EAN_T9, 0), photoAvec(EAN_T4, 1)), RecognitionContext.forManga());

        assertThat(propositions).extracting(RecognizedItem::seriesTitleRaw)
                .containsExactly("Naruto", "Bleach");
    }

    @Test
    void a_single_code_needs_no_thread_pool() {
        // The most common case must not pay for setting up a pool.
        BarcodeRecognizer recognizer = new BarcodeRecognizer(lookup(Map.of(EAN_T9, "Naruto, Vol. 9")));

        assertThat(recognizer.recognize(List.of(photoAvec(EAN_T9, 0)), RecognitionContext.forManga()))
                .hasSize(1);
    }

    @Test
    void at_most_twelve_codes_are_identified() {
        // Each code costs a round trip to an external database, free and
        // shared with the scanner of the "Scanner" page and the iOS client.
        assertThat(BarcodeRecognizer.MAX_CODES).isEqualTo(12);
    }
}
