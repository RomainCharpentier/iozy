package com.iozycore.core.application;

/**
 * What a use case raises when the thing a caller names does not exist.
 * {@code ApiExceptionHandler} turns it into the standard Spring 404, the same
 * one a {@code ResponseStatusException} gave: the web client shows its own
 * message for a 404, never the technical one.
 */
public class NotFoundException extends RuntimeException {

    public NotFoundException(String message) {
        super(message);
    }
}
