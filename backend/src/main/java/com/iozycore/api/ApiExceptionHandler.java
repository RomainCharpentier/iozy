package com.iozycore.api;

import com.iozycore.domain.shared.EntityDeletionNotAllowedException;
import com.iozycore.domain.shared.EntityTypeDeletionNotAllowedException;
import com.iozycore.domain.shared.OwnershipDeletionNotAllowedException;
import com.iozycore.domain.shared.VariantDeletionNotAllowedException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.InvalidDataAccessApiUsageException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(EntityDeletionNotAllowedException.class)
    public ResponseEntity<Map<String, String>> handleDeletionNotAllowed(EntityDeletionNotAllowedException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(EntityTypeDeletionNotAllowedException.class)
    public ResponseEntity<Map<String, String>> handleTypeDeletionNotAllowed(EntityTypeDeletionNotAllowedException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(OwnershipDeletionNotAllowedException.class)
    public ResponseEntity<Map<String, String>> handleOwnershipDeletionNotAllowed(OwnershipDeletionNotAllowedException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(VariantDeletionNotAllowedException.class)
    public ResponseEntity<Map<String, String>> handleVariantDeletionNotAllowed(VariantDeletionNotAllowedException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, String>> handleIllegalState(IllegalStateException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", ex.getMessage()));
    }

    /**
     * Filet général : une contrainte de base violée (unicité, clé étrangère)
     * sortait en 500 avec la requête SQL complète et le nom de la contrainte.
     * Trois cas ont déjà été corrigés un par un en amont - suppression d'édition
     * (Lot 26), wishlist et relations (Lot 28), création d'édition en double
     * (Lot 36) - mais chacun ne fermait que sa porte. Ici on ferme le couloir :
     * un conflit de données est un 409, jamais une trace SQL à l'écran.
     * <p>
     * Le message reste générique volontairement : celui de Postgres nomme des
     * colonnes et des contraintes, qui ne veulent rien dire pour qui lit
     * l'écran. Le détail part en WARN dans les logs, car cette exception peut
     * aussi trahir un vrai défaut serveur.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, String>> handleDataIntegrityViolation(DataIntegrityViolationException ex) {
        log.warn("Requête refusée en 409 (contrainte de base violée)", ex);
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("error", "Cette donnée entre en conflit avec une donnée existante."));
    }

    /**
     * Un identifiant absent du corps de la requête arrive jusqu'à Spring Data,
     * qui refuse un {@code findById(null)} : l'{@code IllegalArgumentException}
     * qu'il lève est enveloppée dans une {@link InvalidDataAccessApiUsageException},
     * que le handler d'{@code IllegalArgumentException} ci-dessus ne voit donc
     * pas - le client recevait un 500 avec la trace, là où le corps envoyé était
     * simplement incomplet (ex: {@code POST /api/entities/quick-add} sans
     * {@code entityTypeId}).
     * <p>
     * Message générique et non {@code ex.getMessage()} : la phrase de Spring est
     * en anglais et parle de l'API JPA, pas de la requête HTTP. Le détail part
     * en WARN dans les logs, car cette exception peut aussi trahir un vrai
     * défaut serveur (requête JPQL invalide) - qu'un 400 muet rendrait
     * invisible.
     */
    @ExceptionHandler(InvalidDataAccessApiUsageException.class)
    public ResponseEntity<Map<String, String>> handleInvalidDataAccessUsage(InvalidDataAccessApiUsageException ex) {
        log.warn("Requête refusée en 400 (usage invalide de la couche d'accès aux données)", ex);
        return ResponseEntity.badRequest()
                .body(Map.of("error", "Requête invalide : un identifiant obligatoire est absent ou mal formé."));
    }
}
