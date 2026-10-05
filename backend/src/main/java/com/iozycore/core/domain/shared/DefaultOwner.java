package com.iozycore.core.domain.shared;

import java.util.UUID;

/**
 * The two owner ids that do not designate an account like
 * the others.
 *
 * <h2>{@link #ID} — the one from before accounts</h2>
 * All data entered before accounts existed carries this
 * id: the {@code owner_id} columns exist since migration V2,
 * filled with this value "for the day when". That day came on
 * 2026-08-29, and the most delicate migration did not happen: the
 * <b>first account adopts this id</b> (see {@code AppUser.premier}),
 * so the existing collection becomes its own without a single row
 * moving.
 *
 * <p>It is no longer used when creating anything: the
 * session says who owns a write (see
 * {@code ProprietaireCourant}).
 *
 * <h2>{@link #PERSONNE} — the owner of nothing</h2>
 * The fallback when no account is known: outside an authenticated request, or on
 * a path that forgot to say on whose behalf it works. No account
 * can carry it - account ids are either {@link #ID}, or
 * drawn at random - so <b>no row answers to it</b>.
 *
 * <p>This is the important point: a mistake must show <b>nothing</b>, never
 * someone else's collection. A fallback on {@link #ID} would have done
 * exactly the opposite, and without noise.
 */
public final class DefaultOwner {

    public static final UUID ID = UUID.fromString("00000000-0000-0000-0000-000000000000");

    public static final UUID PERSONNE = UUID.fromString("ffffffff-ffff-ffff-ffff-ffffffffffff");

    private DefaultOwner() {
    }
}
