package com.iozycore.api.dto;

import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.tierlist.Rank;
import com.iozycore.domain.tierlist.TierList;
import com.iozycore.domain.tierlist.TierListItem;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

public class TierListDtos {

    /** @param entityTypeId univers de la liste - {@code null} pour une Tier List
     *                     transverse "toutes catégories" (voir TierList). */
    public record CreateTierListRequest(String name, UUID entityTypeId, Set<Rank> activeRanks, String description) {
    }

    public record UpdateTierListRequest(String name, Set<Rank> activeRanks, String description) {
    }

    /** @param entityTypeId {@code null} pour une Tier List transverse "toutes
     *                     catégories" - le client l'affiche alors hors de tout univers. */
    public record TierListResponse(UUID id, String name, UUID entityTypeId, Set<Rank> activeRanks, String description,
                                    Instant createdAt, int itemCount, int rankedCount) {
        public static TierListResponse from(TierList list, int itemCount, int rankedCount) {
            return new TierListResponse(list.id(), list.name(), list.entityTypeId().orElse(null), list.activeRanks(),
                    list.description().orElse(null), list.createdAt(), itemCount, rankedCount);
        }
    }

    /** Une œuvre, enrichie de son titre/jaquette (voir la maquette - jamais un id nu affiché à l'utilisateur). */
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

    /** `rank: null` retire le classement (redevient "non classé"), sans retirer l'appartenance à la liste. */
    public record SetRankRequest(Rank rank) {
    }

    public record GeneralBoardResponse(Map<Rank, List<TierListEntryResponse>> ranked, List<TierListEntryResponse> unranked) {
    }

    public record CustomRankEntryResponse(UUID tierListId, String tierListName, Rank rank) {
    }

    /** "Mes classements" côté fiche (voir la maquette V1.2 §30/§52). */
    public record EntityTierSummaryResponse(Rank generalRank, List<CustomRankEntryResponse> customRanks) {
    }
}
