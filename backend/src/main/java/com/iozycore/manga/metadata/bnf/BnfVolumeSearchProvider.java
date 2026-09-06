package com.iozycore.manga.metadata.bnf;

import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.manga.metadata.VolumeCandidate;
import com.iozycore.core.metadata.SourceUnavailableException;
import com.iozycore.manga.metadata.VolumeSearchProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
 * Recherche les tomes réels d'une série de manga via le catalogue SRU
 * (ouvert, sans clé ni quota) de la BnF (Bibliothèque nationale de France) -
 * le dépôt légal impose à tout éditeur français d'y déposer chaque
 * parution, ce qui en fait une couverture bien plus exhaustive que Google
 * Books sur les sorties françaises récentes ou d'éditeurs plus confidentiels.
 * <p>
 * Cas réel qui motive ce fournisseur (signalé et vérifié à la demande de
 * l'utilisateur, voir historique de la conversation) : "Dragon Ball Full
 * Color - L'enfance de Goku" (Glénat, à partir de mai 2024) est
 * INTROUVABLE sur Google Books quelle que soit la formulation essayée
 * (titre exact de l'éditeur y compris), mais ressort immédiatement sur la
 * BnF - avec numéro de tome (champ MARC 200$h), éditeur (214$c) et ISBN
 * (010$a) dans des champs STRUCTURÉS, contrairement à Google Books où le
 * numéro de tome doit être deviné par regex dans un titre libre.
 * <p>
 * Les jaquettes viennent du service « couverture » du catalogue (Lot 120) :
 * une image par notice récente (celles du dépôt légal depuis les années
 * 2010, vérifié sur Boruto - 300 Ko chacune), et une erreur 500 pour les
 * autres. Chaque URL est donc VÉRIFIÉE (HEAD) avant d'être rendue, sans quoi
 * une adresse morte serait persistée sur le tome et bloquerait le rattrapage
 * de jaquettes de Ma collection. Toujours cumulé aux résultats Google Books
 * (jamais en repli conditionnel) - TomeSearchService dédoublonne ensuite
 * par (édition, tome) : la notice BnF, rencontrée en premier, fait foi, et
 * une jaquette manquante est reprise de Google Books (Lot 119).
 * <p>
 * Deux façons de cataloguer un tome, toutes deux lues (Lot 120) : le titre
 * de série en 200$a avec le numéro en 200$h (« Boruto » T9), ou le titre
 * PROPRE du tome en 200$a (« Kawaki ») avec la série et son numéro en
 * 461$t/$v ou 225$a/$v. Boruto : 7 tomes par la première voie, les 20 par
 * les deux. La requête interroge le NOM DE SÉRIE (avant « : » ou « - »),
 * sans quoi les tomes catalogués par leur titre propre ne remontent pas.
 * <p>
 * Pas de notion de recherche "rapide"/"approfondie" ici (voir
 * GoogleBooksVolumeSearchProvider et son partage de quota) : une seule
 * requête libre (CQL) par recherche suffit à tout ramener d'un coup, sans
 * biais de popularité à contourner par mot-clé - searchAdditionalEditions
 * garde son comportement par défaut (vide), la relancer n'apporterait rien
 * de plus.
 */
@Component
// En premier (Lot 119) : sans cle ni quota, et des champs STRUCTURES. Sur un
// meme tome, c'est sa notice qui fait foi ; Google Books n'apporte que la
// jaquette (voir TomeSearchService.fusionnerTome).
@Order(1)
public class BnfVolumeSearchProvider implements VolumeSearchProvider {

    private static final Logger log = LoggerFactory.getLogger(BnfVolumeSearchProvider.class);
    private static final String SEARCH_URL =
            "https://catalogue.bnf.fr/api/SRU?version=1.2&operation=searchRetrieve&maximumRecords=100&startRecord=%d&query=%s";
    /** Cinq pages au plus : One Piece (112 tomes, plusieurs editions) tient
     *  en quatre ; au-dela, c'est une requete trop large, pas une serie. */
    private static final int PAGE = 100;
    private static final int NOTICES_MAX = 500;
    private static final Pattern NOMBRE_DE_NOTICES = Pattern.compile("<srw:numberOfRecords>(\\d+)</srw:numberOfRecords>");
    /** L'image de la notice, par son identifiant ARK (controlfield 003). 500 quand il n'y en a pas. */
    static final String COVER_URL = "https://catalogue.bnf.fr/couverture?&appName=NE&idArk=%s&couverture=1";
    /** Un numéro de tome au-delà n'en est pas un (identifiants FRBNF à quinze chiffres en 461$v, entre autres). */
    private static final int VOLUME_NUMBER_MAX = 999;

    // "T. 7", "7" - le champ MARC 200$h contient en général juste le
    // numéro, mais on reste tolérant sur un éventuel préfixe.
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
            String encodedQuery = URLEncoder.encode(cql, StandardCharsets.UTF_8);
            // Page par page (mesure du 2026-09-05 : One Piece rendait 44 tomes
            // sur 112, les 100 premieres notices seulement). Une requete par
            // page, et on s'arrete des que la BnF dit qu'il n'y a plus rien.
            List<String> pages = new ArrayList<>();
            int total = Integer.MAX_VALUE;
            for (int debut = 1; debut <= Math.min(total, NOTICES_MAX); debut += PAGE) {
                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(SEARCH_URL.formatted(debut, encodedQuery)))
                        .timeout(Duration.ofSeconds(10))
                        .GET()
                        .build();

                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() != 200) {
                    // Une source qui refuse (429 : la BnF limite le debit par
                    // adresse) ou qui tombe n'a rien DIT - ce n'est pas « aucun
                    // tome » : signale comme telle, TomeSearchService ne
                    // mettra pas ce vide en cache (voir searchVolumes).
                    log.warn("La BnF a répondu {} pour la recherche de tomes '{}'", response.statusCode(), cql);
                    throw new SourceUnavailableException("La BnF a répondu " + response.statusCode());
                }
                Matcher nombre = NOMBRE_DE_NOTICES.matcher(response.body());
                total = nombre.find() ? Integer.parseInt(nombre.group(1)) : 0;
                // Les jaquettes ne sont plus verifiees ici (Lot 127) : voir
                // BnfCouverture - une par tome GARDE, jamais une par tome liste.
                pages.add(response.body());
            }
            return parse(pages, seriesTitle, excludedTitleFragments);
        } catch (SourceUnavailableException e) {
            throw e;
        } catch (Exception e) {
            // Best-effort par nature : une panne ne doit jamais bloquer la
            // recherche de tomes, Google Books reste dans tous les cas
            // interrogé séparément par TomeSearchService.
            log.warn("Échec de la recherche de tomes BnF pour '{}' : {}", cql, e.getMessage());
            throw new SourceUnavailableException("La BnF n'a pas répondu : " + e.getMessage());
        }
    }

    /** 010$a - l'ISBN du tome, dans un champ MARC dédié. */
    private static String isbnDe(Element record) {
        Element field010 = firstDatafield(record, "010");
        return field010 == null ? null : subfield(field010, "a");
    }

    /** L'année de publication : 214$d (« DL 2009 ») ou, sur les notices d'avant 2019, 210$d. */
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

    /** Miroir de {@link #searchVolumes} pour les tests - parse une seule
     * réponse XML déjà en mémoire. */
    List<VolumeCandidate> parse(String xml, String seriesTitle) throws Exception {
        return parse(xml, seriesTitle, List.of());
    }

    List<VolumeCandidate> parse(String xml, String seriesTitle, List<String> excludedTitleFragments) throws Exception {
        return parse(List.of(xml), seriesTitle, excludedTitleFragments);
    }

    /**
     * Toutes les pages d'une reponse, en DEUX passes.
     *
     * <p>Un tome catalogue sous son propre titre (« Kawaki », 461$t
     * « Boruto ») n'a rien qui dise s'il appartient a « Boruto: Naruto Next
     * Generations » ou a une autre serie « Boruto ». Mesure du 2026-09-05 :
     * cherchant « One Piece: Strong World », les 111 tomes de One Piece
     * (« A l'aube d'une grande aventure », 461$t « One piece ») s'invitaient
     * par ce chemin. La regle : quand la serie cherchee porte un sous-titre,
     * un tel tome n'est retenu que si d'AUTRES notices du meme ensemble 461
     * portent ce sous-titre en clair (« Boruto » + $e « Naruto next
     * generations » : oui ; « One piece » + « Strong world » : jamais, ses
     * deux tomes sont catalogues $a « Strong world » + $e « one piece film »).
     */
    List<VolumeCandidate> parse(List<String> pages, String seriesTitle, List<String> excludedTitleFragments) throws Exception {
        List<VolumeCandidate> candidates = new ArrayList<>();
        // Les tomes en attente d'une confirmation, avec la serie 461 qui les porte.
        List<Map.Entry<String, VolumeCandidate>> differes = new ArrayList<>();
        // Les series 461 dont une notice a confirme le sous-titre cherche.
        Set<String> seriesConfirmees = new HashSet<>();
        // Les tomes qui portent un $e qui ne designe aucune edition, groupes
        // par ce $e ; et les numeros des tomes sans aucun $e (voir plus bas).
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
        // Un $e partage par PLUSIEURS tomes dont la serie a deja les numeros
        // sans $e est une AUTRE oeuvre cataloguee sous le nom de la serie
        // (lot 144) : « Naruto » + « Konoha shinden / the steam ninja
        // scrolls » T1 et T2 - un roman -, « les liens, repliques celebres »
        // T1 et T2, chez Kana comme les 72 tomes. Ils prenaient la place des
        // tomes 1 et 2, et la separation par ISBN renvoyait les vrais dans une
        // « Kana (2002) » a part. Un sous-titre porte par UN tome (« Grande
        // chance », T21) reste un tome : il n'a pas de jumeau sans $e.
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
            // 200$b dit la nature du document. Le dépôt légal reçoit aussi
            // les DVD (« Images animées » - les coffrets Kana Home Video de
            // Boruto, numérotés 3, 4, 7, 8 comme des tomes) et les jeux
            // (« Ressource électronique ») : on ne garde que le papier, et
            // les notices qui ne disent rien (certains tomes n'ont pas de $b).
            String nature = subfield(titleField, "b");
            if (nature != null && !nature.toLowerCase().contains("texte imprim")) {
                continue;
            }
            // Une collection de ROMANS jeunesse n'est jamais une edition du
            // manga (lot 144) : Hachette range « Naruto » et « One piece » en
            // Bibliothèque verte - des romans tires de l'anime, que la BnF
            // rattache a la serie (225$a « One piece », 410$t « Bibliothèque
            // verte ») et qui sortaient en « Hachette jeunesse » 15 et 11
            // tomes a cote de Kana et Glénat. Mangacollec ne les compte pas.
            if (estUnRomanJeunesse(record)) {
                continue;
            }
            // Comparaison insensible à la casse (vérifié manuellement : la
            // BnF indexe parfois "Dragon ball" en minuscules selon la
            // notice) ET aux espaces/tirets internes (vérifié manuellement
            // sur "Cardcaptor Sakura" - titre MyAnimeList en un seul mot -
            // face à "Card captor Sakura", le $a réel de la BnF avec un
            // espace, voir historique) - le champ $a est déjà exactement le
            // nom de la série (jamais un TITRE PLUS LONG à préfixer comme
            // côté Google Books, voir matchSeriesPrefix), mais peut différer
            // légèrement en ponctuation/espacement du titre MyAnimeList
            // cherché.
            // Le titre cherché peut porter un SOUS-TITRE que la BnF range à
            // part : « Boruto: Naruto Next Generations » (MyAnimeList) est
            // catalogué $a « Boruto » + $e « Naruto next generations ».
            // Constaté le 2026-09-04, Google Books à quota épuisé : la BnF
            // rendait 19 notices, toutes écartées ici, et l'écran concluait
            // qu'aucun fournisseur n'avait répondu. On accepte donc $a seul,
            // ou $a suivi de l'un de ses $e - et ce $e-là n'est plus une
            // édition (voir plus bas).
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
            // Ou l'inverse : le SOUS-TITRE cherche en $a, et la serie mere
            // dans un $e - « Strong world » + $e « one piece film », la facon
            // dont la BnF catalogue un film en anime comics.
            String serieCourteCherchee = normalizeForComparison(nomDeSerie(seriesTitle));
            String sousTitreDuCherche = cherche.startsWith(serieCourteCherchee) ? cherche.substring(serieCourteCherchee.length()) : "";
            for (int k = 0; !correspond && k < sousTitres.size(); k++) {
                if (!sousTitreDuCherche.isEmpty() && titreBnf.equals(sousTitreDuCherche)
                        && normalizeForComparison(sousTitres.get(k)).contains(serieCourteCherchee)) {
                    correspond = true;
                    sousTitreConsomme = k;
                }
            }
            // Seconde voie : le tome porte son titre PROPRE en 200$a
            // (« Kawaki »), et la série en 461$t (ou 225$a) avec son numéro
            // en $v. C'est ainsi que la BnF catalogue treize des vingt tomes
            // de Boruto, et les premiers Dragon Ball de 1993.
            String serie = serieDeRattachement(record);
            boolean parLaSerie = !correspond && serie != null
                    && (normalizeForComparison(serie).equals(cherche)
                        || normalizeForComparison(serie).equals(serieCourte));
            // Rattaché à la série mais avec un sous-titre qui n'est PAS celui
            // cherché : c'est une autre série sous le même nom - « Boruto »
            // + « two blue vortex » n'est pas « Boruto: Naruto Next
            // Generations ». Sans cette garde, la suite s'invitait dans la
            // liste comme une « édition Two Blue Vortex » des tomes 1 à 3.
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
            // Sans aucun $e, et une serie CHERCHEE avec sous-titre : le tome
            // est mis en attente - il ne compte que si une autre notice du
            // meme ensemble confirme ce sous-titre (voir parse). Un tome
            // intitule du seul nom de la serie mere (« One piece » T5) est
            // ecarte tout de suite.
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
            // Une notice qui porte le sous-titre en clair confirme sa serie 461
            // pour les tomes en attente.
            if (sousTitreConsomme >= 0 && serie != null && !sousTitreCherche.isEmpty()) {
                seriesConfirmees.add(normalizeForComparison(serie));
            }

            // 200$h : numéro de tome, dans un champ MARC dédié - jamais une
            // fiche de "série" entière (sans tome précis), qui n'a rien à
            // proposer ici. À défaut, le numéro dans la série (461$v/225$v).
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
            // Un produit DERIVE n'est pas un tome (lot 144) : « Naruto, grand
            // livre d'Uzumaki » T1 et T2 - un art book - est catalogue comme
            // un tome, avec un $e qui ne designe aucune edition ; il prenait
            // la place des tomes 1 et 2 de Kana, que la separation par ISBN
            // renvoyait alors dans une « Kana (2002) » a part (mesure du
            // 2026-09-06). Un $e qui nomme un guide, un art book, un roman,
            // ecarte la notice ; un sous-titre de tome (« Grande chance »)
            // reste un tome.
            if (edition.isBlank() && estUnProduitDerive(partsEdition)) {
                continue;
            }
            // Le titre complet, TOUS les $e compris : « Dragon Ball » + « super »
            // doit rester reconnaissable comme « Dragon Ball Super » meme si
            // « super » ne fait pas une edition.
            String displayTitle = rawTitle + (partsEdition.isEmpty() ? "" : " " + String.join(" ", partsEdition))
                    + " T" + volumeNumber.getAsInt();

            // Spin-off/side-story/suite CONNU(e) (voir RelatedSeriesService) -
            // même logique que GoogleBooksVolumeSearchProvider.
            if (matchesKnownRelatedSeries(displayTitle, excludedTitleFragments)) {
                continue;
            }

            String publisher = publisherFrom214(record);
            String finalEdition = !edition.isBlank() ? edition
                    : (publisher == null || publisher.isBlank() ? "Édition inconnue" : publisher);
            finalEdition = normalizeEditionWord(finalEdition);

            // L'URL de jaquette est posée ici mais VÉRIFIÉE par searchVolumes
            // (voir la javadoc de la classe) : parse() reste sans réseau.
            VolumeCandidate candidate = new VolumeCandidate(finalEdition, volumeNumber.getAsInt(), coverUrl(record),
                    displayTitle, isbnDe(record), anneeDe(record));
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
     * Ce qui, dans un 200$e, DESIGNE une edition (« Perfect edition »,
     * « Edition double », « Full color », « Collector »...), par opposition au
     * sous-titre d'UN tome. Mesure du 2026-09-05 sur Jujutsu Kaisen : la BnF
     * catalogue « Grande chance », « Recursion », « Mort et vie » en $e des
     * tomes 21, 24, 29 - et chacun devenait une edition a part, a un tome, a
     * cote des 29 de Ki-oon, la ou mangacollec n'en connait qu'une.
     */
    private static final Pattern DESIGNATION_D_EDITION = Pattern.compile(
            "(?iu)\\b(?:[ée]ditions?|[ée]d\\.|deluxe|luxe|perfect|double|collector|int[ée]grale|kanzenban|ultimate"
            + "|full ?colou?r|couleur|nouvelle|coffret|r[ée][ée]dition|grand format|poche|kiosque|black|star|prestige"
            + "|anniversaire|jubil[ée]|originale?|first|premium|compl[eè]te|omnibus|variant|jaquette|hokage|log|kai)\\b");

    /** 200$e (répétable - ex: "full color" ET "l'enfance de Goku" sur deux
     * subfields distincts pour la même notice) : seules les parts qui
     * DESIGNENT une edition sont gardees, jointes et capitalisees. Un
     * sous-titre de tome (« Grande chance ») ne fait pas une edition : la
     * notice retombe alors sur son editeur, comme les autres tomes. */
    private static String editionName(List<String> parts) {
        // Tout ou rien : des qu'une part DESIGNE une edition (« full color »),
        // les autres la qualifient (« l'enfance de Goku » : l'arc de Dragon
        // Ball Full Color, dont la numerotation repart a 1) et restent. Sans
        // aucune designation, ce sont des sous-titres de tomes : aucune.
        boolean designeUneEdition = parts.stream().anyMatch(part -> DESIGNATION_D_EDITION.matcher(part).find());
        if (!designeUneEdition) {
            return "";
        }
        return parts.stream()
                .map(BnfVolumeSearchProvider::capitalizeWords)
                .collect(Collectors.joining(" - "));
    }

    private static String publisherFrom214(Element record) {
        // 214 depuis 2019 ; les notices plus anciennes portent l'éditeur en
        // 210$c - sans ce repli, les premiers tomes d'une série sortaient en
        // « Édition inconnue » et se retrouvaient à part des suivants.
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

    /** « Boruto: Naruto Next Generations » -> « Boruto » ; « Dragon Ball - Full Color » -> « Dragon Ball » ; sinon le titre entier. */
    static String nomDeSerie(String seriesTitle) {
        String[] parts = seriesTitle.split("\\s*[:\\-\u2013]\\s+", 2);
        String serie = parts[0].trim();
        return serie.isEmpty() ? seriesTitle.trim() : serie;
    }

    /** 461$t (l'ensemble dont le tome fait partie), à défaut 225$a (la collection). */
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

    /** L'URL de couverture de la notice, ou null sans identifiant ARK. */
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

    /** Les collections de romans jeunesse connues, a la casse et aux accents pres. */
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

    /** Retire tout espace/tiret et met en minuscules avant comparaison - voir
     * l'appelant. "Cardcaptor" (un seul mot) et "Card captor" (deux mots)
     * donnent tous deux "cardcaptor", peu importe où la coupure tombe. */
    /** Ni casse, ni espaces, ni ponctuation : « Boruto: Naruto » et « Boruto : Naruto » sont le même titre. */
    private static String normalizeForComparison(String text) {
        return text.trim().toLowerCase().replaceAll("[^\\p{L}\\p{N}]+", "");
    }

    /** Comparaison par mot entier (?U pour reconnaître les lettres accentuées
     * comme des caractères de mot, même piège que côté Google Books) - un
     * simple contains() ferait matcher un fragment générique/court à
     * l'intérieur d'un autre mot sans rapport. */
    private static boolean matchesKnownRelatedSeries(String title, List<String> excludedTitleFragments) {
        for (String fragment : excludedTitleFragments) {
            if (Pattern.compile("(?iU)\\b" + Pattern.quote(fragment) + "\\b").matcher(title).find()) {
                return true;
            }
        }
        return false;
    }

    /** "full color" -> "Full Color" - la BnF indexe les sous-titres de
     * collection tout en minuscules, contrairement au nom de l'éditeur
     * (déjà correctement casé) utilisé en repli. */
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

    // "Pika", "Pika Edition", "Pika édition" (vérifié manuellement sur
    // "Fairy Tail", voir historique) : la BnF indexe le même éditeur avec ou
    // sans le mot "édition"/"edition" accentué ou non selon la notice,
    // formant sinon plusieurs onglets d'édition distincts pour un seul
    // éditeur réel - même classe de problème que TRAILING_MANGA_SUFFIX côté
    // GoogleBooksVolumeSearchProvider. "s?" final (vérifié manuellement sur
    // "Blue Period", voir historique) : "Pika éditions" (pluriel) formait
    // encore un quatrième onglet distinct malgré ce premier assouplissement,
    // le \b final ne validant jamais une frontière de mot entre "n" et "s".
    private static final Pattern EDITION_WORD_VARIANT = Pattern.compile("(?U)\\b[EeÉé]ditions?\\b");

    private static String normalizeEditionWord(String text) {
        return EDITION_WORD_VARIANT.matcher(text).replaceAll("Édition");
    }
}
