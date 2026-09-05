package com.iozycore.application.admin;

import java.util.Map;
import java.util.UUID;
import com.iozycore.manga.deals.Volume;

/**
 * Ce que pèse chaque compte, et comment effacer le sien.
 *
 * <h2>Le seul endroit de l'application qui regarde par-dessus la cloison</h2>
 * Partout ailleurs, une requête ne voit que les lignes du propriétaire courant
 * - c'est Hibernate qui l'impose, par le filtre de {@code @TenantId}, et c'est
 * ce qui rend l'isolation vraie plutôt que promise (voir le Lot 95). Les deux
 * gestes ci-dessous ne peuvent pas s'écrire ainsi : compter les possessions de
 * QUELQU'UN D'AUTRE, ou effacer les siennes, c'est précisément sortir de sa
 * propre cloison.
 *
 * <p>D'où un port séparé, et une implémentation en SQL direct : ce n'est pas
 * un contournement discret glissé dans un dépôt ordinaire, c'est une porte
 * nommée, avec un seul appelant ({@link GestionDesComptes}) et une garde
 * devant (le rôle {@code ADMIN}, voir {@code SecurityConfig}).
 *
 * <h2>Des NOMBRES, jamais du contenu</h2>
 * {@link #compter()} rend des décomptes. Aucune méthode ici ne rend une ligne :
 * un administrateur doit pouvoir décider s'il supprime un compte - donc savoir
 * ce qu'il détruit - sans jamais lire la collection de personne.
 */
public interface DonneesParProprietaire {

    /**
     * @param possessions les tomes et objets réellement possédés
     * @param envies      la liste d'envies
     * @param experiences lectures, parties, visionnages - ce qu'on a vécu
     * @param classements les Tier Lists personnelles
     * @param analyses    les analyses d'annonces enregistrées
     */
    record Volume(long possessions, long envies, long experiences, long classements, long analyses) {

        public static final Volume AUCUN = new Volume(0, 0, 0, 0, 0);

        /** Ce qu'on détruirait en supprimant ce compte - zéro veut dire « rien ». */
        public long total() {
            return possessions + envies + experiences + classements + analyses;
        }
    }

    /**
     * Le volume de chaque propriétaire, en une seule requête.
     * <p>
     * Une requête par compte ferait grandir le coût de l'écran avec le nombre
     * de comptes, pour un écran qui les liste tous - la figure exacte du
     * constat C1.
     */
    Map<UUID, Volume> compter();

    /**
     * Efface TOUT ce qui appartient à ce propriétaire, dans les onze tables qui
     * portent un {@code owner_id}. Le compte lui-même est retiré ailleurs (voir
     * {@code AppUserRepository#supprimer}) : cette méthode ne connaît que les
     * données.
     * <p>
     * Le catalogue - œuvres, tomes, éditions, relations - n'est PAS touché : il
     * est partagé, une œuvre est la même pour tout le monde, et la supprimer
     * retirerait de la collection des autres.
     */
    void effacerToutCeQuiAppartientA(UUID proprietaire);
}
