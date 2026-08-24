package com.iozycore.recognition;

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
 * Du code-barres lu à la proposition à confirmer.
 *
 * <p>La résolution EAN → titre est <b>simulée</b> : c'est la seule étape de la
 * chaîne qui sortirait sur le réseau, et un test qui interrogerait vraiment
 * Google Books mesurerait la disponibilité d'un tiers, pas le comportement de
 * ce code. Le décodage, lui, est bien réel — les images sont dessinées puis
 * relues.
 */
class BarcodeRecognizerTest {

    private static final String EAN_T9 = "9782505011118";
    private static final String EAN_T4 = "9782344029572";
    private static final String EAN_T7 = "9782505078180";
    private static final String EAN_T2 = "9782820343819";

    /** Ce qu'une base bibliographique rend : un titre libre, pas un tome structuré. */
    private static BarcodeWorkLookup lookup(Map<String, String> titresParCode) {
        return (ean, entityTypeCode) -> Optional.ofNullable(titresParCode.get(ean));
    }

    // ============================================ La chaîne complète

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
        // Le point qui distingue cette source des deux autres : ce n'est pas une
        // lecture probable, c'est un identifiant qui correspond ou ne correspond pas.
        assertThat(item.hasExactIdentifier()).isTrue();
        assertThat(item.ean()).isEqualTo(EAN_T9);
        assertThat(item.sources()).containsExactly(RecognitionSource.EAN);
        assertThat(item.confidence()).isEqualTo(RecognitionConfidence.HIGH);
    }

    @Test
    void the_title_is_read_by_the_SAME_rules_as_a_listing_title() {
        // « Naruto, Vol. 9 » et « Naruto tome 9 » posent le même problème de
        // lecture. Une seconde extraction écrite ici aurait fini par diverger.
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

        // L'écran doit pouvoir dire « vu sur la photo 4 », comme pour la vision.
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

    // ============================================ Se taire plutôt que broder

    @Test
    void a_code_no_database_knows_produces_nothing() {
        // Pas de ligne « EAN 9782505011118 » à l'écran : elle n'apprendrait
        // rien, et donnerait l'illusion d'un tome identifié.
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
        // « Naruto tomes 1 à 3 » désigne un coffret, pas un tome. Choisir un
        // numéro au hasard parmi trois serait pire que n'en donner aucun.
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
        // Le décodage est local et gratuit ; l'identification ne l'est pas. Une
        // photo sans code ne doit déclencher aucun aller-retour.
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

    // ============================================ Fabriques

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

    // ============================================ Menees de front

    @Test
    void several_codes_are_identified_in_parallel_not_queued() {
        // Mesure sur cette instance : 1,4 a 5,5 s par identification, et les
        // echecs ne sont pas mis en cache. Douze codes en file sur une route
        // SYNCHRONE, c'est une minute d'attente derriere un clic.
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

        assertThat(maximum.get()).as("plusieurs identifications de front").isGreaterThan(1);
        assertThat(dureeMs).as("quatre fois 120 ms en file feraient 480 ms").isLessThan(400);
    }

    @Test
    void the_order_follows_the_photos_not_the_order_answers_come_back() {
        // L'ordre suit celui des photos, donc celui que l'ecran affiche. Le
        // rendre au gre des reponses ferait danser la liste d'une analyse a
        // l'autre pour les memes photos.
        BarcodeWorkLookup irregulier = (ean, code) -> {
            try {
                // Le PREMIER code repond en dernier.
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
        // Le cas le plus courant ne doit pas payer la mise en place d'un pool.
        BarcodeRecognizer recognizer = new BarcodeRecognizer(lookup(Map.of(EAN_T9, "Naruto, Vol. 9")));

        assertThat(recognizer.recognize(List.of(photoAvec(EAN_T9, 0)), RecognitionContext.forManga()))
                .hasSize(1);
    }

    @Test
    void at_most_twelve_codes_are_identified() {
        // Chaque code coute un aller-retour vers une base externe, gratuite et
        // partagee avec le scanner de la page « Scanner » et le client iOS.
        assertThat(BarcodeRecognizer.MAX_CODES).isEqualTo(12);
    }
}
