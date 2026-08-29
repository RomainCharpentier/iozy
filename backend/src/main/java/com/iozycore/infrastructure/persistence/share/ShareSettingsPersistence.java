package com.iozycore.infrastructure.persistence.share;

import com.iozycore.domain.share.ShareSettings;
import com.iozycore.domain.share.ShareSettingsRepository;
import com.iozycore.application.auth.UtilisateurCourant;
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
class JpaShareSettingsRepositoryAdapter implements ShareSettingsRepository {

    private final ShareSettingsJpaRepository jpaRepository;
    private final UtilisateurCourant utilisateurCourant;

    JpaShareSettingsRepositoryAdapter(ShareSettingsJpaRepository jpaRepository, UtilisateurCourant utilisateurCourant) {
        this.jpaRepository = jpaRepository;
        this.utilisateurCourant = utilisateurCourant;
    }

    @Override
    public ShareSettings find() {
        // La clé primaire EST le propriétaire : la question « celui de qui ? »
        // est déjà celle de la ligne à lire.
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
        // Sans cette garde, un jeton nul ou vide « matcherait » la ligne d'un
        // lien supprimé, dont la colonne token vaut justement null : le lien
        // révoqué redeviendrait ouvert à qui appelle l'URL sans jeton.
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
