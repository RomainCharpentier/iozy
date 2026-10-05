package com.iozycore.core.api;

import com.iozycore.core.domain.shared.EntityDeletionNotAllowedException;
import com.iozycore.core.domain.shared.EntityTypeDeletionNotAllowedException;
import com.iozycore.core.domain.shared.VariantDeletionNotAllowedException;
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
     * General safety net: a violated database constraint (uniqueness, foreign key)
     * used to come out as a 500 with the full SQL query and the name of the constraint.
     * Three cases were already fixed one by one upstream - edition deletion
     * (Batch 26), wishlist and relationships (Batch 28), creation of a duplicate edition
     * (Batch 36) - but each one only closed its own door. Here we close the corridor:
     * a data conflict is a 409, never an SQL trace on the screen.
     * <p>
     * The message stays generic on purpose: the Postgres one names
     * columns and constraints, which mean nothing to whoever reads
     * the screen. The detail goes to WARN in the logs, because this exception can
     * also reveal a real server defect.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, String>> handleDataIntegrityViolation(DataIntegrityViolationException ex) {
        log.warn("Request refused with 409 (database constraint violated)", ex);
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("error", "Cette donnée entre en conflit avec une donnée existante."));
    }

    /**
     * An id missing from the request body reaches Spring Data,
     * which refuses a {@code findById(null)}: the {@code IllegalArgumentException}
     * it raises is wrapped in an {@link InvalidDataAccessApiUsageException},
     * which the {@code IllegalArgumentException} handler above therefore does not
     * see - the client got a 500 with the trace, where the body sent was
     * simply incomplete (e.g. {@code POST /api/entities/quick-add} without
     * {@code entityTypeId}).
     * <p>
     * Generic message and not {@code ex.getMessage()}: the Spring sentence is
     * in English and talks about the JPA API, not about the HTTP request. The detail goes
     * to WARN in the logs, because this exception can also reveal a real
     * server defect (invalid JPQL query) - which a silent 400 would make
     * invisible.
     */
    @ExceptionHandler(InvalidDataAccessApiUsageException.class)
    public ResponseEntity<Map<String, String>> handleInvalidDataAccessUsage(InvalidDataAccessApiUsageException ex) {
        log.warn("Request refused with 400 (invalid use of the data access layer)", ex);
        return ResponseEntity.badRequest()
                .body(Map.of("error", "Requête invalide : un identifiant obligatoire est absent ou mal formé."));
    }
}
