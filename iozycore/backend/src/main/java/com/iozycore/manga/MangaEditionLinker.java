package com.iozycore.manga;

import com.iozycore.core.application.EditionLinker;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.manga.domain.EditionTier;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.manga.domain.MangaEditionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.UUID;

/**
 * The reference edition of a volume: found by (work, name), otherwise by
 * (title, name) - an edition declared before the series exists is then
 * attached -, otherwise created, with nothing more than its name. This is what
 * makes "X/Y" possible from the first volume added (logic extracted from
 * TomeResolver in Batch 133).
 */
@Component
@RequiredArgsConstructor
public class MangaEditionLinker implements EditionLinker {

    private final MangaEditionRepository mangaEditionRepository;

    @Override
    public Optional<UUID> editionIdPour(Entity oeuvre, String nomEdition) {
        Optional<MangaEdition> parId = mangaEditionRepository.findByEntityIdAndEditionName(oeuvre.id(), nomEdition);
        if (parId.isPresent()) {
            return Optional.of(parId.get().id());
        }
        Optional<MangaEdition> parTitre = mangaEditionRepository.findBySeriesAndEdition(oeuvre.title(), nomEdition);
        if (parTitre.isPresent()) {
            MangaEdition edition = parTitre.get();
            if (edition.entityId() == null) {
                edition = mangaEditionRepository.save(edition.withEntityId(oeuvre.id()));
            }
            return Optional.of(edition.id());
        }
        MangaEdition creee = MangaEdition.create(oeuvre.id(), oeuvre.title(), nomEdition, EditionTier.OTHER,
                null, null, null, false, false, null);
        return Optional.of(mangaEditionRepository.save(creee).id());
    }
}
