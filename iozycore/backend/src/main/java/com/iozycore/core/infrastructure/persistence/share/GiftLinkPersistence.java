package com.iozycore.core.infrastructure.persistence.share;

import com.iozycore.core.domain.share.GiftLink;
import com.iozycore.core.domain.share.GiftLinkRepository;
import com.iozycore.core.infrastructure.multitenance.ProprietaireCourant;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * The gift links, in plain SQL with the owner passed by hand.
 *
 * <p>No JPA entity on purpose: the owner side needs an upsert on the "one per
 * owner" constraint and a delete, and the public side a lookup that has no owner
 * yet. {@code deleteBy...} would ignore {@code @TenantId} anyway (see
 * backend/CLAUDE.md). Every owner-side statement names
 * {@link ProprietaireCourant#resolveCurrentTenantIdentifier()} in its WHERE clause.
 */
@Repository
@Transactional
@RequiredArgsConstructor
class JdbcGiftLinkRepository implements GiftLinkRepository {

    private static final String COLUMNS = "id, owner_id, token, created_at, expires_at";
    private static final RowMapper<GiftLink> ROW = (row, i) -> GiftLink.reconstitute(
            row.getObject("id", UUID.class), row.getObject("owner_id", UUID.class), row.getString("token"),
            row.getTimestamp("created_at").toInstant(), row.getTimestamp("expires_at").toInstant());

    private final JdbcTemplate jdbc;
    private final ProprietaireCourant owner;

    @Override
    @Transactional(readOnly = true)
    public Optional<GiftLink> find() {
        return jdbc.query("SELECT " + COLUMNS + " FROM gift_link WHERE owner_id = ?", ROW,
                owner.resolveCurrentTenantIdentifier()).stream().findFirst();
    }

    /**
     * One row per owner: a second "create" at the same moment only moves the
     * expiry of the row already there, it never leaves two live links.
     */
    @Override
    public GiftLink save(GiftLink link) {
        UUID ownerId = owner.resolveCurrentTenantIdentifier();
        jdbc.update("""
                        INSERT INTO gift_link (id, owner_id, token, token_hash, created_at, expires_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                        ON CONFLICT (owner_id) DO UPDATE SET expires_at = EXCLUDED.expires_at
                        """,
                link.id(), ownerId, link.token(), link.tokenHash(), Timestamp.from(link.createdAt()),
                Timestamp.from(link.expiresAt()));
        return find().orElseThrow();
    }

    @Override
    public void delete() {
        jdbc.update("DELETE FROM gift_link WHERE owner_id = ?", owner.resolveCurrentTenantIdentifier());
    }

    /** Searches by the hash, then compares the token itself in constant time. */
    @Override
    @Transactional(readOnly = true)
    public Optional<GiftLink> findByToken(String token) {
        if (token == null || token.isBlank() || token.length() > GiftLink.MAX_TOKEN_LENGTH) {
            return Optional.empty();
        }
        List<GiftLink> found = jdbc.query("SELECT " + COLUMNS + " FROM gift_link WHERE token_hash = ?", ROW,
                GiftLink.hashOf(token));
        return found.stream().filter(link -> link.matches(token)).findFirst();
    }
}
