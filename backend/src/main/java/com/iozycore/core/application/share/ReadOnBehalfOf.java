package com.iozycore.core.application.share;

import java.util.UUID;
import java.util.function.Supplier;

/**
 * Port: run a block of reads on behalf of another owner, then come back.
 * <p>
 * The only legitimate use is a share link: its recipient has no account, and
 * what they must see belongs to the owner named by the token. The call is
 * written at the place where the crossing happens, never deduced from where
 * the request comes from. The infrastructure implements it on top of the
 * owner isolation ({@code AuNomDe}).
 */
public interface ReadOnBehalfOf {

    <T> T run(UUID ownerId, Supplier<T> work);
}
