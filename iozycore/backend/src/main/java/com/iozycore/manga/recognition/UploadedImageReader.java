package com.iozycore.manga.recognition;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * The photos sent by the user, turned into analysable bytes.
 *
 * <h2>Why this second door exists</h2>
 * Visual recognition had only one entry: URLs fetched from a
 * listing, on whitelisted hosts. Three situations therefore stayed
 * out of reach, although the engine could handle them perfectly:
 * <ul>
 *   <li>a platform that <b>refuses</b> automatic reading - Leboncoin
 *       protects its pages, so its photos are unreachable;</li>
 *   <li>a listing of the kind "<i>mangas en tout genre</i>", whose text names
 *       no series: the photos are the <b>only</b> source;</li>
 *   <li>a shelf photographed at home, which is nobody's listing.</li>
 * </ul>
 * In all three cases, the user has the images in front of them. What was missing
 * was only the way to give them.
 *
 * <h2>No outgoing request, by construction</h2>
 * This class knows no {@code HttpClient}, no URL, no whitelist -
 * it reads a stream that was already received. There is therefore <b>no</b> address that a
 * caller could make the server reach: the question of SSRF does not arise
 * here, it is absent. This is also why this door is simpler
 * than {@link RecognitionImageFetcher}, not riskier.
 *
 * <h2>What replaces the whitelist</h2>
 * Exactly the same limits - eight images, 3 MB each, 12 MB cumulated
 * ({@link RecognitionImageLimits}) - plus a check that the fetcher does not
 * have to do: the MIME type is <b>observed on the bytes</b>, never read from the
 * header declared by the client.
 *
 * <h2>The bytes are never logged</h2>
 * Neither the content nor the file name: the latter comes from the phone of
 * the user and sometimes carries more than it seems.
 */
@Component
@Slf4j
public class UploadedImageReader {

    /** What was kept, and what was dropped - the screen must be able to say it. */
    public record Intake(List<RecognitionImage> images, int rejectedCount) {

        public Intake {
            images = images == null ? List.of() : List.copyOf(images);
        }
    }

    /**
     * @param fichiers the parts received; {@code null}, empty and empty parts
     *                 are tolerated and simply ignored
     * @return the images kept, in the order sent, with their display
     *         index - <b>never an exception</b>: a refused photo is
     *         one photo less, not a broken flow
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
                // The surplus is dropped, but counted: the controller already refuses
                // beyond MAX_IMAGES, so arriving here only through the cumulated
                // ceiling must stay visible.
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
                // An interrupted upload is one photo less.
                log.info("Uploaded photo unreadable: {}", e.getClass().getSimpleName());
                refusees++;
                continue;
            }

            // The type is OBSERVED, not taken on trust: fichier.getContentType()
            // is only a string written by the client.
            String mediaType = RecognitionImageLimits.sniff(octets);
            if (mediaType == null) {
                log.info("Uploaded photo dropped: these bytes are not a JPEG, PNG or WebP image");
                refusees++;
                continue;
            }

            // sourceUrl null: this photo comes from no address, and inventing
            // one would make us believe that we could go back to it.
            retenues.add(new RecognitionImage(positionAffichee, null, octets, mediaType));
            cumule += octets.length;
        }
        return new Intake(retenues, refusees);
    }

    /**
     * Bounded reading: we stop at the ceiling rather than loading then measuring.
     *
     * <p>A file larger than the ceiling is <b>truncated</b>, as on the
     * fetcher side. A truncated image that the engine cannot read is better
     * than a flat refusal: the rest of the batch goes through anyway.
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
