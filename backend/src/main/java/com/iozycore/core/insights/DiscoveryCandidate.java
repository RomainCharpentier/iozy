package com.iozycore.core.insights;

/**
 * A discovery suggestion (UC "series I do not have" / heuristic
 * recommendations). reason explains why the suggestion is made - never
 * a real AI recommendation engine (see DiscoveryService), always
 * traceable to a concrete signal (author, category...).
 */
public record DiscoveryCandidate(String source, String externalId, String title, String imageUrl, String reason) {
}
