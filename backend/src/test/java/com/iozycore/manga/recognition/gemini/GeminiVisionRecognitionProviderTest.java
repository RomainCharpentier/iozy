package com.iozycore.manga.recognition.gemini;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.manga.recognition.RecognitionResult;
import com.iozycore.manga.recognition.RecognizedBox;
import com.iozycore.manga.recognition.RecognizedItem;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Reading the JSON returned by Gemini - without network. What matters here:
 * the frame of a book arrives as the model placed it, and its absence or
 * its malformation never costs the reading itself.
 */
class GeminiVisionRecognitionProviderTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    private static RecognizedItem seul(String json) throws Exception {
        RecognitionResult resultat = GeminiVisionRecognitionProvider.parse(JSON, json);
        assertThat(resultat.items()).hasSize(1);
        return resultat.items().get(0);
    }

    @Test
    void a_box_in_thousandths_lands_as_fractions_on_the_photo_the_model_names() throws Exception {
        RecognizedItem item = seul("""
                {"items":[{"seriesTitle":"Bleach","volumeNumber":62,"editionHint":null,"ean":null,
                  "confidence":"HIGH","evidence":"Chiffre 62 sur la tranche","sourceImages":[0,1],
                  "boxImage":1,"box_2d":[120,400,880,455]}],"unidentifiedCount":0}""");

        assertThat(item.seriesTitleRaw()).isEqualTo("Bleach");
        assertThat(item.volumeNumber()).isEqualTo(62);
        assertThat(item.boxes()).containsExactly(new RecognizedBox(1, 0.12, 0.4, 0.88, 0.455));
    }

    @Test
    void without_boxImage_the_box_belongs_to_the_first_photo_the_item_was_seen_on() throws Exception {
        RecognizedItem item = seul("""
                {"items":[{"seriesTitle":"Bleach","volumeNumber":62,"confidence":"HIGH",
                  "sourceImages":[2],"box_2d":[0,0,1000,1000]}],"unidentifiedCount":0}""");

        assertThat(item.boxes()).containsExactly(new RecognizedBox(2, 0, 0, 1, 1));
    }

    @Test
    void a_null_or_malformed_box_costs_nothing_but_the_box() throws Exception {
        assertThat(seul("""
                {"items":[{"seriesTitle":"Bleach","volumeNumber":62,"confidence":"HIGH",
                  "sourceImages":[0],"box_2d":null}],"unidentifiedCount":0}""").boxes()).isEmpty();
        assertThat(seul("""
                {"items":[{"seriesTitle":"Bleach","volumeNumber":62,"confidence":"HIGH",
                  "sourceImages":[0],"box_2d":[10,20,30]}],"unidentifiedCount":0}""").boxes()).isEmpty();
        assertThat(seul("""
                {"items":[{"seriesTitle":"Bleach","volumeNumber":62,"confidence":"HIGH",
                  "sourceImages":[0],"box_2d":["a","b","c","d"]}],"unidentifiedCount":0}""").boxes()).isEmpty();
        assertThat(seul("""
                {"items":[{"seriesTitle":"Bleach","volumeNumber":62,"confidence":"HIGH",
                  "sourceImages":[0],"box_2d":[500,200,500,300]}],"unidentifiedCount":0}""").boxes()).isEmpty();
    }

    @Test
    void an_item_without_a_readable_title_is_still_skipped() throws Exception {
        RecognitionResult resultat = GeminiVisionRecognitionProvider.parse(JSON, """
                {"items":[{"seriesTitle":null,"volumeNumber":3,"confidence":"LOW","box_2d":[0,0,500,500]}],
                 "unidentifiedCount":2}""");

        assertThat(resultat.items()).isEmpty();
        assertThat(resultat.unidentifiedCount()).isEqualTo(2);
    }
}
