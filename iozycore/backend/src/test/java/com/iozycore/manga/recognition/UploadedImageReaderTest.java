package com.iozycore.manga.recognition;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The door for photos sent by the user.
 *
 * <p>It replaces a host whitelist with a single question: <b>are these
 * bytes really an image?</b> These tests protect this question
 * and the limits that come with it.
 */
class UploadedImageReaderTest {

    private final UploadedImageReader reader = new UploadedImageReader();

    // ============================================ The type is established

    @Test
    void a_real_jpeg_is_accepted_and_its_type_is_observed() {
        UploadedImageReader.Intake intake = reader.read(List.of(fichier("photo.jpg", "image/jpeg", jpeg(2048))));

        assertThat(intake.images()).hasSize(1);
        assertThat(intake.images().get(0).mediaType()).isEqualTo("image/jpeg");
        assertThat(intake.rejectedCount()).isZero();
    }

    @Test
    void png_and_webp_are_accepted_too() {
        UploadedImageReader.Intake intake = reader.read(List.of(
                fichier("a.png", "image/png", png(2048)),
                fichier("b.webp", "image/webp", webp(2048))));

        assertThat(intake.images()).extracting(RecognitionImage::mediaType)
                .containsExactly("image/png", "image/webp");
    }

    @Test
    void a_file_that_merely_CLAIMS_to_be_an_image_is_refused() {
        // The core of the matter. Content-Type is a string written by the client:
        // nothing prevents announcing image/jpeg on anything, and these bytes
        // would then go to an external engine.
        byte[] pasUneImage = "#!/bin/sh\nrm -rf /\n".getBytes(StandardCharsets.UTF_8);

        UploadedImageReader.Intake intake =
                reader.read(List.of(fichier("innocent.jpg", "image/jpeg", pasUneImage)));

        assertThat(intake.images()).isEmpty();
        assertThat(intake.rejectedCount()).isEqualTo(1);
    }

    @Test
    void a_real_image_declared_as_something_else_is_still_accepted() {
        // Symmetric to the previous test: it is the content that decides, not
        // the label - in one direction as in the other.
        UploadedImageReader.Intake intake =
                reader.read(List.of(fichier("sans-extension", "application/octet-stream", png(1024))));

        assertThat(intake.images()).hasSize(1);
        assertThat(intake.images().get(0).mediaType()).isEqualTo("image/png");
    }

    @Test
    void a_refused_photo_does_not_take_the_others_down_with_it() {
        UploadedImageReader.Intake intake = reader.read(List.of(
                fichier("ok.jpg", "image/jpeg", jpeg(1024)),
                fichier("faux.jpg", "image/jpeg", "pas une image".getBytes(StandardCharsets.UTF_8)),
                fichier("ok2.png", "image/png", png(1024))));

        assertThat(intake.images()).hasSize(2);
        assertThat(intake.rejectedCount()).isEqualTo(1);
    }

    // ============================================ The limits

    @Test
    void at_most_eight_photos_are_read() {
        List<MultipartFile> neuf = new ArrayList<>();
        for (int i = 0; i < 9; i++) {
            neuf.add(fichier("p" + i + ".jpg", "image/jpeg", jpeg(1024)));
        }

        UploadedImageReader.Intake intake = reader.read(neuf);

        assertThat(intake.images()).hasSize(RecognitionImageLimits.MAX_IMAGES);
    }

    @Test
    void a_photo_larger_than_the_per_image_cap_is_truncated_not_refused() {
        byte[] enorme = jpeg(RecognitionImageLimits.MAX_BYTES_PER_IMAGE + 500_000);

        UploadedImageReader.Intake intake = reader.read(List.of(fichier("grosse.jpg", "image/jpeg", enorme)));

        // Truncated rather than rejected: the rest of the batch still goes through, and an
        // engine that could not read it will say so itself.
        assertThat(intake.images()).hasSize(1);
        assertThat(intake.images().get(0).bytes()).hasSize(RecognitionImageLimits.MAX_BYTES_PER_IMAGE);
    }

    @Test
    void the_cumulative_cap_stops_the_reading() {
        // Five 3 MB photos exceed the cumulative 12 MB: the last ones are
        // not loaded into memory.
        List<MultipartFile> lourdes = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            lourdes.add(fichier("p" + i + ".jpg", "image/jpeg", jpeg(RecognitionImageLimits.MAX_BYTES_PER_IMAGE)));
        }

        UploadedImageReader.Intake intake = reader.read(lourdes);

        int cumule = intake.images().stream().mapToInt(image -> image.bytes().length).sum();
        assertThat(cumule).isLessThanOrEqualTo(RecognitionImageLimits.MAX_TOTAL_BYTES);
        assertThat(intake.images()).hasSizeLessThan(5);
    }

    // ============================================ Robustness

    @Test
    void nothing_sent_is_not_an_error() {
        assertThat(reader.read(null).images()).isEmpty();
        assertThat(reader.read(List.of()).images()).isEmpty();
    }

    @Test
    void an_empty_part_is_simply_ignored() {
        UploadedImageReader.Intake intake = reader.read(List.of(
                fichier("vide.jpg", "image/jpeg", new byte[0]),
                fichier("ok.jpg", "image/jpeg", jpeg(512))));

        assertThat(intake.images()).hasSize(1);
    }

    @Test
    void an_uploaded_photo_carries_no_source_url() {
        // It comes from no address. Inventing one for it would suggest
        // that we could go back to it - and so that there is something to reach.
        UploadedImageReader.Intake intake = reader.read(List.of(fichier("p.jpg", "image/jpeg", jpeg(512))));

        assertThat(intake.images().get(0).sourceUrl()).isNull();
    }

    @Test
    void display_indexes_follow_the_order_of_sending() {
        UploadedImageReader.Intake intake = reader.read(List.of(
                fichier("a.jpg", "image/jpeg", jpeg(512)),
                fichier("b.png", "image/png", png(512)),
                fichier("c.webp", "image/webp", webp(512))));

        assertThat(intake.images()).extracting(RecognitionImage::index).containsExactly(0, 1, 2);
    }

    @Test
    void the_bytes_never_appear_in_toString() {
        // A base64 image in an exception trace is the content of a
        // personal photo copied into a file that nobody monitors.
        RecognitionImage image = reader.read(List.of(fichier("p.jpg", "image/jpeg", jpeg(512))))
                .images().get(0);

        assertThat(image.toString()).contains("image/jpeg").doesNotContain("bytes=[");
    }

    // ============================================ Factories

    private static MultipartFile fichier(String nom, String typeDeclare, byte[] contenu) {
        return new MockMultipartFile("photos", nom, typeDeclare, contenu);
    }

    /** Real JPEG header, then padding - the point is not to decode. */
    private static byte[] jpeg(int taille) {
        return avecEntete(new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0}, taille);
    }

    private static byte[] png(int taille) {
        return avecEntete(new byte[]{(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A}, taille);
    }

    private static byte[] webp(int taille) {
        byte[] octets = avecEntete("RIFF".getBytes(StandardCharsets.US_ASCII), taille);
        System.arraycopy("WEBP".getBytes(StandardCharsets.US_ASCII), 0, octets, 8, 4);
        return octets;
    }

    private static byte[] avecEntete(byte[] entete, int taille) {
        byte[] octets = new byte[Math.max(taille, 16)];
        System.arraycopy(entete, 0, octets, 0, entete.length);
        return octets;
    }
}
