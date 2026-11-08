package com.iozycore.manga.application;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.testing.InMemoryEntityRepository;
import com.iozycore.core.testing.InMemoryEntityTypeRepository;
import com.iozycore.manga.MangaEditionLinker;
import com.iozycore.manga.domain.EditionTier;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.manga.domain.TotalSource;
import com.iozycore.manga.testing.InMemoryMangaEditionRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** A total typed by a person: only on an edition this series has, never on another series' row. */
class EditionTotalServiceTest {

    private final InMemoryEntityRepository entities = new InMemoryEntityRepository();
    private final InMemoryMangaEditionRepository editions = new InMemoryMangaEditionRepository();
    private final EditionTotalService service = new EditionTotalService(entities,
            new InMemoryEntityTypeRepository(EntityTypeFixtures.MANGA), editions,
            List.of(new MangaEditionLinker(editions)));

    @Test
    void a_name_the_series_does_not_have_creates_nothing() {
        Entity pluto = serie("Pluto", "Kana");

        assertThatThrownBy(() -> service.setTotal(pluto.id(), "Knaa", 5))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Cette série n'a pas d'édition « Knaa »");
        assertThatThrownBy(() -> service.setTotal(pluto.id(), "X", null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(editions.findAll()).isEmpty();
    }

    @Test
    void a_known_name_is_matched_without_case_or_accents_and_stored_as_the_series_writes_it() {
        Entity berserk = serie("Berserk", "Glénat");

        MangaEdition edition = service.setTotal(berserk.id(), "GLENAT", 41);

        assertThat(edition.editionName()).isEqualTo("Glénat");
        assertThat(edition.entityId()).isEqualTo(berserk.id());
        assertThat(edition.totalVolumes()).isEqualTo(41);
        assertThat(edition.totalSource()).isEqualTo(TotalSource.MANUAL);
    }

    @Test
    void refuses_the_edition_row_of_a_homonym_series() {
        Entity first = serie("Doubt", "Ki-oon");
        MangaEdition theirs = editions.save(MangaEdition.create(first.id(), "Doubt", "Ki-oon", EditionTier.STANDARD,
                null, 4, null, false, false, null));
        Entity homonym = serie("Doubt", "Ki-oon");

        assertThatThrownBy(() -> service.setTotal(homonym.id(), "Ki-oon", 9))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("L'édition « Ki-oon » appartient à une autre série du même titre");
        assertThat(editions.findById(theirs.id()).orElseThrow().totalVolumes()).isEqualTo(4);
    }

    private Entity serie(String title, String edition) {
        Entity entity = Entity.create(EntityTypeFixtures.MANGA.id(), title);
        entity.addVariant("Tome 1 " + edition, Map.of("volumeNumber", 1, "edition", edition));
        return entities.save(entity);
    }
}
