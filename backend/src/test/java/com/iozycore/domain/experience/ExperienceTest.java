package com.iozycore.domain.experience;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ExperienceTest {

    @Test
    void recording_an_experience_does_not_require_any_ownership() {
        // Un tome peut être marqué "lu" sans jamais avoir été possédé.
        Experience experience = Experience.record_(UUID.randomUUID(), "READ", LocalDate.now(), 8, "Très bon tome");

        assertEquals(1, experience.pullDomainEvents().size());
        assertEquals(8, experience.rating().orElseThrow());
    }

    @Test
    void experience_type_cannot_be_blank() {
        assertThrows(IllegalArgumentException.class,
                () -> Experience.record_(UUID.randomUUID(), " ", LocalDate.now(), null, null));
    }

    @Test
    void rating_must_stay_within_bounds() {
        assertThrows(IllegalArgumentException.class,
                () -> Experience.record_(UUID.randomUUID(), "FINISHED", LocalDate.now(), 15, null));
    }

    @Test
    void comment_and_rating_can_be_updated_later() {
        Experience experience = Experience.record_(UUID.randomUUID(), "PLAYED", LocalDate.now(), null, null);

        experience.updateRating(9);
        experience.updateComment("Excellente partie entre amis");

        assertEquals(9, experience.rating().orElseThrow());
        assertTrue(experience.comment().contains("Excellente"));
    }
}
