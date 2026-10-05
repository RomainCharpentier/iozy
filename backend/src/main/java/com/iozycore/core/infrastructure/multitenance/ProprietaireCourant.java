package com.iozycore.core.infrastructure.multitenance;

import com.iozycore.core.application.auth.UtilisateurCourant;
import org.hibernate.cfg.AvailableSettings;
import org.hibernate.context.spi.CurrentTenantIdentifierResolver;
import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer;
import org.springframework.stereotype.Component;

import com.iozycore.core.domain.shared.DefaultOwner;

import java.util.Map;
import java.util.UUID;

/**
 * Who owns what Hibernate reads and writes, right now.
 *
 * <h2>Why the isolation lives HERE and not in each query</h2>
 * The alternative was to add an {@code ownerId} to every method of the eight
 * private repositories - eighty calls, and above all a rule to remember
 * <b>for every new query written a year later</b>. Just one forgotten,
 * and a screen shows someone else's collection with nothing to
 * warn about it.
 *
 * <p>Hibernate can do this by itself: a column marked {@code @TenantId}
 * is added to the {@code WHERE} clause of every query on the entity, and
 * filled on insert. It is not a filter you remember to add, it is a
 * filter you cannot remove.
 *
 * <h2>The default is "nobody", never "the first one"</h2>
 * Outside any authenticated request, this resolver returns {@link DefaultOwner#PERSONNE} -
 * an identifier that no account can have, so it matches
 * no row. A path that forgets to say on behalf of whom it works sees
 * <b>nothing</b>; it does not see the collection of the first account. This is the
 * only safe way to be wrong.
 *
 * <h2>Reading on behalf of another, explicitly</h2>
 * One legitimate case exists: a share link. Its recipient has no
 * account, and what they must see belongs to someone else. This goes through
 * {@link AuNomDe}, which says it in plain words at the place where it happens -
 * rather than through a silent exception in the resolver.
 */
@Component
public class ProprietaireCourant implements CurrentTenantIdentifierResolver<UUID>, HibernatePropertiesCustomizer {

    private final UtilisateurCourant utilisateurCourant;

    public ProprietaireCourant(UtilisateurCourant utilisateurCourant) {
        this.utilisateurCourant = utilisateurCourant;
    }

    @Override
    public UUID resolveCurrentTenantIdentifier() {
        return AuNomDe.actuel().orElseGet(utilisateurCourant::proprietaire);
    }

    /**
     * {@code false}: the owner changes from one request to another, and
     * Hibernate must read this resolver again at each session instead of checking
     * that it has not changed. Answering {@code true} would make the first
     * request served to someone else fail.
     */
    @Override
    public boolean validateExistingCurrentSessions() {
        return false;
    }

    /** Plugs this resolver into Hibernate - without this line, it is never used. */
    @Override
    public void customize(Map<String, Object> proprietesHibernate) {
        proprietesHibernate.put(AvailableSettings.MULTI_TENANT_IDENTIFIER_RESOLVER, this);
    }
}
