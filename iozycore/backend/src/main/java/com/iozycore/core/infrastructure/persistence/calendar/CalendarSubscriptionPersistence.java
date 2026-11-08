package com.iozycore.core.infrastructure.persistence.calendar;

import com.iozycore.core.domain.calendar.CalendarSubscription;
import com.iozycore.core.domain.calendar.CalendarSubscriptionRepository;
import com.iozycore.core.infrastructure.multitenance.ProprietaireCourant;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import org.hibernate.annotations.TenantId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Entity
@Table(name = "calendar_subscription")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Getter
class CalendarSubscriptionJpaEntity {

    @Id
    private UUID id;

    // Isolation by owner: Hibernate adds this column to every query.
    @TenantId
    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(nullable = false)
    private String token;

    @Column(name = "token_hash", nullable = false)
    private String tokenHash;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;
}

interface CalendarSubscriptionJpaRepository extends JpaRepository<CalendarSubscriptionJpaEntity, UUID> {

    // A derived query, so filtered by owner.
    Optional<CalendarSubscriptionJpaEntity> findFirstByRevokedAtIsNull();

    /**
     * Native SQL, so the owner is passed by hand ({@code @TenantId} does not apply).
     * {@code ON CONFLICT ... DO NOTHING} on the partial unique index: a second
     * active link for the same owner is never written, even by two requests at once.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = """
            INSERT INTO calendar_subscription (id, owner_id, token, token_hash, created_at)
            VALUES (:id, :ownerId, :token, :tokenHash, :createdAt)
            ON CONFLICT (owner_id) WHERE revoked_at IS NULL DO NOTHING
            """, nativeQuery = true)
    void insertIfNoneActive(@Param("id") UUID id, @Param("ownerId") UUID ownerId, @Param("token") String token,
                            @Param("tokenHash") String tokenHash, @Param("createdAt") Instant createdAt);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = "UPDATE calendar_subscription SET revoked_at = :at WHERE owner_id = :ownerId AND revoked_at IS NULL",
            nativeQuery = true)
    void revokeActive(@Param("ownerId") UUID ownerId, @Param("at") Instant at);
}

@Repository
@Transactional
@RequiredArgsConstructor
class JpaCalendarSubscriptionRepositoryAdapter implements CalendarSubscriptionRepository {

    private final CalendarSubscriptionJpaRepository jpaRepository;
    private final ProprietaireCourant owner;
    private final JdbcTemplate jdbc;

    @Override
    public Optional<CalendarSubscription> findActive() {
        return jpaRepository.findFirstByRevokedAtIsNull().map(JpaCalendarSubscriptionRepositoryAdapter::toDomain);
    }

    @Override
    public CalendarSubscription saveIfNoneActive(CalendarSubscription subscription) {
        jpaRepository.insertIfNoneActive(subscription.id(), owner.resolveCurrentTenantIdentifier(),
                subscription.token(), subscription.tokenHash(), subscription.createdAt());
        return findActive().orElseThrow();
    }

    @Override
    public void revokeActive(Instant at) {
        jpaRepository.revokeActive(owner.resolveCurrentTenantIdentifier(), at);
    }

    /**
     * Plain SQL on purpose: this lookup has no owner yet - finding it is its whole
     * point - and a JPA query would be filtered on "nobody". It searches by the
     * hash, then compares the token itself in constant time.
     */
    @Override
    @Transactional(readOnly = true)
    public Optional<CalendarSubscription> findActiveByToken(String token) {
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }
        List<CalendarSubscription> found = jdbc.query("""
                        SELECT id, owner_id, token, created_at, revoked_at FROM calendar_subscription
                        WHERE token_hash = ? AND revoked_at IS NULL
                        """,
                (row, i) -> CalendarSubscription.reconstitute(
                        row.getObject("id", UUID.class), row.getObject("owner_id", UUID.class), row.getString("token"),
                        row.getTimestamp("created_at").toInstant(), instantOrNull(row.getTimestamp("revoked_at"))),
                CalendarSubscription.hashOf(token));
        return found.stream().filter(subscription -> subscription.matches(token)).findFirst();
    }

    private static Instant instantOrNull(Timestamp timestamp) {
        return timestamp == null ? null : timestamp.toInstant();
    }

    private static CalendarSubscription toDomain(CalendarSubscriptionJpaEntity jpa) {
        return CalendarSubscription.reconstitute(jpa.getId(), jpa.getOwnerId(), jpa.getToken(), jpa.getCreatedAt(),
                jpa.getRevokedAt());
    }
}
