package com.iozycore.integration;

import com.iozycore.core.api.dto.ExperienceDtos.ExperienceResponse;
import com.iozycore.core.api.dto.ExperienceDtos.RecordExperienceRequest;
import com.iozycore.core.api.dto.ExperienceDtos.UpdateExperienceRequest;
import com.iozycore.core.api.experience.ExperienceController;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * An experience created by the user must not stay a prisoner of
 * the application.
 * <p>
 * Once saved, it could until now no longer be corrected or removed
 * (docs/USER_JOURNEYS.md, §14): a rating set by reflex permanently distorted
 * the average, the statistics and the yearly review, which are all computed
 * from it.
 * <p>
 * These tests check the full cycle create → read again → edit → delete →
 * read again, and above all what must NOT change on the way: the type, the date and
 * the volume concerned stay immutable - choosing the wrong volume means having
 * saved ANOTHER experience.
 */
class ExperienceReversibilityIntegrationTest extends PostgresIntegrationTest {

    @Autowired
    private ExperienceController experienceController;

    @Autowired
    private EntityRepository entityRepository;

    private static final UUID MANGA = EntityTypeFixtures.MANGA.id();

    private UUID uneOeuvre(String prefixe) {
        return entityRepository.save(Entity.create(MANGA, prefixe + " " + UUID.randomUUID())).id();
    }

    @Test
    void une_experience_peut_etre_creee_relue_modifiee_puis_supprimee() {
        UUID entityId = uneOeuvre("Monster");

        ExperienceResponse creee = experienceController.record(new RecordExperienceRequest(
                entityId, null, "READ", LocalDate.now(), 7, "Lu d'une traite"));
        assertThat(experienceController.byEntity(entityId)).extracting(ExperienceResponse::id).contains(creee.id());

        ExperienceResponse modifiee = experienceController.update(
                creee.id(), new UpdateExperienceRequest(9, "Relu, encore meilleur"));

        assertThat(modifiee.rating()).isEqualTo(9);
        assertThat(modifiee.comment()).isEqualTo("Relu, encore meilleur");
        // Read again from the database, not only the PATCH response: it is the
        // persistence that we check, not the returned object.
        assertThat(experienceController.byEntity(entityId))
                .filteredOn(e -> e.id().equals(creee.id()))
                .singleElement()
                .satisfies(e -> {
                    assertThat(e.rating()).isEqualTo(9);
                    assertThat(e.comment()).isEqualTo("Relu, encore meilleur");
                });

        experienceController.delete(creee.id());

        assertThat(experienceController.byEntity(entityId)).extracting(ExperienceResponse::id)
                .doesNotContain(creee.id());
        // The work itself is not concerned by the removal of an experience.
        assertThat(entityRepository.findById(entityId)).isPresent();
    }

    @Test
    void modifier_une_experience_ne_touche_ni_au_type_ni_a_la_date_ni_au_tome() {
        UUID entityId = uneOeuvre("Pluto");
        LocalDate date = LocalDate.of(2026, 3, 14);
        ExperienceResponse creee = experienceController.record(new RecordExperienceRequest(
                entityId, null, "READ", date, 5, null));

        ExperienceResponse modifiee = experienceController.update(creee.id(), new UpdateExperienceRequest(8, "Mieux"));

        assertThat(modifiee.experienceType()).isEqualTo("READ");
        assertThat(modifiee.occurredAt()).isEqualTo(date);
        assertThat(modifiee.variantId()).isNull();
    }

    @Test
    void une_note_et_un_commentaire_peuvent_etre_effaces() {
        UUID entityId = uneOeuvre("Vagabond");
        ExperienceResponse creee = experienceController.record(new RecordExperienceRequest(
                entityId, null, "READ", LocalDate.now(), 6, "Un avis vite écrit"));

        // null does not mean "unchanged" here but "clears" - otherwise a
        // rating set by mistake could never be removed again.
        ExperienceResponse effacee = experienceController.update(creee.id(), new UpdateExperienceRequest(null, null));

        assertThat(effacee.rating()).isNull();
        assertThat(effacee.comment()).isNull();
    }

    @Test
    void une_note_hors_bornes_est_refusee_et_ne_modifie_rien() {
        UUID entityId = uneOeuvre("Berserk");
        ExperienceResponse creee = experienceController.record(new RecordExperienceRequest(
                entityId, null, "READ", LocalDate.now(), 7, null));

        assertThatThrownBy(() -> experienceController.update(creee.id(), new UpdateExperienceRequest(42, null)))
                .isInstanceOf(ResponseStatusException.class);

        assertThat(experienceController.byEntity(entityId)).singleElement()
                .satisfies(e -> assertThat(e.rating()).isEqualTo(7));
    }

    @Test
    void supprimer_une_experience_est_idempotent() {
        UUID entityId = uneOeuvre("Blame");
        ExperienceResponse creee = experienceController.record(new RecordExperienceRequest(
                entityId, null, "READ", LocalDate.now(), 7, null));
        experienceController.delete(creee.id());

        // Double click, or obsolete tile after a late reload: never
        // an error, like the other deletions of the project.
        assertThatCode(() -> experienceController.delete(creee.id())).doesNotThrowAnyException();
        assertThatCode(() -> experienceController.delete(UUID.randomUUID())).doesNotThrowAnyException();
    }
}
