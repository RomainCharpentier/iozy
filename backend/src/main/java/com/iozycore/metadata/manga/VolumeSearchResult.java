package com.iozycore.metadata.manga;

import java.util.List;

/**
 * Résultat de {@link TomeSearchService#searchVolumes} - {@code volumes}
 * vide ne veut pas systématiquement dire "aucune édition française" :
 * {@code providerUnavailable} distingue ce cas d'un échec TRANSITOIRE du
 * fournisseur externe, qu'il s'agisse d'un quota dépassé (voir
 * {@link QuotaExceededException}) ou d'une source muette (voir
 * {@link SourceUnavailableException}). Le client peut alors afficher un
 * message adapté ("réessaie plus tard") plutôt que de laisser croire à tort
 * que la série n'a aucune édition.
 * <p>
 * Un seul drapeau pour les deux causes : elles appellent exactement la même
 * conduite, côté cache (ne rien mémoriser) comme côté écran (réessayer) -
 * les distinguer n'apporterait qu'un mot dans un message.
 */
public record VolumeSearchResult(List<VolumeCandidate> volumes, boolean providerUnavailable) {
    public static VolumeSearchResult of(List<VolumeCandidate> volumes) {
        return new VolumeSearchResult(volumes, false);
    }
}
