package com.iozycore.boardgame.infrastructure;

import com.iozycore.boardgame.expansion.BoardGameExpansion;
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
@Table(name = "board_game_expansion_cache")
@Getter
public class BoardGameExpansionCacheJpaEntity {

    @Id
    @Column(name = "base_bgg_id")
    private String baseBggId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private List<BoardGameExpansion> expansions;

    @Column(name = "fetched_at", nullable = false)
    private Instant fetchedAt;

    protected BoardGameExpansionCacheJpaEntity() {
        // required by JPA
    }

    public BoardGameExpansionCacheJpaEntity(String baseBggId, List<BoardGameExpansion> expansions, Instant fetchedAt) {
        this.baseBggId = baseBggId;
        this.expansions = expansions;
        this.fetchedAt = fetchedAt;
    }
}
