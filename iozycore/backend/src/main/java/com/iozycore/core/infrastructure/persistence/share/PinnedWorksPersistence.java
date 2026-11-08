package com.iozycore.core.infrastructure.persistence.share;

import com.iozycore.core.domain.share.PinnedWorks;
import com.iozycore.core.domain.share.PinnedWorksRepository;
import com.iozycore.core.infrastructure.multitenance.ProprietaireCourant;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * The pinned works, in plain SQL with the owner passed by hand: replacing the
 * list deletes then inserts in one transaction, and Hibernate would flush the
 * inserts before the deletes (a clash on the position constraint). Every
 * statement names the current owner in its WHERE clause.
 */
@Repository
@Transactional
@RequiredArgsConstructor
class JdbcPinnedWorksRepository implements PinnedWorksRepository {

    private final JdbcTemplate jdbc;
    private final ProprietaireCourant owner;

    @Override
    @Transactional(readOnly = true)
    public PinnedWorks find() {
        List<UUID> ids = jdbc.query("SELECT entity_id FROM share_pin WHERE owner_id = ? ORDER BY position",
                (row, i) -> row.getObject("entity_id", UUID.class), owner.resolveCurrentTenantIdentifier());
        return new PinnedWorks(ids);
    }

    @Override
    public void replace(PinnedWorks pinned) {
        UUID ownerId = owner.resolveCurrentTenantIdentifier();
        jdbc.update("DELETE FROM share_pin WHERE owner_id = ?", ownerId);
        List<UUID> ids = pinned.entityIds();
        for (int position = 0; position < ids.size(); position++) {
            jdbc.update("INSERT INTO share_pin (id, owner_id, entity_id, position) VALUES (?, ?, ?, ?)",
                    UUID.randomUUID(), ownerId, ids.get(position), position);
        }
    }
}
