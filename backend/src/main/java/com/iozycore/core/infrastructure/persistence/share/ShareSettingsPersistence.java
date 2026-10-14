package com.iozycore.core.infrastructure.persistence.share;

import com.iozycore.core.domain.share.ShareSettings;
import com.iozycore.core.domain.share.ShareSettingsRepository;
import com.iozycore.core.application.auth.UtilisateurCourant;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.RequiredArgsConstructor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

@Entity
@Table(name = "share_settings")
class ShareSettingsJpaEntity {

    @Id
    @Column(name = "owner_id")
    private UUID ownerId;

    @Column(name = "token")
    private String token;

    @Column(name = "share_collection", nullable = false)
    private boolean shareCollection;

    @Column(name = "share_wishlist", nullable = false)
    private boolean shareWishlist;

    @Column(name = "include_tier_lists", nullable = false)
    private boolean includeTierLists;

    protected ShareSettingsJpaEntity() {
    }

    ShareSettingsJpaEntity(UUID ownerId, String token, boolean shareCollection, boolean shareWishlist,
                            boolean includeTierLists) {
        this.ownerId = ownerId;
        this.token = token;
        this.shareCollection = shareCollection;
        this.shareWishlist = shareWishlist;
        this.includeTierLists = includeTierLists;
    }

    UUID getOwnerId() { return ownerId; }
    String getToken() { return token; }
    boolean isShareCollection() { return shareCollection; }
    boolean isShareWishlist() { return shareWishlist; }
    boolean isIncludeTierLists() { return includeTierLists; }
}

interface ShareSettingsJpaRepository extends JpaRepository<ShareSettingsJpaEntity, UUID> {
    Optional<ShareSettingsJpaEntity> findByToken(String token);
}

@Repository
@Transactional
@RequiredArgsConstructor
class JpaShareSettingsRepositoryAdapter implements ShareSettingsRepository {

    private final ShareSettingsJpaRepository jpaRepository;
    private final UtilisateurCourant utilisateurCourant;

    @Override
    public ShareSettings find() {
        // The primary key IS the owner: the question "whose?"
        // is already that of the row to read.
        UUID proprietaire = utilisateurCourant.proprietaire();
        return jpaRepository.findById(proprietaire)
                .map(JpaShareSettingsRepositoryAdapter::toDomain)
                .orElseGet(() -> ShareSettings.noLink(proprietaire));
    }

    @Override
    public ShareSettings save(ShareSettings settings) {
        return toDomain(jpaRepository.save(new ShareSettingsJpaEntity(
                utilisateurCourant.proprietaire(), settings.token(), settings.shareCollection(), settings.shareWishlist(),
                settings.includeTierLists())));
    }

    @Override
    public Optional<ShareSettings> findByToken(String token) {
        // Without this guard, a null or empty token would "match" the row of a
        // deleted link, whose token column is precisely null: the revoked
        // link would become open again to whoever calls the URL without a token.
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }
        return jpaRepository.findByToken(token).map(JpaShareSettingsRepositoryAdapter::toDomain);
    }


    private static ShareSettings toDomain(ShareSettingsJpaEntity jpa) {
        return new ShareSettings(jpa.getOwnerId(), jpa.getToken(), jpa.isShareCollection(),
                jpa.isShareWishlist(), jpa.isIncludeTierLists());
    }
}
