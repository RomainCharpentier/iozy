package com.iozycore.integration;

import com.iozycore.core.application.EntityDeletionService;
import com.iozycore.core.application.VariantDeletionService;
import com.iozycore.manga.domain.EditionTier;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.manga.domain.MangaEditionRepository;
import com.iozycore.core.domain.catalog.Tag;
import com.iozycore.core.domain.catalog.TagRepository;
import com.iozycore.core.domain.catalog.Variant;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.core.domain.shared.EntityDeletionNotAllowedException;
import com.iozycore.core.domain.shared.VariantDeletionNotAllowedException;
import com.iozycore.core.listing.ListingPlatform;
import com.iozycore.manga.deals.MarketPriceObservation;
import com.iozycore.manga.deals.MarketPriceObservationRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Valide que le module de persistance (Flyway + JPA) fonctionne réellement
 * contre un PostgreSQL réel, pas seulement contre le domaine en mémoire.
 * Couvre le scénario UC1 → UC2 → UC5 : création d'une Entity, ajout d'un
 * Tag, ajout d'une Ownership, puis vérification qu'une Entity récupérée
 * depuis la base porte bien ses Variant/Tag/Ownership associés.
 *
 * @Transactional isole chaque méthode : les repositories (eux-mêmes
 * @Transactional, propagation REQUIRED) rejoignent la transaction ouverte
 * par le test au lieu d'en ouvrir une nouvelle, et Spring la rollback à la
 * fin de chaque méthode - sans ça les 3 méthodes partagent le même
 * conteneur Postgres statique et polluent les résultats les unes des
 * autres (constaté : le filtre par tag remontait aussi une Entity créée
 * par une méthode précédente).
 */
class EntityPersistenceIntegrationTest extends PostgresIntegrationTest {


    @Autowired
    private EntityRepository entityRepository;

    @Autowired
    private OwnershipRepository ownershipRepository;

    @Autowired
    private TagRepository tagRepository;

    @Autowired
    private MangaEditionRepository mangaEditionRepository;

    @Autowired
    private VariantDeletionService variantDeletionService;

    @Autowired
    private MarketPriceObservationRepository marketPriceObservationRepository;

    @Autowired
    private EntityDeletionService entityDeletionService;

    @Test
    void an_entity_can_be_saved_reloaded_with_its_variant_and_tag() {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        entity.addVariant("Black Edition", java.util.Map.of("volumeCount", 6));

        Tag tag = tagRepository.save(new Tag(UUID.randomUUID(), "seinen"));
        entity.addTag(tag.id());

        entityRepository.save(entity);

        Entity reloaded = entityRepository.findById(entity.id()).orElseThrow();

        assertThat(reloaded.title()).isEqualTo("Death Note");
        assertThat(reloaded.variants()).hasSize(1);
        assertThat(reloaded.variants().get(0).label()).isEqualTo("Black Edition");
        assertThat(reloaded.tagIds()).containsExactly(tag.id());
    }

    @Test
    void an_ownership_can_be_acquired_then_marked_sold_and_reloaded() {
        Entity entity = Entity.create(EntityTypeFixtures.VIDEO_GAME.id(), "Hollow Knight");
        entityRepository.save(entity);

        Ownership ownership = Ownership.acquire(entity.id(), null, OwnershipCondition.NEW, LocalDate.now(), null);
        ownershipRepository.save(ownership);

        Ownership reloaded = ownershipRepository.findById(ownership.id()).orElseThrow();
        reloaded.markSold();
        ownershipRepository.save(reloaded);

        Ownership afterSale = ownershipRepository.findById(ownership.id()).orElseThrow();
        assertThat(afterSale.isActive()).isFalse();
        assertThat(ownershipRepository.existsByEntityId(entity.id())).isTrue(); // existe encore, juste vendue
    }

    @Test
    void purchase_price_is_null_by_default_and_can_be_set_then_cleared_after_reload() {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Vagabond " + UUID.randomUUID());
        entityRepository.save(entity);

        Ownership ownership = Ownership.acquire(entity.id(), null, OwnershipCondition.NEW, LocalDate.now(), null);
        ownershipRepository.save(ownership);

        assertThat(ownershipRepository.findById(ownership.id()).orElseThrow().purchasePrice()).isEmpty();

        Ownership reloaded = ownershipRepository.findById(ownership.id()).orElseThrow();
        reloaded.updatePurchasePrice(new BigDecimal("6.90"));
        ownershipRepository.save(reloaded);

        assertThat(ownershipRepository.findById(ownership.id()).orElseThrow().purchasePrice())
                .contains(new BigDecimal("6.90"));

        Ownership cleared = ownershipRepository.findById(ownership.id()).orElseThrow();
        cleared.updatePurchasePrice(null);
        ownershipRepository.save(cleared);

        assertThat(ownershipRepository.findById(ownership.id()).orElseThrow().purchasePrice()).isEmpty();
    }

    @Test
    void merged_variant_attributes_persist_after_reload() {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note " + UUID.randomUUID());
        Variant variant = entity.addVariant("Tome 1", Map.of("volumeNumber", 1, "edition", "Black Edition"));
        entityRepository.save(entity);

        Entity reloaded = entityRepository.findById(entity.id()).orElseThrow();
        reloaded.mergeVariantAttributes(variant.id(), Map.of("coverImageUrl", "https://example.com/tome1.jpg"));
        entityRepository.save(reloaded);

        Entity afterMerge = entityRepository.findById(entity.id()).orElseThrow();
        Variant updatedVariant = afterMerge.variants().get(0);
        assertThat(updatedVariant.attributes()).containsEntry("coverImageUrl", "https://example.com/tome1.jpg");
        assertThat(updatedVariant.attributes()).containsEntry("volumeNumber", 1); // conservé, pas écrasé
        assertThat(updatedVariant.attributes()).containsEntry("edition", "Black Edition");
    }

    @Test
    void a_variant_linked_to_a_manga_edition_persists_the_link_after_reload() {
        MangaEdition edition = mangaEditionRepository.save(MangaEdition.create("Death Note " + UUID.randomUUID(),
                "Black Edition", EditionTier.DELUXE, "Kana", 6, new BigDecimal("14.90"), false, false, null));
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note " + UUID.randomUUID());
        Variant variant = entity.addVariant("Tome 1", Map.of("volumeNumber", 1, "edition", "Black Edition"));
        entityRepository.save(entity);

        Entity reloaded = entityRepository.findById(entity.id()).orElseThrow();
        assertThat(reloaded.variants().get(0).mangaEditionId()).isNull(); // pas encore lié

        reloaded.linkVariantToEdition(variant.id(), edition.id());
        entityRepository.save(reloaded);

        Entity afterLink = entityRepository.findById(entity.id()).orElseThrow();
        assertThat(afterLink.variants().get(0).mangaEditionId()).isEqualTo(edition.id());
    }

    @Test
    void an_unreferenced_variant_can_be_deleted_and_a_sibling_variant_keeps_the_entity_alive() {
        // Un second tome garde la Série non-vide, pour isoler ce test de la cascade
        // "0 tome -> suppression de la Série" (voir deleting_the_last_tome_of_a_series_... plus bas).
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note " + UUID.randomUUID());
        Variant variant = entity.addVariant("Tome 1", Map.of("volumeNumber", 1));
        entity.addVariant("Tome 2", Map.of("volumeNumber", 2));
        entityRepository.save(entity);

        variantDeletionService.delete(entity.id(), variant.id());

        Entity reloaded = entityRepository.findById(entity.id()).orElseThrow();
        assertThat(reloaded.variants()).extracting(Variant::label).containsExactly("Tome 2");
    }

    @Test
    void a_variant_referenced_by_a_real_ownership_row_cannot_be_deleted() {
        // Round-trip réel : sans la garde applicative, la contrainte FK
        // ownership.variant_id (V1__init_schema.sql, sans ON DELETE) rejetterait
        // la suppression avec une erreur SQL brute plutôt qu'un message clair.
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note " + UUID.randomUUID());
        Variant variant = entity.addVariant("Tome 1", Map.of("volumeNumber", 1));
        entityRepository.save(entity);
        ownershipRepository.save(Ownership.acquire(entity.id(), variant.id(), OwnershipCondition.NEW, LocalDate.now(), null));

        assertThatThrownBy(() -> variantDeletionService.delete(entity.id(), variant.id()))
                .isInstanceOf(VariantDeletionNotAllowedException.class);

        Entity reloaded = entityRepository.findById(entity.id()).orElseThrow();
        assertThat(reloaded.variants()).hasSize(1); // toujours là
    }

    @Test
    void deleting_the_last_tome_of_an_edition_cascades_all_the_way_to_the_series_for_real() {
        // Round-trip réel bout en bout (étape 5) : Édition ET Série effectivement absentes
        // de la base ensuite, pas seulement du domaine en mémoire.
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note " + UUID.randomUUID());
        Variant variant = entity.addVariant("Tome 1", Map.of("volumeNumber", 1));
        entityRepository.save(entity); // la Série doit exister avant qu'une Édition puisse la référencer (FK)
        MangaEdition edition = mangaEditionRepository.save(MangaEdition.create(entity.id(), entity.title(),
                "Perfect Edition", EditionTier.DELUXE, "Kana", 6, null, false, false, null));
        entity.linkVariantToEdition(variant.id(), edition.id());
        entityRepository.save(entity);

        variantDeletionService.delete(entity.id(), variant.id());

        assertThat(mangaEditionRepository.findById(edition.id())).isEmpty();
        assertThat(entityRepository.findById(entity.id())).isEmpty();
    }

    @Test
    void a_manga_edition_with_a_real_market_observation_survives_losing_its_last_tome() {
        // Preuve par la contrainte FK réelle (market_price_observation.manga_edition_id) :
        // sans le rattrapage de DataIntegrityViolationException dans VariantDeletionService,
        // cet appel lèverait une erreur SQL brute plutôt que de simplement conserver
        // l'Édition comme donnée de référence.
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), "Sanctuary " + UUID.randomUUID());
        Variant variant = entity.addVariant("Tome 1", Map.of("volumeNumber", 1));
        entityRepository.save(entity); // la Série doit exister avant qu'une Édition puisse la référencer (FK)
        MangaEdition edition = mangaEditionRepository.save(MangaEdition.create(entity.id(), entity.title(),
                "Perfect Edition", EditionTier.PERFECT, "Glénat", 6, null, false, false, null));
        entity.linkVariantToEdition(variant.id(), edition.id());
        entityRepository.save(entity);
        marketPriceObservationRepository.save(MarketPriceObservation.record_(edition.id(), null,
                new BigDecimal("150"), ListingPlatform.VINTED, null, LocalDate.now(), "Lot Vinted"));

        variantDeletionService.delete(entity.id(), variant.id()); // ne lève rien

        assertThat(mangaEditionRepository.findById(edition.id())).isPresent(); // conservée
        Entity reloaded = entityRepository.findById(entity.id()).orElseThrow();
        assertThat(reloaded.variants()).isEmpty(); // le Tome, lui, a bien disparu

        // La Série reste aussi (le cascade s'est arrêté), et une tentative de suppression
        // directe de la Série est bloquée avec un message clair - jamais l'erreur SQL brute
        // que la contrainte FK manga_edition.entity_id lèverait sans la garde étendue à l'étape 5.
        assertThatThrownBy(() -> entityDeletionService.delete(entity.id()))
                .isInstanceOf(EntityDeletionNotAllowedException.class)
                .hasMessageContaining("1 édition");
    }

    @Test
    void search_matches_by_title_across_types_and_respects_type_and_tag_filters() {
        Entity deathNote = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        Tag seinen = tagRepository.save(new Tag(UUID.randomUUID(), "seinen-" + UUID.randomUUID()));
        deathNote.addTag(seinen.id());
        entityRepository.save(deathNote);

        Entity hollowKnight = Entity.create(EntityTypeFixtures.VIDEO_GAME.id(), "Hollow Knight");
        entityRepository.save(hollowKnight);

        // Recherche transversale par titre, sans filtre de type : ne doit
        // remonter que l'Entity dont le titre correspond, quel que soit son type.
        assertThat(entityRepository.search("death", null, null))
                .extracting(Entity::id)
                .containsExactly(deathNote.id());

        // Recherche vide + filtre de type uniquement : tous les mangas.
        assertThat(entityRepository.search(null, EntityTypeFixtures.MANGA.id(), null))
                .extracting(Entity::id)
                .contains(deathNote.id())
                .doesNotContain(hollowKnight.id());

        // Filtre par tag : seule l'Entity taguée doit remonter.
        assertThat(entityRepository.search(null, null, seinen.id()))
                .extracting(Entity::id)
                .containsExactly(deathNote.id());

        // Un titre qui ne correspond à rien renvoie une liste vide, pas une erreur.
        assertThat(entityRepository.search("un titre qui n'existe vraiment pas", null, null)).isEmpty();
    }
}
