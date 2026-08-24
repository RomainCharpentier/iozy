package com.iozycore.integration;

import com.iozycore.api.relationship.RelationshipController;
import com.iozycore.api.relationship.RelationshipController.CreateRelationshipRequest;
import com.iozycore.api.relationship.RelationshipController.UpdateRelationshipRequest;
import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityTypeFixtures;
import com.iozycore.domain.catalog.Relationship;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Une relation créée par erreur doit pouvoir être corrigée ou retirée.
 * <p>
 * Le type choisi à la création n'était jamais réaffiché par la fiche, et aucun
 * endpoint ne permettait ni de le changer ni de supprimer le lien : une
 * relation erronée restait à la fois invisible et définitive
 * (docs/USER_JOURNEYS.md, §14).
 * <p>
 * Seul le TYPE est modifiable, et c'est délibéré : changer une extrémité ne
 * corrige pas une relation, cela en décrit une autre. Le test qui compte le
 * plus est le dernier : supprimer un lien ne touche à aucune des deux œuvres
 * liées.
 */
class RelationshipReversibilityIntegrationTest extends PostgresIntegrationTest {

    @Autowired
    private RelationshipController relationshipController;

    @Autowired
    private EntityRepository entityRepository;

    private static final UUID MANGA = EntityTypeFixtures.MANGA.id();

    private UUID uneOeuvre(String prefixe) {
        return entityRepository.save(Entity.create(MANGA, prefixe + " " + UUID.randomUUID())).id();
    }

    @Test
    void une_relation_peut_etre_creee_corrigee_puis_supprimee() {
        UUID source = uneOeuvre("Fullmetal Alchemist");
        UUID cible = uneOeuvre("Fullmetal Alchemist Brotherhood");

        Relationship creee = relationshipController.create(
                new CreateRelationshipRequest(source, cible, "ADAPTED_INTO"));
        assertThat(relationshipController.fromEntity(source)).extracting(Relationship::id).contains(creee.id());

        Relationship corrigee = relationshipController.update(
                creee.id(), new UpdateRelationshipRequest("RELATED_TO"));

        assertThat(corrigee.relationshipType()).isEqualTo("RELATED_TO");
        // Les extrémités ne bougent pas : corriger un type, ce n'est pas
        // relier deux autres œuvres.
        assertThat(corrigee.sourceEntityId()).isEqualTo(source);
        assertThat(corrigee.targetEntityId()).isEqualTo(cible);
        assertThat(relationshipController.fromEntity(source))
                .filteredOn(r -> r.id().equals(creee.id()))
                .singleElement()
                .satisfies(r -> assertThat(r.relationshipType()).isEqualTo("RELATED_TO"));

        relationshipController.delete(creee.id());

        assertThat(relationshipController.fromEntity(source)).extracting(Relationship::id)
                .doesNotContain(creee.id());
        assertThat(relationshipController.toEntity(cible)).extracting(Relationship::id)
                .doesNotContain(creee.id());
    }

    @Test
    void supprimer_une_relation_ne_touche_a_aucune_des_deux_oeuvres() {
        UUID source = uneOeuvre("Gunnm");
        UUID cible = uneOeuvre("Gunnm Last Order");
        Relationship creee = relationshipController.create(
                new CreateRelationshipRequest(source, cible, "PART_OF_SERIES"));

        relationshipController.delete(creee.id());

        assertThat(entityRepository.findById(source)).isPresent();
        assertThat(entityRepository.findById(cible)).isPresent();
    }

    @Test
    void un_type_de_relation_vide_est_refuse_et_ne_modifie_rien() {
        UUID source = uneOeuvre("Akira");
        UUID cible = uneOeuvre("Akira film");
        Relationship creee = relationshipController.create(
                new CreateRelationshipRequest(source, cible, "ADAPTED_INTO"));

        assertThatThrownBy(() -> relationshipController.update(creee.id(), new UpdateRelationshipRequest("   ")))
                .isInstanceOf(ResponseStatusException.class);

        assertThat(relationshipController.fromEntity(source)).singleElement()
                .satisfies(r -> assertThat(r.relationshipType()).isEqualTo("ADAPTED_INTO"));
    }

    @Test
    void supprimer_une_relation_est_idempotent() {
        UUID source = uneOeuvre("Nausicaa");
        UUID cible = uneOeuvre("Nausicaa film");
        Relationship creee = relationshipController.create(
                new CreateRelationshipRequest(source, cible, "ADAPTED_INTO"));
        relationshipController.delete(creee.id());

        assertThatCode(() -> relationshipController.delete(creee.id())).doesNotThrowAnyException();
        assertThatCode(() -> relationshipController.delete(UUID.randomUUID())).doesNotThrowAnyException();
    }
}
