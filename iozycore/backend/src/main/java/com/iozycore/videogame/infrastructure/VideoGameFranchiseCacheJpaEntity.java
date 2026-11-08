package com.iozycore.videogame.infrastructure;

import com.iozycore.videogame.franchise.FranchiseGame;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.List;

/** See V43: shared reference data, no owner. */
@Entity
@Table(name = "video_game_franchise_cache")
@Getter
public class VideoGameFranchiseCacheJpaEntity {

    @Id
    @Column(name = "igdb_id")
    private String igdbId;

    @Column(name = "franchise_name")
    private String franchiseName;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private List<FranchiseGame> games;

    @Column(name = "fetched_at", nullable = false)
    private Instant fetchedAt;

    protected VideoGameFranchiseCacheJpaEntity() {
        // required by JPA
    }

    public VideoGameFranchiseCacheJpaEntity(String igdbId, String franchiseName, List<FranchiseGame> games,
                                            Instant fetchedAt) {
        this.igdbId = igdbId;
        this.franchiseName = franchiseName;
        this.games = games;
        this.fetchedAt = fetchedAt;
    }
}
