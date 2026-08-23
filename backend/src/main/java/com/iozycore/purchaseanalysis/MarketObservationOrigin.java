package com.iozycore.purchaseanalysis;

/**
 * D'où vient un prix relevé : d'une saisie délibérée, ou d'une annonce que
 * l'utilisateur a réellement analysée.
 *
 * <h2>Pourquoi le distinguer</h2>
 * Les deux sont des faits constatés et valent autant l'un que l'autre comme
 * comparables. Mais ils ne se relisent pas pareil : un relevé manuel est une
 * intention (« j'ai vu ce prix, je le note »), un relevé issu d'analyse est un
 * sous-produit d'un autre geste. Quand un chiffre surprend, savoir lequel des
 * deux on regarde est la première question qu'on se pose - et sans ce champ,
 * elle n'a pas de réponse.
 *
 * <h2>Ce que ce n'est pas</h2>
 * Ni une hiérarchie de fiabilité, ni un niveau de confiance : la confiance se
 * calcule sur l'échantillon ({@link MarketReferenceConfidence}), pas sur la
 * façon dont la ligne est arrivée en base.
 */
public enum MarketObservationOrigin {

    /** Saisi par l'utilisateur depuis la fiche d'une édition. */
    MANUAL_ENTRY,

    /**
     * Retenu d'une annonce analysée puis enregistrée. Le prix est celui de
     * l'annonce, <b>hors frais</b> - la protection et la livraison relèvent du
     * coût d'acquisition de l'acheteur, pas de ce que vaut le produit.
     */
    LISTING_ANALYSIS
}
