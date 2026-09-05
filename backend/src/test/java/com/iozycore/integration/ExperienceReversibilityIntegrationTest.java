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
 * Une expérience créée par l'utilisateur ne doit pas rester prisonnière de
 * l'application.
 * <p>
 * Enregistrée, elle ne pouvait jusqu'ici plus être ni corrigée ni retirée
 * (docs/USER_JOURNEYS.md, §14) : une note posée par réflexe faussait
 * durablement la moyenne, les statistiques et le bilan annuel, qui se calculent
 * tous dessus.
 * <p>
 * Ces tests vérifient le cycle complet créer → relire → modifier → supprimer →
 * relire, et surtout ce qui ne doit PAS bouger au passage : le type, la date et
 * le tome concerné restent immuables - se tromper de tome, c'est avoir
 * enregistré une AUTRE expérience.
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
        // Relecture depuis la base, pas seulement la réponse du PATCH : c'est la
        // persistance qu'on vérifie, pas l'objet renvoyé.
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
        // L'œuvre elle-même n'est pas concernée par le retrait d'une expérience.
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

        // null n'est pas « inchangé » ici mais bien « efface » - sans quoi une
        // note posée par erreur ne pourrait plus jamais être retirée.
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

        // Double clic, ou tuile obsolète après un rechargement tardif : jamais
        // une erreur, comme les autres suppressions du projet.
        assertThatCode(() -> experienceController.delete(creee.id())).doesNotThrowAnyException();
        assertThatCode(() -> experienceController.delete(UUID.randomUUID())).doesNotThrowAnyException();
    }
}
