package com.iozycore.custom;

import com.iozycore.core.application.NotFoundException;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.core.application.insights.DiscoverySource;
import com.iozycore.core.application.insights.ReleaseSource;
import com.iozycore.core.metadata.MetadataProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * Reads the collection types with what the installed universes offer for
 * each: a metadata source, a discovery source, a release source. The clients
 * use it to show only what is really wired.
 */
@Service
@RequiredArgsConstructor
public class EntityTypeCatalog {

    private final EntityTypeRepository entityTypeRepository;
    private final List<MetadataProvider> metadataProviders;
    private final List<DiscoverySource> discoverySources;
    private final List<ReleaseSource> releaseSources;

    public record DescribedType(EntityType type, boolean hasMetadataProvider, boolean hasDiscoverySource,
                                boolean hasReleaseSource) {
    }

    public List<DescribedType> listAll() {
        return entityTypeRepository.findAll().stream().map(this::describe).toList();
    }

    public DescribedType get(UUID id) {
        return entityTypeRepository.findById(id)
                .map(this::describe)
                .orElseThrow(() -> new NotFoundException("EntityType introuvable : " + id));
    }

    public DescribedType describe(EntityType type) {
        return new DescribedType(type,
                metadataProviders.stream().anyMatch(provider -> provider.supports(type)),
                discoverySources.stream().anyMatch(source -> source.supports(type)),
                releaseSources.stream().anyMatch(source -> source.supports(type)));
    }
}
