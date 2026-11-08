package com.iozycore.core.domain.share;

/**
 * When a money value may leave the app, on the public page or in the shared
 * image (lot 217).
 *
 * <h2>The threshold</h2>
 * A value is shown only when BOTH hold:
 * <ul>
 *   <li>at least {@link #MIN_PRICED} owned objects have a price: below that,
 *       one odd price (a collector's edition, a typo) makes the whole number;</li>
 *   <li>at least half of the owned objects have one ({@link #MIN_SHARE_PERCENT}):
 *       below that, the "value of the collection" is the value of a minority of
 *       it, and a visitor cannot see that part is missing.</li>
 * </ul>
 * Inside the app the owner sees every partial total with its count; outside,
 * there is no room for that caveat, so the number is left out instead.
 */
public final class ValueDisclosure {

    public static final long MIN_PRICED = 5;
    public static final long MIN_SHARE_PERCENT = 50;

    private ValueDisclosure() {
    }

    /** True when a total built on {@code priced} prices out of {@code total} objects may be shown. */
    public static boolean isSound(long priced, long total) {
        if (total <= 0 || priced < MIN_PRICED) {
            return false;
        }
        return priced * 100 >= total * MIN_SHARE_PERCENT;
    }
}
