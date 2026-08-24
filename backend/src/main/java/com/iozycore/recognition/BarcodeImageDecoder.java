package com.iozycore.recognition;

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
 * Lit les codes-barres présents sur une photo — <b>en local, sans rien
 * appeler</b>.
 *
 * <h2>Le producteur qui manquait</h2>
 * {@link RecognitionSource#EAN} existait depuis la V2, avec sa priorité la plus
 * haute et ses règles d'arbitrage testées. Mais <b>rien ne l'alimentait</b> :
 * seul le moteur de vision pouvait lire des chiffres, c'est-à-dire deviner par
 * modèle une information imprimée pour être lue par machine. Cette classe est
 * le producteur indépendant qui manquait.
 *
 * <h2>Pourquoi c'est la meilleure des trois sources</h2>
 * Un EAN n'est pas une lecture probable, c'est un <b>identifiant exact</b> —
 * avec sa clé de contrôle, qui rejette d'elle-même les lectures approximatives.
 * Là où le texte annonce ce que le vendeur <i>dit</i> et où la vision propose
 * ce qu'un modèle <i>croit</i> voir, le code-barres désigne un tirage précis.
 *
 * <h2>Gratuit, déterministe, et sans IA</h2>
 * Aucun réseau, aucun modèle, aucun euro, aucune seconde d'attente notable.
 * C'est ce qui permet à la reconnaissance de rendre quelque chose d'utile même
 * quand <b>aucun moteur de vision n'est configuré</b> — le principe « l'IA
 * n'est jamais obligatoire » cesse ici d'être une intention pour devenir un
 * comportement.
 *
 * <h2>Ce qui est cherché, et ce qui ne l'est pas</h2>
 * Uniquement les formats 1D des livres : EAN-13 (dont relèvent tous les
 * ISBN-13), EAN-8 et UPC-A. Pas de QR code — sur une photo d'annonce, un QR
 * mène à une page marchande, jamais à une œuvre. Les chercher tous coûterait du
 * temps pour du bruit.
 */
public final class BarcodeImageDecoder {

    private static final Logger log = LoggerFactory.getLogger(BarcodeImageDecoder.class);

    /**
     * Plusieurs codes par photo : une pile de mangas de dos en montre autant
     * que de tomes, et c'est justement la photo la plus utile d'un lot.
     */
    private static final int MAX_CODES_PAR_IMAGE = 12;

    private static final Map<DecodeHintType, Object> INDICES = new EnumMap<>(DecodeHintType.class);

    static {
        INDICES.put(DecodeHintType.POSSIBLE_FORMATS,
                List.of(BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A));
        // Une photo d'annonce est prise à main levée, de biais, sous une lumière
        // quelconque : sans cet effort supplémentaire, un code sur deux passe à
        // côté. Le surcoût se compte en dizaines de millisecondes.
        INDICES.put(DecodeHintType.TRY_HARDER, Boolean.TRUE);
    }

    private BarcodeImageDecoder() {
    }

    /**
     * Les codes lus sur cette image, dans l'ordre où ils ont été trouvés, sans
     * doublon.
     *
     * <p><b>Ne lève jamais</b> : une photo floue, un format d'image exotique ou
     * un décodeur qui trébuche rendent une liste vide. Un code-barres illisible
     * est un code-barres en moins, jamais un parcours cassé — les autres
     * sources restent là.
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

        // Deux passes : à l'endroit, puis pivotée d'un quart de tour. Sur une
        // tranche de manga le code est imprimé verticalement, et le décodeur 1D
        // balaie par lignes horizontales - sans la rotation il ne voit rien.
        chercher(source, codes);
        if (codes.size() < MAX_CODES_PAR_IMAGE && source.isRotateSupported()) {
            chercher(source.rotateCounterClockwise(), codes);
        }
        return List.copyOf(codes);
    }

    /** Les codes de toutes les images, sans doublon d'une photo à l'autre. */
    public static List<String> decodeAll(List<RecognitionImage> images) {
        if (images == null || images.isEmpty()) {
            return List.of();
        }
        Set<String> codes = new LinkedHashSet<>();
        for (RecognitionImage image : images) {
            // Le même tome photographié deux fois ne fait pas deux tomes :
            // la déduplication a lieu ici, pas après coup dans le décompte.
            codes.addAll(decode(image));
        }
        return List.copyOf(codes);
    }

    private static void chercher(LuminanceSource source, Set<String> codes) {
        try {
            BinaryBitmap bitmap = new BinaryBitmap(new HybridBinarizer(source));
            // GenericMultipleBarcodeReader découpe l'image et relit chaque
            // quadrant : c'est lui qui permet de trouver PLUSIEURS codes là où
            // un lecteur simple s'arrête au premier.
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
            // Aucun code sur cette image : le cas le plus courant, pas une erreur.
        } catch (RuntimeException e) {
            // Le décodeur trébuche sur certaines images dégénérées. Une photo
            // en moins vaut mieux qu'une analyse interrompue.
            log.debug("Décodage de code-barres abandonné : {}", e.getClass().getSimpleName());
        }
    }

    /** Ne journalise jamais les octets : ce sont les photos de quelqu'un. */
    private static BufferedImage lire(RecognitionImage image) {
        try {
            return ImageIO.read(new ByteArrayInputStream(image.bytes()));
        } catch (Exception e) {
            log.debug("Image non décodable en pixels : {}", e.getClass().getSimpleName());
            return null;
        }
    }

    /**
     * La luminance d'un {@link BufferedImage}, en niveaux de gris.
     *
     * <p>Écrit ici plutôt qu'emprunté à {@code zxing:javase} : cette classe est
     * la seule chose que ce module apporterait, et elle vaut moins que ses deux
     * dépendances transitives.
     *
     * <p>La formule de luminance est la pondération classique (0,299 R + 0,587
     * V + 0,114 B) : l'œil - et donc l'impression - traite le vert comme bien
     * plus lumineux que le bleu. Une moyenne arithmétique effacerait des
     * contrastes qui, sur une couverture colorée, séparent les barres du fond.
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
            // GenericMultipleBarcodeReader recadre pour explorer les quadrants :
            // sans ce support, il ne trouverait jamais qu'un seul code.
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
                    // (x, y) devient (y, largeur - 1 - x) : la nouvelle image
                    // fait hauteur de large et largeur de haut.
                    pivotees[(largeur - 1 - x) * hauteur + y] = luminances[y * largeur + x];
                }
            }
            return new LuminanceSourceDeBufferedImage(pivotees, hauteur, largeur);
        }
    }

    /** Exposé pour les tests : ce que le décodeur accepte de chercher. */
    static List<BarcodeFormat> formatsCherches() {
        return new ArrayList<>(List.of(BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A));
    }
}
