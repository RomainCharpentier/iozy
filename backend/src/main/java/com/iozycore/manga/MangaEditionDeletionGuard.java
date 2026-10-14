package com.iozycore.manga;

import com.iozycore.core.application.EntityDeletionGuard;
import com.iozycore.manga.domain.MangaEditionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.UUID;

/** A series still referenced by a reference edition cannot be deleted (constraint manga_edition.entity_id). */
@Component
@RequiredArgsConstructor
public class MangaEditionDeletionGuard implements EntityDeletionGuard {

    private final MangaEditionRepository mangaEditionRepository;

    @Override
    public long referencesRestantes(UUID entityId) {
        return mangaEditionRepository.findByEntityId(entityId).size();
    }
}
