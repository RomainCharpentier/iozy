package com.iozycore.boardgame;

import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.boardgame.bgg.BggCollectionFetcher;
import com.iozycore.boardgame.bgg.BggCollectionItem;
import com.iozycore.core.application.QuickAddService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
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
@RequiredArgsConstructor
@Slf4j
public class BggCollectionImportService {

    private final BggCollectionFetcher collectionFetcher;
    private final QuickAddService quickAddService;
    private final EntityTypeRepository entityTypeRepository;

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
                Map<String, Object> attributes = attributesOf(item);

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

    /**
     * Same keys as BggMetadataProvider.details, so an imported game looks like
     * one added by hand. Only what the collection answer gave: no /thing call.
     */
    static Map<String, Object> attributesOf(BggCollectionItem item) {
        Map<String, Object> attributes = new LinkedHashMap<>();
        attributes.put("bggId", item.externalId());
        putIfPresent(attributes, "yearPublished", item.yearPublished());
        if (item.imageUrl() != null && !item.imageUrl().isBlank()) {
            attributes.put("coverImageUrl", item.imageUrl());
        }
        putIfPresent(attributes, "minPlayers", item.minPlayers());
        putIfPresent(attributes, "maxPlayers", item.maxPlayers());
        putIfPresent(attributes, "averageDurationMinutes", item.playingTimeMinutes());
        return attributes;
    }

    private static void putIfPresent(Map<String, Object> attributes, String key, Object value) {
        if (value != null) {
            attributes.put(key, value);
        }
    }
}
