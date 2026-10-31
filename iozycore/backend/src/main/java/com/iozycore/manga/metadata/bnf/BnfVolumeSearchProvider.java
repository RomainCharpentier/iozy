package com.iozycore.manga.metadata.bnf;

import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.manga.metadata.VolumeCandidate;
import com.iozycore.core.metadata.SourceUnavailableException;
import com.iozycore.manga.metadata.VolumeSearchProvider;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Set;
import java.util.Map;
import java.util.HashSet;
import java.util.OptionalInt;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Searches the real volumes of a manga series via the SRU catalog
 * (open, no key or quota) of the BnF (Bibliothèque nationale de France) -
 * the legal deposit requires every French publisher to file each
 * release there, which makes it a much more complete coverage than Google
 * Books for recent French releases or those of smaller publishers.
 * <p>
 * Real case that motivates this provider (reported and checked at the request of
 * the user, see history of the conversation): "Dragon Ball Full
 * Color - L'enfance de Goku" (Glénat, from May 2024) is
 * IMPOSSIBLE TO FIND on Google Books whatever the wording tried
 * (exact title of the publisher included), but comes out at once on the
 * BnF - with volume number (MARC field 200$h), publisher (214$c) and ISBN
 * (010$a) in STRUCTURED fields, unlike Google Books where the
 * volume number must be guessed by regex in a free title.
 * <p>
 * The covers come from the "couverture" service of the catalog (Batch 120):
 * one image per recent record (those of the legal deposit since the
 * 2010s, checked on Boruto - 300 KB each), and a 500 error for the
 * others. Each URL is therefore CHECKED (HEAD) before being returned, otherwise
 * a dead address would be persisted on the volume and would block the cover
 * catch-up of Ma collection. Always added to the Google Books results
 * (never as a conditional fallback) - TomeSearchService then deduplicates
 * by (edition, volume): the BnF record, met first, is authoritative, and
 * a missing cover is taken from Google Books (Batch 119).
 * <p>
 * Two ways to catalog a volume, both read (Batch 120): the series title
 * in 200$a with the number in 200$h ("Boruto" T9), or the volume's
 * OWN title in 200$a ("Kawaki") with the series and its number in
 * 461$t/$v or 225$a/$v. Boruto: 7 volumes by the first way, all 20 by
 * both. The query asks for the SERIES NAME (before ":" or "-"),
 * otherwise the volumes cataloged by their own title do not come up.
 * <p>
 * No notion of "quick"/"deep" search here (see
 * GoogleBooksVolumeSearchProvider and its quota sharing): a single
 * free request (CQL) per search is enough to bring everything back at once, without
 * popularity bias to work around by keyword - searchAdditionalEditions
 * keeps its default behavior (empty), running it again would bring nothing
 * more.
 */
@Component
// First (Batch 119): no key or quota, and STRUCTURED fields. On the
// same volume, its record is authoritative; Google Books only brings the
// cover (see TomeSearchService.fusionnerTome).
@Order(1)
@Slf4j
public class BnfVolumeSearchProvider implements VolumeSearchProvider {

    private static final String SEARCH_URL =
            "https://catalogue.bnf.fr/api/SRU?version=1.2&operation=searchRetrieve&maximumRecords=100&startRecord=%d&query=%s";
    /** Five pages at most: One Piece (112 volumes, several editions) fits
     *  in four; beyond that, it is a request that is too wide, not a series. */
    private static final int PAGE = 100;
    private static final int NOTICES_MAX = 500;
    private static final Pattern NOMBRE_DE_NOTICES = Pattern.compile("<srw:numberOfRecords>(\\d+)</srw:numberOfRecords>");
    /** The image of the record, by its ARK identifier (controlfield 003). 500 when there is none. */
    static final String COVER_URL = "https://catalogue.bnf.fr/couverture?&appName=NE&idArk=%s&couverture=1";
    /** A volume number above this is not one (FRBNF identifiers with fifteen digits in 461$v, among others). */
    private static final int VOLUME_NUMBER_MAX = 999;

    // "T. 7", "7" - the MARC field 200$h usually contains just the
    // number, but we stay tolerant of a possible prefix.
    private static final Pattern VOLUME_NUMBER = Pattern.compile("(\\d+)");
    private static final Pattern ANNEE = Pattern.compile("(1[89]\\d{2}|20\\d{2})");

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    @Override
    public boolean supports(EntityType entityType) {
        return "MANGA".equals(entityType.code());
    }

    @Override
    public List<VolumeCandidate> searchVolumes(String seriesTitle, String author, List<String> excludedTitleFragments) {
        if (seriesTitle == null || seriesTitle.isBlank()) {
            return List.of();
        }
        String cql = buildQuery(seriesTitle, author);
        try {
            // Page by page (measured on 2026-09-05: One Piece returned 44 volumes
            // out of 112, the first 100 records only). One request per
            // page, and we stop as soon as the BnF says there is nothing more.
            // The author is tried in several spellings (see queriesFor): the
            // next one is only asked when the previous found NO record.
            List<String> pages = new ArrayList<>();
            for (String query : queriesFor(seriesTitle, author)) {
                cql = query;
                String encodedQuery = URLEncoder.encode(cql, StandardCharsets.UTF_8);
                int total = Integer.MAX_VALUE;
                for (int debut = 1; debut <= Math.min(total, NOTICES_MAX); debut += PAGE) {
                    HttpRequest request = HttpRequest.newBuilder()
                            .uri(URI.create(SEARCH_URL.formatted(debut, encodedQuery)))
                            .timeout(Duration.ofSeconds(10))
                            .GET()
                            .build();

                    HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                    if (response.statusCode() != 200) {
                        // A source that refuses (429: the BnF limits the rate per
                        // address) or that goes down has said nothing - it is not "no
                        // volume": reported as such, TomeSearchService will not
                        // cache this empty result (see searchVolumes).
                        log.warn("The BnF answered {} for the volume search '{}'", response.statusCode(), cql);
                        throw new SourceUnavailableException("La BnF a répondu " + response.statusCode());
                    }
                    Matcher nombre = NOMBRE_DE_NOTICES.matcher(response.body());
                    total = nombre.find() ? Integer.parseInt(nombre.group(1)) : 0;
                    // The covers are no longer checked here (Batch 127): see
                    // BnfCouverture - one per volume KEPT, never one per volume listed.
                    pages.add(response.body());
                }
                if (!pages.isEmpty() && !pages.stream().allMatch(BnfVolumeSearchProvider::sansNotice)) {
                    break;
                }
                pages.clear();
            }
            return parse(pages, seriesTitle, excludedTitleFragments);
        } catch (SourceUnavailableException e) {
            throw e;
        } catch (Exception e) {
            // Best-effort by nature: an outage must never block the
            // volume search, Google Books stays in all cases
            // queried separately by TomeSearchService.
            log.warn("BnF volume search failed for '{}': {}", cql, e.getMessage());
            throw new SourceUnavailableException("La BnF n'a pas répondu : " + e.getMessage());
        }
    }

    /** An answer page that announces no record at all. */
    private static boolean sansNotice(String page) {
        Matcher nombre = NOMBRE_DE_NOTICES.matcher(page);
        return !nombre.find() || Integer.parseInt(nombre.group(1)) == 0;
    }

    /** 010$a - the ISBN of the volume, in a dedicated MARC field. */
    private static String isbnDe(Element record) {
        Element field010 = firstDatafield(record, "010");
        return field010 == null ? null : subfield(field010, "a");
    }

    /** The publication year: 214$d ("DL 2009") or, on records from before 2019, 210$d. */
    private static Integer anneeDe(Element record) {
        for (String tag : new String[] {"214", "210"}) {
            Element field = firstDatafield(record, tag);
            String date = field == null ? null : subfield(field, "d");
            if (date != null) {
                Matcher matcher = ANNEE.matcher(date);
                if (matcher.find()) {
                    return Integer.parseInt(matcher.group(1));
                }
            }
        }
        return null;
    }

    private static String buildQuery(String seriesTitle, String author) {
        String query = "bib.title all \"" + nomDeSerie(seriesTitle).replace("\"", "") + "\"";
        if (author != null && !author.isBlank()) {
            query += " and bib.author all \"" + author.replace("\"", "") + "\"";
        }
        return query;
    }

    /**
     * The queries to try, in order, until one of them finds a record.
     *
     * <p>The catalog (AniList, MyAnimeList) writes Japanese names in Hepburn
     * with the long vowel spelled out: "Kentarou Miura", "Tatsuya Endou",
     * "Yuusei Matsui". The BnF writes them with a macron, "Miura, Kentarō",
     * and its {@code all} match is literal: the first query finds NOTHING,
     * and the series stayed without any volume (measured on 2026-10-31:
     * "Kentarou Miura" 0 records, "Kentaro Miura" 64; "Tatsuya Endou" 0,
     * "Tatsuya Endo" 30). So, after the name as given: the name with its
     * long vowels simplified, then the family name alone, simplified. Never
     * the title alone: "Monster" is 2,334 records and "Kingdom" 6,511, a
     * request that is too wide, not a series. A query that finds nothing
     * costs one request and answers at once.
     */
    static List<String> queriesFor(String seriesTitle, String author) {
        List<String> queries = new ArrayList<>();
        queries.add(buildQuery(seriesTitle, author));
        if (author != null && !author.isBlank()) {
            String simplified = sansVoyellesLongues(author);
            if (!queries.contains(buildQuery(seriesTitle, simplified))) {
                queries.add(buildQuery(seriesTitle, simplified));
            }
            String[] mots = simplified.trim().split("\\s+");
            String nomDeFamille = mots[mots.length - 1];
            if (mots.length > 1 && !queries.contains(buildQuery(seriesTitle, nomDeFamille))) {
                queries.add(buildQuery(seriesTitle, nomDeFamille));
            }
        }
        return queries;
    }

    /** "Kentarou" becomes "Kentaro", "Yuusei" "Yusei": the two long vowels
     *  of a Hepburn transcription that the BnF writes with a macron (ō, ū).
     *  Nothing else: "ii" stays "ii" at the BnF too ("Iida"), and touching
     *  "ee" would turn a Western "Lee" into something else. */
    static String sansVoyellesLongues(String nom) {
        return nom.replaceAll("(?i)ou", "o").replaceAll("(?i)uu", "u");
    }

    /** Mirror of {@link #searchVolumes} for the tests - parses a single
     * XML answer already in memory. */
    List<VolumeCandidate> parse(String xml, String seriesTitle) throws Exception {
        return parse(xml, seriesTitle, List.of());
    }

    List<VolumeCandidate> parse(String xml, String seriesTitle, List<String> excludedTitleFragments) throws Exception {
        return parse(List.of(xml), seriesTitle, excludedTitleFragments);
    }

    /**
     * All the pages of an answer, in TWO passes.
     *
     * <p>A volume cataloged under its own title ("Kawaki", 461$t
     * "Boruto") has nothing that says whether it belongs to "Boruto: Naruto Next
     * Generations" or to another "Boruto" series. Measurement of 2026-09-05:
     * searching "One Piece: Strong World", the 111 volumes of One Piece
     * ("A l'aube d'une grande aventure", 461$t "One piece") invited themselves
     * through this path. The rule: when the searched series has a subtitle,
     * such a volume is only kept if OTHER records of the same 461 set
     * carry this subtitle in clear ("Boruto" + $e "Naruto next
     * generations": yes; "One piece" + "Strong world": never, its two
     * volumes are cataloged $a "Strong world" + $e "one piece film").
     */
    List<VolumeCandidate> parse(List<String> pages, String seriesTitle, List<String> excludedTitleFragments) throws Exception {
        List<VolumeCandidate> candidates = new ArrayList<>();
        // The volumes waiting for a confirmation, with the 461 series that carries them.
        List<Map.Entry<String, VolumeCandidate>> differes = new ArrayList<>();
        // The 461 series for which a record confirmed the searched subtitle.
        Set<String> seriesConfirmees = new HashSet<>();
        // The volumes that carry a $e that designates no edition, grouped
        // by this $e; and the numbers of the volumes without any $e (see below).
        Map<String, List<VolumeCandidate>> parSousTitre = new LinkedHashMap<>();
        Set<Integer> numerosSansSousTitre = new HashSet<>();
        for (String xml : pages) {
            parseUnePage(xml, seriesTitle, excludedTitleFragments, candidates, differes, seriesConfirmees,
                    parSousTitre, numerosSansSousTitre);
        }
        for (Map.Entry<String, VolumeCandidate> differe : differes) {
            if (seriesConfirmees.contains(differe.getKey())) {
                candidates.add(differe.getValue());
            }
        }
        // A $e shared by SEVERAL volumes whose series already has the numbers
        // without $e is ANOTHER work cataloged under the name of the series
        // (batch 144): "Naruto" + "Konoha shinden / the steam ninja
        // scrolls" T1 and T2 - a novel -, "les liens, repliques celebres"
        // T1 and T2, at Kana like the 72 volumes. They took the place of
        // volumes 1 and 2, and the separation by ISBN sent the real ones to a
        // separate "Kana (2002)". A subtitle carried by ONE volume ("Grande
        // chance", T21) stays a volume: it has no twin without $e.
        for (List<VolumeCandidate> groupe : parSousTitre.values()) {
            if (groupe.size() >= 2 && groupe.stream().allMatch(c -> numerosSansSousTitre.contains(c.volumeNumber()))) {
                candidates.removeAll(groupe);
            }
        }
        return candidates;
    }

    private void parseUnePage(String xml, String seriesTitle, List<String> excludedTitleFragments,
                              List<VolumeCandidate> candidates, List<Map.Entry<String, VolumeCandidate>> differes,
                              Set<String> seriesConfirmees, Map<String, List<VolumeCandidate>> parSousTitre,
                              Set<Integer> numerosSansSousTitre) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        DocumentBuilder builder = factory.newDocumentBuilder();
        Document document = builder.parse(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));

        NodeList records = document.getElementsByTagName("mxc:record");
        for (int i = 0; i < records.getLength(); i++) {
            Element record = (Element) records.item(i);
            Element titleField = firstDatafield(record, "200");
            if (titleField == null) {
                continue;
            }

            String rawTitle = subfield(titleField, "a");
            if (rawTitle == null || rawTitle.isBlank()) {
                continue;
            }
            // 200$b tells the nature of the document. The legal deposit also receives
            // DVDs ("Images animées" - the Kana Home Video boxes of
            // Boruto, numbered 3, 4, 7, 8 like volumes) and games
            // ("Ressource électronique"): we only keep paper,
            // and the records that say nothing (some volumes have no $b).
            String nature = subfield(titleField, "b");
            if (nature != null && !nature.toLowerCase().contains("texte imprim")) {
                continue;
            }
            // A collection of children's NOVELS is never an edition of the
            // manga (batch 144): Hachette puts "Naruto" and "One piece" in
            // Bibliothèque verte - novels drawn from the anime, which the BnF
            // attaches to the series (225$a "One piece", 410$t "Bibliothèque
            // verte") and which came out as "Hachette jeunesse" 15 and 11
            // volumes next to Kana and Glénat. Mangacollec does not count them.
            if (estUnRomanJeunesse(record)) {
                continue;
            }
            // Case-insensitive comparison (checked manually: the
            // BnF sometimes indexes "Dragon ball" in lowercase depending on the
            // record) AND ignoring inner spaces/hyphens (checked manually
            // on "Cardcaptor Sakura" - MyAnimeList title in a single word -
            // against "Card captor Sakura", the real $a of the BnF with a
            // space, see history) - the $a field is already exactly the
            // name of the series (never a LONGER TITLE to prefix as
            // on the Google Books side, see matchSeriesPrefix), but can differ
            // slightly in punctuation/spacing from the MyAnimeList title
            // searched.
            // The searched title can carry a SUBTITLE that the BnF files
            // apart: "Boruto: Naruto Next Generations" (MyAnimeList) is
            // cataloged $a "Boruto" + $e "Naruto next generations".
            // Seen on 2026-09-04, Google Books with its quota exhausted: the BnF
            // returned 19 records, all rejected here, and the screen concluded
            // that no provider had answered. So we accept $a alone,
            // or $a followed by one of its $e - and that $e is no longer an
            // edition (see below).
            String cherche = normalizeForComparison(seriesTitle);
            String serieCourte = normalizeForComparison(nomDeSerie(seriesTitle));
            String titreBnf = normalizeForComparison(rawTitle);
            List<String> sousTitres = subfields(titleField, "e");
            int sousTitreConsomme = -1;
            boolean correspond = titreBnf.equals(cherche);
            for (int k = 0; !correspond && k < sousTitres.size(); k++) {
                if ((titreBnf + normalizeForComparison(sousTitres.get(k))).equals(cherche)) {
                    correspond = true;
                    sousTitreConsomme = k;
                }
            }
            // Or the reverse: the SUBTITLE searched in $a, and the parent series
            // in a $e - "Strong world" + $e "one piece film", the way
            // the BnF catalogs an anime comics film.
            String serieCourteCherchee = normalizeForComparison(nomDeSerie(seriesTitle));
            String sousTitreDuCherche = cherche.startsWith(serieCourteCherchee) ? cherche.substring(serieCourteCherchee.length()) : "";
            for (int k = 0; !correspond && k < sousTitres.size(); k++) {
                if (!sousTitreDuCherche.isEmpty() && titreBnf.equals(sousTitreDuCherche)
                        && normalizeForComparison(sousTitres.get(k)).contains(serieCourteCherchee)) {
                    correspond = true;
                    sousTitreConsomme = k;
                }
            }
            // Second way: the volume carries its OWN title in 200$a
            // ("Kawaki"), and the series in 461$t (or 225$a) with its number
            // in $v. This is how the BnF catalogs thirteen of the twenty volumes
            // of Boruto, and the first Dragon Ball of 1993.
            String serie = serieDeRattachement(record);
            boolean parLaSerie = !correspond && serie != null
                    && (normalizeForComparison(serie).equals(cherche)
                        || normalizeForComparison(serie).equals(serieCourte));
            // Attached to the series but with a subtitle that is NOT the one
            // searched: it is another series under the same name - "Boruto"
            // + "two blue vortex" is not "Boruto: Naruto Next
            // Generations". Without this guard, the sequel invited itself into the
            // list as a "Two Blue Vortex edition" of volumes 1 to 3.
            String sousTitreCherche = cherche.startsWith(serieCourte) ? cherche.substring(serieCourte.length()) : "";
            if (parLaSerie && !sousTitres.isEmpty() && !sousTitreCherche.isEmpty()) {
                parLaSerie = false;
                for (int k = 0; k < sousTitres.size(); k++) {
                    if (normalizeForComparison(sousTitres.get(k)).equals(sousTitreCherche)) {
                        parLaSerie = true;
                        sousTitreConsomme = k;
                    }
                }
            }
            // Without any $e, and a series SEARCHED with a subtitle: the volume
            // is put on hold - it only counts if another record of the
            // same set confirms this subtitle (see parse). A volume
            // titled with the name of the parent series alone ("One piece" T5) is
            // rejected at once.
            boolean differe = false;
            if (parLaSerie && sousTitres.isEmpty() && !sousTitreCherche.isEmpty()) {
                if (titreBnf.equals(serieCourte)) {
                    parLaSerie = false;
                } else {
                    differe = true;
                }
            }
            if (!correspond && !parLaSerie) {
                continue;
            }
            // A record that carries the subtitle in clear confirms its 461 series
            // for the volumes on hold.
            if (sousTitreConsomme >= 0 && serie != null && !sousTitreCherche.isEmpty()) {
                seriesConfirmees.add(normalizeForComparison(serie));
            }

            // 200$h: volume number, in a dedicated MARC field - never a
            // whole "series" record (without a precise volume), which has nothing to
            // offer here. Failing that, the number in the series (461$v/225$v).
            OptionalInt volumeNumber = parseVolumeNumber(subfield(titleField, "h"));
            if (volumeNumber.isEmpty()) {
                volumeNumber = parseVolumeNumber(numeroDansLaSerie(record));
            }
            if (volumeNumber.isEmpty()) {
                continue;
            }

            List<String> partsEdition = new ArrayList<>(sousTitres);
            if (sousTitreConsomme >= 0) {
                partsEdition.remove(sousTitreConsomme);
            }
            String edition = editionName(partsEdition);
            // A DERIVED product is not a volume (batch 144): "Naruto, grand
            // livre d'Uzumaki" T1 and T2 - an art book - is cataloged as
            // a volume, with a $e that designates no edition; it took
            // the place of volumes 1 and 2 of Kana, which the separation by ISBN
            // then sent to a separate "Kana (2002)" (measured on
            // 2026-09-06). A $e that names a guide, an art book, a novel,
            // rejects the record; a volume subtitle ("Grande chance")
            // stays a volume.
            if (edition.isBlank() && estUnProduitDerive(partsEdition)) {
                continue;
            }
            // The full title, ALL the $e included: "Dragon Ball" + "super"
            // must stay recognizable as "Dragon Ball Super" even if
            // "super" does not make an edition.
            String displayTitle = rawTitle + (partsEdition.isEmpty() ? "" : " " + String.join(" ", partsEdition))
                    + " T" + volumeNumber.getAsInt();

            // KNOWN spin-off/side-story/sequel (see RelatedSeriesService) -
            // same logic as GoogleBooksVolumeSearchProvider.
            if (matchesKnownRelatedSeries(displayTitle, excludedTitleFragments)) {
                continue;
            }

            String publisher = publisherFrom214(record);
            String finalEdition = !edition.isBlank() ? edition
                    : (publisher == null || publisher.isBlank() ? "Édition inconnue" : publisher);
            finalEdition = normalizeEditionWord(finalEdition);

            // The cover URL is set here but CHECKED by searchVolumes
            // (see the class javadoc): parse() stays without network.
            // The BnF only dates to the year ("DL 2024"): the release
            // calendar does nothing with it, but the merge with Google Books keeps
            // the most precise date of the two (see VolumeCandidate).
            Integer annee = anneeDe(record);
            VolumeCandidate candidate = new VolumeCandidate(finalEdition, volumeNumber.getAsInt(), coverUrl(record),
                    displayTitle, isbnDe(record), annee, annee == null ? null : String.valueOf(annee));
            if (differe) {
                differes.add(Map.entry(normalizeForComparison(serie), candidate));
            } else {
                candidates.add(candidate);
                if (edition.isBlank() && !partsEdition.isEmpty()) {
                    parSousTitre.computeIfAbsent(normalizeForComparison(String.join(" ", partsEdition)), cle -> new ArrayList<>())
                            .add(candidate);
                } else if (partsEdition.isEmpty()) {
                    numerosSansSousTitre.add(volumeNumber.getAsInt());
                }
            }
        }
    }

    /**
     * What, in a 200$e, DESIGNATES an edition ("Perfect edition",
     * "Edition double", "Full color", "Collector"...), as opposed to the
     * subtitle of ONE volume. Measurement of 2026-09-05 on Jujutsu Kaisen: the BnF
     * catalogs "Grande chance", "Recursion", "Mort et vie" in $e of
     * volumes 21, 24, 29 - and each became a separate edition, with one volume, next
     * to the 29 of Ki-oon, where mangacollec knows only one.
     */
    private static final Pattern DESIGNATION_D_EDITION = Pattern.compile(
            "(?iu)\\b(?:[ée]ditions?|[ée]d\\.|deluxe|luxe|perfect|double|collector|int[ée]grale|kanzenban|ultimate"
            + "|full ?colou?r|couleur|nouvelle|coffret|r[ée][ée]dition|grand format|poche|kiosque|black|star|prestige"
            + "|anniversaire|jubil[ée]|originale?|first|premium|compl[eè]te|omnibus|variant|jaquette|hokage|log|kai)\\b");

    /** 200$e (repeatable - e.g. "full color" AND "l'enfance de Goku" in two
     * distinct subfields for the same record): only the parts that
     * DESIGNATE an edition are kept, joined and capitalized. A
     * volume subtitle ("Grande chance") does not make an edition: the
     * record then falls back on its publisher, like the other volumes. */
    private static String editionName(List<String> parts) {
        // All or nothing: as soon as one part DESIGNATES an edition ("full color"),
        // the others qualify it ("l'enfance de Goku": the arc of Dragon
        // Ball Full Color, whose numbering starts again at 1) and stay. Without
        // any designation, they are volume subtitles: none.
        boolean designeUneEdition = parts.stream().anyMatch(part -> DESIGNATION_D_EDITION.matcher(part).find());
        if (!designeUneEdition) {
            return "";
        }
        return parts.stream()
                .map(BnfVolumeSearchProvider::capitalizeWords)
                .collect(Collectors.joining(" - "));
    }

    private static String publisherFrom214(Element record) {
        // 214 since 2019; older records carry the publisher in
        // 210$c - without this fallback, the first volumes of a series came out as
        // "Édition inconnue" and ended up apart from the following ones.
        Element field214 = firstDatafield(record, "214");
        String publisher = field214 == null ? null : subfield(field214, "c");
        if (publisher == null || publisher.isBlank()) {
            Element field210 = firstDatafield(record, "210");
            publisher = field210 == null ? null : subfield(field210, "c");
        }
        return publisher;
    }

    private static OptionalInt parseVolumeNumber(String rawValue) {
        if (rawValue == null || rawValue.isBlank()) {
            return OptionalInt.empty();
        }
        Matcher matcher = VOLUME_NUMBER.matcher(rawValue);
        if (!matcher.find()) {
            return OptionalInt.empty();
        }
        try {
            int number = Integer.parseInt(matcher.group(1));
            return number >= 1 && number <= VOLUME_NUMBER_MAX ? OptionalInt.of(number) : OptionalInt.empty();
        } catch (NumberFormatException e) {
            return OptionalInt.empty();
        }
    }

    /** "Boruto: Naruto Next Generations" -> "Boruto"; "Dragon Ball - Full Color" -> "Dragon Ball"; otherwise the whole title. */
    static String nomDeSerie(String seriesTitle) {
        String[] parts = seriesTitle.split("\\s*[:\\-\u2013]\\s+", 2);
        String serie = parts[0].trim();
        return serie.isEmpty() ? seriesTitle.trim() : serie;
    }

    /** 461$t (the set the volume is part of), failing that 225$a (the collection). */
    private static String serieDeRattachement(Element record) {
        Element ensemble = firstDatafield(record, "461");
        String titre = ensemble == null ? null : subfield(ensemble, "t");
        if (titre == null || titre.isBlank()) {
            Element collection = firstDatafield(record, "225");
            titre = collection == null ? null : subfield(collection, "a");
        }
        return titre == null || titre.isBlank() ? null : titre;
    }

    private static String numeroDansLaSerie(Element record) {
        Element ensemble = firstDatafield(record, "461");
        String numero = ensemble == null ? null : subfield(ensemble, "v");
        if (numero == null || numero.isBlank()) {
            Element collection = firstDatafield(record, "225");
            numero = collection == null ? null : subfield(collection, "v");
        }
        return numero;
    }

    /** The cover URL of the record, or null without an ARK identifier. */
    private static String coverUrl(Element record) {
        NodeList controlfields = record.getElementsByTagName("mxc:controlfield");
        for (int i = 0; i < controlfields.getLength(); i++) {
            Element field = (Element) controlfields.item(i);
            if ("003".equals(field.getAttribute("tag"))) {
                String url = field.getTextContent();
                int ark = url == null ? -1 : url.indexOf("ark:/");
                return ark < 0 ? null : COVER_URL.formatted(url.substring(ark).trim());
            }
        }
        return null;
    }

    private static final Pattern PRODUIT_DERIVE = Pattern.compile(
            "(?iu)\\b(?:grand livre|art ?books?|guides?|data ?books?|fan ?books?|illustrations|romans?|novels?"
            + "|encyclop[ée]die|character books?|official books?)\\b");

    private static boolean estUnProduitDerive(List<String> parts) {
        return parts.stream().anyMatch(part -> PRODUIT_DERIVE.matcher(part).find());
    }

    /** The known children's novel collections, case and accents exact. */
    private static boolean estUnRomanJeunesse(Element record) {
        for (String tag : List.of("225", "410")) {
            for (Element champ : datafields(record, tag)) {
                for (String code : List.of("a", "t")) {
                    for (String valeur : subfields(champ, code)) {
                        String pliee = normalizeForComparison(valeur);
                        if (pliee.contains("biblioth") && (pliee.contains("verte") || pliee.contains("rose"))) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    private static List<Element> datafields(Element record, String tag) {
        List<Element> trouves = new ArrayList<>();
        NodeList datafields = record.getElementsByTagName("mxc:datafield");
        for (int i = 0; i < datafields.getLength(); i++) {
            Element datafield = (Element) datafields.item(i);
            if (tag.equals(datafield.getAttribute("tag"))) {
                trouves.add(datafield);
            }
        }
        return trouves;
    }

    private static Element firstDatafield(Element record, String tag) {
        NodeList datafields = record.getElementsByTagName("mxc:datafield");
        for (int i = 0; i < datafields.getLength(); i++) {
            Element datafield = (Element) datafields.item(i);
            if (tag.equals(datafield.getAttribute("tag"))) {
                return datafield;
            }
        }
        return null;
    }

    private static String subfield(Element datafield, String code) {
        List<String> values = subfields(datafield, code);
        return values.isEmpty() ? null : values.get(0);
    }

    private static List<String> subfields(Element datafield, String code) {
        List<String> values = new ArrayList<>();
        NodeList subfields = datafield.getElementsByTagName("mxc:subfield");
        for (int i = 0; i < subfields.getLength(); i++) {
            Element subfield = (Element) subfields.item(i);
            if (code.equals(subfield.getAttribute("code"))) {
                values.add(subfield.getTextContent());
            }
        }
        return values;
    }

    /** Removes every space/hyphen and lowercases before comparison - see
     * the caller. "Cardcaptor" (a single word) and "Card captor" (two words)
     * both give "cardcaptor", no matter where the cut falls. */
    /** Neither case, nor spaces, nor punctuation: "Boruto: Naruto" and "Boruto : Naruto" are the same title. */
    private static String normalizeForComparison(String text) {
        return text.trim().toLowerCase().replaceAll("[^\\p{L}\\p{N}]+", "");
    }

    /** Whole word comparison (?U to recognize accented letters
     * as word characters, same trap as on the Google Books side) - a
     * simple contains() would make a generic/short fragment match
     * inside another unrelated word. */
    private static boolean matchesKnownRelatedSeries(String title, List<String> excludedTitleFragments) {
        for (String fragment : excludedTitleFragments) {
            if (Pattern.compile("(?iU)\\b" + Pattern.quote(fragment) + "\\b").matcher(title).find()) {
                return true;
            }
        }
        return false;
    }

    /** "full color" -> "Full Color" - the BnF indexes collection
     * subtitles all in lowercase, unlike the publisher name
     * (already correctly cased) used as a fallback. */
    private static String capitalizeWords(String text) {
        StringBuilder result = new StringBuilder();
        for (String word : text.trim().split("\\s+")) {
            if (word.isEmpty()) {
                continue;
            }
            if (result.length() > 0) {
                result.append(' ');
            }
            result.append(Character.toUpperCase(word.charAt(0))).append(word.substring(1));
        }
        return result.toString();
    }

    // "Pika", "Pika Edition", "Pika édition" (checked manually on
    // "Fairy Tail", see history): the BnF indexes the same publisher with or
    // without the word "édition"/"edition" accented or not depending on the record,
    // otherwise forming several distinct edition tabs for a single
    // real publisher - same class of problem as TRAILING_MANGA_SUFFIX on the
    // GoogleBooksVolumeSearchProvider side. Final "s?" (checked manually on
    // "Blue Period", see history): "Pika éditions" (plural) still formed
    // a fourth distinct tab despite this first relaxation,
    // the final \b never validating a word boundary between "n" and "s".
    private static final Pattern EDITION_WORD_VARIANT = Pattern.compile("(?U)\\b[EeÉé]ditions?\\b");

    private static String normalizeEditionWord(String text) {
        return EDITION_WORD_VARIANT.matcher(text).replaceAll("Édition");
    }
}
