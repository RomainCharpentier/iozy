package com.iozycore.boardgame;

import com.iozycore.boardgame.expansion.BoardGameExpansion;
import com.iozycore.boardgame.expansion.ExpansionCache;
import com.iozycore.boardgame.expansion.StoredExpansions;

import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** The expansion cache in memory, with the number of reads of the expansions. */
class InMemoryExpansionCache implements ExpansionCache {

    final Map<String, StoredExpansions> rows = new HashMap<>();
    int reads;

    @Override
    public Map<String, StoredExpansions> findAll(Collection<String> baseBggIds) {
        reads++;
        return rows.entrySet().stream().filter(entry -> baseBggIds.contains(entry.getKey()))
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
    }

    @Override
    public Map<String, Instant> fetchedAtByBaseId() {
        return rows.values().stream().collect(Collectors.toMap(StoredExpansions::baseBggId,
                StoredExpansions::fetchedAt));
    }

    @Override
    public void save(String baseBggId, List<BoardGameExpansion> expansions, Instant fetchedAt) {
        rows.put(baseBggId, new StoredExpansions(baseBggId, expansions, fetchedAt));
    }
}
