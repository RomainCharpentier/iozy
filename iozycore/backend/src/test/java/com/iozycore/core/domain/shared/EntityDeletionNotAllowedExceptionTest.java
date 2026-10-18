package com.iozycore.core.domain.shared;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import org.junit.jupiter.api.Test;

class EntityDeletionNotAllowedExceptionTest {

    @Test
    void the_message_is_a_french_sentence_without_the_id() {
        UUID id = UUID.randomUUID();

        String message = new EntityDeletionNotAllowedException(id, 6, 1, 1).getMessage();

        assertThat(message).isEqualTo(
                "Impossible de supprimer cette fiche : elle a encore 6 exemplaires, 1 expérience et 1 édition.");
        assertThat(message).doesNotContain(id.toString());
    }

    @Test
    void the_message_names_only_what_still_holds_the_page() {
        assertThat(new EntityDeletionNotAllowedException(UUID.randomUUID(), 2, 0, 3).getMessage())
                .isEqualTo("Impossible de supprimer cette fiche : elle a encore 2 exemplaires et 3 éditions.");
    }
}
