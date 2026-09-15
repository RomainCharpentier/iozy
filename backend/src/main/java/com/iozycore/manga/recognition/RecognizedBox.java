package com.iozycore.manga.recognition;

import java.util.Optional;

/**
 * Où un élément a été vu sur une photo : un rectangle en fractions de la
 * largeur et de la hauteur (0 à 1), sur la photo {@code imageIndex}.
 *
 * <p>Sert à l'écran de vérification : un cadre sur la photo, un recadrage
 * pour valider les lectures une par une. Une boîte absente n'enlève rien à la
 * lecture - le moteur peut lire un titre sans savoir le situer, et le texte ou
 * un code-barres n'ont pas de place sur une image.
 *
 * @param imageIndex la photo, dans l'ordre où l'utilisateur les a envoyées
 * @param top        bord haut, fraction de la hauteur
 * @param left       bord gauche, fraction de la largeur
 * @param bottom     bord bas, strictement sous le haut
 * @param right      bord droit, strictement à droite du gauche
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
     * Ce que Gemini rend : {@code [ymin, xmin, ymax, xmax]} en millièmes de la
     * photo. Ramené dans la photo si ça déborde d'un peu ; vide si le
     * rectangle n'a pas de surface - une lecture sans place n'est pas une
     * erreur, elle n'a simplement pas de cadre.
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
