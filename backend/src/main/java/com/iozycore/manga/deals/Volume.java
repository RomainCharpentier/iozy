package com.iozycore.manga.deals;

/** A single volume number within a series/edition. */
public record Volume(int number) {
    public Volume {
        if (number < 1) {
            throw new IllegalArgumentException("Un numéro de tome vaut au minimum 1");
        }
    }
}
