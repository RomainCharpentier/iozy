package com.iozycore.manga;

import com.iozycore.core.application.VariantDeletionHook;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.Variant;
import com.iozycore.manga.deals.MarketPriceObservationRepository;
import com.iozycore.manga.domain.MangaEditionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * After the deletion of a volume: its reference edition, if no other
 * volume carries it and no recorded price is attached to it, is deleted
 * with it - an edition with no volume and no record has nothing left to say (logic
 * extracted from VariantDeletionService in Batch 133).
 */
@Component
@RequiredArgsConstructor
public class MangaOrphanEditionCleanup implements VariantDeletionHook {

    private final MangaEditionRepository mangaEditionRepository;
    private final MarketPriceObservationRepository marketPriceObservationRepository;

    @Override
    public void apresSuppression(Entity oeuvre, Variant tomeSupprime, UUID tomeSupprimeId) {
        UUID mangaEditionId = tomeSupprime == null ? null : tomeSupprime.mangaEditionId();
        if (mangaEditionId == null) {
            return;
        }
        boolean encoreReferencee = oeuvre.variants().stream()
                .anyMatch(v -> mangaEditionId.equals(v.mangaEditionId()));
        if (encoreReferencee || !marketPriceObservationRepository.findByEditionId(mangaEditionId).isEmpty()) {
            return;
        }
        mangaEditionRepository.deleteById(mangaEditionId);
    }
}
