package com.iozycore.manga;

import com.iozycore.manga.metadata.bnf.BnfCouverture;
import com.iozycore.core.metadata.CoverImageCheck;
import org.springframework.stereotype.Component;

/** A BnF cover is kept only if it really exists (see BnfCouverture); any other address passes. */
@Component
public class BnfCoverImageCheck implements CoverImageCheck {

    @Override
    public boolean estUtilisable(String url) {
        return BnfCouverture.estVivante(url);
    }
}
