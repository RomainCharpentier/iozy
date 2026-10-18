package com.iozycore.core.infrastructure.multitenance;

import com.iozycore.core.application.share.ReadOnBehalfOf;
import org.springframework.stereotype.Component;

import java.util.UUID;
import java.util.function.Supplier;

/** Adapter of {@link ReadOnBehalfOf} on the owner isolation of Hibernate. */
@Component
class OnBehalfOfOwnerReader implements ReadOnBehalfOf {

    @Override
    public <T> T run(UUID ownerId, Supplier<T> work) {
        return AuNomDe.executer(ownerId, work);
    }
}
