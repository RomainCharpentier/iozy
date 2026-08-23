package com.iozycore.recognition;

import java.util.List;
import java.util.UUID;

/**
 * Un élément reconnu, confronté au catalogue - ce que l'écran de confirmation
 * affiche réellement.
 *
 * @param recognized      la lecture brute, conservée telle quelle : l'utilisateur doit
 *                        pouvoir voir ce qui a été lu, pas seulement ce qu'IozyCore en a fait
 * @param catalogStatus   voir {@link CatalogStatus}
 * @param entityId        la Série du catalogue, si elle a été retrouvée - {@code null} sinon.
 *                        Aucune Entity n'est créée ici, jamais.
 * @param catalogTitle    le titre <b>tel qu'il est écrit dans le catalogue</b>, qui fait foi
 *                        pour l'affichage - « Platinum End », même si la photo disait
 *                        « PLATINUM end ». Null si absent du catalogue.
 * @param editionOptions  les éditions connues de cette série, quand il faut en confirmer une.
 *                        Une proposition à choisir, jamais un choix déjà fait.
 * @param preselected     si l'écran doit pré-cocher cet élément - voir
 *                        {@link RecognitionConfidence#worthPreselecting()}
 */
public record ResolvedItem(RecognizedItem recognized, CatalogStatus catalogStatus, UUID entityId,
                            String catalogTitle, List<EditionOption> editionOptions, boolean preselected) {

    public ResolvedItem {
        editionOptions = editionOptions == null ? List.of() : List.copyOf(editionOptions);
    }

    /** Une édition connue du catalogue, proposée à la confirmation. */
    public record EditionOption(UUID editionId, String editionName, Integer totalVolumes) {
    }

    /** Le titre à afficher : celui du catalogue s'il existe, sinon ce qui a été lu. */
    public String displayTitle() {
        return catalogTitle != null ? catalogTitle : recognized.seriesTitleRaw();
    }

    /**
     * Vrai quand cet élément peut alimenter l'analyse sans autre question :
     * série connue, tome lu, édition tranchée. Tout le reste demande un geste.
     */
    public boolean readyForAnalysis() {
        return catalogStatus == CatalogStatus.MATCHED && recognized.volumeNumber() != null;
    }
}
