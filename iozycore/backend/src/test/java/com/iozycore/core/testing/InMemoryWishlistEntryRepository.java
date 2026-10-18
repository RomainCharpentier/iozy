package com.iozycore.core.testing;

import com.iozycore.core.domain.wishlist.WishlistEntry;
import com.iozycore.core.domain.wishlist.WishlistEntryRepository;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Shared in-memory double of {@link WishlistEntryRepository}, for application tests without Spring. */
public class InMemoryWishlistEntryRepository implements WishlistEntryRepository {

    private final Map<UUID, WishlistEntry> store = new LinkedHashMap<>();

    @Override
    public WishlistEntry save(WishlistEntry entry) {
        store.put(entry.id(), entry);
        return entry;
    }

    @Override
    public Optional<WishlistEntry> findByEntityId(UUID entityId) {
        return store.values().stream()
                .filter(e -> e.entityId().equals(entityId) && e.variantId().isEmpty())
                .findFirst();
    }

    @Override
    public Optional<WishlistEntry> findByVariantId(UUID variantId) {
        return store.values().stream()
                .filter(e -> e.variantId().map(variantId::equals).orElse(false))
                .findFirst();
    }

    @Override
    public List<WishlistEntry> findAllByEntityId(UUID entityId) {
        return store.values().stream().filter(e -> e.entityId().equals(entityId)).toList();
    }

    @Override
    public List<WishlistEntry> findAll() {
        return List.copyOf(store.values());
    }

    @Override
    public void deleteById(UUID id) {
        store.remove(id);
    }
}
