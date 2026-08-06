package com.iozycore.domain.wishlist;

import com.iozycore.domain.shared.DomainEvent;

import java.time.Instant;
import java.util.UUID;

public record EntityAddedToWishlist(UUID wishlistEntryId, UUID entityId, Instant occurredAt) implements DomainEvent {
}
