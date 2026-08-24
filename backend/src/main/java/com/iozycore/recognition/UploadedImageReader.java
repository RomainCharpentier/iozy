package com.iozycore.recognition;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * Les photos envoyées par l'utilisateur, transformées en octets analysables.
 *
 * <h2>Pourquoi cette seconde porte existe</h2>
 * La reconnaissance visuelle n'avait qu'une entrée : des URLs récupérées d'une
 * annonce, sur des hôtes en liste blanche. Trois situations restaient donc
 * hors de portée, alors que le moteur savait parfaitement les traiter :
 * <ul>
 *   <li>une plateforme qui <b>refuse</b> la lecture automatique — Leboncoin
 *       protège ses pages, ses photos sont donc inatteignables ;</li>
 *   <li>une annonce du genre « <i>mangas en tout genre</i> », dont le texte ne
 *       nomme aucune série : les photos sont la <b>seule</b> source ;</li>
 *   <li>une étagère photographiée chez soi, qui n'est l'annonce de personne.</li>
 * </ul>
 * Dans les trois cas, l'utilisateur a les images sous les yeux. Il lui manquait
 * seulement le moyen de les donner.
 *
 * <h2>Aucune requête sortante, par construction</h2>
 * Cette classe ne connaît ni {@code HttpClient}, ni URL, ni liste blanche —
 * elle lit un flux déjà reçu. Il n'existe donc <b>aucune</b> adresse qu'un
 * appelant pourrait faire joindre au serveur : la question du SSRF ne se pose
 * pas ici, elle est absente. C'est aussi pourquoi cette porte est plus simple
 * que {@link RecognitionImageFetcher}, pas plus risquée.
 *
 * <h2>Ce qui remplace la liste blanche</h2>
 * Les mêmes bornes exactement — huit images, 3 Mo chacune, 12 Mo cumulés
 * ({@link RecognitionImageLimits}) — plus une vérification que le fetcher n'a
 * pas à faire : le type MIME est <b>constaté sur les octets</b>, jamais lu dans
 * l'en-tête déclaré par le client.
 *
 * <h2>Les octets ne sont jamais journalisés</h2>
 * Ni le contenu, ni le nom du fichier : celui-ci vient du téléphone de
 * l'utilisateur et porte parfois plus qu'il n'y paraît.
 */
@Component
public class UploadedImageReader {

    private static final Logger log = LoggerFactory.getLogger(UploadedImageReader.class);

    /** Ce qui a été retenu, et ce qui a été écarté — l'écran doit pouvoir le dire. */
    public record Intake(List<RecognitionImage> images, int rejectedCount) {

        public Intake {
            images = images == null ? List.of() : List.copyOf(images);
        }
    }

    /**
     * @param fichiers les parties reçues ; {@code null}, vide et parties vides
     *                 sont tolérés et simplement ignorés
     * @return les images retenues, dans l'ordre d'envoi, avec leur index
     *         d'affichage — <b>jamais d'exception</b> : une photo refusée est
     *         une photo en moins, pas un parcours cassé
     */
    public Intake read(List<MultipartFile> fichiers) {
        if (fichiers == null || fichiers.isEmpty()) {
            return new Intake(List.of(), 0);
        }

        List<RecognitionImage> retenues = new ArrayList<>();
        int cumule = 0;
        int index = 0;
        int refusees = 0;

        for (MultipartFile fichier : fichiers) {
            if (retenues.size() >= RecognitionImageLimits.MAX_IMAGES
                    || cumule >= RecognitionImageLimits.MAX_TOTAL_BYTES) {
                // Le surplus est écarté, mais compté : le contrôleur refuse déjà
                // au-delà de MAX_IMAGES, donc n'arriver ici que par le plafond
                // cumulé doit rester visible.
                refusees++;
                continue;
            }
            if (fichier == null || fichier.isEmpty()) {
                continue;
            }

            int positionAffichee = index++;
            int plafond = Math.min(RecognitionImageLimits.MAX_BYTES_PER_IMAGE,
                    RecognitionImageLimits.MAX_TOTAL_BYTES - cumule);

            byte[] octets;
            try {
                octets = lireBorne(fichier, plafond);
            } catch (IOException e) {
                // Un envoi interrompu est une photo en moins.
                log.info("Photo envoyée illisible : {}", e.getClass().getSimpleName());
                refusees++;
                continue;
            }

            // Le type est CONSTATÉ, pas cru sur parole : fichier.getContentType()
            // n'est qu'une chaîne écrite par le client.
            String mediaType = RecognitionImageLimits.sniff(octets);
            if (mediaType == null) {
                log.info("Photo envoyée écartée : ces octets ne sont pas une image JPEG, PNG ou WebP");
                refusees++;
                continue;
            }

            // sourceUrl null : cette photo ne vient d'aucune adresse, et lui en
            // inventer une ferait croire qu'on pourrait y retourner.
            retenues.add(new RecognitionImage(positionAffichee, null, octets, mediaType));
            cumule += octets.length;
        }
        return new Intake(retenues, refusees);
    }

    /**
     * Lecture bornée : on s'arrête au plafond plutôt que de charger puis mesurer.
     *
     * <p>Un fichier plus gros que le plafond est <b>tronqué</b>, comme côté
     * fetcher. Une image tronquée que le moteur ne saura pas lire vaut mieux
     * qu'un refus sec : le reste du lot passe quand même.
     */
    private static byte[] lireBorne(MultipartFile fichier, int plafond) throws IOException {
        try (InputStream stream = fichier.getInputStream();
             java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream()) {
            byte[] tampon = new byte[8192];
            int total = 0;
            int lus;
            while (total < plafond && (lus = stream.read(tampon)) != -1) {
                int garder = Math.min(lus, plafond - total);
                out.write(tampon, 0, garder);
                total += garder;
            }
            return out.toByteArray();
        }
    }
}
