package com.iozycore.domain.catalog;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EntityTest {

    @Test
    void creating_an_entity_raises_entity_created_event() {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");

        List<?> events = entity.pullDomainEvents();

        assertEquals(1, events.size());
        assertTrue(events.get(0) instanceof EntityCreated);
        assertEquals("Death Note", ((EntityCreated) events.get(0)).title());
    }

    @Test
    void pulling_domain_events_clears_them() {
        Entity entity = Entity.create(EntityTypeFixtures.VIDEO_GAME.id(), "Hollow Knight");
        entity.pullDomainEvents();

        assertTrue(entity.pullDomainEvents().isEmpty());
    }

    @Test
    void title_cannot_be_blank() {
        assertThrows(IllegalArgumentException.class, () -> Entity.create(EntityTypeFixtures.BOARD_GAME.id(), "  "));
    }

    @Test
    void a_variant_can_be_added_without_existing_outside_its_entity() {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");

        Variant variant = entity.addVariant("Black Edition", Map.of("volumeCount", 6));

        assertEquals(1, entity.variants().size());
        assertEquals(variant.label(), entity.variants().get(0).label());
    }

    @Test
    void merging_variant_attributes_adds_new_keys_without_touching_others() {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        Variant variant = entity.addVariant("Tome 1", Map.of("volumeNumber", 1, "edition", "Black Edition"));

        entity.mergeVariantAttributes(variant.id(), Map.of("coverImageUrl", "https://example.com/tome1.jpg"));

        Variant updated = entity.variants().get(0);
        assertEquals(1, updated.attributes().get("volumeNumber"));
        assertEquals("Black Edition", updated.attributes().get("edition"));
        assertEquals("https://example.com/tome1.jpg", updated.attributes().get("coverImageUrl"));
        assertEquals(variant.id(), updated.id());
        assertEquals(variant.label(), updated.label());
    }

    @Test
    void merging_attributes_on_an_existing_key_overwrites_it() {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        Variant variant = entity.addVariant("Tome 1", Map.of("coverImageUrl", "https://example.com/old.jpg"));

        entity.mergeVariantAttributes(variant.id(), Map.of("coverImageUrl", "https://example.com/new.jpg"));

        assertEquals("https://example.com/new.jpg", entity.variants().get(0).attributes().get("coverImageUrl"));
    }

    @Test
    void merging_entity_attributes_adds_new_keys_without_touching_others() {
        // Correction manuelle de la Série elle-même (audit UX "correction
        // manuelle") - même sémantique que mergeVariantAttributes, appliquée
        // à l'Entity plutôt qu'à un Variant imbriqué.
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        entity.setAttribute("mangaka", "Tsugumi Ohba");

        entity.mergeAttributes(Map.of("coverImageUrl", "https://example.com/series.jpg"));

        assertEquals("Tsugumi Ohba", entity.attributes().get("mangaka"));
        assertEquals("https://example.com/series.jpg", entity.attributes().get("coverImageUrl"));
    }

    @Test
    void merging_entity_attributes_on_an_existing_key_overwrites_it() {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        entity.setAttribute("coverImageUrl", "https://example.com/old.jpg");

        entity.mergeAttributes(Map.of("coverImageUrl", "https://example.com/new.jpg"));

        assertEquals("https://example.com/new.jpg", entity.attributes().get("coverImageUrl"));
    }

    @Test
    void removing_an_attribute_makes_it_disappear_rather_than_leaving_it_empty() {
        // Vider un champ dans le formulaire "Informations" de la fiche doit
        // vraiment retirer l'attribut : une chaîne vide ressemblerait ensuite
        // à une donnée renseignée (voir la javadoc de mergeAttributes, qui
        // interdit justement la valeur vide comme moyen d'effacer).
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        entity.setAttribute("mangaka", "Tsugumi Ohba");

        entity.removeAttribute("mangaka");

        assertFalse(entity.attributes().containsKey("mangaka"));
    }

    @Test
    void removing_an_attribute_that_was_never_set_is_not_an_error() {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");

        entity.removeAttribute("mangaka");

        assertTrue(entity.attributes().isEmpty());
    }

    @Test
    void renumbering_a_volume_moves_its_label_with_it() {
        // Le libellé et le numéro DOIVENT bouger ensemble : QuickAddService
        // déduplique par libellé, un tome renuméroté sans son libellé serait
        // re-créé en double au prochain ajout du même tome.
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        Variant tome = entity.addVariant("Tome 3 — Black Édition",
                Map.of("volumeNumber", 3, "edition", "Black Édition"));

        entity.renumberVariant(tome.id(), 5);

        Variant renumbered = entity.variants().get(0);
        assertEquals("Tome 5 — Black Édition", renumbered.label());
        assertEquals(5, renumbered.attributes().get("volumeNumber"));
        // Les autres attributs survivent (jaquette du tome, édition...).
        assertEquals("Black Édition", renumbered.attributes().get("edition"));
    }

    @Test
    void renumbering_onto_a_number_already_taken_in_the_same_edition_fails_loudly() {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        Variant tome3 = entity.addVariant("Tome 3 — Black Édition", Map.of("volumeNumber", 3, "edition", "Black Édition"));
        entity.addVariant("Tome 4 — Black Édition", Map.of("volumeNumber", 4, "edition", "Black Édition"));

        assertThrows(IllegalStateException.class, () -> entity.renumberVariant(tome3.id(), 4));
    }

    @Test
    void the_same_number_in_a_DIFFERENT_edition_is_not_a_conflict() {
        // Deux éditions d'une même série ont chacune leur tome 4 - ce n'est pas
        // un doublon, elles sont numérotées indépendamment.
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        Variant tome3 = entity.addVariant("Tome 3 — Black Édition", Map.of("volumeNumber", 3, "edition", "Black Édition"));
        entity.addVariant("Tome 4 — Kana", Map.of("volumeNumber", 4, "edition", "Kana"));

        entity.renumberVariant(tome3.id(), 4);

        assertEquals("Tome 4 — Black Édition", entity.variants().get(0).label());
    }

    @Test
    void a_volume_number_below_one_is_rejected() {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        Variant tome = entity.addVariant("Tome 3", Map.of("volumeNumber", 3));

        assertThrows(IllegalArgumentException.class, () -> entity.renumberVariant(tome.id(), 0));
    }

    @Test
    void merging_attributes_on_an_unknown_variant_fails_loudly() {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");

        assertThrows(IllegalArgumentException.class,
                () -> entity.mergeVariantAttributes(UUID.randomUUID(), Map.of("coverImageUrl", "https://example.com/x.jpg")));
    }

    @Test
    void a_new_variant_has_no_manga_edition_link_by_default() {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");

        Variant variant = entity.addVariant("Tome 1", Map.of("volumeNumber", 1));

        assertEquals(null, variant.mangaEditionId());
    }

    @Test
    void linking_a_variant_to_a_manga_edition_sets_it_without_touching_attributes() {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        Variant variant = entity.addVariant("Tome 1", Map.of("volumeNumber", 1, "edition", "Black Edition"));
        UUID mangaEditionId = UUID.randomUUID();

        entity.linkVariantToEdition(variant.id(), mangaEditionId);

        Variant updated = entity.variants().get(0);
        assertEquals(mangaEditionId, updated.mangaEditionId());
        assertEquals(1, updated.attributes().get("volumeNumber"));
        assertEquals("Black Edition", updated.attributes().get("edition"));
    }

    @Test
    void linking_an_unknown_variant_to_a_manga_edition_fails_loudly() {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");

        assertThrows(IllegalArgumentException.class,
                () -> entity.linkVariantToEdition(UUID.randomUUID(), UUID.randomUUID()));
    }

    @Test
    void removing_a_variant_deletes_it_without_touching_other_variants() {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        Variant tome1 = entity.addVariant("Tome 1", Map.of("volumeNumber", 1));
        Variant tome2 = entity.addVariant("Tome 2", Map.of("volumeNumber", 2));

        entity.removeVariant(tome1.id());

        assertEquals(1, entity.variants().size());
        assertEquals(tome2.id(), entity.variants().get(0).id());
    }

    @Test
    void removing_an_unknown_variant_fails_loudly() {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");

        assertThrows(IllegalArgumentException.class, () -> entity.removeVariant(UUID.randomUUID()));
    }

    @Test
    void merging_attributes_preserves_an_existing_manga_edition_link() {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        Variant variant = entity.addVariant("Tome 1", Map.of("volumeNumber", 1));
        UUID mangaEditionId = UUID.randomUUID();
        entity.linkVariantToEdition(variant.id(), mangaEditionId);

        entity.mergeVariantAttributes(variant.id(), Map.of("coverImageUrl", "https://example.com/tome1.jpg"));

        assertEquals(mangaEditionId, entity.variants().get(0).mangaEditionId());
    }

    @Test
    void reconstituted_entity_does_not_raise_new_events() {
        UUID id = UUID.randomUUID();
        Entity entity = Entity.reconstitute(id, EntityTypeFixtures.MANGA.id(), "Berserk",
                Map.of(), List.of(), Set.of());

        assertTrue(entity.pullDomainEvents().isEmpty());
    }
}
