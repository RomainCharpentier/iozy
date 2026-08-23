package com.iozycore.recognition;

/**
 * Le peu qu'on sait déjà avant de regarder les photos.
 *
 * <h2>Aider à lire, jamais dicter la réponse</h2>
 * Le titre d'une annonce (« Lot Platinum End tomes 1 à 14 ») aide énormément à
 * lire des tranches floues. Mais un moteur à qui l'on souffle la réponse la
 * répète : c'est le risque assumé ici, et la raison pour laquelle le contexte
 * reste un <b>indice</b> transmis tel quel, jamais une consigne du genre
 * « trouve quatorze tomes de Platinum End ». Le prompt du provider doit
 * demander ce qui est <b>visible</b>, et le contexte ne sert qu'à lever les
 * ambiguïtés de lecture.
 *
 * <h2>Univers attendu</h2>
 * La V1 n'est validée que sur le manga. {@code expectedEntityTypeCode} permet
 * à un moteur de refuser poliment ce qu'il ne sait pas faire, plutôt que de
 * répondre n'importe quoi sur une photo de jeu de société.
 *
 * @param listingTitle          titre de l'annonce, ou {@code null}
 * @param expectedEntityTypeCode code d'univers attendu (« MANGA »), ou {@code null} si inconnu
 */
public record RecognitionContext(String listingTitle, String expectedEntityTypeCode) {

    public static final String MANGA = "MANGA";

    public RecognitionContext {
        listingTitle = listingTitle == null || listingTitle.isBlank() ? null : listingTitle.trim();
        expectedEntityTypeCode = expectedEntityTypeCode == null || expectedEntityTypeCode.isBlank()
                ? null : expectedEntityTypeCode.trim().toUpperCase(java.util.Locale.ROOT);
    }

    /** Aucun indice - une photo seule, sans annonce autour. */
    public static RecognitionContext none() {
        return new RecognitionContext(null, null);
    }

    /** Le cas de la V1 : des photos d'annonce de mangas. */
    public static RecognitionContext forManga(String listingTitle) {
        return new RecognitionContext(listingTitle, MANGA);
    }

    public boolean isManga() {
        return MANGA.equals(expectedEntityTypeCode);
    }
}
