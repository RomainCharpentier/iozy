package com.iozycore.manga.infrastructure.metadata;

import com.iozycore.manga.metadata.VolumeCandidate;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** See V3__volume_search_cache.sql - series_title/author are stored already
 * normalised (trim + lowercase), never displayed as is. */
@Entity
@Table(name = "volume_search_cache")
public class VolumeSearchCacheJpaEntity {

    @Id
    private UUID id;

    @Column(name = "entity_type_id", nullable = false)
    private UUID entityTypeId;

    @Column(name = "series_title", nullable = false)
    private String seriesTitle;

    @Column(nullable = false)
    private String author;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private List<VolumeCandidate> volumes;

    @Column(name = "fetched_at", nullable = false)
    private Instant fetchedAt;

    protected VolumeSearchCacheJpaEntity() {
        // required by JPA
    }

    public VolumeSearchCacheJpaEntity(UUID id, UUID entityTypeId, String seriesTitle, String author,
                                       List<VolumeCandidate> volumes, Instant fetchedAt) {
        this.id = id;
        this.entityTypeId = entityTypeId;
        this.seriesTitle = seriesTitle;
        this.author = author;
        this.volumes = volumes;
        this.fetchedAt = fetchedAt;
    }

    public UUID getId() { return id; }
    public UUID getEntityTypeId() { return entityTypeId; }
    public String getSeriesTitle() { return seriesTitle; }
    public String getAuthor() { return author; }
    public List<VolumeCandidate> getVolumes() { return volumes; }
    public Instant getFetchedAt() { return fetchedAt; }
}
