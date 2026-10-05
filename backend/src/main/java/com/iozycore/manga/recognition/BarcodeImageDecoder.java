package com.iozycore.manga.recognition;

import com.google.zxing.BinaryBitmap;
import com.google.zxing.DecodeHintType;
import com.google.zxing.LuminanceSource;
import com.google.zxing.NotFoundException;
import com.google.zxing.Result;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.common.HybridBinarizer;
import com.google.zxing.multi.GenericMultipleBarcodeReader;
import com.google.zxing.oned.MultiFormatOneDReader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Reads the barcodes found on a photo - <b>locally, without calling
 * anything</b>.
 *
 * <h2>The missing producer</h2>
 * {@link RecognitionSource#EAN} has existed since V2, with its highest priority
 * and its tested arbitration rules. But <b>nothing fed it</b>:
 * only the vision engine could read digits, that is, guess with a
 * model a piece of information printed to be read by a machine. This class is
 * the independent producer that was missing.
 *
 * <h2>Why it is the best of the three sources</h2>
 * An EAN is not a probable reading, it is an <b>exact identifier</b> -
 * with its check digit, which rejects approximate readings by itself.
 * Where the text announces what the seller <i>says</i> and where vision proposes
 * what a model <i>thinks</i> it sees, the barcode designates a precise print run.
 *
 * <h2>Free, deterministic, and without AI</h2>
 * No network, no model, no euro, no noticeable second of waiting.
 * This is what lets recognition return something useful even
 * when <b>no vision engine is configured</b> - the principle "AI
 * is never mandatory" stops here being an intention and becomes a
 * behaviour.
 *
 * <h2>What is searched, and what is not</h2>
 * Only the 1D formats of books: EAN-13 (which includes all
 * ISBN-13), EAN-8 and UPC-A. No QR code - on a listing photo, a QR
 * leads to a merchant page, never to a work. Searching for all of them would cost
 * time for noise.
 */
public final class BarcodeImageDecoder {

    private static final Logger log = LoggerFactory.getLogger(BarcodeImageDecoder.class);

    /**
     * Several codes per photo: a pile of mangas seen from the back shows as many
     * as there are volumes, and this is precisely the most useful photo of a batch.
     */
    private static final int MAX_CODES_PAR_IMAGE = 12;

    private static final Map<DecodeHintType, Object> INDICES = new EnumMap<>(DecodeHintType.class);

    static {
        INDICES.put(DecodeHintType.POSSIBLE_FORMATS,
                List.of(BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A));
        // A listing photo is taken by hand, at an angle, under whatever
        // light: without this extra effort, one code out of two is
        // missed. The extra cost is counted in tens of milliseconds.
        INDICES.put(DecodeHintType.TRY_HARDER, Boolean.TRUE);
    }

    private BarcodeImageDecoder() {
    }

    /**
     * The codes read on this image, in the order they were found, without
     * duplicates.
     *
     * <p><b>Never throws</b>: a blurry photo, an exotic image format or
     * a decoder that stumbles return an empty list. An unreadable barcode
     * is one barcode less, never a broken flow - the other
     * sources are still there.
     */
    public static List<String> decode(RecognitionImage image) {
        if (image == null) {
            return List.of();
        }
        BufferedImage rendue = lire(image);
        if (rendue == null) {
            return List.of();
        }

        Set<String> codes = new LinkedHashSet<>();
        LuminanceSource source = new LuminanceSourceDeBufferedImage(rendue);

        // Two passes: upright, then rotated by a quarter turn. On a
        // manga spine the code is printed vertically, and the 1D decoder
        // scans by horizontal lines - without the rotation it sees nothing.
        chercher(source, codes);
        if (codes.size() < MAX_CODES_PAR_IMAGE && source.isRotateSupported()) {
            chercher(source.rotateCounterClockwise(), codes);
        }
        return List.copyOf(codes);
    }

    /** The codes of all the images, without duplicates from one photo to the other. */
    public static List<String> decodeAll(List<RecognitionImage> images) {
        if (images == null || images.isEmpty()) {
            return List.of();
        }
        Set<String> codes = new LinkedHashSet<>();
        for (RecognitionImage image : images) {
            // The same volume photographed twice does not make two volumes:
            // the deduplication happens here, not afterwards in the count.
            codes.addAll(decode(image));
        }
        return List.copyOf(codes);
    }

    private static void chercher(LuminanceSource source, Set<String> codes) {
        try {
            BinaryBitmap bitmap = new BinaryBitmap(new HybridBinarizer(source));
            // GenericMultipleBarcodeReader cuts the image and re-reads each
            // quadrant: this is what lets it find SEVERAL codes where
            // a simple reader stops at the first one.
            Result[] resultats = new GenericMultipleBarcodeReader(new MultiFormatOneDReader(INDICES))
                    .decodeMultiple(bitmap, INDICES);
            for (Result resultat : resultats) {
                String code = resultat.getText();
                if (code != null && !code.isBlank()) {
                    codes.add(code.trim());
                }
                if (codes.size() >= MAX_CODES_PAR_IMAGE) {
                    return;
                }
            }
        } catch (NotFoundException e) {
            // No code on this image: the most common case, not an error.
        } catch (RuntimeException e) {
            // The decoder stumbles on some degenerate images. One photo
            // less is better than an interrupted analysis.
            log.debug("Barcode decoding abandoned: {}", e.getClass().getSimpleName());
        }
    }

    /** Never logs the bytes: these are someone's photos. */
    private static BufferedImage lire(RecognitionImage image) {
        try {
            return ImageIO.read(new ByteArrayInputStream(image.bytes()));
        } catch (Exception e) {
            log.debug("Image cannot be decoded into pixels: {}", e.getClass().getSimpleName());
            return null;
        }
    }

    /**
     * The luminance of a {@link BufferedImage}, in grey levels.
     *
     * <p>Written here rather than borrowed from {@code zxing:javase}: this class is
     * the only thing this module would bring, and it is worth less than its two
     * transitive dependencies.
     *
     * <p>The luminance formula is the classic weighting (0.299 R + 0.587
     * G + 0.114 B): the eye - and therefore printing - treats green as much
     * brighter than blue. An arithmetic mean would erase
     * contrasts which, on a coloured cover, separate the bars from the background.
     */
    private static final class LuminanceSourceDeBufferedImage extends LuminanceSource {

        private final byte[] luminances;

        LuminanceSourceDeBufferedImage(BufferedImage image) {
            this(convertir(image), image.getWidth(), image.getHeight());
        }

        private LuminanceSourceDeBufferedImage(byte[] luminances, int largeur, int hauteur) {
            super(largeur, hauteur);
            this.luminances = luminances;
        }

        private static byte[] convertir(BufferedImage image) {
            int largeur = image.getWidth();
            int hauteur = image.getHeight();
            byte[] gris = new byte[largeur * hauteur];
            int[] ligne = new int[largeur];
            for (int y = 0; y < hauteur; y++) {
                image.getRGB(0, y, largeur, 1, ligne, 0, largeur);
                for (int x = 0; x < largeur; x++) {
                    int pixel = ligne[x];
                    int r = (pixel >> 16) & 0xFF;
                    int v = (pixel >> 8) & 0xFF;
                    int b = pixel & 0xFF;
                    gris[y * largeur + x] = (byte) ((r * 299 + v * 587 + b * 114) / 1000);
                }
            }
            return gris;
        }

        @Override
        public byte[] getRow(int y, byte[] tampon) {
            int largeur = getWidth();
            byte[] cible = tampon != null && tampon.length >= largeur ? tampon : new byte[largeur];
            System.arraycopy(luminances, y * largeur, cible, 0, largeur);
            return cible;
        }

        @Override
        public byte[] getMatrix() {
            return luminances;
        }

        @Override
        public boolean isCropSupported() {
            // GenericMultipleBarcodeReader crops to explore the quadrants:
            // without this support, it would never find more than one code.
            return true;
        }

        @Override
        public LuminanceSource crop(int gauche, int haut, int largeur, int hauteur) {
            byte[] extrait = new byte[largeur * hauteur];
            for (int y = 0; y < hauteur; y++) {
                System.arraycopy(luminances, (haut + y) * getWidth() + gauche,
                        extrait, y * largeur, largeur);
            }
            return new LuminanceSourceDeBufferedImage(extrait, largeur, hauteur);
        }

        @Override
        public boolean isRotateSupported() {
            return true;
        }

        @Override
        public LuminanceSource rotateCounterClockwise() {
            int largeur = getWidth();
            int hauteur = getHeight();
            byte[] pivotees = new byte[luminances.length];
            for (int y = 0; y < hauteur; y++) {
                for (int x = 0; x < largeur; x++) {
                    // (x, y) becomes (y, width - 1 - x): the new image
                    // is as wide as the old height and as tall as the old width.
                    pivotees[(largeur - 1 - x) * hauteur + y] = luminances[y * largeur + x];
                }
            }
            return new LuminanceSourceDeBufferedImage(pivotees, hauteur, largeur);
        }
    }

    /** Exposed for tests: what the decoder agrees to search for. */
    static List<BarcodeFormat> formatsCherches() {
        return new ArrayList<>(List.of(BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A));
    }
}
