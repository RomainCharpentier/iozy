package com.iozycore.manga;

import com.iozycore.manga.metadata.bnf.BnfCouverture;
import com.iozycore.core.metadata.CoverImageCheck;
import org.springframework.stereotype.Component;

/** Une jaquette de la BnF n'est gardée que si elle existe vraiment (voir BnfCouverture) ; toute autre adresse passe. */
@Component
public class BnfCoverImageCheck implements CoverImageCheck {

    @Override
    public boolean estUtilisable(String url) {
        return BnfCouverture.estVivante(url);
    }
}
