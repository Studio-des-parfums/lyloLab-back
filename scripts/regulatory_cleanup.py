#!/usr/bin/env python3
"""
Nettoyage des données réglementaires des matières premières.

Harmonise et traduit en français les données réglementaires (colonne JSON
`regulatory`) et les champs réglementaires de la fiche labo, d'après les
tables de regulatory_mappings.py. Passe par l'API du backend (qui doit
tourner) : rien n'est écrit directement en base.

Ne touche pas aux limites IFRA chiffrées de la fiche labo (`ifraCat4`), ni au
choix entre la limite du RADAR et celle de la fiche labo quand elles
divergent. Les matières issues d'une formule (synthétiques) sont ignorées :
leurs données sont recalculées à partir des ingrédients.

L'API exige une session : copiez le jeton d'un compte de l'équipe à nettoyer
(clé « lylo.session » du localStorage du navigateur) dans LYLO_TOKEN.

Usage :
  LYLO_TOKEN=<jeton> python3 scripts/regulatory_cleanup.py          # rapport seul
  LYLO_TOKEN=<jeton> python3 scripts/regulatory_cleanup.py --apply --backup <fichier.json>
"""

import argparse
import json
import os
import re
import sys
import urllib.request
from collections import defaultdict

import regulatory_mappings as M

API = os.environ.get("API_URL", "http://localhost:3000").rstrip("/") + "/api"

BANNED_PATTERN = re.compile(r"banned|prohibit|interdit", re.I)
PERCENT_PATTERN = re.compile(r"(\d+(?:[.,]\d+)?)\s*%")
SIMPLE_LIMIT = re.compile(r"^(\d+(?:[.,]\d+)?)\s*%\s*(?:Cat\.?\s*4)?$", re.I)
AMENDMENT = re.compile(r"Amend\.?\s*(\d+(?:/\d+)*)")
NUMERIC_ONLY = re.compile(r"^[\d\s.,;%]+$")

# Les noms déjà corrigés se reconnaissent eux-mêmes (relance sans effet).
SUBSTANCES = {v.lower(): v for v in M.SUBSTANCES.values()}
SUBSTANCES.update({k.lower(): v for k, v in M.SUBSTANCES.items()})
FLAVOR_RESTRICTION = {M.key(v): v for v in M.FLAVOR_RESTRICTION.values()}
FLAVOR_RESTRICTION.update(M.FLAVOR_RESTRICTION)

# Posée sur chaque profil nettoyé : le script ne retraite pas un profil déjà
# à cette version (les tables partent des valeurs d'origine).
CLEANUP_VERSION = 1


def parse_limit(value):
    """Même règle que parseIfraLimitPercent (backend et frontend)."""
    if isinstance(value, (int, float)):
        return value * 100
    if not value:
        return None
    if BANNED_PATTERN.search(value):
        return 0
    match = PERCENT_PATTERN.search(value)
    return float(match.group(1).replace(",", ".")) if match else None


def fmt_percent(number: float) -> str:
    text = f"{number:.4f}".rstrip("0").rstrip(".")
    return f"{text.replace('.', ',')} %"


def http(method, path, body=None):
    token = os.environ.get("LYLO_TOKEN")
    if not token:
        sys.exit("Définissez LYLO_TOKEN (jeton de session d'un membre de l'équipe).")
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(
        API + path, data=data, method=method,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
    )
    with urllib.request.urlopen(request) as response:
        return json.load(response)


class Cleaner:
    def __init__(self):
        self.unmapped = defaultdict(set)
        self.changed_fields = defaultdict(int)
        self.unsafe_limits = []
        self.unclear_lab_values = []

    def lookup(self, table, field, value):
        k = M.key(str(value))
        if k not in table:
            self.unmapped[field].add(str(value))
            return None, False
        return table[k], True

    # -- listes de substances ------------------------------------------------
    def clean_substances(self, field, text):
        fixed = text
        for wrong, right in M.SUBSTANCE_PRE_FIXES:
            fixed = re.sub(re.escape(wrong), right, fixed, flags=re.I)
        names = []
        for token in fixed.split(","):
            token = M.key(token)
            if not token:
                continue
            name = SUBSTANCES.get(token.lower())
            if name is None:
                self.unmapped[field].add(token)
                name = token
            if name not in names:
                names.append(name)
        return ", ".join(names)

    # -- colonne JSON regulatory ---------------------------------------------
    def clean_regulatory(self, name, reg):
        if reg.get("cleanupVersion") == CLEANUP_VERSION:
            return reg
        out = dict(reg)
        out["cleanupVersion"] = CLEANUP_VERSION
        review = list(reg.get("reviewNotes") or [])

        def set_or_drop(field, value):
            if value in (None, "", []):
                out.pop(field, None)
            else:
                out[field] = value

        # Limite IFRA Cat.4
        raw = reg.get("ifraLimit")
        if raw not in (None, ""):
            limit, note, todo = raw, None, None
            if isinstance(raw, (int, float)):
                limit = fmt_percent(raw * 100)
            elif M.key(raw) in M.IFRA_LIMIT_SPECIAL:
                limit, note, todo = M.IFRA_LIMIT_SPECIAL[M.key(raw)]
            elif SIMPLE_LIMIT.match(M.key(raw)):
                number = float(SIMPLE_LIMIT.match(M.key(raw)).group(1).replace(",", "."))
                limit = fmt_percent(number)
            else:
                self.unmapped["ifraLimit"].add(str(raw))
            before, after = parse_limit(raw), parse_limit(limit)
            # Jamais plus permissif qu'avant : même limite, ou plus stricte.
            if before is not None and (after is None or after > before + 1e-9):
                self.unsafe_limits.append((name, raw, limit))
                limit, note, todo = raw, None, None
            set_or_drop("ifraLimit", limit)
            set_or_drop("ifraLimitNote", note)
            if todo:
                review.append(todo)

        # Raison IFRA + amendement
        raw = reg.get("ifraReason")
        if raw not in (None, ""):
            text, ok = self.lookup(M.IFRA_REASON, "ifraReason", raw)
            if ok:
                set_or_drop("ifraReason", text)
                numbers = sorted({n for group in AMENDMENT.findall(raw) for n in group.split("/")}, key=int)
                set_or_drop("ifraAmendment", ", ".join(numbers))

        # Annexe III
        raw = reg.get("rciiiRestriction")
        if raw not in (None, ""):
            value, ok = self.lookup(M.RCIII, "rciiiRestriction", raw)
            if ok:
                status, ghs, note = value
                if note == "CONFIRM":
                    review.append(f"Statut Annexe III à confirmer (valeur d'origine : « {M.key(raw)} »)")
                    note = None
                out["rciiiRestriction"] = status
                set_or_drop("ghsClassification", ghs)
                set_or_drop("rciiiNote", note)

        # Allergènes UE
        raw = reg.get("euAllergenRaw")
        if raw not in (None, ""):
            note, ok = self.lookup(M.EU_ALLERGEN_NOTE, "euAllergenRaw", raw)
            if ok:
                set_or_drop("euAllergenNote", note)
                out.pop("euAllergenRaw", None)
        if out.get("isAllergen") and not out.get("allergens"):
            if name.strip() in M.MISSING_ALLERGENS_FILL:
                out["allergens"] = M.MISSING_ALLERGENS_FILL[name.strip()]
            else:
                review.append("Préciser quels allergènes UE la matière contient")

        # Recombinaison
        raw = reg.get("recombi")
        if raw not in (None, ""):
            value, ok = self.lookup(M.RECOMBI, "recombi", raw)
            if ok:
                risk, note = value
                if risk is None:
                    out.pop("recombiRisk", None)
                    review.append("Risque de recombinaison à renseigner")
                else:
                    out["recombiRisk"] = risk
                set_or_drop("recombi", note)

        # Stabilité
        for field, table in (
            ("physicoChemicalIssue", M.PHYSICO),
            ("triggeringConditions", M.TRIGGERING),
            ("impactResult", M.IMPACT),
        ):
            raw = reg.get(field)
            if raw not in (None, ""):
                text, ok = self.lookup(table, field, raw)
                if ok:
                    set_or_drop(field, text)

        # Régions : statut + note
        china_notes = []
        for field, note_field, table in (
            ("usaMocra", "usaMocraNote", M.USA),
            ("californiaProp65", "californiaNote", M.CA),
            ("chinaCsar", "chinaNote", M.CHINA),
            ("menaGso", "menaNote", M.MENA),
        ):
            raw = reg.get(field)
            if raw in (None, ""):
                continue
            value, ok = self.lookup(table, field, raw)
            if not ok:
                continue
            status, note = value
            if note == "CONFIRM":
                review.append(f"Statut {field_label(field)} à confirmer (valeur d'origine : « {M.key(raw)} »)")
                note = None
            elif note == "MOVED_TO_CHINA":
                note = "La valeur d'origine concernait la Chine (déplacée)"
                moved, _ = self.lookup(M.CHINA, "chinaCsar", raw.split(":", 1)[1])
                if moved and moved[1]:
                    china_notes.append(moved[1])
            out[field] = status
            if field == "chinaCsar":
                china_notes.insert(0, note)
            else:
                set_or_drop(note_field, note)

        raw = reg.get("chinaMeaning")
        if raw not in (None, ""):
            note, ok = self.lookup(M.CHINA_MEANING, "chinaMeaning", raw)
            if ok:
                china_notes.append(note)
                out.pop("chinaMeaning", None)
        if "chinaCsar" in out or china_notes:
            unique = []
            for note in china_notes:
                if note and note not in unique:
                    unique.append(note)
            set_or_drop("chinaNote", " ; ".join(unique))

        unique_review = []
        for item in review:
            if item not in unique_review:
                unique_review.append(item)
        set_or_drop("reviewNotes", unique_review)
        return out

    # -- fiche labo ----------------------------------------------------------
    def clean_lab(self, material):
        changes = {}

        value = material.get("ifraCat4")
        if value:
            # Les valeurs chiffrées sont des limites (comparées au RADAR) : on n'y touche pas.
            if not NUMERIC_ONLY.match(value):
                if value.strip().lower() in {"cetalo", "gb"}:
                    self.unclear_lab_values.append((material["name"], "IFRA Cat.4 (labo)", value))
                else:
                    changes["ifraCat4"] = self.clean_substances("ifraCat4", value)

        value = material.get("cosmeticRegulation")
        if value:
            if NUMERIC_ONLY.match(value) or value.strip() in {"F", "allergène"}:
                if not NUMERIC_ONLY.match(value):
                    self.unclear_lab_values.append((material["name"], "Règlement cosmétique", value))
            else:
                changes["cosmeticRegulation"] = self.clean_substances("cosmeticRegulation", value)

        value = material.get("allergens")
        if value:
            changes["allergens"] = self.clean_substances("allergens", value)

        value = material.get("flavor")
        if value:
            if M.key(value) in M.FLAVOR_GARBAGE:
                changes["flavor"] = None
            else:
                text = re.sub(r"^F\s*,\s*", "F, ", M.key(value))
                for wrong, right in M.FLAVOR_TYPO_FIXES:
                    text = text.replace(wrong, right)
                changes["flavor"] = text

        value = material.get("flavorRestriction")
        if value:
            text, ok = self.lookup(FLAVOR_RESTRICTION, "flavorRestriction", value)
            if ok:
                changes["flavorRestriction"] = text

        return {k: v for k, v in changes.items() if v != material.get(k)}


def field_label(field):
    return {
        "usaMocra": "USA (MoCRA)",
        "californiaProp65": "Californie",
        "chinaCsar": "Chine",
        "menaGso": "MENA",
    }[field]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--backup", help="fichier où sauvegarder les valeurs avant modification")
    parser.add_argument("--report", help="fichier JSON où écrire les modifications prévues")
    parser.add_argument(
        "--mark-cleaned", metavar="BACKUP",
        help="pose cleanupVersion sur les profils d'une sauvegarde déjà appliquée, sans rien d'autre",
    )
    args = parser.parse_args()
    if args.apply and not args.backup:
        sys.exit("--apply demande --backup <fichier.json>")

    materials = http("GET", "/materials")

    if args.mark_cleaned:
        with open(args.mark_cleaned, encoding="utf-8") as f:
            ids = {item["id"] for item in json.load(f) if item.get("regulatory")}
        marked = 0
        for material in materials:
            reg = material.get("regulatory")
            if material["id"] in ids and reg and reg.get("cleanupVersion") != CLEANUP_VERSION:
                http("PATCH", f"/materials/{material['id']}",
                     {"regulatory": {**reg, "cleanupVersion": CLEANUP_VERSION}})
                marked += 1
        print(f"{marked} profils marqués comme nettoyés.")
        return

    cleaner = Cleaner()
    updates = []
    for material in materials:
        if material.get("origin") == "synthetic":
            continue
        payload = cleaner.clean_lab(material)
        reg = material.get("regulatory")
        if reg:
            cleaned = cleaner.clean_regulatory(material["name"], reg)
            if cleaned != reg:
                payload["regulatory"] = cleaned
                for field in set(reg) | set(cleaned):
                    if reg.get(field) != cleaned.get(field):
                        cleaner.changed_fields[field] += 1
        for field in payload:
            if field != "regulatory":
                cleaner.changed_fields[f"labo.{field}"] += 1
        if payload:
            updates.append((material, payload))

    print(f"Matières à modifier : {len(updates)}")
    print("Champs modifiés :")
    for field, count in sorted(cleaner.changed_fields.items()):
        print(f"  {field}: {count}")
    review = [(m["name"], p["regulatory"]["reviewNotes"]) for m, p in updates
              if p.get("regulatory", {}).get("reviewNotes")]
    print(f"Matières avec des points à compléter : {len(review)}")
    if cleaner.unclear_lab_values:
        print("Valeurs labo incompréhensibles (laissées telles quelles) :")
        for item in cleaner.unclear_lab_values:
            print("  ", " | ".join(item))
    if cleaner.unsafe_limits:
        print("Limites IFRA laissées telles quelles (la correction aurait été moins stricte) :")
        for item in cleaner.unsafe_limits:
            print("  ", item)
    if cleaner.unmapped:
        print("\nVALEURS NON PRÉVUES (rien n'est appliqué tant qu'il en reste) :")
        for field, values in cleaner.unmapped.items():
            for value in sorted(values):
                print(f"  {field}: {value!r}")

    if args.report:
        with open(args.report, "w", encoding="utf-8") as f:
            json.dump(
                [{"name": m["name"], "id": m["id"], "changes": p} for m, p in updates],
                f, ensure_ascii=False, indent=2,
            )

    if not args.apply:
        return
    if cleaner.unmapped:
        sys.exit("Abandon : complétez regulatory_mappings.py pour les valeurs non prévues.")

    fields = ["regulatory", "ifraCat4", "cosmeticRegulation", "allergens", "flavor", "flavorRestriction"]
    with open(args.backup, "w", encoding="utf-8") as f:
        json.dump(
            [{"id": m["id"], "name": m["name"], **{k: m.get(k) for k in fields}} for m, _ in updates],
            f, ensure_ascii=False, indent=2,
        )
    print(f"Sauvegarde écrite : {args.backup}")

    for material, payload in updates:
        http("PATCH", f"/materials/{material['id']}", payload)
    print(f"{len(updates)} matières mises à jour.")


if __name__ == "__main__":
    main()
