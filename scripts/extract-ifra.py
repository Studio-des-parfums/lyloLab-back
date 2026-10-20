import json
import re
import unicodedata
import warnings
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent.parent
SRC = ROOT / "RADAR BASES 201705-Vide Ifra.xlsx..xlsx"
OUT = Path(__file__).resolve().parent.parent / "data" / "ifra-regulatory.json"

FIELDS = [
    "ifraLimit",
    "rciiiRestriction",
    "ifraReason",
    "euAllergenRaw",
    "recombi",
    "physicoChemicalIssue",
    "triggeringConditions",
    "impactResult",
    "usaMocra",
    "californiaProp65",
    "chinaCsar",
    "chinaMeaning",
    "menaGso",
]

# Canonical EU fragrance allergen names (Annex III of Regulation 1223/2009 and
# the 2023/1545 extension), mapped from every FR/EN spelling variant found in
# the source file. Matching is done on an accent-stripped, lowercased string.
ALLERGEN_ALIASES: dict[str, str] = {
    "benzyl alcohol": "Benzyl alcohol",
    "alcool benzylique": "Benzyl alcohol",
    "benzyl benzoate": "Benzyl benzoate",
    "benzoate de benzyle": "Benzyl benzoate",
    "benzyl cinnamate": "Benzyl cinnamate",
    "cinnamate de benzyle": "Benzyl cinnamate",
    "benzyl salicylate": "Benzyl salicylate",
    "salicylate de benzyle": "Benzyl salicylate",
    "cinnamyl alcohol": "Cinnamyl alcohol",
    "alcool cinnamique": "Cinnamyl alcohol",
    "cinnamal": "Cinnamal",
    "cinnamaldehyde": "Cinnamal",
    "aldehyde cinnamique": "Cinnamal",
    "acide cinnamique": "Cinnamic acid",
    "cinnamic acid": "Cinnamic acid",
    "citral": "Citral",
    "geranial": "Citral",
    "neral": "Citral",
    "citronellol": "Citronellol",
    "citronellal": "Citronellal",
    "coumarin": "Coumarin",
    "coumarine": "Coumarin",
    "eugenol": "Eugenol",
    "eugénol": "Eugenol",
    "isoeugenol": "Isoeugenol",
    "isoeugénol": "Isoeugenol",
    "farnesol": "Farnesol",
    "farnésol": "Farnesol",
    "furnesol": "Farnesol",
    "geraniol": "Geraniol",
    "géraniol": "Geraniol",
    "limonene": "Limonene",
    "limonène": "Limonene",
    "d-limonene": "Limonene",
    "linalool": "Linalool",
    "linalol": "Linalool",
    "terpineol": "Terpineol",
    "beta-caryophyllene": "beta-Caryophyllene",
    "β-caryophyllène": "beta-Caryophyllene",
    "cedryl acetate": "Cedryl acetate",
    "acetate cedryle": "Cedryl acetate",
    "camphor": "Camphor",
    "camphre": "Camphor",
    "oakmoss": "Oakmoss extract",
    "mousse de chene": "Oakmoss extract",
    "7-methoxycoumarin": "7-methoxycoumarin",
    "methoxycoumarine": "7-methoxycoumarin",
}

# Longest alias first so e.g. "d-limonene" matches before "limonene".
_ALIAS_PATTERNS = sorted(ALLERGEN_ALIASES.items(), key=lambda kv: -len(kv[0]))

NEGATIVE_VALUES = {"no", "non", "aucun", ""}


def strip_accents(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text)
    return "".join(c for c in normalized if not unicodedata.combining(c))


def parse_eu_allergen(raw: str | None) -> tuple[bool, list[str]]:
    """Turns a free-text EU-allergen cell into (isAllergen, [canonical names])."""
    if raw is None:
        return False, []

    normalized = strip_accents(str(raw)).lower().strip()
    if normalized in NEGATIVE_VALUES:
        return False, []

    found: list[str] = []
    for alias, canonical in _ALIAS_PATTERNS:
        if re.search(rf"\b{re.escape(alias)}", normalized) and canonical not in found:
            found.append(canonical)

    # "oui"/"yes" without a named molecule still means "declared allergen".
    is_allergen = bool(found) or bool(
        re.match(r"^(oui|yes)\b", normalized) or "allergen" in normalized
    )

    return is_allergen, found

with warnings.catch_warnings():
    warnings.simplefilter("ignore")
    wb = openpyxl.load_workbook(SRC, data_only=True)

ws = wb["Tableau synthèse"]

records = {}
for row in ws.iter_rows(min_row=3, max_row=1000):
    vals = [c.value for c in row]
    cas = vals[0]
    if cas is None:
        continue
    cas = str(cas).strip()
    if cas.lower() == "somme":
        continue

    entry = {"name": vals[1]}
    for field, value in zip(FIELDS, vals[3:3 + len(FIELDS)]):
        if value is None:
            continue
        if isinstance(value, str):
            value = value.strip()
            if value == "" or value == "/":
                continue
        entry[field] = value

    is_allergen, allergens = parse_eu_allergen(entry.get("euAllergenRaw"))
    entry["isAllergen"] = is_allergen
    entry["allergens"] = allergens

    records[cas] = entry

OUT.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Extracted {len(records)} CAS entries -> {OUT}")
