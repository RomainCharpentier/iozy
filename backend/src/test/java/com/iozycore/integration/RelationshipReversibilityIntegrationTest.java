package com.iozycore.integration;

import com.iozycore.core.api.relationship.RelationshipController;
import com.iozycore.core.api.relationship.RelationshipController.CreateRelationshipRequest;
import com.iozycore.core.api.relationship.RelationshipController.UpdateRelationshipRequest;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.catalog.Relationship;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * A relationship created by mistake must be correctable or removable.
 * <p>
 * The type chosen at creation was never shown again by the detail page, and no
 * endpoint allowed to change it or to delete the link: a wrong
 * relationship stayed both invisible and permanent
 * (docs/USER_JOURNEYS.md, §14).
 * <p>
 * Only the TYPE can be edited, and this is deliberate: changing an end does not
 * correct a relationship, it describes another one. The test that matters
 * most is the last one: deleting a link touches neither of the two linked
 * works.
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
        // The ends do not move: correcting a type is not
        // linking two other works.
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
                .isInstanceOf(IllegalArgumentException.class);

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
