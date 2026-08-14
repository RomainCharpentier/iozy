package com.iozycore.api;

import com.iozycore.domain.shared.EntityDeletionNotAllowedException;
import com.iozycore.domain.shared.EntityTypeDeletionNotAllowedException;
import com.iozycore.domain.shared.OwnershipDeletionNotAllowedException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class ApiExceptionHandler {

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

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, String>> handleIllegalState(IllegalStateException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", ex.getMessage()));
    }
}
