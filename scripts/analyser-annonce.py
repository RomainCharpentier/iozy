#!/usr/bin/env python3
"""Analyse une annonce Vinted depuis son lien, en une commande.

    python scripts/analyser-annonce.py <url> --serie "Vinland Saga" --edition "Standard" --tomes 1-12

Ce script n'analyse rien lui-même : il enchaîne deux endpoints d'IozyCore déjà
en place, et se contente d'afficher le résultat lisiblement.

    1. POST /listing-metadata/resolve   lit l'annonce (titre, prix, description, photos)
    2. POST /purchase-analysis/analyze  croise avec TA collection et rend un verdict

Le second est ce qui fait la différence avec un outil autonome : il sait ce que
tu possèdes déjà. Un lot à 60 € dont tu as déjà la moitié des tomes n'est pas la
même affaire qu'un lot à 60 € entièrement neuf pour toi, et c'est exactement ce
que « bonne annonce » veut dire ici.

Aucun compte, aucun cookie, aucune usurpation de navigateur : la page d'annonce
publique est lue telle qu'un visiteur anonyme la reçoit (voir
docs/LISTING_SOURCES.md). Si Vinted décide un jour de fermer cet accès, le
script le dira au lieu de contourner.

Le contenu du lot (série, édition, tomes) se déclare à la main : IozyCore n'a
pas de reconnaissance d'images, et deviner à partir du titre produirait des
verdicts calculés sur des tomes inventés.
"""

from __future__ import annotations

import argparse
import io
import json
import sys
import urllib.error
import urllib.request

# La console Windows est en cp1252 par défaut : sans ça, chaque accent du
# rapport sort en mojibake. On force l'UTF-8 en sortie plutôt que de retirer
# les accents.
if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

API_PAR_DEFAUT = "http://localhost:8080/api"

MESSAGES_ECHEC = {
    "UNSUPPORTED_SOURCE": "Plateforme pas encore lue automatiquement — donne les champs à la main.",
    "LISTING_NOT_FOUND": "Cette annonce n'est plus accessible.",
    "UNAVAILABLE": "Impossible de lire l'annonce pour le moment.",
    "INVALID_URL": "Lien inexploitable.",
}

VERDICTS = {
    "EXCELLENT_DEAL": "EXCELLENTE AFFAIRE",
    "GOOD_DEAL": "BONNE AFFAIRE",
    "FAIR_PRICE": "PRIX CORRECT",
    "EXPENSIVE": "CHER",
    "AVOID": "À ÉVITER",
}

# Ce que vaut le montant de livraison retenu. Un total qui n'inclut aucune
# livraison n'est pas un coût d'acquisition, et un « à partir de » n'est pas un
# tarif : le rapport doit nommer les trois cas différemment.
LIVRAISON = {
    "FREE": "offerte",
    "EXACT": "{montant}",
    "FROM": "à partir de {montant}",
    "ESTIMATED": "{montant} estimés",
    "UNKNOWN": "non communiquée",
}

TOTAUX = {
    "FROM": "Coût min.",
    "UNKNOWN": "Sous-total",
}

CONSEILS = {
    "NEGOTIATE": "négocier",
    "ACCEPTABLE_AS_IS": "acceptable tel quel",
    "SKIP_LISTING": "passer cette annonce",
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
        raise SystemExit(f"Erreur {erreur.code} sur {chemin} : {detail}") from erreur
    except urllib.error.URLError as erreur:
        raise SystemExit(
            f"IozyCore est injoignable sur {api} ({erreur.reason}).\n"
            "Démarre le backend, ou passe --api si tu l'exposes ailleurs."
        ) from erreur


def analyser_tomes(texte: str) -> list[int]:
    """Accepte « 1-12 », « 1,2,5-9 ». Un fragment illisible est ignoré, jamais deviné."""
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
    return "non calculable" if valeur is None else f"{valeur:.2f} EUR"


def main() -> int:
    parseur = argparse.ArgumentParser(
        description="Analyse une annonce Vinted en la croisant avec ta collection IozyCore.",
        epilog="Exemple : %(prog)s https://www.vinted.fr/items/123456 "
        '--serie "Vinland Saga" --edition "Standard" --tomes 1-12',
    )
    parseur.add_argument("url", help="lien de l'annonce")
    parseur.add_argument("--serie", help="série du lot (sinon : lecture seule de l'annonce)")
    parseur.add_argument("--edition", default="Standard", help="édition (défaut : Standard)")
    parseur.add_argument("--tomes", default="", help="tomes inclus, ex. 1-12 ou 1,3,5-9")
    parseur.add_argument("--etat", default="VERY_GOOD",
                         help="MINT_SEALED, LIKE_NEW, VERY_GOOD, GOOD, ACCEPTABLE, VISIBLE_DEFECTS")
    parseur.add_argument("--port", type=float, default=None,
                         help="frais de port en euros (à défaut : ceux lus sur l'annonce)")
    parseur.add_argument("--protection", type=float, default=None,
                         help="frais de protection acheteur (à défaut : ceux lus sur l'annonce)")
    parseur.add_argument("--api", default=API_PAR_DEFAUT, help=f"base de l'API (défaut : {API_PAR_DEFAUT})")
    parseur.add_argument("--json", action="store_true", help="sortie brute, pour enchaîner un autre outil")
    args = parseur.parse_args()

    # --- 1. Lire l'annonce ---------------------------------------------------
    annonce = appeler(args.api, "/listing-metadata/resolve", {"url": args.url})
    statut = annonce["status"]

    if statut not in ("SUCCESS", "PARTIAL"):
        print(f"Lecture de l'annonce : {MESSAGES_ECHEC.get(statut, statut)}", file=sys.stderr)
        if not args.serie:
            return 1
        print("On continue avec ce que tu as déclaré à la main.\n", file=sys.stderr)

    if not args.json:
        print("=" * 62)
        print(f"  {annonce.get('title') or '(titre non lu)'}")
        print("=" * 62)
        print(f"  Source      : {annonce['source']}")
        print(f"  Prix affiché: {euros(annonce.get('price'))}")
        print(f"  Photos      : {len(annonce.get('imageUrls') or [])}")
        print(f"  Lu          : {', '.join(annonce.get('retrievedFields') or []) or 'rien'}")
        if statut == "PARTIAL":
            print("  (lecture partielle — le reste est à compléter à la main)")

    prix = annonce.get("price")
    if prix is None:
        print("\nPrix illisible sur l'annonce : impossible de juger l'offre.", file=sys.stderr)
        print("Rien n'est supposé à sa place — relance en le renseignant dans l'app.", file=sys.stderr)
        return 1

    # --- 2. Croiser avec la collection --------------------------------------
    if not args.serie:
        print("\nAnnonce lue, mais pas analysée : indique --serie et --tomes pour")
        print("obtenir un verdict croisé avec ta collection.")
        return 0

    port = args.port if args.port is not None else annonce.get("shippingFee")
    nature_port = "ESTIMATED" if args.port is not None else (annonce.get("shippingKind") or "UNKNOWN")
    if port is None:
        nature_port = "UNKNOWN"
    protection = args.protection if args.protection is not None else annonce.get("buyerProtectionFee")

    tomes = analyser_tomes(args.tomes)
    if not tomes:
        print("\n--tomes n'a produit aucun numéro exploitable (ex. attendu : 1-12).", file=sys.stderr)
        return 1

    analyse = appeler(args.api, "/purchase-analysis/analyze", {
        "platform": annonce["source"] if annonce["source"] != "OTHER" else "VINTED",
        "url": annonce.get("url") or args.url,
        "rawTitle": annonce.get("title") or f"Lot {args.serie}",
        "askingPrice": prix,
        # Un port saisi à la main est une ESTIMATION : utilisable, mais pas un
        # tarif constaté. Sans saisie, on garde ce que l'annonce disait - nature
        # comprise -, et à défaut on reste explicitement ignorant plutôt que de
        # compter un port à 0 qui rendrait le coût trop favorable.
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
          f"({analyse['verdictScore']}/100, confiance {analyse['overallConfidence']})")
    libelle_total = TOTAUX.get(nature_port, "Coût acq.")
    print(f"  {libelle_total:<12}: {euros(analyse['totalRealCost'])}   "
          f"(valeur neuve {euros(analyse['totalNewValue'])})")
    print(f"  Livraison   : "
          + LIVRAISON.get(nature_port, "non communiquée").format(montant=euros(port)))
    if analyse.get("discountPercent") is not None:
        print(f"  Décote      : {analyse['discountPercent']:.0f} % vs neuf")
    print(f"  Conseil     : {CONSEILS.get(negociation['advice'], negociation['advice'])}")
    if negociation.get("recommendedOffer") is not None:
        print(f"  Offre       : {euros(negociation['recommendedOffer'])}  "
              f"(cible {euros(negociation['targetPriceMin'])}–{euros(negociation['targetPriceMax'])}, "
              f"max {euros(negociation['maxPrice'])})")
    print(f"  Pourquoi    : {negociation['rationale']}")

    for detail in analyse["itemBreakdown"]:
        doublons = detail["duplicates"]["duplicateVolumeNumbers"]
        utiles = detail["duplicates"]["usefulVolumeCount"]
        print(f"\n  {detail['item']['series']['title']} — {len(detail['item']['includedVolumes'])} tome(s)")
        print(f"    utiles pour toi : {utiles}")
        if doublons:
            print(f"    déjà possédés   : {', '.join(map(str, doublons))}")

    avertissements = analyse.get("warnings") or []
    if avertissements:
        print("\n  Points d'attention :")
        for a in avertissements:
            print(f"    [{a['severity']}] {a['message']}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
