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
import com.iozycore.manga.domain.followededition.FollowedEdition;
import com.iozycore.manga.domain.followededition.FollowedEditionRepository;
import com.iozycore.domain.ownership.Ownership;
import com.iozycore.domain.ownership.OwnershipCondition;
import com.iozycore.domain.ownership.OwnershipRepository;
import com.iozycore.domain.wishlist.WishlistEntry;
import com.iozycore.domain.wishlist.WishlistEntryRepository;
import com.iozycore.manga.domain.EditionTier;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.manga.domain.MangaEditionRepository;
import com.iozycore.manga.deals.Condition;
import com.iozycore.listing.ListingPlatform;
import com.iozycore.manga.deals.MarketPriceObservation;
import com.iozycore.manga.deals.MarketPriceObservationRepository;
import com.iozycore.manga.deals.VolumeRange;
import com.iozycore.export.ExportDocument;
import com.iozycore.export.ExportService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Validates ExportService (§19, docs/CONCEPTION.md - anti-lock-in) against a real PostgreSQL - mirrors EntityPersistenceIntegrationTest. */
class ExportIntegrationTest extends PostgresIntegrationTest {


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
    private MangaEditionRepository mangaEditionRepository;
    @Autowired
    private MarketPriceObservationRepository marketPriceObservationRepository;
    @Autowired
    private FollowedEditionRepository followedEditionRepository;
    @Autowired
    private ExportService exportService;

    /**
     * Le critère du Lot 33, appliqué à ce qui restait dehors : un prix relevé à
     * la main, l'édition qu'on suit, un type de collection créé soi-même et le
     * profil qui pondère les verdicts n'existent nulle part ailleurs. Un export
     * qui les omet promet une porte de sortie qu'il n'ouvre pas.
     */
    @Test
    void l_export_emporte_aussi_ce_qui_ne_se_reconstruit_nulle_part_ailleurs() {
        Entity serie = Entity.create(EntityTypeFixtures.MANGA.id(), "Vinland " + UUID.randomUUID());
        entityRepository.save(serie);

        MangaEdition edition = mangaEditionRepository.save(MangaEdition.create(
                serie.title(), "Kurokawa", EditionTier.STANDARD, "Kurokawa", 27,
                new BigDecimal("7.65"), false, false, null));
        MarketPriceObservation releve = marketPriceObservationRepository.save(MarketPriceObservation.record_(
                edition.id(), new VolumeRange(1, 3), new BigDecimal("21.00"), ListingPlatform.LEBONCOIN,
                Condition.GOOD, LocalDate.now(), "vu en brocante"));
        FollowedEdition suivie = followedEditionRepository.save(FollowedEdition.create(serie.id(), "Kurokawa"));

        ExportDocument document = exportService.buildExportDocument();

        ExportDocument.MarketObservationExport releveExporte = document.marketObservations().stream()
                .filter(o -> o.id().equals(releve.id())).findFirst().orElseThrow();
        // Dénormalisé comme le reste de l'export : lisible sans rejoindre une autre table.
        assertThat(releveExporte.seriesTitle()).isEqualTo(serie.title());
        assertThat(releveExporte.editionName()).isEqualTo("Kurokawa");
        assertThat(releveExporte.observedPrice()).isEqualByComparingTo(new BigDecimal("21.00"));
        assertThat(releveExporte.origin()).isEqualTo("MANUAL_ENTRY");
        assertThat(releveExporte.note()).isEqualTo("vu en brocante");

        ExportDocument.FollowedEditionExport suivieExportee = document.followedEditions().stream()
                .filter(f -> f.id().equals(suivie.id())).findFirst().orElseThrow();
        assertThat(suivieExportee.entityTitle()).isEqualTo(serie.title());
        assertThat(suivieExportee.editionName()).isEqualTo("Kurokawa");

        // Le code et le libellé voyagent déjà sur chaque œuvre ; ce qui manquait,
        // c'est ce qu'un type personnalisé porte en propre.
        assertThat(document.entityTypes()).extracting(ExportDocument.EntityTypeExport::code).contains("MANGA");

        assertThat(document.collectorPreferences()).isNotNull();
        assertThat(document.collectorPreferences().conditionImportance()).isNotBlank();
    }

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
