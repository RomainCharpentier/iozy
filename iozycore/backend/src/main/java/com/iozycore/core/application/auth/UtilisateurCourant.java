package com.iozycore.core.application.auth;

import com.iozycore.core.domain.shared.DefaultOwner;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.UUID;

/**
 * Who writes, right now.
 *
 * <h2>The only place that queries the session</h2>
 * The rest of the application simply asks "whose", without knowing where the
 * answer comes from. The day the session changes shape (token, header,
 * other), this file changes, and only this one.
 *
 * <h2>Without a known account: nobody, never "the first"</h2>
 * {@link #proprietaire()} returns {@link DefaultOwner#PERSONNE} outside an
 * authenticated request. No row belongs to it: a path that
 * forgot to say on whose behalf it works sees <b>nothing</b>. A fallback
 * on {@link DefaultOwner#ID} - the id of the first account, the one that
 * took over the original collection - would have done exactly the opposite, and without
 * noise.
 *
 * <h2>A visitor is nobody, and that is exactly what is needed</h2>
 * A visit session names no owner (see {@link Invite}):
 * it therefore falls back to {@link DefaultOwner#PERSONNE} by the ordinary path,
 * without any special case to write here. The result is the one we
 * want to show - the <b>catalog</b>, which belongs to nobody - and
 * nothing of the ownerships, wishes or ratings of anyone, all filtered
 * by owner.
 */
@Component
public class UtilisateurCourant {

    /**
     * The id of the signed-in ACCOUNT, empty outside an authenticated request -
     * and also empty for a guest, who has none.
     */
    public Optional<UUID> id() {
        return principal()
                .filter(AppUserDetailsService.Principal.class::isInstance)
                .map(AppUserDetailsService.Principal.class::cast)
                .map(AppUserDetailsService.Principal::id);
    }

    /** The owner to attach a write to, or whose data to read. */
    public UUID proprietaire() {
        return id().orElse(DefaultOwner.PERSONNE);
    }

    private Optional<Object> principal() {
        Authentication authentification = SecurityContextHolder.getContext().getAuthentication();
        if (authentification == null || !authentification.isAuthenticated()) {
            return Optional.empty();
        }
        return Optional.ofNullable(authentification.getPrincipal());
    }
}
