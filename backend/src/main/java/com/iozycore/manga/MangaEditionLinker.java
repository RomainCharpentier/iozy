package com.iozycore.manga;

import com.iozycore.core.application.EditionLinker;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.manga.domain.EditionTier;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.manga.domain.MangaEditionRepository;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.UUID;

/**
 * L'édition de référence d'un tome : retrouvée par (œuvre, nom), sinon par
 * (titre, nom) - une édition déclarée avant que la série n'existe est alors
 * rattachée -, sinon créée, sans rien de plus que son nom. C'est ce qui
 * rend « X/Y » possible dès le premier tome ajouté (logique extraite de
 * TomeResolver au Lot 133).
 */
@Component
public class MangaEditionLinker implements EditionLinker {

    private final MangaEditionRepository mangaEditionRepository;

    public MangaEditionLinker(MangaEditionRepository mangaEditionRepository) {
        this.mangaEditionRepository = mangaEditionRepository;
    }

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
