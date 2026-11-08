package com.iozycore.core.domain.share;

import java.util.Optional;

/** The gift links. Every method but {@link #findByToken} works for the current owner. */
public interface GiftLinkRepository {

    /** The link of the current owner, expired or not. */
    Optional<GiftLink> find();

    /** Writes the link of the current owner: inserts it, or moves its expiry if it exists. */
    GiftLink save(GiftLink link);

    /** Removes the link of the current owner. Nothing to remove is not an error. */
    void delete();

    /**
     * The link that holds this token, whoever owns it, expired or not: the only
     * lookup that crosses owners, for the public page. Empty for an unknown token.
     */
    Optional<GiftLink> findByToken(String token);
}
