#!/usr/bin/env python3
"""Analyse a Vinted listing from its link, in one command.

    python scripts/analyser-annonce.py <url> --serie "Vinland Saga" --edition "Standard" --tomes 1-12

This script analyses nothing itself: it chains two IozyCore endpoints that are
already in place, and only prints the result in a readable way.

    1. POST /listing-metadata/resolve   reads the listing (title, price, description, photos)
    2. POST /purchase-analysis/analyze  compares with YOUR collection and gives a verdict

The second one is what makes the difference with a standalone tool: it knows what
you already own. A lot at 60 EUR of which you already own half of the volumes is not the
same deal as a lot at 60 EUR that is entirely new for you, and that is exactly
what "good listing" means here.

No account, no cookie, no browser impersonation: the public listing page
is read as an anonymous visitor receives it (see
docs/LISTING_SOURCES.md). If Vinted one day decides to close this access, the
script will say so instead of working around it.

The content of the lot (series, edition, volumes) is declared by hand: IozyCore has
no image recognition, and guessing from the title would give
verdicts computed on invented volumes.
"""

from __future__ import annotations

import argparse
import io
import json
import sys
import urllib.error
import urllib.request

# The Windows console is cp1252 by default: without this, every accent of the
# report comes out as mojibake. We force UTF-8 on output rather than remove
# the accents.
if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

API_PAR_DEFAUT = "http://localhost:8080/api"

MESSAGES_ECHEC = {
    "UNSUPPORTED_SOURCE": "Platform not read automatically yet - give the fields by hand.",
    "LISTING_NOT_FOUND": "This listing is no longer available.",
    "UNAVAILABLE": "Unable to read the listing right now.",
    "INVALID_URL": "Unusable link.",
}

VERDICTS = {
    "EXCELLENT_DEAL": "EXCELLENT DEAL",
    "GOOD_DEAL": "GOOD DEAL",
    "FAIR_PRICE": "FAIR PRICE",
    "EXPENSIVE": "EXPENSIVE",
    "AVOID": "AVOID",
}

# What the chosen shipping amount is worth. A total that includes no
# shipping is not an acquisition cost, and a "from" is not a
# price: the report must name the three cases differently.
LIVRAISON = {
    "FREE": "free",
    "EXACT": "{montant}",
    "FROM": "from {montant}",
    "ESTIMATED": "{montant} estimated",
    "UNKNOWN": "not given",
}

TOTAUX = {
    "FROM": "Min. cost",
    "UNKNOWN": "Subtotal",
}

CONSEILS = {
    "NEGOTIATE": "negotiate",
    "ACCEPTABLE_AS_IS": "acceptable as it is",
    "SKIP_LISTING": "skip this listing",
}


def appeler(api: str, chemin: str, corps: dict) -> dict:
    requete = urllib.request.Request(
        api + chemin,
        data=json.dumps(corps).encode("utf-8"),
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(requete, timeout=60) as reponse:
            return json.loads(reponse.read().decode("utf-8"))
    except urllib.error.HTTPError as erreur:
        detail = erreur.read().decode("utf-8", "replace")
        try:
            detail = json.loads(detail).get("message", detail)
        except json.JSONDecodeError:
            pass
        raise SystemExit(f"Error {erreur.code} on {chemin}: {detail}") from erreur
    except urllib.error.URLError as erreur:
        raise SystemExit(
            f"IozyCore cannot be reached on {api} ({erreur.reason}).\n"
            "Start the backend, or pass --api if you expose it elsewhere."
        ) from erreur


def analyser_tomes(texte: str) -> list[int]:
    """Accepts "1-12", "1,2,5-9". An unreadable fragment is ignored, never guessed."""
    tomes: set[int] = set()
    for morceau in texte.split(","):
        morceau = morceau.strip()
        if not morceau:
            continue
        if "-" in morceau:
            debut, _, fin = morceau.partition("-")
            if debut.strip().isdigit() and fin.strip().isdigit():
                a, b = int(debut), int(fin)
                if 0 < a <= b:
                    tomes.update(range(a, b + 1))
        elif morceau.isdigit() and int(morceau) > 0:
            tomes.add(int(morceau))
    return sorted(tomes)


def euros(valeur: float | None) -> str:
    return "not computable" if valeur is None else f"{valeur:.2f} EUR"


def main() -> int:
    parseur = argparse.ArgumentParser(
        description="Analyse a Vinted listing by comparing it with your IozyCore collection.",
        epilog="Example: %(prog)s https://www.vinted.fr/items/123456 "
        '--serie "Vinland Saga" --edition "Standard" --tomes 1-12',
    )
    parseur.add_argument("url", help="link of the listing")
    parseur.add_argument("--serie", help="series of the lot (otherwise: read-only of the listing)")
    parseur.add_argument("--edition", default="Standard", help="edition (default: Standard)")
    parseur.add_argument("--tomes", default="", help="volumes included, e.g. 1-12 or 1,3,5-9")
    parseur.add_argument("--etat", default="VERY_GOOD",
                         help="MINT_SEALED, LIKE_NEW, VERY_GOOD, GOOD, ACCEPTABLE, VISIBLE_DEFECTS")
    parseur.add_argument("--port", type=float, default=None,
                         help="shipping cost in euros (by default: the one read on the listing)")
    parseur.add_argument("--protection", type=float, default=None,
                         help="buyer protection fee (by default: the one read on the listing)")
    parseur.add_argument("--api", default=API_PAR_DEFAUT, help=f"API base (default: {API_PAR_DEFAUT})")
    parseur.add_argument("--json", action="store_true", help="raw output, to chain another tool")
    args = parseur.parse_args()

    # --- 1. Read the listing -------------------------------------------------
    annonce = appeler(args.api, "/listing-metadata/resolve", {"url": args.url})
    statut = annonce["status"]

    if statut not in ("SUCCESS", "PARTIAL"):
        print(f"Reading the listing: {MESSAGES_ECHEC.get(statut, statut)}", file=sys.stderr)
        if not args.serie:
            return 1
        print("Continuing with what you declared by hand.\n", file=sys.stderr)

    if not args.json:
        print("=" * 62)
        print(f"  {annonce.get('title') or '(title not read)'}")
        print("=" * 62)
        print(f"  Source      : {annonce['source']}")
        print(f"  Shown price : {euros(annonce.get('price'))}")
        print(f"  Photos      : {len(annonce.get('imageUrls') or [])}")
        print(f"  Read        : {', '.join(annonce.get('retrievedFields') or []) or 'nothing'}")
        if statut == "PARTIAL":
            print("  (partial reading - the rest has to be filled in by hand)")

    prix = annonce.get("price")
    if prix is None:
        print("\nPrice unreadable on the listing: cannot judge the offer.", file=sys.stderr)
        print("Nothing is assumed in its place - run again after entering it in the app.", file=sys.stderr)
        return 1

    # --- 2. Compare with the collection --------------------------------------
    if not args.serie:
        print("\nListing read, but not analysed: give --serie and --tomes to")
        print("get a verdict compared with your collection.")
        return 0

    port = args.port if args.port is not None else annonce.get("shippingFee")
    nature_port = "ESTIMATED" if args.port is not None else (annonce.get("shippingKind") or "UNKNOWN")
    if port is None:
        nature_port = "UNKNOWN"
    protection = args.protection if args.protection is not None else annonce.get("buyerProtectionFee")

    tomes = analyser_tomes(args.tomes)
    if not tomes:
        print("\n--tomes produced no usable number (e.g. expected: 1-12).", file=sys.stderr)
        return 1

    analyse = appeler(args.api, "/purchase-analysis/analyze", {
        "platform": annonce["source"] if annonce["source"] != "OTHER" else "VINTED",
        "url": annonce.get("url") or args.url,
        "rawTitle": annonce.get("title") or f"Lot {args.serie}",
        "askingPrice": prix,
        # A shipping cost typed by hand is an ESTIMATE: usable, but not an
        # observed price. Without input, we keep what the listing said - kind
        # included -, and failing that we stay explicitly ignorant rather than
        # count a shipping of 0 that would make the cost too favourable.
        "shippingFee": port,
        "shippingKind": nature_port,
        "buyerProtectionFee": protection,
        "condition": args.etat,
        "conditionAppliesToContainer": False,
        "items": [{"seriesTitle": args.serie, "editionName": args.edition, "includedVolumes": tomes}],
        "photoUrls": annonce.get("imageUrls") or [],
    })

    if args.json:
        print(json.dumps(analyse, ensure_ascii=False, indent=2))
        return 0

    negociation = analyse["negotiation"]
    print()
    print(f"  VERDICT     : {VERDICTS.get(analyse['verdict'], analyse['verdict'])} "
          f"({analyse['verdictScore']}/100, confidence {analyse['overallConfidence']})")
    libelle_total = TOTAUX.get(nature_port, "Acq. cost")
    print(f"  {libelle_total:<12}: {euros(analyse['totalRealCost'])}   "
          f"(new value {euros(analyse['totalNewValue'])})")
    print(f"  Shipping    : "
          + LIVRAISON.get(nature_port, "not given").format(montant=euros(port)))
    if analyse.get("discountPercent") is not None:
        print(f"  Discount    : {analyse['discountPercent']:.0f} % vs new")
    print(f"  Advice      : {CONSEILS.get(negociation['advice'], negociation['advice'])}")
    if negociation.get("recommendedOffer") is not None:
        print(f"  Offer       : {euros(negociation['recommendedOffer'])}  "
              f"(target {euros(negociation['targetPriceMin'])}–{euros(negociation['targetPriceMax'])}, "
              f"max {euros(negociation['maxPrice'])})")
    print(f"  Why         : {negociation['rationale']}")

    for detail in analyse["itemBreakdown"]:
        doublons = detail["duplicates"]["duplicateVolumeNumbers"]
        utiles = detail["duplicates"]["usefulVolumeCount"]
        print(f"\n  {detail['item']['series']['title']} — {len(detail['item']['includedVolumes'])} volume(s)")
        print(f"    useful for you  : {utiles}")
        if doublons:
            print(f"    already owned   : {', '.join(map(str, doublons))}")

    avertissements = analyse.get("warnings") or []
    if avertissements:
        print("\n  Warnings:")
        for a in avertissements:
            print(f"    [{a['severity']}] {a['message']}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
