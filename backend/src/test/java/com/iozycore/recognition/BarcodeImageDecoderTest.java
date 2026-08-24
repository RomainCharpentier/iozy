package com.iozycore.recognition;

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
 * La lecture des codes-barres, sur de <b>vraies</b> images.
 *
 * <h2>Des images générées, jamais des photos</h2>
 * Chaque test dessine son propre code-barres avec l'encodeur de ZXing, puis
 * demande au décodeur de le relire. Aucune couverture protégée, aucune photo
 * d'annonce, rien de téléchargé, rien de commité — et un test parfaitement
 * déterministe.
 *
 * <p>Ce que cela prouve : la chaîne octets → pixels → luminance → code
 * fonctionne, y compris la conversion en niveaux de gris et la rotation
 * écrites à la main. Ce que cela ne prouve pas : le taux de réussite sur une
 * photo prise à main levée, qu'une poignée d'images ne permettrait pas de
 * mesurer.
 */
class BarcodeImageDecoderTest {

    /** Un EAN-13 valide - clé de contrôle comprise, sinon l'encodeur refuse. */
    private static final String EAN_NARUTO_T9 = "9782505011118";
    private static final String EAN_AUTRE = "9782344029572";

    // ============================================ Lecture nominale

    @Test
    void reads_an_ean13_from_a_png() {
        RecognitionImage image = imageAvecCode(EAN_NARUTO_T9, "png");

        assertThat(BarcodeImageDecoder.decode(image)).containsExactly(EAN_NARUTO_T9);
    }

    @Test
    void reads_an_ean13_from_a_jpeg_too() {
        // Le JPEG introduit des artefacts de compression : c'est le format des
        // photos d'annonce, donc le cas réel.
        RecognitionImage image = imageAvecCode(EAN_NARUTO_T9, "jpg");

        assertThat(BarcodeImageDecoder.decode(image)).containsExactly(EAN_NARUTO_T9);
    }

    @Test
    void reads_a_barcode_printed_vertically() {
        // Sur une tranche de manga le code est imprimé verticalement, et un
        // décodeur 1D balaie par lignes horizontales : sans la passe pivotée,
        // il ne verrait rien du tout.
        RecognitionImage image = pivotee(imageAvecCode(EAN_NARUTO_T9, "png"));

        assertThat(BarcodeImageDecoder.decode(image)).containsExactly(EAN_NARUTO_T9);
    }

    @Test
    void reads_several_barcodes_from_a_single_photo() {
        // La photo la plus utile d'un lot : une pile vue de dos, un code par
        // tome. S'arrêter au premier ferait perdre tout le reste.
        RecognitionImage image = imageAvecDeuxCodes(EAN_NARUTO_T9, EAN_AUTRE);

        assertThat(BarcodeImageDecoder.decode(image))
                .containsExactlyInAnyOrder(EAN_NARUTO_T9, EAN_AUTRE);
    }

    // ============================================ Robustesse

    @Test
    void a_photo_without_any_barcode_yields_nothing_rather_than_failing() {
        RecognitionImage image = imageUnie();

        assertThat(BarcodeImageDecoder.decode(image)).isEmpty();
    }

    @Test
    void bytes_that_are_not_an_image_yield_nothing_rather_than_throwing() {
        // Le lecteur d'images en amont valide déjà le type MIME sur les octets,
        // mais un décodeur qui lève ferait tomber toute l'analyse - pour une
        // seule photo.
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

    // ============================================ Sur plusieurs photos

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
        // Pas de QR code : sur une photo d'annonce, un QR mène à une page
        // marchande, jamais à une œuvre.
        assertThat(BarcodeImageDecoder.formatsCherches())
                .containsExactlyInAnyOrder(BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A);
    }

    // ============================================ Fabriques d'images

    private static RecognitionImage imageAvecCode(String ean, String format) {
        return enveloppe(dessiner(ean, 400, 200), format);
    }

    /** Deux codes côte à côte, comme deux tranches voisines sur une étagère. */
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
