package com.iozycore.core.application.auth;

/**
 * A visitor without an account: someone who browses the <b>catalog</b>, and
 * nothing else.
 *
 * <h2>It carries NO owner, and that is the whole point</h2>
 * A first version made it enter "at" someone's place: it carried the
 * id of a collection, and read that person's ownerships, ratings and
 * rankings. This was not what we wanted to show. A
 * visitor must see the <b>works</b> that the instance knows - title,
 * cover, editions - and nothing of what someone made of them.
 *
 * <p>Now the partitioning already returns exactly that to whoever is nobody:
 * the catalog is <b>shared</b> (no owner column, see
 * {@code ProprietaireCourant}), while ownerships, wishes, experiences and
 * rankings are filtered by owner. A principal that names no
 * owner falls back to {@link com.iozycore.core.domain.shared.DefaultOwner#PERSONNE},
 * <b>who owns nothing</b> - so the whole catalog, and not one row
 * of personal data.
 *
 * <p>This is why this record is <b>empty</b>. It is
 * not an oversight: giving it an "owner" field would reopen the door
 * that we just closed, and we would then have to ask at each screen what
 * it is allowed to read from it. It does not carry it, so the question is no longer
 * asked anywhere.
 *
 * <h2>What it still serves to say</h2>
 * Two things, and they are enough: that the session is <b>authenticated</b>
 * (otherwise the partitioning would let it read nothing at all) and that it
 * is <b>read-only</b> (see {@code SecurityConfig}). The type itself
 * carries the information; it does not need data.
 */
public record Invite() {
}
