package com.iozycore.manga.metadata;

import com.iozycore.core.domain.catalog.EntityType;

import java.util.List;

/**
 * Recherche les tomes réels (avec jaquette) des différentes éditions
 * françaises d'une série - voir {@link VolumeCandidate}. Distinct de
 * {@link FrenchTitleProvider} (qui ne renvoie qu'un titre) : ici on veut
 * de quoi construire une sélection visuelle des tomes possédés.
 */
public interface VolumeSearchProvider {

    boolean supports(EntityType entityType);

    /** Best-effort, couverture "rapide" (voir GoogleBooksVolumeSearchProvider.
     * QUICK_EDITION_KEYWORDS - la majorité des mangas n'ont qu'une seule
     * édition française, pas la peine de payer une recherche exhaustive par
     * défaut) : une liste vide signifie "rien trouvé", jamais une erreur -
     * l'appelant garde alors le parcours de saisie manuelle du tome.
     *
     * @param excludedTitleFragments fragments de titre (voir RelatedSeriesService)
     *                               identifiant un spin-off/side-story connu de
     *                               la série cherchée - à exclure des résultats,
     *                               jamais vide sans raison mais toléré (aucun
     *                               filtre appliqué dans ce cas). */
    List<VolumeCandidate> searchVolumes(String seriesTitle, String author, List<String> excludedTitleFragments);

    /** Recherche approfondie optionnelle (mots-clés d'édition plus rares,
     * voir DEEP_EDITION_KEYWORDS) - déclenchée uniquement par une action
     * explicite de l'utilisateur ("Chercher plus d'éditions"), jamais
     * automatiquement. Résultat pensé pour être FUSIONNÉ avec celui déjà
     * connu de {@link #searchVolumes}, pas pour le remplacer (voir
     * TomeSearchService.searchAdditionalEditions). Vide par défaut : un
     * fournisseur qui n'a pas de notion de recherche approfondie (aucune
     * édition particulière à chercher plus loin) reste simplement muet ici. */
    default List<VolumeCandidate> searchAdditionalEditions(String seriesTitle, String author, List<String> excludedTitleFragments) {
        return List.of();
    }

    /**
     * Retrouver UN tome precis, par son numero (Lot 125) - « le tome 7 de
     * cette serie existe-t-il chez toi ? ». Sert a combler les trous d'une
     * liste que les recherches par titre ont laissee incomplete, sans
     * relancer une recherche entiere. Vide par defaut : seul Google Books le
     * sait faire utilement (voir GoogleBooksVolumeSearchProvider.probeVolume).
     */
    default List<VolumeCandidate> probeVolume(String seriesTitle, String author, int volumeNumber,
                                              List<String> excludedTitleFragments) {
        return List.of();
    }

    /**
     * Les tomes d'UNE edition nommee - « Hokage », « Édition originale » - en
     * cherchant la serie AVEC le nom de l'edition (lot 144). Une recherche par
     * serie ne rend qu'une page, ou l'edition simple prend toute la place ;
     * chercher une edition par son nom rend les siens. Vide par defaut : seul
     * Google Books le sait faire utilement, la BnF ayant deja tout dit en une
     * requete paginee.
     *
     * @throws QuotaExceededException / SourceUnavailableException comme une
     *         sonde : l'appelant garde ce qu'il a, et ne fige rien
     */
    default List<VolumeCandidate> searchEdition(String seriesTitle, String author, String editionName,
                                                List<String> excludedTitleFragments) {
        return List.of();
    }
}
