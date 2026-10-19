import json
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
    "euAllergen",
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

    records[cas] = entry

OUT.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Extracted {len(records)} CAS entries -> {OUT}")
