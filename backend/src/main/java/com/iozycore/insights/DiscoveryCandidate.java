package com.iozycore.insights;

/**
 * Une suggestion de découverte (UC "séries que je n'ai pas" / recommandations
 * heuristiques). reason explique pourquoi la suggestion est faite - jamais
 * un vrai moteur de recommandation IA (voir DiscoveryService), toujours
 * traçable jusqu'à un signal concret (auteur, catégorie...).
 */
public record DiscoveryCandidate(String source, String externalId, String title, String imageUrl, String reason) {
}
