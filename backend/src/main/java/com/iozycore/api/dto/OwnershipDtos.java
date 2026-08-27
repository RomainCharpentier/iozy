package com.iozycore.api.dto;

import com.iozycore.domain.ownership.Ownership;
import com.iozycore.domain.ownership.OwnershipCondition;
import com.iozycore.domain.ownership.OwnershipStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public final class OwnershipDtos {

    private OwnershipDtos() {
    }

    public record OwnershipResponse(UUID id, UUID entityId, UUID variantId, OwnershipCondition condition,
                                     OwnershipStatus status, LocalDate acquiredAt, String note,
                                     BigDecimal purchasePrice) {
        public static OwnershipResponse from(Ownership ownership) {
            return new OwnershipResponse(
                    ownership.id(), ownership.entityId(), ownership.variantId().orElse(null),
                    ownership.condition(), ownership.status(), ownership.acquiredAt(), ownership.note(),
                    ownership.purchasePrice().orElse(null));
        }
    }
}
