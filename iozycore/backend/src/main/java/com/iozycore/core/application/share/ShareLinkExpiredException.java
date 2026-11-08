package com.iozycore.core.application.share;

/**
 * A gift link whose thirty days are over. Unlike an unknown token, saying it
 * reveals nothing: the visitor already holds a link the owner really sent, and
 * "expired" tells them to ask for a new one instead of a dead end.
 */
public class ShareLinkExpiredException extends RuntimeException {

    public ShareLinkExpiredException() {
        super("Ce lien a expiré");
    }
}
