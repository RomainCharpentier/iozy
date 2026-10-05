package com.iozycore.manga.recognition;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.MultiFormatWriter;
import com.google.zxing.common.BitMatrix;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Reading barcodes, on <b>real</b> images.
 *
 * <h2>Generated images, never photos</h2>
 * Each test draws its own barcode with the ZXing encoder, then
 * asks the decoder to read it back. No protected cover, no listing
 * photo, nothing downloaded, nothing committed — and a perfectly
 * deterministic test.
 *
 * <p>What this proves: the chain bytes → pixels → luminance → code
 * works, including the grayscale conversion and the rotation
 * written by hand. What it does not prove: the success rate on a
 * hand-held photo, which a handful of images could not
 * measure.
 */
class BarcodeImageDecoderTest {

    /** A valid EAN-13 - check digit included, otherwise the encoder refuses. */
    private static final String EAN_NARUTO_T9 = "9782505011118";
    private static final String EAN_AUTRE = "9782344029572";

    // ============================================ Nominal reading

    @Test
    void reads_an_ean13_from_a_png() {
        RecognitionImage image = imageAvecCode(EAN_NARUTO_T9, "png");

        assertThat(BarcodeImageDecoder.decode(image)).containsExactly(EAN_NARUTO_T9);
    }

    @Test
    void reads_an_ean13_from_a_jpeg_too() {
        // JPEG introduces compression artefacts: it is the format of
        // listing photos, so the real case.
        RecognitionImage image = imageAvecCode(EAN_NARUTO_T9, "jpg");

        assertThat(BarcodeImageDecoder.decode(image)).containsExactly(EAN_NARUTO_T9);
    }

    @Test
    void reads_a_barcode_printed_vertically() {
        // On the spine of a manga the code is printed vertically, and a
        // 1D decoder sweeps along horizontal lines: without the rotated pass,
        // it would see nothing at all.
        RecognitionImage image = pivotee(imageAvecCode(EAN_NARUTO_T9, "png"));

        assertThat(BarcodeImageDecoder.decode(image)).containsExactly(EAN_NARUTO_T9);
    }

    @Test
    void reads_several_barcodes_from_a_single_photo() {
        // The most useful photo of a batch: a stack seen from behind, one code per
        // volume. Stopping at the first one would lose all the rest.
        RecognitionImage image = imageAvecDeuxCodes(EAN_NARUTO_T9, EAN_AUTRE);

        assertThat(BarcodeImageDecoder.decode(image))
                .containsExactlyInAnyOrder(EAN_NARUTO_T9, EAN_AUTRE);
    }

    // ============================================ Robustness

    @Test
    void a_photo_without_any_barcode_yields_nothing_rather_than_failing() {
        RecognitionImage image = imageUnie();

        assertThat(BarcodeImageDecoder.decode(image)).isEmpty();
    }

    @Test
    void bytes_that_are_not_an_image_yield_nothing_rather_than_throwing() {
        // The upstream image reader already validates the MIME type on the bytes,
        // but a decoder that throws would bring down the whole analysis - for a
        // single photo.
        RecognitionImage image = new RecognitionImage(0, null,
                "pas une image".getBytes(StandardCharsets.UTF_8), "image/png");

        assertThat(BarcodeImageDecoder.decode(image)).isEmpty();
    }

    @Test
    void a_null_image_is_tolerated() {
        assertThat(BarcodeImageDecoder.decode(null)).isEmpty();
        assertThat(BarcodeImageDecoder.decodeAll(null)).isEmpty();
        assertThat(BarcodeImageDecoder.decodeAll(List.of())).isEmpty();
    }

    // ============================================ On several photos

    @Test
    void the_same_volume_photographed_twice_is_not_two_volumes() {
        RecognitionImage premiere = imageAvecCode(EAN_NARUTO_T9, "png");
        RecognitionImage seconde = imageAvecCode(EAN_NARUTO_T9, "jpg");

        assertThat(BarcodeImageDecoder.decodeAll(List.of(premiere, seconde)))
                .containsExactly(EAN_NARUTO_T9);
    }

    @Test
    void codes_from_different_photos_are_all_collected() {
        assertThat(BarcodeImageDecoder.decodeAll(List.of(
                imageAvecCode(EAN_NARUTO_T9, "png"),
                imageUnie(),
                imageAvecCode(EAN_AUTRE, "png"))))
                .containsExactly(EAN_NARUTO_T9, EAN_AUTRE);
    }

    @Test
    void only_book_barcode_formats_are_searched() {
        // No QR code: on a listing photo, a QR leads to a shop
        // page, never to a work.
        assertThat(BarcodeImageDecoder.formatsCherches())
                .containsExactlyInAnyOrder(BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A);
    }

    // ============================================ Image factories

    private static RecognitionImage imageAvecCode(String ean, String format) {
        return enveloppe(dessiner(ean, 400, 200), format);
    }

    /** Two codes side by side, like two neighbouring spines on a shelf. */
    private static RecognitionImage imageAvecDeuxCodes(String premier, String second) {
        BufferedImage gauche = dessiner(premier, 400, 260);
        BufferedImage droite = dessiner(second, 400, 260);

        BufferedImage assemblee = new BufferedImage(880, 300, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = assemblee.createGraphics();
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, 880, 300);
        g.drawImage(gauche, 20, 20, null);
        g.drawImage(droite, 460, 20, null);
        g.dispose();
        return enveloppe(assemblee, "png");
    }

    private static RecognitionImage imageUnie() {
        BufferedImage unie = new BufferedImage(300, 300, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = unie.createGraphics();
        g.setColor(new Color(0x33, 0x44, 0x55));
        g.fillRect(0, 0, 300, 300);
        g.dispose();
        return enveloppe(unie, "png");
    }

    private static RecognitionImage pivotee(RecognitionImage source) {
        BufferedImage origine = lire(source);
        BufferedImage cible = new BufferedImage(origine.getHeight(), origine.getWidth(),
                BufferedImage.TYPE_INT_RGB);
        for (int y = 0; y < origine.getHeight(); y++) {
            for (int x = 0; x < origine.getWidth(); x++) {
                cible.setRGB(y, origine.getWidth() - 1 - x, origine.getRGB(x, y));
            }
        }
        return enveloppe(cible, "png");
    }

    private static BufferedImage dessiner(String ean, int largeur, int hauteur) {
        try {
            Map<EncodeHintType, Object> indices = new EnumMap<>(EncodeHintType.class);
            indices.put(EncodeHintType.MARGIN, 20);
            BitMatrix matrice = new MultiFormatWriter()
                    .encode(ean, BarcodeFormat.EAN_13, largeur, hauteur, indices);

            BufferedImage image = new BufferedImage(largeur, hauteur, BufferedImage.TYPE_INT_RGB);
            for (int y = 0; y < hauteur; y++) {
                for (int x = 0; x < largeur; x++) {
                    image.setRGB(x, y, matrice.get(x, y) ? 0x000000 : 0xFFFFFF);
                }
            }
            return image;
        } catch (Exception e) {
            throw new IllegalStateException("Impossible de dessiner le code-barres de test", e);
        }
    }

    private static RecognitionImage enveloppe(BufferedImage image, String format) {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            ImageIO.write(image, format, out);
            return new RecognitionImage(0, null, out.toByteArray(),
                    "jpg".equals(format) ? "image/jpeg" : "image/png");
        } catch (Exception e) {
            throw new IllegalStateException("Impossible d'encoder l'image de test", e);
        }
    }

    private static BufferedImage lire(RecognitionImage image) {
        try {
            return ImageIO.read(new java.io.ByteArrayInputStream(image.bytes()));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
