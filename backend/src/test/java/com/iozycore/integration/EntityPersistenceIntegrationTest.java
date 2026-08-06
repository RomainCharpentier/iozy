package com.iozycore.integration;

import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityTypeFixtures;
import com.iozycore.domain.catalog.Tag;
import com.iozycore.domain.catalog.TagRepository;
import com.iozycore.domain.ownership.Ownership;
import com.iozycore.domain.ownership.OwnershipCondition;
import com.iozycore.domain.ownership.OwnershipRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

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
@Testcontainers
@SpringBootTest
@Transactional
class EntityPersistenceIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("iozycore_test")
            .withUsername("iozycore")
            .withPassword("iozycore");

    @DynamicPropertySource
    static void configureDatasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired
    private EntityRepository entityRepository;

    @Autowired
    private OwnershipRepository ownershipRepository;

    @Autowired
    private TagRepository tagRepository;

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
