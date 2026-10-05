package com.iozycore.core.domain.tierlist;

/**
 * Scale S to F (see IozyCore DS v1.1 - RANK_SCALE) - the LETTER carries
 * the information, color only reinforces it on the web side (a rank
 * stays understandable in grayscale). Declared order = natural sort
 * order (S is the highest).
 */
public enum Rank {
    S, A, B, C, D, E, F
}
