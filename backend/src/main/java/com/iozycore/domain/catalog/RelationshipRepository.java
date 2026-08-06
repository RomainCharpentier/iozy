package com.iozycore.domain.catalog;

import java.util.List;
import java.util.UUID;

public interface RelationshipRepository {

    Relationship save(Relationship relationship);

    List<Relationship> findBySourceEntityId(UUID sourceEntityId);

    List<Relationship> findByTargetEntityId(UUID targetEntityId);

    void deleteById(UUID id);
}
