package com.iozycore.integration;

import com.iozycore.integration.http.FakeRecognitionProvider;
import com.iozycore.manga.recognition.RecognitionImage;
import com.iozycore.manga.shelfimport.ShelfAnalysis;
import com.iozycore.manga.shelfimport.ShelfImportService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The vision call of the shelf import is slow HTTP: it must not hold a
 * database connection while it runs.
 *
 * <p>The test transaction is suspended, otherwise the call would always see
 * the one the test opens. The photo reads as nothing, so the analysis writes
 * nothing and there is nothing to clean up.
 */
@Import(FakeRecognitionProvider.class)
class ShelfImportOutsideTransactionIntegrationTest extends PostgresIntegrationTest {

    @Autowired
    private ShelfImportService service;

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void reading_the_shelf_calls_the_vision_engine_outside_any_transaction() {
        RecognitionImage photo = new RecognitionImage(0, null,
                FakeRecognitionProvider.DECLENCHE_RIEN.getBytes(StandardCharsets.ISO_8859_1), "image/jpeg");

        int callsBefore = FakeRecognitionProvider.appelsAuMoteur();

        ShelfAnalysis analysis = service.analyze(List.of(photo), 1);

        assertThat(analysis.items()).isEmpty();
        // Without a call, the flag below would keep its default and prove nothing.
        assertThat(FakeRecognitionProvider.appelsAuMoteur() - callsBefore).isEqualTo(1);
        assertThat(FakeRecognitionProvider.transactionDuringLastCall()).isFalse();
    }
}
