package com.iozycore.core.domain.wishlist;

import com.iozycore.core.domain.shared.DomainEvent;

import java.time.Instant;
import java.util.UUID;

public record EntityAddedToWishlist(UUID wishlistEntryId, UUID entityId, Instant occurredAt) implements DomainEvent {
}
