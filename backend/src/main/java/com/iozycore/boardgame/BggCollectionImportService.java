package com.iozycore.boardgame;

import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.boardgame.bgg.BggCollectionFetcher;
import com.iozycore.boardgame.bgg.BggCollectionItem;
import com.iozycore.core.application.QuickAddService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Imports in one go the board games marked "owned" in a user's
 * BGG collection. Reuses QuickAddService (so its deduplication
 * by title) instead of duplicating the Entity+Ownership creation logic
 * - a BGG import and a manual quick add are
 * basically the same operation, just triggered in bulk.
 * <p>
 * Each game is imported in its own transaction (through the call to
 * QuickAddService, which is itself @Transactional): one invalid item in the middle
 * of a collection of 200 games does not make the other 199 fail.
 */
@Service
public class BggCollectionImportService {

    private static final Logger log = LoggerFactory.getLogger(BggCollectionImportService.class);

    private final BggCollectionFetcher collectionFetcher;
    private final QuickAddService quickAddService;
    private final EntityTypeRepository entityTypeRepository;

    public BggCollectionImportService(BggCollectionFetcher collectionFetcher, QuickAddService quickAddService,
                                       EntityTypeRepository entityTypeRepository) {
        this.collectionFetcher = collectionFetcher;
        this.quickAddService = quickAddService;
        this.entityTypeRepository = entityTypeRepository;
    }

    public record ImportResult(int totalFound, int created, int matchedExisting, int failed) {
    }

    public ImportResult importOwnedGames(String bggUsername) {
        List<BggCollectionItem> items = collectionFetcher.fetchOwnedGames(bggUsername);

        // Resolved once (not per item) - the BGG import is inherently
        // tied to the "board game" type, wired on its well-known code.
        UUID boardGameTypeId = entityTypeRepository.findByCode("BOARD_GAME")
                .orElseThrow(() -> new IllegalStateException("Type BOARD_GAME introuvable"))
                .id();

        int created = 0;
        int matchedExisting = 0;
        int failed = 0;

        for (BggCollectionItem item : items) {
            try {
                Map<String, Object> attributes = item.yearPublished() != null
                        ? Map.of("yearPublished", item.yearPublished(), "bggId", item.externalId())
                        : Map.of("bggId", item.externalId());

                QuickAddService.QuickAddResult result = quickAddService.addNewEntityWithOwnership(
                        boardGameTypeId, item.title(), OwnershipCondition.USED, attributes);

                if (result.matchedExistingEntity()) {
                    matchedExisting++;
                } else {
                    created++;
                }
            } catch (Exception e) {
                // A game that fails to import (empty title, etc.) must not
                // stop the import of the next ones - we count it and carry on.
                log.warn("Failed to import BGG game '{}' (id {}): {}", item.title(), item.externalId(), e.getMessage());
                failed++;
            }
        }

        return new ImportResult(items.size(), created, matchedExisting, failed);
    }
}
