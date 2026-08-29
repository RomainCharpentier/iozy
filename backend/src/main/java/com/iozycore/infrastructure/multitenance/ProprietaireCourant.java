package com.iozycore.infrastructure.multitenance;

import com.iozycore.application.auth.UtilisateurCourant;
import org.hibernate.cfg.AvailableSettings;
import org.hibernate.context.spi.CurrentTenantIdentifierResolver;
import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer;
import org.springframework.stereotype.Component;

import com.iozycore.domain.shared.DefaultOwner;

import java.util.Map;
import java.util.UUID;

/**
 * À qui appartient ce que Hibernate lit et écrit, en ce moment même.
 *
 * <h2>Pourquoi le cloisonnement vit ICI et pas dans chaque requête</h2>
 * L'alternative était d'ajouter un {@code ownerId} à chaque méthode des huit
 * dépôts privés - quatre-vingts appels, et surtout une règle à se rappeler
 * <b>à chaque nouvelle requête écrite un an plus tard</b>. Une seule oubliée,
 * et un écran montre la collection de quelqu'un d'autre sans que rien ne le
 * signale.
 *
 * <p>Hibernate sait faire ça lui-même : une colonne marquée {@code @TenantId}
 * est ajoutée à la clause {@code WHERE} de toute requête sur l'entité, et
 * remplie à l'insertion. Ce n'est pas un filtre qu'on pense à poser, c'est un
 * filtre qu'on ne peut pas retirer.
 *
 * <h2>Le défaut est « personne », jamais « le premier »</h2>
 * Hors de toute requête authentifiée, ce résolveur rend {@link DefaultOwner#PERSONNE} -
 * un identifiant qu'aucun compte ne peut porter, donc qui ne correspond à
 * aucune ligne. Un chemin qui oublierait de dire au nom de qui il travaille ne
 * voit <b>rien</b> ; il ne voit pas la collection du premier compte. C'est la
 * seule façon sûre de se tromper.
 *
 * <h2>Lire au nom d'un autre, explicitement</h2>
 * Un cas légitime existe : un lien de partage. Son destinataire n'a pas de
 * compte, et ce qu'il doit voir appartient à quelqu'un d'autre. Cela passe par
 * {@link AuNomDe}, qui le dit en toutes lettres à l'endroit où ça se produit -
 * plutôt que par une exception silencieuse dans le résolveur.
 */
@Component
public class ProprietaireCourant implements CurrentTenantIdentifierResolver<UUID>, HibernatePropertiesCustomizer {

    private final UtilisateurCourant utilisateurCourant;

    public ProprietaireCourant(UtilisateurCourant utilisateurCourant) {
        this.utilisateurCourant = utilisateurCourant;
    }

    @Override
    public UUID resolveCurrentTenantIdentifier() {
        return AuNomDe.actuel().orElseGet(utilisateurCourant::proprietaire);
    }

    /**
     * {@code false} : le propriétaire change d'une requête à l'autre, et
     * Hibernate doit relire ce résolveur à chaque session plutôt que de valider
     * qu'il n'a pas bougé. Répondre {@code true} ferait échouer la première
     * requête servie à quelqu'un d'autre.
     */
    @Override
    public boolean validateExistingCurrentSessions() {
        return false;
    }

    /** Branche ce résolveur dans Hibernate - sans cette ligne, il n'est jamais consulté. */
    @Override
    public void customize(Map<String, Object> proprietesHibernate) {
        proprietesHibernate.put(AvailableSettings.MULTI_TENANT_IDENTIFIER_RESOLVER, this);
    }
}
