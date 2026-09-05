package com.iozycore.core.api.listing;

import com.iozycore.core.listing.ListingResolution;
import com.iozycore.core.listing.ListingSnapshot;
import com.iozycore.core.listing.ListingSourceResolver;
import com.iozycore.core.listing.ListingPlatform;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Lit une annonce en ligne pour pré-remplir un brouillon d'analyse d'achat.
 *
 * <h2>Ce n'est pas un endpoint de récupération d'URL arbitraire</h2>
 * Le serveur ne va chercher que ce qu'un provider déclaré reconnaît, et
 * uniquement sur les hôtes que ce provider autorise explicitement. Une URL
 * quelconque n'est jamais suivie : elle rend {@code UNSUPPORTED_SOURCE} sans le
 * moindre appel réseau. Voir {@code ListingUrlGuard} pour le détail des
 * protections (HTTPS seul, liste blanche, refus des adresses internes,
 * redirections revalidées une par une, délai et taille plafonnés).
 *
 * <h2>Toujours 200</h2>
 * Une annonce supprimée, une plateforme non couverte ou un résultat partiel ne
 * sont pas des erreurs d'API : ce sont des issues normales du parcours, que le
 * formulaire doit savoir présenter sans se bloquer. Le {@code status} de la
 * réponse les distingue, plutôt qu'un code HTTP qui les confondrait tous dans
 * un bandeau rouge.
 */
@RestController
@RequestMapping("/api/listing-metadata")
@Tag(name = "Listing metadata", description = "Pré-remplissage d'une analyse d'achat depuis le lien d'une annonce")
public class ListingMetadataController {

    private final ListingSourceResolver resolver;

    public ListingMetadataController(ListingSourceResolver resolver) {
        this.resolver = resolver;
    }

    public record ResolveListingRequest(String url) {
    }

    /**
     * @param retrievedFields ce qui a RÉELLEMENT été lu - le client ne pré-remplit que ces champs,
     *                        et n'invente jamais les autres
     */
    public record ListingPreviewResponse(String status, ListingPlatform source, String url, String externalId,
                                          String title, String description, BigDecimal price, String currency,
                                          BigDecimal shippingFee, String shippingKind,
                                          BigDecimal buyerProtectionFee,
                                          List<String> imageUrls, Instant retrievedAt,
                                          List<String> retrievedFields) {

        static ListingPreviewResponse from(ListingResolution resolution) {
            ListingSnapshot snapshot = resolution.snapshot();
            if (snapshot == null) {
                return new ListingPreviewResponse(resolution.status().name(), resolution.source(), resolution.url(),
                        null, null, null, null, null, null, null, null, List.of(), null, List.of());
            }
            return new ListingPreviewResponse(
                    resolution.status().name(), snapshot.source(), snapshot.sourceUrl(), snapshot.externalId(),
                    snapshot.title(), snapshot.description(), snapshot.price(), snapshot.currency(),
                    snapshot.shippingFee(), snapshot.shippingKind().name(), snapshot.buyerProtectionFee(),
                    snapshot.imageUrls(), snapshot.retrievedAt(),
                    snapshot.retrievedFields().stream().map(Enum::name).toList());
        }
    }

    @Operation(summary = "Lire une annonce depuis son lien pour pré-remplir une analyse d'achat. "
            + "Répond toujours 200 : le champ status distingue succès, résultat partiel, source non prise "
            + "en charge, annonce introuvable et indisponibilité, chacun ayant sa suite côté formulaire.")
    @PostMapping("/resolve")
    public ListingPreviewResponse resolve(@RequestBody ResolveListingRequest request) {
        return ListingPreviewResponse.from(resolver.resolve(request.url()));
    }
}
