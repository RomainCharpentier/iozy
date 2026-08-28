package com.iozycore.application;

import com.iozycore.domain.catalog.EditionTier;
import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityTypeFixtures;
import java.util.LinkedHashMap;
import com.iozycore.domain.wishlist.WishlistEntryRepository;
import com.iozycore.domain.wishlist.WishlistEntry;
import com.iozycore.domain.catalog.MangaEdition;
import com.iozycore.domain.catalog.MangaEditionRepository;
import com.iozycore.domain.catalog.Variant;
import com.iozycore.domain.ownership.Ownership;
import com.iozycore.domain.ownership.OwnershipCondition;
import com.iozycore.domain.ownership.OwnershipRepository;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Vérifie la déduplication de l'ajout rapide (UC1, étape 6) avec de faux
 * repositories en mémoire - pas besoin de Spring ni de PostgreSQL pour
 * tester cette règle applicative.
 */
class QuickAddServiceTest {

    @Test
    void first_quick_add_creates_a_new_entity() {
        QuickAddService service = newService();

        QuickAddService.QuickAddResult result = service.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "Death Note - Tome 1", OwnershipCondition.NEW);

        assertThat(result.matchedExistingEntity()).isFalse();
    }

    @Test
    void re_adding_the_exact_same_title_reuses_the_existing_entity_instead_of_duplicating_it() {
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        InMemoryOwnershipRepository ownershipRepository = new InMemoryOwnershipRepository();
        QuickAddService service = new QuickAddService(entityRepository, ownershipRepository,
                new CatalogEntityResolver(entityRepository),
                new TomeResolver(entityRepository, new InMemoryMangaEditionRepository()), new InMemoryWishlistEntryRepository(), event -> {
        });

        QuickAddService.QuickAddResult first = service.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "Death Note - Tome 1", OwnershipCondition.NEW);
        // Casse différente volontairement, pour vérifier le match insensible à la casse.
        QuickAddService.QuickAddResult second = service.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "death note - tome 1", OwnershipCondition.USED);

        assertThat(second.matchedExistingEntity()).isTrue();
        assertThat(second.entityId()).isEqualTo(first.entityId());
        assertThat(entityRepository.count()).isEqualTo(1); // aucun doublon dans le Catalog
        assertThat(ownershipRepository.findByEntityId(first.entityId())).hasSize(2); // 2 exemplaires distincts
    }

    @Test
    void a_different_title_never_matches_an_existing_entity() {
        QuickAddService service = newService();

        QuickAddService.QuickAddResult first = service.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "Death Note - Tome 1", OwnershipCondition.NEW);
        QuickAddService.QuickAddResult second = service.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "Death Note - Tome 2", OwnershipCondition.NEW);

        assertThat(second.matchedExistingEntity()).isFalse();
        assertThat(second.entityId()).isNotEqualTo(first.entityId());
    }

    @Test
    void prefilled_attributes_never_overwrite_attributes_already_set_on_a_matched_entity() {
        InMemoryEntityRepository repo = new InMemoryEntityRepository();
        QuickAddService service = new QuickAddService(repo, new InMemoryOwnershipRepository(),
                new CatalogEntityResolver(repo),
                new TomeResolver(repo, new InMemoryMangaEditionRepository()), new InMemoryWishlistEntryRepository(), event -> {
        });

        service.addNewEntityWithOwnership(EntityTypeFixtures.MANGA.id(), "Death Note - Tome 1", OwnershipCondition.NEW,
                Map.of("mangaka", "Saisie manuelle"));
        service.addNewEntityWithOwnership(EntityTypeFixtures.MANGA.id(), "Death Note - Tome 1", OwnershipCondition.NEW,
                Map.of("mangaka", "Ohba, Tsugumi", "publisher", "Kana"));

        Entity entity = repo.findByTypeAndTitle(EntityTypeFixtures.MANGA.id(), "Death Note - Tome 1").orElseThrow();
        assertThat(entity.attributes()).containsEntry("mangaka", "Saisie manuelle"); // pas écrasé
        assertThat(entity.attributes()).containsEntry("publisher", "Kana"); // complété
    }

    @Test
    void adding_two_different_volume_numbers_of_the_same_series_creates_two_variants_on_one_entity() {
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        InMemoryOwnershipRepository ownershipRepository = new InMemoryOwnershipRepository();
        QuickAddService service = new QuickAddService(entityRepository, ownershipRepository,
                new CatalogEntityResolver(entityRepository),
                new TomeResolver(entityRepository, new InMemoryMangaEditionRepository()), new InMemoryWishlistEntryRepository(), event -> {
        });

        QuickAddService.QuickAddResult tome1 = service.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "Death Note", OwnershipCondition.NEW, Map.of(), 1, null);
        QuickAddService.QuickAddResult tome2 = service.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "Death Note", OwnershipCondition.NEW, Map.of(), 2, null);

        assertThat(tome1.entityId()).isEqualTo(tome2.entityId()); // même série, une seule fiche
        assertThat(tome1.variantId()).isNotEqualTo(tome2.variantId()); // deux tomes distincts
        assertThat(tome1.matchedExistingVariant()).isFalse();
        assertThat(tome2.matchedExistingVariant()).isFalse();

        Entity entity = entityRepository.findById(tome1.entityId()).orElseThrow();
        assertThat(entity.variants()).hasSize(2);
        assertThat(ownershipRepository.findByEntityId(entity.id())).hasSize(2);
    }

    @Test
    void re_adding_the_same_volume_number_reuses_the_variant_and_flags_it_as_already_owned() {
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        InMemoryOwnershipRepository ownershipRepository = new InMemoryOwnershipRepository();
        QuickAddService service = new QuickAddService(entityRepository, ownershipRepository,
                new CatalogEntityResolver(entityRepository),
                new TomeResolver(entityRepository, new InMemoryMangaEditionRepository()), new InMemoryWishlistEntryRepository(), event -> {
        });

        QuickAddService.QuickAddResult first = service.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "Death Note", OwnershipCondition.NEW, Map.of(), 3, null);
        QuickAddService.QuickAddResult second = service.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "Death Note", OwnershipCondition.NEW, Map.of(), 3, null);

        assertThat(second.variantId()).isEqualTo(first.variantId()); // même tome, pas de doublon de Variant
        assertThat(second.matchedExistingVariant()).isTrue();

        Entity entity = entityRepository.findById(first.entityId()).orElseThrow();
        assertThat(entity.variants()).hasSize(1); // un seul "Tome 3", pas deux
    }

    @Test
    void same_volume_number_with_a_different_edition_is_a_distinct_variant() {
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        InMemoryMangaEditionRepository mangaEditionRepository = new InMemoryMangaEditionRepository();
        QuickAddService service = new QuickAddService(entityRepository, new InMemoryOwnershipRepository(),
                new CatalogEntityResolver(entityRepository),
                new TomeResolver(entityRepository, mangaEditionRepository), new InMemoryWishlistEntryRepository(), event -> {
        });

        QuickAddService.QuickAddResult pika = service.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "Death Note", OwnershipCondition.NEW, Map.of(), 1, "Pika");
        QuickAddService.QuickAddResult perfectEdition = service.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "Death Note", OwnershipCondition.NEW, Map.of(), 1, "Perfect Edition");

        assertThat(pika.variantId()).isNotEqualTo(perfectEdition.variantId());
        Entity entity = entityRepository.findById(pika.entityId()).orElseThrow();
        assertThat(entity.variants()).hasSize(2);

        // Chaque édition distincte est aussi reliée à sa propre Édition catalogue -
        // pas de doublon, mais pas non plus un seul et même mangaEditionId pour les deux.
        UUID pikaEditionId = variantById(entity, pika.variantId()).mangaEditionId();
        UUID perfectEditionId = variantById(entity, perfectEdition.variantId()).mangaEditionId();
        assertThat(pikaEditionId).isNotNull();
        assertThat(perfectEditionId).isNotNull();
        assertThat(pikaEditionId).isNotEqualTo(perfectEditionId);
        assertThat(mangaEditionRepository.count()).isEqualTo(2);
    }

    @Test
    void adding_the_same_edition_twice_reuses_the_same_manga_edition_never_a_duplicate() {
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        InMemoryMangaEditionRepository mangaEditionRepository = new InMemoryMangaEditionRepository();
        QuickAddService service = new QuickAddService(entityRepository, new InMemoryOwnershipRepository(),
                new CatalogEntityResolver(entityRepository),
                new TomeResolver(entityRepository, mangaEditionRepository), new InMemoryWishlistEntryRepository(), event -> {
        });

        QuickAddService.QuickAddResult tome1 = service.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "Death Note", OwnershipCondition.NEW, Map.of(), 1, "Perfect Edition");
        QuickAddService.QuickAddResult tome2 = service.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "Death Note", OwnershipCondition.NEW, Map.of(), 2, "Perfect Edition");

        Entity entity = entityRepository.findById(tome1.entityId()).orElseThrow();
        UUID edition1 = variantById(entity, tome1.variantId()).mangaEditionId();
        UUID edition2 = variantById(entity, tome2.variantId()).mangaEditionId();
        assertThat(edition1).isEqualTo(edition2); // même édition, pas un doublon par tome
        assertThat(mangaEditionRepository.count()).isEqualTo(1);
    }

    @Test
    void no_edition_means_no_manga_edition_is_created_or_linked() {
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        InMemoryMangaEditionRepository mangaEditionRepository = new InMemoryMangaEditionRepository();
        QuickAddService service = new QuickAddService(entityRepository, new InMemoryOwnershipRepository(),
                new CatalogEntityResolver(entityRepository),
                new TomeResolver(entityRepository, mangaEditionRepository), new InMemoryWishlistEntryRepository(), event -> {
        });

        QuickAddService.QuickAddResult result = service.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "Death Note", OwnershipCondition.NEW, Map.of(), 5, null);

        Entity entity = entityRepository.findById(result.entityId()).orElseThrow();
        assertThat(variantById(entity, result.variantId()).mangaEditionId()).isNull();
        assertThat(mangaEditionRepository.count()).isZero();
    }

    @Test
    void an_existing_manga_edition_not_yet_linked_to_this_series_gets_linked_opportunistically() {
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        InMemoryMangaEditionRepository mangaEditionRepository = new InMemoryMangaEditionRepository();
        // Simule une Édition déjà connue via l'Analyse d'achat, avant que "Death Note"
        // soit dans la collection (entityId encore null à ce stade).
        MangaEdition preExisting = mangaEditionRepository.save(MangaEdition.create(
                "Death Note", "Perfect Edition", EditionTier.DELUXE, "Kana", 6, null, false, false, null));
        QuickAddService service = new QuickAddService(entityRepository, new InMemoryOwnershipRepository(),
                new CatalogEntityResolver(entityRepository),
                new TomeResolver(entityRepository, mangaEditionRepository), new InMemoryWishlistEntryRepository(), event -> {
        });

        QuickAddService.QuickAddResult result = service.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "Death Note", OwnershipCondition.NEW, Map.of(), 1, "Perfect Edition");

        Entity entity = entityRepository.findById(result.entityId()).orElseThrow();
        assertThat(variantById(entity, result.variantId()).mangaEditionId()).isEqualTo(preExisting.id());
        assertThat(mangaEditionRepository.count()).isEqualTo(1); // réutilisée, pas dupliquée
        assertThat(mangaEditionRepository.findById(preExisting.id()).orElseThrow().entityId())
                .isEqualTo(result.entityId()); // reliée après coup, jamais devinée avant
    }

    private static Variant variantById(Entity entity, UUID variantId) {
        return entity.variants().stream().filter(v -> v.id().equals(variantId)).findFirst().orElseThrow();
    }

    @Test
    void no_volume_number_means_no_variant_at_all_legacy_behavior() {
        QuickAddService service = newService();

        QuickAddService.QuickAddResult result = service.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "Death Note", OwnershipCondition.NEW);

        assertThat(result.variantId()).isNull();
        assertThat(result.matchedExistingVariant()).isFalse();
    }

    @Test
    void une_date_d_acquisition_fournie_est_respectee_plutot_que_remplacee_par_aujourd_hui() {
        // Le seul usage : annuler un retrait de tome. Sans ce champ, l'annulation
        // rajoutait l'exemplaire AVEC LA DATE DU JOUR, effacant la vraie date
        // d'acquisition - constate le 2026-08-28 sur un tome passe du 26/08 au
        // 28/08 apres un aller-retour. Une annulation qui abime ce qu'elle
        // restaure ne restaure rien.
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        InMemoryOwnershipRepository ownershipRepository = new InMemoryOwnershipRepository();
        QuickAddService service = new QuickAddService(entityRepository, ownershipRepository,
                new CatalogEntityResolver(entityRepository),
                new TomeResolver(entityRepository, new InMemoryMangaEditionRepository()),
                new InMemoryWishlistEntryRepository(), event -> {
                });
        LocalDate origine = LocalDate.of(2026, 8, 26);

        QuickAddService.QuickAddResult resultat = service.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "Death Note", OwnershipCondition.NEW, Map.of(), 2, "Black Edition",
                null, null, origine);

        assertThat(ownershipRepository.findByEntityId(resultat.entityId()))
                .singleElement()
                .satisfies(o -> assertThat(o.acquiredAt()).isEqualTo(origine));
    }

    @Test
    void sans_date_fournie_l_ajout_reste_date_d_aujourd_hui() {
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        InMemoryOwnershipRepository ownershipRepository = new InMemoryOwnershipRepository();
        QuickAddService service = new QuickAddService(entityRepository, ownershipRepository,
                new CatalogEntityResolver(entityRepository),
                new TomeResolver(entityRepository, new InMemoryMangaEditionRepository()),
                new InMemoryWishlistEntryRepository(), event -> {
                });

        QuickAddService.QuickAddResult resultat = service.addNewEntityWithOwnership(
                EntityTypeFixtures.MANGA.id(), "Naruto", OwnershipCondition.NEW);

        assertThat(ownershipRepository.findByEntityId(resultat.entityId()))
                .singleElement()
                .satisfies(o -> assertThat(o.acquiredAt()).isEqualTo(LocalDate.now()));
    }

    private QuickAddService newService() {
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        return new QuickAddService(entityRepository, new InMemoryOwnershipRepository(),
                new CatalogEntityResolver(entityRepository),
                new TomeResolver(entityRepository, new InMemoryMangaEditionRepository()), new InMemoryWishlistEntryRepository(), event -> {
        });
    }

    /** Faux repository en mémoire, suffisant pour tester la logique applicative sans Spring/PostgreSQL. */
    private static class InMemoryEntityRepository implements EntityRepository {
        private final Map<UUID, Entity> store = new HashMap<>();

        @Override
        public Entity save(Entity entity) {
            store.put(entity.id(), entity);
            return entity;
        }

        @Override
        public Optional<Entity> findById(UUID id) {
            return Optional.ofNullable(store.get(id));
        }

        @Override
        public Optional<Entity> findByTypeAndTitle(UUID entityTypeId, String title) {
            return store.values().stream()
                    .filter(e -> e.entityTypeId().equals(entityTypeId) && e.title().equalsIgnoreCase(title))
                    .findFirst();
        }

        @Override
        public List<Entity> findAllByType(UUID entityTypeId) {
            List<Entity> result = new ArrayList<>();
            for (Entity entity : store.values()) {
                if (entity.entityTypeId().equals(entityTypeId)) {
                    result.add(entity);
                }
            }
            return result;
        }

        @Override
        public List<Entity> search(String titleQuery, UUID entityTypeId, UUID tagId) {
            return store.values().stream()
                    .filter(e -> titleQuery == null || titleQuery.isBlank()
                            || e.title().toLowerCase().contains(titleQuery.toLowerCase()))
                    .filter(e -> entityTypeId == null || e.entityTypeId().equals(entityTypeId))
                    .filter(e -> tagId == null || e.tagIds().contains(tagId))
                    .collect(java.util.stream.Collectors.toList());
        }

        @Override
        public boolean existsByType(UUID entityTypeId) {
            return store.values().stream().anyMatch(e -> e.entityTypeId().equals(entityTypeId));
        }

        @Override
        public void deleteById(UUID id) {
            store.remove(id);
        }

        int count() {
            return store.size();
        }
    }

    /** Faux repository en mémoire pour MangaEdition, même patron que InMemoryEntityRepository ci-dessus. */
    private static class InMemoryMangaEditionRepository implements MangaEditionRepository {
        private final Map<UUID, MangaEdition> store = new HashMap<>();

        @Override
        public MangaEdition save(MangaEdition edition) {
            store.put(edition.id(), edition);
            return edition;
        }

        @Override
        public Optional<MangaEdition> findById(UUID id) {
            return Optional.ofNullable(store.get(id));
        }

        @Override
        public List<MangaEdition> findAll() {
            return List.copyOf(store.values());
        }

        @Override
        public Optional<MangaEdition> findBySeriesAndEdition(String seriesTitle, String editionName) {
            return store.values().stream()
                    .filter(e -> e.seriesTitle().equalsIgnoreCase(seriesTitle) && e.editionName().equalsIgnoreCase(editionName))
                    .findFirst();
        }

        @Override
        public List<MangaEdition> findBySeriesTitle(String seriesTitle) {
            return store.values().stream()
                    .filter(e -> e.seriesTitle().equalsIgnoreCase(seriesTitle))
                    .collect(java.util.stream.Collectors.toList());
        }

        @Override
        public List<MangaEdition> findByEntityId(UUID entityId) {
            return store.values().stream()
                    .filter(e -> entityId.equals(e.entityId()))
                    .collect(java.util.stream.Collectors.toList());
        }

        @Override
        public Optional<MangaEdition> findByEntityIdAndEditionName(UUID entityId, String editionName) {
            return store.values().stream()
                    .filter(e -> entityId.equals(e.entityId()) && e.editionName().equalsIgnoreCase(editionName))
                    .findFirst();
        }

        @Override
        public void deleteById(UUID id) {
            store.remove(id);
        }

        int count() {
            return store.size();
        }
    }

    private static class InMemoryOwnershipRepository implements OwnershipRepository {
        private final Map<UUID, Ownership> store = new HashMap<>();

        @Override
        public Ownership save(Ownership ownership) {
            store.put(ownership.id(), ownership);
            return ownership;
        }

        @Override
        public Optional<Ownership> findById(UUID id) {
            return Optional.ofNullable(store.get(id));
        }

        @Override
        public List<Ownership> findByEntityId(UUID entityId) {
            List<Ownership> result = new ArrayList<>();
            for (Ownership ownership : store.values()) {
                if (ownership.entityId().equals(entityId)) {
                    result.add(ownership);
                }
            }
            return result;
        }

        @Override
        public boolean existsByEntityId(UUID entityId) {
            return !findByEntityId(entityId).isEmpty();
        }

        @Override
        public List<Ownership> findAll() {
            return new ArrayList<>(store.values());
        }

        @Override
        public void deleteById(UUID id) {
            store.remove(id);
        }
    }

    /** Double local, comme les autres dépôts de ce fichier : QuickAddService
     *  referme l'envie d'une œuvre qu'on vient d'acquérir (voir
     *  retirerDesEnvies), il lui faut donc un dépôt d'envies. */
    private static class InMemoryWishlistEntryRepository implements WishlistEntryRepository {
        private final Map<UUID, WishlistEntry> parId = new LinkedHashMap<>();

        @Override
        public WishlistEntry save(WishlistEntry entry) {
            parId.put(entry.id(), entry);
            return entry;
        }

        @Override
        public Optional<WishlistEntry> findByEntityId(UUID entityId) {
            return parId.values().stream().filter(e -> e.entityId().equals(entityId)).findFirst();
        }

        @Override
        public List<WishlistEntry> findAll() {
            return List.copyOf(parId.values());
        }

        @Override
        public Optional<WishlistEntry> findByVariantId(UUID variantId) {
            return parId.values().stream()
                    .filter(e -> e.variantId().map(variantId::equals).orElse(false))
                    .findFirst();
        }

        @Override
        public List<WishlistEntry> findAllByEntityId(UUID entityId) {
            return parId.values().stream().filter(e -> e.entityId().equals(entityId)).toList();
        }

        @Override
        public void deleteById(UUID id) {
            parId.remove(id);
        }
    }
}
