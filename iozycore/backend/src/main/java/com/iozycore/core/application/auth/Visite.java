package com.iozycore.core.application.auth;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.List;

/**
 * What a visit is, once it no longer designates anyone.
 *
 * <h2>There is nothing left to decide</h2>
 * This class used to be a service, with two repositories and three questions: which
 * collection to open, did its owner allow it, does it still
 * allow it. All of them disappeared with the answer to the real need - a visitor
 * browses the <b>catalog</b>, which belongs to nobody. So only
 * the declaration of a role remains, and that is plenty to justify a name.
 *
 * <p>No setting opens or closes it: the visit is available because
 * the catalog exists. What the code no longer knows how to do cannot be
 * misconfigured.
 */
public final class Visite {

    /**
     * The role of a visitor. It gives access to nothing more than an ordinary
     * account - it REMOVES some: it is what the security chain recognizes
     * to refuse any write (see {@code SecurityConfig}).
     */
    public static final String ROLE = "ROLE_INVITE";

    public static final List<GrantedAuthority> AUTORITES = List.of(new SimpleGrantedAuthority(ROLE));

    private Visite() {
    }
}
