package com.iozycore.manga;

import com.iozycore.core.application.VariantDeletionHook;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.Variant;
import com.iozycore.manga.deals.MarketPriceObservationRepository;
import com.iozycore.manga.domain.MangaEditionRepository;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Après la suppression d'un tome : son édition de référence, si plus aucun
 * tome ne la porte et qu'aucun prix relevé ne s'y rattache, est effacée
 * avec lui - une édition sans tome ni relevé n'a plus rien à dire (logique
 * extraite de VariantDeletionService au Lot 133).
 */
@Component
public class MangaOrphanEditionCleanup implements VariantDeletionHook {

    private final MangaEditionRepository mangaEditionRepository;
    private final MarketPriceObservationRepository marketPriceObservationRepository;

    public MangaOrphanEditionCleanup(MangaEditionRepository mangaEditionRepository,
                                     MarketPriceObservationRepository marketPriceObservationRepository) {
        this.mangaEditionRepository = mangaEditionRepository;
        this.marketPriceObservationRepository = marketPriceObservationRepository;
    }

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
