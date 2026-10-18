package com.iozycore.core.metadata;

/**
 * Extension point of the core: can a cover be KEPT?
 *
 * <p>The core saves the address of a cover as a provider
 * gives it; some providers answer 200 on an address that has no
 * image (the BnF, in 500). A universe that knows this kind of source says
 * here whether the address is usable - the core itself knows no source
 * (Batch 133).
 */
public interface CoverImageCheck {

    boolean estUtilisable(String url);
}
