package com.iozycore.infrastructure.persistence.wishlist;

import com.iozycore.domain.shared.DefaultOwner;
import com.iozycore.domain.wishlist.WishlistShareSettings;
import com.iozycore.domain.wishlist.WishlistShareSettingsRepository;
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
@Table(name = "wishlist_share_settings")
class WishlistShareSettingsJpaEntity {

    @Id
    @Column(name = "owner_id")
    private UUID ownerId;

    @Column(name = "token")
    private String token;

    protected WishlistShareSettingsJpaEntity() {
    }

    WishlistShareSettingsJpaEntity(UUID ownerId, String token) {
        this.ownerId = ownerId;
        this.token = token;
    }

    UUID getOwnerId() { return ownerId; }
    String getToken() { return token; }
}

interface WishlistShareSettingsJpaRepository extends JpaRepository<WishlistShareSettingsJpaEntity, UUID> {
    Optional<WishlistShareSettingsJpaEntity> findByToken(String token);
}

@Repository
@Transactional
class JpaWishlistShareSettingsRepositoryAdapter implements WishlistShareSettingsRepository {

    private final WishlistShareSettingsJpaRepository jpaRepository;

    JpaWishlistShareSettingsRepositoryAdapter(WishlistShareSettingsJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public WishlistShareSettings find() {
        return jpaRepository.findById(DefaultOwner.ID)
                .map(JpaWishlistShareSettingsRepositoryAdapter::toDomain)
                .orElseGet(WishlistShareSettings::noLink);
    }

    @Override
    public WishlistShareSettings save(WishlistShareSettings settings) {
        WishlistShareSettingsJpaEntity saved = jpaRepository.save(
                new WishlistShareSettingsJpaEntity(DefaultOwner.ID, settings.token()));
        return toDomain(saved);
    }

    @Override
    public Optional<WishlistShareSettings> findByToken(String token) {
        // Un jeton null ne doit jamais "matcher" une ligne dont le lien a été
        // supprimé (token = null en base) - filtré explicitement plutôt que de
        // compter sur le comportement de la requête générée pour un paramètre null.
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }
        return jpaRepository.findByToken(token).map(JpaWishlistShareSettingsRepositoryAdapter::toDomain);
    }

    private static WishlistShareSettings toDomain(WishlistShareSettingsJpaEntity jpa) {
        return new WishlistShareSettings(jpa.getOwnerId(), jpa.getToken());
    }
}
