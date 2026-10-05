package com.iozycore.core.infrastructure.multitenance;

import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * Work on behalf of another owner, for the length of one block, and say so.
 *
 * <h2>The only legitimate case</h2>
 * A share link: its recipient has no account, and what they must
 * see belongs to someone else. The isolation cannot come from
 * the session - it comes from the <b>token</b>, which names its owner.
 *
 * <h2>Why it is read at the place where it happens</h2>
 * Reading on behalf of someone else is exactly what an isolation is meant to
 * prevent. So it must never be an indirect result of
 * where the call comes from: it is written, in plain words, around the
 * lines concerned.
 *
 * <pre>{@code
 * return AuNomDe.executer(settings.ownerId(), () -> collectionPartagee());
 * }</pre>
 *
 * <p>The restore is guaranteed ({@code finally} block), even if the
 * body throws: an exception must not leave a server thread reading
 * on behalf of someone for all the following requests.
 */
public final class AuNomDe {

    private static final ThreadLocal<UUID> COURANT = new ThreadLocal<>();

    private AuNomDe() {
    }

    /** The owner imposed for this thread, if there is one. */
    static Optional<UUID> actuel() {
        return Optional.ofNullable(COURANT.get());
    }

    public static <T> T executer(UUID proprietaire, Supplier<T> travail) {
        UUID precedent = COURANT.get();
        COURANT.set(proprietaire);
        try {
            return travail.get();
        } finally {
            // `set(precedent)` rather than `remove()`: blocks can
            // be nested, and leaving the innermost one must not cancel the
            // outermost one.
            if (precedent == null) {
                COURANT.remove();
            } else {
                COURANT.set(precedent);
            }
        }
    }
}
