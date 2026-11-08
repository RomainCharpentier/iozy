package com.iozycore.videogame;

import com.iozycore.videogame.franchise.Franchise;
import com.iozycore.videogame.franchise.FranchiseCache;
import com.iozycore.videogame.franchise.StoredFranchise;

import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;

/** The licence cache in memory, with the number of reads of the licences. */
class InMemoryFranchiseCache implements FranchiseCache {

    final Map<String, StoredFranchise> rows = new HashMap<>();
    int reads;

    @Override
    public Map<String, StoredFranchise> findAll(Collection<String> igdbIds) {
        reads++;
        return rows.entrySet().stream().filter(entry -> igdbIds.contains(entry.getKey()))
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
    }

    @Override
    public Map<String, Instant> fetchedAtById() {
        return rows.values().stream().collect(Collectors.toMap(StoredFranchise::igdbId, StoredFranchise::fetchedAt));
    }

    @Override
    public void save(String igdbId, Franchise franchise, Instant fetchedAt) {
        rows.put(igdbId, new StoredFranchise(igdbId, franchise, fetchedAt));
    }
}
