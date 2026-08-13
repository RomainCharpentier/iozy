package com.iozycore.integration;

import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityTypeFixtures;
import com.iozycore.domain.catalog.Relationship;
import com.iozycore.domain.catalog.RelationshipRepository;
import com.iozycore.domain.catalog.Tag;
import com.iozycore.domain.catalog.TagRepository;
import com.iozycore.domain.catalog.Variant;
import com.iozycore.domain.experience.Experience;
import com.iozycore.domain.experience.ExperienceRepository;
import com.iozycore.domain.ownership.Ownership;
import com.iozycore.domain.ownership.OwnershipCondition;
import com.iozycore.domain.ownership.OwnershipRepository;
import com.iozycore.domain.wishlist.WishlistEntry;
import com.iozycore.domain.wishlist.WishlistEntryRepository;
import com.iozycore.export.ExportDocument;
import com.iozycore.export.ExportService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Validates ExportService (§19, docs/CONCEPTION.md - anti-lock-in) against a real PostgreSQL - mirrors EntityPersistenceIntegrationTest. */
@Testcontainers
@SpringBootTest
@Transactional
class ExportIntegrationTest {

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
    private ExperienceRepository experienceRepository;
    @Autowired
    private WishlistEntryRepository wishlistEntryRepository;
    @Autowired
    private RelationshipRepository relationshipRepository;
    @Autowired
    private TagRepository tagRepository;
    @Autowired
    private ExportService exportService;

    @Test
    void the_export_document_denormalizes_every_resource_type_with_readable_titles() {
        Entity deathNote = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note " + UUID.randomUUID());
        Tag seinen = tagRepository.save(new Tag(UUID.randomUUID(), "seinen-" + UUID.randomUUID()));
        deathNote.addTag(seinen.id());
        Variant tome1 = deathNote.addVariant("Tome 1", Map.of("volumeNumber", 1));
        entityRepository.save(deathNote);

        Entity bakuman = Entity.create(EntityTypeFixtures.MANGA.id(), "Bakuman " + UUID.randomUUID());
        entityRepository.save(bakuman);

        Ownership ownership = Ownership.acquire(deathNote.id(), tome1.id(), OwnershipCondition.NEW, LocalDate.now(), "Note");
        ownership.updatePurchasePrice(new BigDecimal("6.90"));
        ownershipRepository.save(ownership);

        Experience experience = experienceRepository.save(
                Experience.record_(deathNote.id(), tome1.id(), "READ", LocalDate.now(), 9, "Excellent"));
        wishlistEntryRepository.save(WishlistEntry.add(bakuman.id(), LocalDate.now()));
        relationshipRepository.save(new Relationship(UUID.randomUUID(), deathNote.id(), bakuman.id(), "SAME_AUTHOR"));

        ExportDocument document = exportService.buildExportDocument();

        ExportDocument.EntityExport entityExport = document.entities().stream()
                .filter(e -> e.id().equals(deathNote.id())).findFirst().orElseThrow();
        assertThat(entityExport.entityTypeCode()).isEqualTo("MANGA");
        assertThat(entityExport.tagLabels()).contains(seinen.label());
        assertThat(entityExport.variants()).extracting(ExportDocument.VariantExport::label).contains("Tome 1");

        ExportDocument.OwnershipExport ownershipExport = document.ownerships().stream()
                .filter(o -> o.id().equals(ownership.id())).findFirst().orElseThrow();
        assertThat(ownershipExport.entityTitle()).isEqualTo(deathNote.title());
        assertThat(ownershipExport.variantLabel()).isEqualTo("Tome 1");
        assertThat(ownershipExport.purchasePrice()).isEqualByComparingTo(new BigDecimal("6.90"));

        assertThat(document.experiences()).anySatisfy(x -> {
            assertThat(x.entityTitle()).isEqualTo(deathNote.title());
            assertThat(x.rating()).isEqualTo(9);
            assertThat(x.variantId()).isEqualTo(tome1.id());
            assertThat(x.variantLabel()).isEqualTo("Tome 1");
        });

        Experience reloaded = experienceRepository.findById(experience.id()).orElseThrow();
        assertThat(reloaded.variantId()).contains(tome1.id());
        assertThat(document.wishlist()).anySatisfy(w -> assertThat(w.entityTitle()).isEqualTo(bakuman.title()));
        assertThat(document.relationships()).anySatisfy(r -> {
            assertThat(r.sourceEntityTitle()).isEqualTo(deathNote.title());
            assertThat(r.targetEntityTitle()).isEqualTo(bakuman.title());
            assertThat(r.relationshipType()).isEqualTo("SAME_AUTHOR");
        });
        assertThat(document.tags()).anySatisfy(t -> assertThat(t.label()).isEqualTo(seinen.label()));
    }
}
