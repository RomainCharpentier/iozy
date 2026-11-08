package com.iozycore.core.domain.share;

/** The pinned works of the current owner. */
public interface PinnedWorksRepository {

    /** In the order chosen; none when nothing was pinned. */
    PinnedWorks find();

    /** Replaces the whole list in one go. */
    void replace(PinnedWorks pinned);
}
