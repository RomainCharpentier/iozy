package com.iozycore.metadata;

import java.util.List;

/**
 * Résultat de {@link MetadataSearchService#searchVolumes} - {@code volumes}
 * vide ne veut pas systématiquement dire "aucune édition française" :
 * {@code quotaExceeded} distingue ce cas d'un quota externe dépassé (voir
 * {@link QuotaExceededException}), pour que le client puisse afficher un
 * message adapté ("réessaie plus tard") plutôt que de laisser croire à tort
 * que la série n'a aucune édition.
 */
public record VolumeSearchResult(List<VolumeCandidate> volumes, boolean quotaExceeded) {
    public static VolumeSearchResult of(List<VolumeCandidate> volumes) {
        return new VolumeSearchResult(volumes, false);
    }
}
