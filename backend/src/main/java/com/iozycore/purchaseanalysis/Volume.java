package com.iozycore.purchaseanalysis;

/** A single volume number within a series/edition. */
public record Volume(int number) {
    public Volume {
        if (number < 1) {
            throw new IllegalArgumentException("Volume number must be at least 1");
        }
    }
}
