package com.iozycore.manga.recognition;

import java.util.Optional;

/**
 * Where an item was seen on a photo: a rectangle in fractions of the
 * width and the height (0 to 1), on the photo {@code imageIndex}.
 *
 * <p>Used by the review screen: a frame on the photo, a crop
 * to validate the readings one by one. A missing box takes nothing away from the
 * reading - the engine can read a title without knowing how to place it, and the text or
 * a barcode have no place on an image.
 *
 * @param imageIndex the photo, in the order in which the user sent them
 * @param top        top edge, fraction of the height
 * @param left       left edge, fraction of the width
 * @param bottom     bottom edge, strictly below the top
 * @param right      right edge, strictly to the right of the left
 */
public record RecognizedBox(int imageIndex, double top, double left, double bottom, double right) {

    public RecognizedBox {
        if (imageIndex < 0) {
            throw new IllegalArgumentException("L'index de photo d'une boîte n'est jamais négatif");
        }
        if (!(0 <= top && top < bottom && bottom <= 1) || !(0 <= left && left < right && right <= 1)) {
            throw new IllegalArgumentException("Une boîte est un rectangle non vide dans la photo, de 0 à 1");
        }
    }

    /**
     * What Gemini returns: {@code [ymin, xmin, ymax, xmax]} in thousandths of the
     * photo. Brought back inside the photo if it overflows a little; empty if the
     * rectangle has no area - a reading without a place is not an
     * error, it simply has no frame.
     */
    public static Optional<RecognizedBox> fromThousandths(int imageIndex, double ymin, double xmin, double ymax,
                                                          double xmax) {
        if (imageIndex < 0) {
            return Optional.empty();
        }
        double top = borner(ymin);
        double left = borner(xmin);
        double bottom = borner(ymax);
        double right = borner(xmax);
        if (top >= bottom || left >= right) {
            return Optional.empty();
        }
        return Optional.of(new RecognizedBox(imageIndex, top, left, bottom, right));
    }

    private static double borner(double milliemes) {
        return Math.max(0d, Math.min(1d, milliemes / 1000d));
    }
}
