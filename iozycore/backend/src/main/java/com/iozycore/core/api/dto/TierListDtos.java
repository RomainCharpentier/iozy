package com.iozycore.core.api.dto;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.tierlist.Rank;
import com.iozycore.core.domain.tierlist.TierList;
import com.iozycore.core.domain.tierlist.TierListItem;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

public class TierListDtos {

    /** @param entityTypeId universe of the list - {@code null} for a cross-cutting
     *                     "all categories" Tier List (see TierList). */
    public record CreateTierListRequest(String name, UUID entityTypeId, Set<Rank> activeRanks, String description) {
    }

    public record UpdateTierListRequest(String name, Set<Rank> activeRanks, String description) {
    }

    /** @param entityTypeId {@code null} for a cross-cutting "all
     *                     categories" Tier List - the client then shows it outside any universe. */
    public record TierListResponse(UUID id, String name, UUID entityTypeId, Set<Rank> activeRanks, String description,
                                    Instant createdAt, int itemCount, int rankedCount) {
        public static TierListResponse from(TierList list, int itemCount, int rankedCount) {
            return new TierListResponse(list.id(), list.name(), list.entityTypeId().orElse(null), list.activeRanks(),
                    list.description().orElse(null), list.createdAt(), itemCount, rankedCount);
        }
    }

    /** A work, enriched with its title/cover (see the mockup - never a bare id shown to the user). */
    public record TierListEntryResponse(UUID entityId, String title, String coverImageUrl, Rank rank) {
        public static TierListEntryResponse from(Entity entity, Rank rank) {
            Object cover = entity.attributes().get("coverImageUrl");
            return new TierListEntryResponse(entity.id(), entity.title(), cover instanceof String s ? s : null, rank);
        }

        public static TierListEntryResponse from(TierListItem item, Entity entity) {
            return from(entity, item.rank().orElse(null));
        }
    }

    public record TierListDetailResponse(TierListResponse list, List<TierListEntryResponse> ranked,
                                          List<TierListEntryResponse> unranked) {
    }

    public record AddTierListItemsRequest(List<UUID> entityIds) {
    }

    /** `rank: null` removes the ranking (becomes "unranked" again), without removing the membership of the list. */
    public record SetRankRequest(Rank rank) {
    }

    public record GeneralBoardResponse(Map<Rank, List<TierListEntryResponse>> ranked, List<TierListEntryResponse> unranked) {
    }

    public record CustomRankEntryResponse(UUID tierListId, String tierListName, Rank rank) {
    }

    /** "My rankings" on the detail page (see mockup V1.2 §30/§52). */
    public record EntityTierSummaryResponse(Rank generalRank, List<CustomRankEntryResponse> customRanks) {
    }
}
