package com.iozycore.infrastructure.persistence.collectionshare;

import com.iozycore.domain.collectionshare.CollectionShareSettings;
import com.iozycore.domain.collectionshare.CollectionShareSettingsRepository;
import com.iozycore.domain.shared.DefaultOwner;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

@Entity
@Table(name = "collection_share_settings")
class CollectionShareSettingsJpaEntity {

    @Id
    @Column(name = "owner_id")
    private UUID ownerId;

    @Column(name = "token")
    private String token;

    @Column(name = "include_tier_lists", nullable = false)
    private boolean includeTierLists;

    protected CollectionShareSettingsJpaEntity() {
    }

    CollectionShareSettingsJpaEntity(UUID ownerId, String token, boolean includeTierLists) {
        this.ownerId = ownerId;
        this.token = token;
        this.includeTierLists = includeTierLists;
    }

    UUID getOwnerId() { return ownerId; }
    String getToken() { return token; }
    boolean isIncludeTierLists() { return includeTierLists; }
}

interface CollectionShareSettingsJpaRepository extends JpaRepository<CollectionShareSettingsJpaEntity, UUID> {
    Optional<CollectionShareSettingsJpaEntity> findByToken(String token);
}

@Repository
@Transactional
class JpaCollectionShareSettingsRepositoryAdapter implements CollectionShareSettingsRepository {

    private final CollectionShareSettingsJpaRepository jpaRepository;

    JpaCollectionShareSettingsRepositoryAdapter(CollectionShareSettingsJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public CollectionShareSettings find() {
        return jpaRepository.findById(DefaultOwner.ID)
                .map(JpaCollectionShareSettingsRepositoryAdapter::toDomain)
                .orElseGet(CollectionShareSettings::noLink);
    }

    @Override
    public CollectionShareSettings save(CollectionShareSettings settings) {
        CollectionShareSettingsJpaEntity saved = jpaRepository.save(new CollectionShareSettingsJpaEntity(
                DefaultOwner.ID, settings.token(), settings.includeTierLists()));
        return toDomain(saved);
    }

    @Override
    public Optional<CollectionShareSettings> findByToken(String token) {
        // Même garde que côté wishlist : un jeton null/vide ne doit jamais
        // "matcher" la ligne d'un lien supprimé (token = null en base).
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }
        return jpaRepository.findByToken(token).map(JpaCollectionShareSettingsRepositoryAdapter::toDomain);
    }

    private static CollectionShareSettings toDomain(CollectionShareSettingsJpaEntity jpa) {
        return new CollectionShareSettings(jpa.getOwnerId(), jpa.getToken(), jpa.isIncludeTierLists());
    }
}
