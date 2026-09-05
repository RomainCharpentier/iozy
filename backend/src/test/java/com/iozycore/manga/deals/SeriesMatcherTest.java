package com.iozycore.manga.deals;

import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityType;
import com.iozycore.domain.catalog.EntityTypeRepository;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Le point de passage unique entre un titre lu quelque part et une œuvre du
 * catalogue.
 *
 * <p>C'est ici que la décoration d'annonce est retirée, plutôt que chez chaque
 * appelant : texte de l'annonce, lecture de photo ou saisie manuelle traversent
 * tous cette porte, et une seule normalisation ne peut pas en contredire une
 * autre.
 */
class SeriesMatcherTest {

    private static final UUID TYPE_MANGA = UUID.randomUUID();

    private final CatalogueEnMemoire catalogue = new CatalogueEnMemoire();
    private final TypesEnMemoire types = new TypesEnMemoire();
    private final SeriesMatcher matcher = new SeriesMatcher(catalogue, types);

    // ====================================================== Le défaut corrigé

    @Test
    void a_decorated_listing_title_still_finds_the_catalogued_series() {
        UUID hellsParadise = catalogue.ajouter("Hell's Paradise");

        MangaSeries serie = matcher.match("🔥 Hell's Paradise");

        assertThat(serie.knownEntityId()).isEqualTo(hellsParadise);
        // Le titre rendu est celui de l'œuvre, pas celui de l'annonce : c'est
        // lui qui s'affiche et qui part dans le lot.
        assertThat(serie.title()).isEqualTo("Hell's Paradise");
    }

    @Test
    void matching_a_decorated_title_never_creates_a_new_series() {
        catalogue.ajouter("Hell's Paradise");

        matcher.match("🔥 Hell's Paradise");
        matcher.match("✨ Hell's Paradise ✨");

        // SeriesMatcher est en lecture seule : une reconnaissance ne devient
        // jamais une fiche catalogue toute seule.
        assertThat(catalogue.creations()).isZero();
        assertThat(catalogue.tailles()).isEqualTo(1);
    }

    @Test
    void decoration_on_both_sides_is_handled_too() {
        UUID deathNote = catalogue.ajouter("Death Note");

        assertThat(matcher.match("✨ Death Note ✨").knownEntityId()).isEqualTo(deathNote);
        assertThat(matcher.match("📚 Death Note").knownEntityId()).isEqualTo(deathNote);
        assertThat(matcher.match("【】 Death Note").knownEntityId()).isEqualTo(deathNote);
    }

    // ====================================================== Titres légitimes

    @Test
    void a_title_whose_punctuation_matters_is_still_found() {
        UUID kOn = catalogue.ajouter("K-ON!");
        UUID kaguya = catalogue.ajouter("Kaguya-sama: Love Is War");
        UUID century = catalogue.ajouter("20th Century Boys");

        assertThat(matcher.match("K-ON!").knownEntityId()).isEqualTo(kOn);
        assertThat(matcher.match("Kaguya-sama: Love Is War").knownEntityId()).isEqualTo(kaguya);
        assertThat(matcher.match("20th Century Boys").knownEntityId()).isEqualTo(century);
    }

    @Test
    void the_existing_case_insensitive_matching_is_untouched() {
        UUID platinumEnd = catalogue.ajouter("Platinum End");

        assertThat(matcher.match("platinum end").knownEntityId()).isEqualTo(platinumEnd);
        assertThat(matcher.match("🔥 PLATINUM END").knownEntityId()).isEqualTo(platinumEnd);
    }

    @Test
    void an_unknown_series_stays_unknown_rather_than_matching_something_close() {
        catalogue.ajouter("Naruto");

        assertThat(matcher.match("🔥 Boruto").knownEntityId()).isNull();
        assertThat(matcher.match("🔥 Boruto").title()).isEqualTo("Boruto");
    }

    // ====================================================== Bout en bout : annonce -> catalogue

    @Test
    void a_listing_whose_title_contains_a_number_finds_its_catalogued_series() {
        UUID century = catalogue.ajouter("20th Century Boys");

        String titre = ListingTextParser.probableSeriesTitle("20th Century Boys tomes 1 à 4");

        assertThat(matcher.match(titre).knownEntityId()).isEqualTo(century);
        assertThat(catalogue.creations()).isZero();
    }

    @Test
    void a_listing_whose_title_contains_punctuation_finds_its_catalogued_series() {
        UUID kaguya = catalogue.ajouter("Kaguya-sama: Love Is War");

        String titre = ListingTextParser.probableSeriesTitle("Kaguya-sama: Love Is War - Tomes 1 à 3");

        assertThat(matcher.match(titre).knownEntityId()).isEqualTo(kaguya);
        assertThat(catalogue.creations()).isZero();
    }

    @Test
    void a_dotted_and_hyphenated_title_finds_its_catalogued_series() {
        UUID dgrayman = catalogue.ajouter("D.Gray-man");

        String titre = ListingTextParser.probableSeriesTitle("D.Gray-man tomes 1 à 3");

        assertThat(matcher.match(titre).knownEntityId()).isEqualTo(dgrayman);
        assertThat(catalogue.creations()).isZero();
    }

    @Test
    void a_decorated_listing_with_a_numeric_title_still_finds_its_series() {
        // Les deux couches se complètent : le parser isole le titre du lot, le
        // normaliseur retire la décoration périphérique.
        UUID century = catalogue.ajouter("20th Century Boys");

        String titre = ListingTextParser.probableSeriesTitle("🔥 20th Century Boys – Tomes 1 à 4");

        assertThat(matcher.match(titre).knownEntityId()).isEqualTo(century);
    }

    // ====================================================== Bords

    @Test
    void a_title_without_any_word_is_refused_rather_than_matched_on_nothing() {
        assertThatThrownBy(() -> matcher.match(null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> matcher.match("   ")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void a_title_made_only_of_decoration_does_not_become_empty() {
        // Inexploitable, mais le vider ferait perdre la seule trace disponible.
        assertThat(matcher.match("🔥🔥").title()).isEqualTo("🔥🔥");
    }

    // ====================================================== Doublures

    private static class TypesEnMemoire implements EntityTypeRepository {
        @Override
        public Optional<EntityType> findByCode(String code) {
            return "MANGA".equals(code)
                    ? Optional.of(EntityType.reconstitute(TYPE_MANGA, "MANGA", "Manga", Set.of("READ"), Set.of()))
                    : Optional.empty();
        }

        @Override
        public EntityType save(EntityType entityType) {
            throw new UnsupportedOperationException("SeriesMatcher ne doit rien écrire");
        }

        @Override
        public Optional<EntityType> findById(UUID id) {
            return Optional.empty();
        }

        @Override
        public List<EntityType> findAll() {
            return List.of();
        }

        @Override
        public void deleteById(UUID id) {
            throw new UnsupportedOperationException("SeriesMatcher ne doit rien supprimer");
        }
    }

    /** Compte toute écriture : le matcher ne doit en produire aucune. */
    private static class CatalogueEnMemoire implements EntityRepository {
        private final List<Entity> entities = new ArrayList<>();
        private int creations;

        UUID ajouter(String titre) {
            Entity entity = Entity.create(TYPE_MANGA, titre);
            entities.add(entity);
            return entity.id();
        }

        int creations() {
            return creations;
        }

        int tailles() {
            return entities.size();
        }

        @Override
        public Entity save(Entity entity) {
            creations++;
            entities.add(entity);
            return entity;
        }

        @Override
        public Optional<Entity> findById(UUID id) {
            return entities.stream().filter(e -> e.id().equals(id)).findFirst();
        }

        @Override
        public Optional<Entity> findByTypeAndTitle(UUID entityTypeId, String title) {
            // Même convention que l'adaptateur JPA : insensible à la casse.
            return entities.stream()
                    .filter(e -> e.entityTypeId().equals(entityTypeId) && e.title().equalsIgnoreCase(title))
                    .findFirst();
        }

        @Override
        public List<Entity> findAllByType(UUID entityTypeId) {
            return entities.stream().filter(e -> e.entityTypeId().equals(entityTypeId)).toList();
        }

        @Override
        public boolean existsByType(UUID entityTypeId) {
            return !findAllByType(entityTypeId).isEmpty();
        }

        @Override
        public List<Entity> search(String titleQuery, UUID entityTypeId, UUID tagId) {
            return List.of();
        }

        @Override
        public void deleteById(UUID id) {
            throw new UnsupportedOperationException("SeriesMatcher ne doit rien supprimer");
        }
    }
}
