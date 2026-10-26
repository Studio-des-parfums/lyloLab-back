"""
Correspondances valeur d'origine -> valeur corrigée pour le nettoyage des
données réglementaires (voir regulatory_cleanup.py).

Les clés sont comparées après normalisation des espaces (voir `key()`), donc
les doubles espaces ou espaces en fin de valeur n'empêchent pas la
correspondance. Toute valeur absente de ces tables est signalée par le script
au lieu d'être modifiée.
"""

import re


def key(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def table(entries: dict) -> dict:
    return {key(k): v for k, v in entries.items()}


# ---------------------------------------------------------------------------
# Noms de substances (INCI quand il existe, sinon nom chimique usuel).
# Utilisé pour les listes d'allergènes et de composants.
# ---------------------------------------------------------------------------
SUBSTANCES = table({
    "benzyl alcool": "Benzyl Alcohol",
    "alcool benzylique": "Benzyl Alcohol",
    "alcool de benzyl": "Benzyl Alcohol",
    "benzyl alcohol": "Benzyl Alcohol",
    "d,l-citronellol": "Citronellol",
    "l-citronellol": "Citronellol",
    "citronellol": "Citronellol",
    "citornellol": "Citronellol",
    "citronellal": "Citronellal",
    "geraniol": "Geraniol",
    "géraniol": "Geraniol",
    "génraniol": "Geraniol",
    "farsenal": "Farnesal",
    "farnesal": "Farnesal",
    "farsenol": "Farnesol",
    "farnisol": "Farnesol",
    "farnesol": "Farnesol",
    "citral": "Citral",
    "cigtral": "Citral",
    "methyl eugenol": "Methyl Eugenol",
    "methyleugénol": "Methyl Eugenol",
    "methyleugenol": "Methyl Eugenol",
    "methyl-eugenol": "Methyl Eugenol",
    "metyl-eugenol": "Methyl Eugenol",
    "eugenol": "Eugenol",
    "eugénol": "Eugenol",
    "iso eugenol": "Isoeugenol",
    "isoeugenol": "Isoeugenol",
    "acetyl iso eugenol": "Acetyl Isoeugenol",
    "cedrene": "Cedrene",
    "alpha cedrene": "alpha-Cedrene",
    "beta cedrene": "beta-Cedrene",
    "beta cadrene": "beta-Cedrene",
    "alpha bisabolol": "alpha-Bisabolol",
    "cinnamic alcool": "Cinnamyl Alcohol",
    "alcool cinnamique": "Cinnamyl Alcohol",
    "alcool cinammique": "Cinnamyl Alcohol",
    "cinnamyl acetate": "Cinnamyl Acetate",
    "aldéhyde cinnamic": "Cinnamal",
    "aldéhyde cinnamique": "Cinnamal",
    "cinnamic aldehyde": "Cinnamal",
    "cinnamic aldehyd": "Cinnamal",
    "methoxycinnamaldehyde": "Methoxycinnamaldehyde",
    "cinnamate": "Cinnamates",
    "cinnamates": "Cinnamates",
    "cinnamate de benzyle": "Benzyl Cinnamate",
    "benzyl cinnamat": "Benzyl Cinnamate",
    "benzyl cinnamate": "Benzyl Cinnamate",
    "salicylate de benzyl": "Benzyl Salicylate",
    "benzyl salicylate": "Benzyl Salicylate",
    "benzyl sallicylate": "Benzyl Salicylate",
    "benzoate de benzyl": "Benzyl Benzoate",
    "benzoate de benzyle": "Benzyl Benzoate",
    "bzneoate de benzyl": "Benzyl Benzoate",
    "benzyl benzoate": "Benzyl Benzoate",
    "cynanide benzyl": "Benzyl Cyanide",
    "benzyl cyanide": "Benzyl Cyanide",
    "methyl n formylanthranilate": "Methyl N-Formylanthranilate",
    "methyl-n-formylanthranilate": "Methyl N-Formylanthranilate",
    "methyl-n-methylanthranilate": "Methyl N-Methylanthranilate",
    "methyl anthranilate": "Methyl Anthranilate",
    "1-octen-3-yl-acetate": "1-Octen-3-yl Acetate",
    "1-octen-3-yl acetate": "1-Octen-3-yl Acetate",
    "7-methoxycoumarine": "7-Methoxycoumarin",
    "7-methoxycoumarin": "7-Methoxycoumarin",
    "benzaldehyde": "Benzaldehyde",
    "benzaldéhyde": "Benzaldehyde",
    "p-methoxybenzaldehyde": "Anisaldehyde",
    "methoxybenzaldéhyde": "Anisaldehyde",
    "methoxybenzaldehyde": "Anisaldehyde",
    "aldehyde anisique": "Anisaldehyde",
    "estragol": "Estragole",
    "estragole": "Estragole",
    "l-carvone": "l-Carvone",
    "l carvone": "l-Carvone",
    "d carvone": "d-Carvone",
    "l,d carvone": "Carvone (l/d)",
    "l,d-carvone": "Carvone (l/d)",
    "d/l-carvone": "Carvone (l/d)",
    "isophorone": "Isophorone",
    "cyclopentadecanolide": "Cyclopentadecanolide",
    "dihydrocoumarin": "Dihydrocoumarin",
    "dihydrocoumarine": "Dihydrocoumarin",
    "coumarin": "Coumarin",
    "coumarine": "Coumarin",
    "courmarine": "Coumarin",
    "beta thujone": "beta-Thujone",
    "alpha thujone": "alpha-Thujone",
    "thujone": "Thujone",
    "mousse d'arbre": "Mousse d'arbre (Evernia furfuracea)",
    "safrole": "Safrole",
    "safrol": "Safrole",
    "2-methoxy-4-propyphenol": "2-Methoxy-4-propylphenol",
    "p-isopropylbenzyl alcool": "p-Isopropylbenzyl Alcohol",
    "cuminaldehyde": "Cuminaldehyde",
    "longifolène": "Longifolene",
    "longifolene": "Longifolene",
    "perilla aldh-ehyde": "Perillaldehyde",
    "perilla aldehyde": "Perillaldehyde",
    "perillaldehyde": "Perillaldehyde",
    "limonene d": "Limonene",
    "limonène d": "Limonene",
    "liminène d": "Limonene",
    "limonède d": "Limonene",
    "limonen d": "Limonene",
    "d-limonene": "Limonene",
    "limonene": "Limonene",
    "limonène d (allergène)": "Limonene",
    "linalol": "Linalool",
    "myrcene": "Myrcene",
    "phenylacetaldehyde": "Phenylacetaldehyde",
    "peroxyde": "Peroxydes",
})

# Corrections appliquées au texte avant le découpage par virgules (virgules
# parasites à l'intérieur d'un nom, deux noms collés).
SUBSTANCE_PRE_FIXES = [
    ("be,zyl", "benzyl"),
    ("d,l-citronellol", "citronellol"),
    ("l,d carvone", "l/d carvone"),
    ("l,d-carvone", "l/d carvone"),
    ("eugenoln iso eugenol", "eugenol, iso eugenol"),
]
SUBSTANCES[key("l/d carvone")] = "Carvone (l/d)"


# ---------------------------------------------------------------------------
# Limite IFRA Cat.4 : valeur -> (limite, note, à compléter)
# Les valeurs simples (« 0.73% », « 1.25 % Cat.4 »…) sont formatées par le
# script ; seules les valeurs particulières sont listées ici.
# ---------------------------------------------------------------------------
IFRA_LIMIT_SPECIAL = table({
    "?": (None, None, "Limite IFRA Cat.4 à renseigner"),
    "Restriction + Spécification": (
        None,
        "Restriction + spécification IFRA : limite chiffrée à préciser",
        "Limite IFRA Cat.4 à chiffrer",
    ),
    "Restriction via composants": (
        None,
        "Restriction via les composants : limite à calculer d'après la composition",
        "Limite IFRA Cat.4 à calculer via les composants",
    ),
    "Spécification (antioxydant requis)": (
        None,
        "Pas de limite chiffrée ; spécification IFRA : antioxydant obligatoire",
        None,
    ),
    "Non restreint": ("Aucune limite", None, None),
    "PROHIBITED": ("Interdite", None, None),
    "Banned": ("Interdite", None, None),
    "Prohibition + Spécification": ("Interdite", "Interdiction + spécification IFRA", None),
    "0.043 % (combined)": ("0,043 %", "Limite cumulée pour l'ensemble des isomères", None),
    "3.0% (tous isomères cumulés)": ("3 %", "Limite cumulée pour tous les isomères", None),
    "0.1% Cat.4 (Restriction + Spécification)": ("0,1 %", "Restriction + spécification IFRA", None),
    "indirect (~0.8 %)": (
        "0,8 %",
        "Limite indirecte et approximative",
        "Limite IFRA approximative à confirmer",
    ),
    "~1 %": ("1 %", "Limite approximative", "Limite IFRA approximative à confirmer"),
    "~12 %": ("12 %", "Limite approximative", "Limite IFRA approximative à confirmer"),
    "0.5-1%": (
        "0,5 %",
        "Fourchette indiquée 0,5–1 % : valeur basse retenue",
        "Limite IFRA approximative à confirmer",
    ),
    "No IFRA Limit but typically limited at 1-2% max": (
        "1 %",
        "Pas de limite IFRA ; usage habituel 1–2 % maximum (valeur basse retenue)",
        "Limite d'usage à confirmer",
    ),
    "Ifra limited beause of citral (0,15%)": ("0,15 %", "Limite liée au Citral", None),
    "6.0% Cat.4 (bergaptène present) / No restriction si FCF": (
        "6 %",
        "Limite due au bergaptène ; aucune limite pour la qualité sans furocoumarines (FCF)",
        None,
    ),
    "1 % (EU cosmetic limit)": (
        "1 %",
        "Limite du règlement cosmétique UE, pas une limite IFRA",
        None,
    ),
    "26.11% max": ("26,11 %", None, None),
    "Prohibition pour tagete erecta dans le produit fini, seulement tagete patula et tagete minuta peuvent étre utilisés avec alpha terthienyl max 0.35%": (
        "Interdite (Tagetes erecta)",
        "Tagetes erecta est interdit dans le produit fini ; seuls Tagetes patula et "
        "Tagetes minuta sont autorisés, avec alpha-terthiényle ≤ 0,35 %",
        "Vérifier l'espèce : si Tagetes patula ou minuta, la matière n'est pas interdite",
    ),
})


# ---------------------------------------------------------------------------
# Raison IFRA : valeur -> texte en français.
# L'amendement (« Amend. 49 ») est extrait automatiquement par le script.
# ---------------------------------------------------------------------------
IFRA_REASON = table({
    "Sensibilisation dermique QRA2 – Amend. 49": "Sensibilisation cutanée (QRA2)",
    "ensibilisation dermique QRA2 – Amend. 51": "Sensibilisation cutanée (QRA2)",
    "Sensitization": "Sensibilisation cutanée",
    "Dermal sensitization": "Sensibilisation cutanée",
    "dermal sensitization": "Sensibilisation cutanée",
    "strong Sensitization": "Sensibilisation cutanée forte",
    "Dermal sensitization (molecule itself)": "Sensibilisation cutanée (molécule elle-même)",
    "Dermal senitization & systemic toxicity": "Sensibilisation cutanée + toxicité systémique",
    "benzyl benzoate / benzyl salicylate": "Via composants : Benzyl Benzoate, Benzyl Salicylate",
    "Contains benzyl alcohol, farnesol": "Via composants : Benzyl Alcohol, Farnesol",
    "Sensibilisation dermique – Amend. 49": "Sensibilisation cutanée",
    "Sensibilisation dermique QRA2 révisée – Amend. 51": "Sensibilisation cutanée (QRA2 révisée)",
    "Hepatotoxicity (pulegone)": "Hépatotoxicité (pulégone)",
    "IFRA Spécification Pinaceae derivatives : teneurs en impuretés contrôlées (delta-3-carène, endoperoxides). PF = purifiée donc risque réduit mais spec reste applicable":
        "Spécification IFRA des dérivés de Pinaceae : teneurs en impuretés contrôlées "
        "(delta-3-carène, endoperoxydes). Qualité purifiée (PF) : risque réduit, mais la "
        "spécification reste applicable",
    "FRA Spécification Pinaceae derivatives, teneurs en impuretés oxydées contrôlées (delta-3-carène, endoperoxides). Riche en alpha- et beta-pinène":
        "Spécification IFRA des dérivés de Pinaceae : teneurs en impuretés oxydées contrôlées "
        "(delta-3-carène, endoperoxydes). Riche en alpha- et bêta-pinène",
    "Standard IFRA Styrax Amend. 49. Contient acide benzoïque, benzyl benzoate, benzyl cinnamate, benzyl alcohol":
        "Standard IFRA propre au styrax. Contient acide benzoïque, Benzyl Benzoate, "
        "Benzyl Cinnamate, Benzyl Alcohol",
    "Standard IFRA propre — restriction Amend. 49. ~35% linalol, ~35% acétate de linalyle, ~8% camphre, 1,8-cinéole. Linalol : spéc. IFRA (antioxydant requis)":
        "Standard IFRA propre (restriction). Environ 35 % de Linalool, 35 % d'acétate de "
        "linalyle, 8 % de camphre, 1,8-cinéole. Linalool : spécification IFRA (antioxydant "
        "obligatoire)",
    "Standard IFRA propre — restriction Amend. 49. Contient 2-isobutyl-3-méthoxypyrazine, butyrates, cat-3-hexenyl esters":
        "Standard IFRA propre (restriction). Contient 2-isobutyl-3-méthoxypyrazine, "
        "butyrates, esters de cis-3-hexényle",
    "Restriction Amend. 49. Contient benzyl acetate, benzyl benzoate, alcool benzylique, linalol, eugénol, farnésol":
        "Restriction. Contient acétate de benzyle, Benzyl Benzoate, Benzyl Alcohol, "
        "Linalool, Eugenol, Farnesol",
    "Restriction + Spéc. IFRA Amend. 49. Limite dérivée de la teneur en atranol/chloroatranol. Spéc. : chaque < 100 ppm ; DHA < 0.1%. Ingrédient critique chypré":
        "Restriction + spécification IFRA. Limite dérivée de la teneur en atranol et "
        "chloroatranol (spécification : chacun < 100 ppm ; DHA < 0,1 %). Ingrédient "
        "critique des chypres",
    "Restriction Amend. 49. Contient alcool benzylique, benzyl acetate, indole, farnésol, cis-3-hexenol. Limite basse":
        "Restriction (limite basse). Contient Benzyl Alcohol, acétate de benzyle, indole, "
        "Farnesol, cis-3-hexénol",
    "Standard IFRA Amend. 49 — restriction. Contient géraniol (~15%), citronellol (~35%), eugénol, farnésol, méthyl eugénol (traces)":
        "Standard IFRA (restriction). Contient Geraniol (~15 %), Citronellol (~35 %), "
        "Eugenol, Farnesol, Methyl Eugenol (traces)",
    "Standard IFRA propre + spécification — Amend. 49/51 révisé. Contient tagetone, dihydrotagetone, limonène. PHOTOTOXIQUE (furocoumarines). Standard révisé Amend. 51":
        "Standard IFRA propre + spécification (révisé). Contient tagétone, dihydrotagétone, "
        "Limonene. Phototoxique (furocoumarines)",
    "oxidation products": "Produits d'oxydation",
    "Restriction Amend. 51 — sensibilisation dermique + toxicité systémique. Dérivé du p-crésol. Note narcisse/animalique phénolique. p-crésol libre lui-même prohibé à 0.005% Cat.4":
        "Sensibilisation cutanée + toxicité systémique. Dérivé du p-crésol (le p-crésol "
        "libre est interdit au-delà de 0,005 % en Cat.4). Note narcisse, animale, phénolée",
    "Restriction Amend. 49 — sensibilisation dermique QRA2. Limite très basse. Acide précurseur des cinnamates":
        "Sensibilisation cutanée (QRA2), limite très basse. Acide précurseur des cinnamates",
    "Restriction Amend. 49 — sensibilisation dermique QRA2. Limite basse":
        "Sensibilisation cutanée (QRA2), limite basse",
    "Maximum allowed preservative concentration (molecule itself)":
        "Concentration maximale autorisée en tant que conservateur (molécule elle-même)",
    "Restriction via eugénol (Cat. 4 = 2.5% — Amend. 51) + chavicol = estragole (très restreint Amend. 51). Version déterpénée = eugénol concentré (~65-70%)":
        "Via composants : Eugenol (Cat.4 = 2,5 %) et Estragole (chavicol, très restreint). "
        "La version déterpénée concentre l'Eugenol (~65–70 %)",
    "Standard IFRA propre — restriction Amend. 49. Riche en guaiol (~50-60%) et bulnésol. Limite dérivée de la teneur en guaiol":
        "Standard IFRA propre (restriction). Riche en guaïol (~50–60 %) et bulnésol ; "
        "limite dérivée de la teneur en guaïol",
    "terpene allergens": "Allergènes terpéniques",
    "Restricted via constituents (terpene allergens (limonene))": "Via composants : allergènes terpéniques (Limonene)",
    "Oxidized terpene sensitization": "Sensibilisation par les terpènes oxydés",
    "Restriction Amend. 49 — toxicité hépatique systémique. Limite révisée à 0.40% Cat.4":
        "Hépatotoxicité systémique. Limite révisée à 0,4 % en Cat.4",
    "Restriction Amend. 49 — phototoxicité furocoumarines si non FCF. Version FCF (bergaptène-free) : pas de limite propre. Vérifier COA":
        "Phototoxicité (furocoumarines) pour la qualité non FCF. Qualité FCF (sans "
        "bergaptène) : pas de limite propre. Vérifier le certificat d'analyse (COA)",
    "Standard IFRA propre — restriction Amend. 49. Contient alpha-pinène, limonène, carotol, daucol":
        "Standard IFRA propre (restriction). Contient alpha-pinène, Limonene, carotol, daucol",
    "Standard IFRA via composants : géraniol (Cat.4 = 1.8%), citronellol (13.3%), formatiate citronellyle. Géranium Egypte ≈ 20% citronellol + 15% géraniol + 18% formiate citronellyle":
        "Via composants : Geraniol (Cat.4 = 1,8 %), Citronellol (13,3 %), formiate de "
        "citronellyle. Géranium d'Égypte ≈ 20 % de Citronellol, 15 % de Geraniol et 18 % de "
        "formiate de citronellyle",
    "Standard IFRA propre sur Fir balsam — restriction Amend. 49. Riche en alpha-pinène, limonène. Spécification Pinaceae":
        "Standard IFRA propre au baume de sapin (restriction). Riche en alpha-pinène et "
        "Limonene. Spécification Pinaceae",
    "Sensibilisation dermique + toxicité systémique — Amend. 49 (publication 2020)":
        "Sensibilisation cutanée + toxicité systémique (publication 2020)",
    "Standard IFRA propre — restriction Amend. 49. Contient alpha-pinène (~15%), beta-pinène (~20%), myrcène, 3-methyl-2-butenyl acétate":
        "Standard IFRA propre (restriction). Contient alpha-pinène (~15 %), bêta-pinène "
        "(~20 %), Myrcene, acétate de 3-méthyl-2-butényle",
    "Sensibilisation dermique + toxicité systémique – Amend. 49 (isomères mélangés)":
        "Sensibilisation cutanée + toxicité systémique (isomères mélangés)",
    "Estragole has to be ≤ 0.01 %": "Estragole limité à 0,01 % maximum",
    "PROHIBÉ par IFRA Amend. 49 (non rectifié). Le birch tar rectifié peut avoir une spécification. Vérifier si produit est rectifié (WT-02) ou brut":
        "Interdit par l'IFRA sous forme non rectifiée. Le goudron de bouleau rectifié peut "
        "relever d'une spécification : vérifier si le produit est rectifié (WT-02) ou brut",
    "Polycyclic aromatic hydrocarbons (PAH)": "Hydrocarbures aromatiques polycycliques (HAP)",
    "Carcinogenic constituent (β-asarone)": "Constituant cancérogène (β-asarone)",
    "Phototoxicity because of furocoumarines": "Phototoxicité (furocoumarines)",
    "Strong sensitizer (eugenol)": "Sensibilisant fort (Eugenol)",
    "limonene oxidation allergens": "Allergènes issus de l'oxydation du Limonene",
    "Restriction Amend. 51 via géraniol. Palmarosa ≈ 85% géraniol → à 2% en formule ≈ 1.7% géraniol, quasi à la limite à elle seule":
        "Via composants : Geraniol. La palmarosa contient ≈ 85 % de Geraniol : à 2 % en "
        "formule, elle apporte ≈ 1,7 % de Geraniol, presque la limite à elle seule",
    "Restriction applies only to allergens": "Restriction uniquement via les allergènes",
    "Sensibilisation dermique QRA2 + Schiff base concern – Amend. 49":
        "Sensibilisation cutanée (QRA2) + risque de formation de bases de Schiff",
    "Aldehyde sensitizer causing allergic contact dermatitis":
        "Aldéhyde sensibilisant (dermatite allergique de contact)",
    "Toxicity": "Toxicité",
    "IFRA Spécification — linalol doit être utilisé avec antioxydant (BHT ou tocophérol) pour prévenir formation de peroxydes. Pas de limite de concentration propre mais spéc. obligatoire":
        "Spécification IFRA : le Linalool doit être utilisé avec un antioxydant (BHT ou "
        "tocophérol) pour éviter la formation de peroxydes. Pas de limite de concentration "
        "propre, mais spécification obligatoire",
    "Standard IFRA propre — restriction Amend. 49. Éther méthylique du p-crésol. Peut s'hydrolyser → p-crésol (prohibé à 0.005% Cat.4) selon conditions. Limite propre Cat.4 à vérifier sur la fiche IFRA":
        "Standard IFRA propre (restriction). Éther méthylique du p-crésol : peut s'hydrolyser "
        "en p-crésol (interdit au-delà de 0,005 % en Cat.4). Limite propre Cat.4 à vérifier "
        "sur la fiche IFRA",
    "Standard IFRA propre — restriction Amend. 49. Balsamic-spicy Oriental":
        "Standard IFRA propre (restriction). Profil oriental balsamique-épicé",
    "Standard IFRA propre — restriction Amend. 49. Riche en linalol (~35-40%), acétate de linalyle, néryl acétate, indole, géraniol":
        "Standard IFRA propre (restriction). Riche en Linalool (~35–40 %), acétate de "
        "linalyle, acétate de néryle, indole, Geraniol",
    "Standard IFRA propre — restriction Amend. 49. Sweet myrrh/baumier":
        "Standard IFRA propre (restriction). Opoponax (myrrhe douce)",
    "Phenolic compound capable of skin depigmentation":
        "Composé phénolique pouvant dépigmenter la peau",
    "Autorisé": None,
    "Restriction via géraniol (1.8%), citronellol (13.3%), eugénol (2.5%), farnésol (3.9%), méthyl eugénol (0.01%) — Amend. 49/51. Limite propre HE rose = 0.6% Cat. 4":
        "Via composants : Geraniol (1,8 %), Citronellol (13,3 %), Eugenol (2,5 %), "
        "Farnesol (3,9 %), Methyl Eugenol (0,01 %). Limite propre de l'HE de rose : 0,6 % "
        "en Cat.4",
    "Salicylate ester associated with endocrine activity concern":
        "Ester salicylique : suspicion d'activité endocrinienne",
    "Salicylate ester capable of systemic absorption":
        "Ester salicylique : absorption systémique possible",
    "Standard IFRA complexe Amend. 49 — Styrax : restriction + spécification. Contient cinnamaldéhyde (Cat.4 = 0.05%), alcool cinnamique (Cat.4 = 0.25%), eugenol, benzyl alcool. Note : CAS varie selon forme (huile/baume/absolu)":
        "Standard IFRA propre au styrax (restriction + spécification). Contient Cinnamal "
        "(Cat.4 = 0,05 %), Cinnamyl Alcohol (Cat.4 = 0,25 %), Eugenol, Benzyl Alcohol. Le "
        "numéro CAS varie selon la forme (huile, baume, absolue)",
    "Restriction Amend. 49 — toxicité systémique. Limite Cat.4 = 1.0%. Très largement utilisée en parfumerie":
        "Toxicité systémique. Limite Cat.4 = 1 %. Très largement utilisée en parfumerie",
    "Standard IFRA propre — restriction Amend. 49. Phénol vinylique apparenté à l'eugénol. Peut se dimériser en conditions oxydantes":
        "Standard IFRA propre (restriction). Phénol vinylique apparenté à l'Eugenol ; peut se "
        "dimériser en conditions oxydantes",
})


# ---------------------------------------------------------------------------
# Annexe III : valeur -> (statut, classification GHS, note)
# ---------------------------------------------------------------------------
NOT_LISTED = "Non listée"
ANNEX_III = "Annexe III"
ANNEX_II = "Annexe II (interdite)"
TO_CHECK = "À vérifier"
GHS_1 = "Sensibilisant cutané Cat. 1"
GHS_1B = "Sensibilisant cutané Cat. 1B"
GHS_SENS = "Sensibilisant cutané"

RCIII = table({
    "Not listed in Annex III": (NOT_LISTED, None, None),
    "Not Listed in Annex III": (NOT_LISTED, None, None),
    "Not listed": (NOT_LISTED, None, None),
    "not listed": (NOT_LISTED, None, None),
    "No restriction": (NOT_LISTED, None, None),
    "No sensitization restriction": (NOT_LISTED, None, None),
    # Pas des statuts d'annexe : à confirmer.
    "Autorisé": (NOT_LISTED, None, "CONFIRM"),
    "autorisé": (NOT_LISTED, None, "CONFIRM"),
    "Allowed": (NOT_LISTED, None, "CONFIRM"),
    "Safe": (NOT_LISTED, None, "CONFIRM"),
    "Limitation": (ANNEX_III, None, None),
    "Lim": (ANNEX_III, None, None),
    "LIm": (ANNEX_III, None, None),
    "lim": (ANNEX_III, None, None),
    "Limited": (ANNEX_III, None, None),
    "Listed": (ANNEX_III, None, None),
    "Lim (RCIII)": (ANNEX_III, None, None),
    "Limitation(Non classé GHS)": (ANNEX_III, "Non classé", None),
    "Limitation (Non classé GHS (irritant))": (ANNEX_III, "Non classé (irritant)", None),
    "Limitation (Sensibilisant Cat. 1 (GHS))": (ANNEX_III, GHS_1, None),
    "Limitation(Sensibilisant Cat. 1 (GHS))": (ANNEX_III, GHS_1, None),
    "Lim (Sensibilisant Cat. 1 (GHS))": (ANNEX_III, GHS_1, None),
    "Limitation (Sensibilisant Cat. 1B (GHS))": (ANNEX_III, GHS_1B, None),
    "Limitation (Sensibilisant Cat. 1B (GHS)": (ANNEX_III, GHS_1B, None),
    "Limitation (Sensibilisant Cat. 1B (GHS) via eugénol)": (ANNEX_III, GHS_1B, "Via Eugenol"),
    "Limitation (Sensibilisant Cat. 1 (GHS) via composants)": (ANNEX_III, GHS_1, "Via les composants"),
    "Limitation (Sensibilisant Cat. 1 (GHS) via géraniol)": (ANNEX_III, GHS_1, "Via Geraniol"),
    "Limitation (Sensibilisant Cat. 1 (GHS) via géraniol, eugénol": (ANNEX_III, GHS_1, "Via Geraniol, Eugenol"),
    "Limitation(Sensibilisant Cat. 1 via géraniol, citronellol)": (ANNEX_III, GHS_1, "Via Geraniol, Citronellol"),
    "Limitation(Sensibilisant via composants benzyliques)": (ANNEX_III, GHS_SENS, "Via les composants benzyliques"),
    "Limitation(Sensibilisant (via composants))": (ANNEX_III, GHS_SENS, "Via les composants"),
    "Limitation(Sensibilisant (via composants)": (ANNEX_III, GHS_SENS, "Via les composants"),
    "Limitation(Sensibilisant (phénol))": (ANNEX_III, GHS_SENS, "Phénol"),
    "Limitation(Sensibilisant (phénol vinylique))": (ANNEX_III, GHS_SENS, "Phénol vinylique"),
    "Lim (RCIII via allergens)": (ANNEX_III, None, "Via les allergènes"),
    "Lim via constituent": (ANNEX_III, None, "Via les composants"),
    "Lim(Estragole)": (ANNEX_III, None, "Via Estragole"),
    "Lim (Linalool)": (ANNEX_III, None, "Via Linalool"),
    "Lim (toxicity)": (ANNEX_III, None, "Toxicité"),
    "Lim (systemic toxicity)": (ANNEX_III, None, "Toxicité systémique"),
    "Annexe III (benzyl benzoate, etc.)": (ANNEX_III, None, "Via Benzyl Benzoate et autres composants"),
    "Annexe III (eugenol)": (ANNEX_III, None, "Via Eugenol"),
    "Annexe III (allergène + restriction)": (ANNEX_III, None, "Allergène + restriction"),
    "Annexe III (fort allergène)": (ANNEX_III, None, "Allergène fort"),
    "Restriction + Spec.(Sensibilisant Cat. 1 (GHS) – Atranol, Chloroatranol)": (
        ANNEX_III, GHS_1, "Restriction + spécification (atranol, chloroatranol)"),
    "Restriction + Spec.(Sensibilisant + phototoxicité)": (
        ANNEX_III, "Sensibilisant cutané ; phototoxique", "Restriction + spécification"),
    "PROHIBÉ(Sensibilisant + carcinogène potentiel (via HAP))": (
        ANNEX_II, "Sensibilisant cutané ; cancérogène potentiel (HAP)", None),
    "Spécification": (TO_CHECK, None, "Spécification indiquée ; statut Annexe III à préciser"),
    "Sensibilisant potentiel (précurseur)": (TO_CHECK, "Sensibilisant potentiel (précurseur)", None),
    "Annexe II/III (impuretés)": (TO_CHECK, None, "Annexe II ou III selon les impuretés"),
    "β-asarone (toxic)": (TO_CHECK, None, "β-asarone (toxique)"),
    "Strong toxicological concern": (TO_CHECK, None, "Préoccupation toxicologique forte"),
    "Listed in Annex I": (
        TO_CHECK, None,
        "Indiqué « Annexe I » : probablement une erreur, l'Annexe I ne liste pas de substances"),
})


# ---------------------------------------------------------------------------
# Allergènes UE : valeur -> note en français (None = rien à ajouter au Oui/Non)
# ---------------------------------------------------------------------------
EXT_2023 = "liste UE étendue, règlement 2023/1545"
EU_ALLERGEN_NOTE = table({
    "No": None, "no": None, "NO": None, "Non": None,
    "Yes": None, "yes": None,
    "Yes (Benzyl benzoate, Benzyl salicylate, Farnesol, Linalool)": None,
    "Oui — citronellol, géraniol, eugénol, farnésol (liste 26)": "Liste des 26 allergènes",
    "Oui – Alcool benzylique ≥ 0.001%": None,
    "Oui — alcool benzylique, benzyl benzoate, benzyl cinnamate si ≥ seuils (liste 26)": "Liste des 26 allergènes",
    "Oui – Citral ≥ 0.001% produit fini": None,
    "oui (linalool)": None,
    "Oui – Géraniol ≥ 0.001% produit fini": None,
    "Yes (Limonene)": None,
    "Yes (Limonene, Linalool)": None,
    "Oui — camphre (EU étendu 2023) + linalol (EU étendu 2023)": f"Camphre et Linalool ({EXT_2023})",
    "Yes (alcool benzylique, benzyl benzoate, eugénol, farnésol + linalol )": None,
    "Yes (Benzyl alcohol, Farnesol (trace))": "Farnesol à l'état de traces",
    "Oui — mousse de chêne (liste EU Annex III directement nommée)": "Mousse de chêne nommée directement à l'Annexe III",
    "Oui — alcool benzylique si ≥ 0.001%": None,
    "Oui — limonène (EU étendu 2023)": f"Limonene ({EXT_2023})",
    "Oui — acétate cédryle (EU Reg. 2023/1545 étendu, ≥ 0.001%)": f"Acétate de cédryle ({EXT_2023})",
    "Oui acide cinnamique (liste EU étendue 2023)": f"Acide cinnamique ({EXT_2023})",
    "Oui — alcool cinnamique (liste des 26)": "Liste des 26 allergènes",
    "Oui – β-caryophyllène (liste EU étendue Reg. 2023/1545)": f"β-caryophyllène ({EXT_2023})",
    "Oui (Limonene)": None,
    "Oui — β-caryophyllène (EU étendu 2023)": f"β-caryophyllène ({EXT_2023})",
    "possible allergens": "Allergènes possibles, non précisés",
    "Possible if limonene exceeds threshold": "Déclarable si le Limonene dépasse le seuil",
    "yes (d-limonene)": None,
    "Oui — limonène ≥ 0.001% (EU étendu 2023) + citral si seuil": f"Limonene ({EXT_2023}) ; Citral si le seuil est atteint",
    "Oui géraniol, citronellol ≥ 0.001% (liste 26)": "Liste des 26 allergènes",
    "Yes (Furnesol)": None,
    "Yes (Linalool, Eugenol (trace))": "Eugenol à l'état de traces",
    "Yes (Citral, Geraniol, Citronellol)": None,
    "Yes (Eugenol, Isoeugenol)": None,
    "Yes (Limonene, linalool, citral)": None,
    "Oui — géraniol ≥ 0.001% (liste 26)": "Liste des 26 allergènes",
    "Oui — eugénol ≥ 0.001% (liste 26)": "Liste des 26 allergènes",
    "Yes (isoeugenol)": None,
    "Oui — linalol (liste EU étendue Reg. 2023/1545)": f"Linalool ({EXT_2023})",
    "Oui — linalol, géraniol (EU étendu 2023)": f"Linalool, Geraniol ({EXT_2023})",
    "Yes (Benzyl salicylate)": None,
    "Oui — alcool cinnamique, cinnamaldéhyde (liste 26) + eugénol si ≥ seuil": "Liste des 26 allergènes ; Eugenol si le seuil est atteint",
    "Yes (Terpineol)": "Terpineol",
})

# Allergènes à compléter quand la matière est marquée allergène sans liste.
MISSING_ALLERGENS_FILL = {
    "Hydroxycitronnellal": ["Hydroxycitronellal"],
}


# ---------------------------------------------------------------------------
# USA (MoCRA) : valeur -> (statut, note)
# ---------------------------------------------------------------------------
ALLOWED = "Autorisé"
RESTRICTED = "Restreint"
BANNED = "Interdit"
FUTURE_ALLERGEN = "Allergène probablement déclarable (règle FDA en préparation)"

USA = table({
    "Allowed": (ALLOWED, None),
    "allowed": (ALLOWED, None),
    "Autorisé": (ALLOWED, None),
    "Autorisé – non listé MoCRA": (ALLOWED, "Non listé MoCRA"),
    "Allowed fragrance ingredient": (ALLOWED, None),
    "alllowed fragance ingredient": (ALLOWED, None),
    "OK": (ALLOWED, None),
    "MoCRA Safe": (ALLOWED, None),
    "Futur allergène MoCRA": (ALLOWED, FUTURE_ALLERGEN),
    "Futur allergènes MoCRA": (ALLOWED, FUTURE_ALLERGEN),
    "Futur allergènes multiples MoCRA": (ALLOWED, "Plusieurs allergènes probablement déclarables (règle FDA en préparation)"),
    "Futur listing MoCRA probable": (ALLOWED, "Inscription probable sur la future liste MoCRA"),
    "Scrutin MoCRA": (ALLOWED, "Sous surveillance MoCRA"),
    "Non interdit MoCRA. Futur allergène probable liste FDA (suit EU)": (ALLOWED, FUTURE_ALLERGEN + " ; la FDA suit la liste UE"),
    "Non interdit MoCRA. Probable futur allergène déclarable FDA (suit EU)": (ALLOWED, FUTURE_ALLERGEN + " ; la FDA suit la liste UE"),
    "Non interdit MoCRA. Allergène probable futur (FDA suit EU). INCI requis": (ALLOWED, FUTURE_ALLERGEN + " ; nom INCI requis"),
    "Autorisée – INCI requis. Linalol futur allergène probable MoCRA": (ALLOWED, "Nom INCI requis ; Linalool probablement déclarable"),
    "Autorisée. Benzyl alcohol, benzyl benzoate, eugénol, farnésol : futurs allergènes MoCRA probables": (ALLOWED, "Benzyl Alcohol, Benzyl Benzoate, Eugenol, Farnesol probablement déclarables"),
    "Autorisée. Eugénol futur allergène probable MoCRA. Estragole : listé comme carcinogène possible par IARC": (ALLOWED, "Eugenol probablement déclarable ; Estragole classé cancérogène possible par le CIRC"),
    "Autorisée. Géraniol futur allergène probable liste MoCRA/FDA": (ALLOWED, "Geraniol probablement déclarable"),
    "Autorisée. Thymol (CT thymol) : futur allergène probable si listing MoCRA": (ALLOWED, "Thymol (chémotype thymol) probablement déclarable"),
    "Autorisée. Géraniol, citronellol, eugénol, farnésol : futurs allergènes probables liste MoCRA/FDA": (ALLOWED, "Geraniol, Citronellol, Eugenol, Farnesol probablement déclarables"),
    "Base autorisée si composants conformes FDA/MoCRA": (ALLOWED, "Sous réserve de conformité des composants (FDA/MoCRA)"),
    "Autorisé si composants conformes FDA": (ALLOWED, "Sous réserve de conformité des composants (FDA)"),
    "Allergène": (ALLOWED, "Allergène"),
    "Restreint": (RESTRICTED, None),
    "Restricted": (RESTRICTED, None),
    "Phototoxicité — restrictions USA": (RESTRICTED, "Phototoxicité"),
    "Phototoxicité — linalol futur allergène MoCRA": (RESTRICTED, "Phototoxicité ; Linalool probablement déclarable"),
    # Pas des statuts MoCRA : déplacés en note, statut à vérifier.
    "Prop 65 Warning": (TO_CHECK, "Indiqué « Prop 65 Warning » : concerne la Californie"),
    "p-Crésol = carcinogène potentiel EPA": (TO_CHECK, "p-crésol classé cancérogène potentiel par l'EPA"),
    "HAP listés carcinogènes EPA": (TO_CHECK, "HAP classés cancérogènes par l'EPA"),
    "Estragole concern": (TO_CHECK, "Préoccupation liée à l'Estragole"),
    "trés toxique": (TO_CHECK, "Indiqué « très toxique »"),
    "Unsafe in practice": (TO_CHECK, "Indiqué « dangereux en pratique »"),
    "Irritation possible": (TO_CHECK, "Irritation possible"),
    "Hydrolyse possible → p-crésol": (TO_CHECK, "Hydrolyse possible en p-crésol"),
})


# ---------------------------------------------------------------------------
# Californie (Prop 65 / CFFIRKA) : valeur -> (statut, note)
# ---------------------------------------------------------------------------
CA_NOT_LISTED = "Non listé"
CA_DECLARABLE = "Déclarable (CFFIRKA)"
CA_WARNING = "Avertissement Prop 65"
LEAVE_ON = "si ≥ 0,001 % dans un produit sans rinçage"

CA = table({
    "Non listé Prop 65 / CFFIRKA": (CA_NOT_LISTED, None),
    "Non listé Prop 65/CFFIRKA": (CA_NOT_LISTED, None),
    "Not Listed": (CA_NOT_LISTED, None),
    "not listed": (CA_NOT_LISTED, None),
    "Not listed": (CA_NOT_LISTED, None),
    "Non listé": (CA_NOT_LISTED, None),
    "allowed": (CA_NOT_LISTED, "CONFIRM"),
    "Autorisé": (CA_NOT_LISTED, "CONFIRM"),
    "OK": (CA_NOT_LISTED, "CONFIRM"),
    "Non listé Prop 65. Déclaration CFFIRKA possible si géraniol libéré ≥ seuil": (CA_NOT_LISTED, "Déclaration CFFIRKA possible si le Geraniol libéré atteint le seuil"),
    "Déclarable CFFIRKA si ≥ 0.001% leave-on (liste EU adoptée par CA)": (CA_DECLARABLE, LEAVE_ON + " (liste UE reprise par la Californie)"),
    "Déclarable CFFIRKA si ≥ 0.001% leave-on (liste EU adoptée CA)": (CA_DECLARABLE, LEAVE_ON + " (liste UE reprise par la Californie)"),
    "Déclarable CFFIRKA si ≥ 0.001%": (CA_DECLARABLE, LEAVE_ON),
    "Déclarable CFFIRKA (liste EU étendue)": (CA_DECLARABLE, "Liste UE étendue"),
    "Déclarable CFFIRKA (EU étendu)": (CA_DECLARABLE, "Liste UE étendue"),
    "Listé CFFIRKA — Déclarable CA": (CA_DECLARABLE, None),
    "Multiples allergènes déclarables CFFIRKA": (CA_DECLARABLE, "Plusieurs allergènes"),
    "4+ allergènes déclarables CFFIRKA": (CA_DECLARABLE, "Au moins 4 allergènes"),
    "Benzyl compounds": (CA_DECLARABLE, "Composés benzyliques"),
    "Limonene": (CA_DECLARABLE, "Limonene"),
    "Allergène": (CA_DECLARABLE, "Allergène"),
    "Restricted because of Allergen": (CA_DECLARABLE, "En raison des allergènes"),
    "Limonène déclarable CFFIRKA si ≥ 0.001%": (CA_DECLARABLE, "Limonene " + LEAVE_ON),
    "Limonène déclarable CFFIRKA": (CA_DECLARABLE, "Limonene"),
    "Linalol déclarable CFFIRKA (liste EU étendue) si ≥ 0.001% (HE graine ≈ 70% linalol)": (CA_DECLARABLE, "Linalool " + LEAVE_ON + " ; l'HE de graines contient ≈ 70 % de Linalool"),
    "Camphre + linalol déclarables CFFIRKA": (CA_DECLARABLE, "Camphre, Linalool"),
    "Benzyl alcohol, benzyl benzoate, eugénol, farnésol déclarables CFFIRKA si ≥ 0.001%": (CA_DECLARABLE, "Benzyl Alcohol, Benzyl Benzoate, Eugenol, Farnesol " + LEAVE_ON),
    "Alcool benzylique déclarable CFFIRKA": (CA_DECLARABLE, "Benzyl Alcohol"),
    "β-caryophyllène déclarable CFFIRKA (liste EU étendue adoptée CA) si ≥ 0.001%": (CA_DECLARABLE, "β-caryophyllène " + LEAVE_ON),
    "Limonène + linalol déclarables CFFIRKA": (CA_DECLARABLE, "Limonene, Linalool"),
    "Géraniol + citronellol déclarables CFFIRKA": (CA_DECLARABLE, "Geraniol, Citronellol"),
    "Géraniol déclarable CFFIRKA si ≥ 0.001% (liste EU adoptée CA)": (CA_DECLARABLE, "Geraniol " + LEAVE_ON),
    "Thymol déclarable CFFIRKA (liste EU étendue adoptée CA) si CT thymol ≥ 0.001%": (CA_DECLARABLE, "Thymol (chémotype thymol) " + LEAVE_ON),
    "Linalol + géraniol déclarables CFFIRKA": (CA_DECLARABLE, "Linalool, Geraniol"),
    "Géraniol, citronellol, eugénol, farnésol déclarables CFFIRKA si ≥ 0.001% (liste EU adoptée CA)": (CA_DECLARABLE, "Geraniol, Citronellol, Eugenol, Farnesol " + LEAVE_ON),
    "Cinnamaldéhyde + cinnamic alcohol déclarables CFFIRKA": (CA_DECLARABLE, "Cinnamal, Cinnamyl Alcohol"),
    "Déclarer composants figurant sur listes CFFIRKA/Prop 65": (CA_DECLARABLE, "Déclarer les composants figurant sur les listes CFFIRKA / Prop 65"),
    "Déclarer si linalol ≥ 0.001% (liste EU adoptée CA)": (CA_DECLARABLE, "Linalool " + LEAVE_ON),
    "Linalool oxydé": (CA_DECLARABLE, "Linalool oxydé"),
    "Prop 65 Warning": (CA_WARNING, None),
    "HAP listés Prop 65 carcinogènes": (CA_WARNING, "HAP classés cancérogènes Prop 65"),
    "Cancérogène (PAH)": (CA_WARNING, "HAP cancérogènes"),
    "Pulegone: 13 µg/day = warning required": (CA_WARNING, "Pulégone : avertissement obligatoire au-delà de 13 µg/jour"),
    "Pulegone: 13 µg/day = warning if exceeded": (CA_WARNING, "Pulégone : avertissement obligatoire au-delà de 13 µg/jour"),
    "warning potentiel": (TO_CHECK, "Avertissement Prop 65 possible"),
    "Possible listing": (TO_CHECK, "Inscription possible"),
    "Vérifier composants CFFIRKA": (TO_CHECK, "Vérifier les composants (CFFIRKA)"),
    "Vérifier Prop 65 sur p-crésol libre": (TO_CHECK, "Vérifier la Prop 65 pour le p-crésol libre"),
    "p-Crésol potentiel = vérifier Prop 65": (TO_CHECK, "Vérifier la Prop 65 pour le p-crésol libre"),
    "restricted": (TO_CHECK, "Indiqué « restreint » sans précision"),
    "restrcited": (TO_CHECK, "Indiqué « restreint » sans précision"),
    "banned": (BANNED, None),
    # Texte de la colonne Chine collé dans la colonne Californie.
    "Interdit / Alerte :Bay oil présent IECIC 2021. Estragole (chavicol) : RESTREINT STSC. Vérifier teneur sur COA": (
        TO_CHECK, "MOVED_TO_CHINA"),
})


# ---------------------------------------------------------------------------
# Chine (IECIC / STSC) : valeur -> (statut, note)
# « IECIC 2022 / 2023 » sont des erreurs de recopie Excel : l'édition est 2021.
# ---------------------------------------------------------------------------
CN_ALLOWED = "Présent IECIC 2021 – autorisé"
CN_RESTRICTED = "Présent IECIC 2021 – restreint STSC"
CN_CHECK_COA = "Vérifier la teneur sur le certificat d'analyse (COA)"

CHINA = table({
    "Présent IECIC 2021. Autorisé. Aucune restriction STSC": (CN_ALLOWED, None),
    "Présent IECIC 2021. Autorisé. Aucune restriction STSC propre sur fragrance": (CN_ALLOWED, None),
    "Présent IECIC 2021. Autorisé": (CN_ALLOWED, None),
    "Présent IECIC 2021 (Autorisé)": (CN_ALLOWED, None),
    "Présent IECIC 2021. Autorisé (fraction)": (CN_ALLOWED, "Fraction"),
    "Présent IECIC 2021": (CN_ALLOWED, None),
    "Présent IECIC 2022": (CN_ALLOWED, None),
    "Présent IECIC 2023": (CN_ALLOWED, None),
    "IECIC listed": (CN_ALLOWED, None),
    "IECIC": (CN_ALLOWED, None),
    "IECIC plant extract": (CN_ALLOWED, "Extrait végétal"),
    "Listé": (CN_ALLOWED, None),
    "listé": (CN_ALLOWED, None),
    "Allowed": (CN_ALLOWED, None),
    "OK": (CN_ALLOWED, None),
    "Composants terpéniques présents IECIC 2021": (CN_ALLOWED, "Composants terpéniques présents à l'IECIC"),
    "Présent IECIC — restreint STSC": (CN_RESTRICTED, None),
    "Présent IECIC 2021. Restreint STSC – limite de teneur applicable": (CN_RESTRICTED, "Limite de teneur applicable"),
    "Restreint": (CN_RESTRICTED, None),
    "Restriction": (CN_RESTRICTED, None),
    "restricted": (CN_RESTRICTED, None),
    "Restrcited": (CN_RESTRICTED, None),
    "Restricted / discouraged": (CN_RESTRICTED, "Usage déconseillé"),
    "Restricted via components": (CN_RESTRICTED, "Via les composants"),
    "controlled": (CN_RESTRICTED, "Contrôlé"),
    "Contrôlé": (CN_RESTRICTED, "Contrôlé"),
    "Allowed but strongly limited": (CN_RESTRICTED, "Usage fortement limité"),
    "Alcool benzylique restreint STSC certains produits": (CN_RESTRICTED, "Benzyl Alcohol restreint dans certains produits"),
    "Présent IECIC 2021. Méthyl eugénol naturel restreint STSC. Vérifier teneur COA": (CN_RESTRICTED, "Methyl Eugenol naturel restreint. " + CN_CHECK_COA),
    "Présent IECIC 2021. Méthyl eugénol naturel restreint STSC. Vérifier teneur sur COA": (CN_RESTRICTED, "Methyl Eugenol naturel restreint. " + CN_CHECK_COA),
    "Méthyl eugénol restreint STSC — vérifier COA": (CN_RESTRICTED, "Methyl Eugenol restreint. " + CN_CHECK_COA),
    "Présent IECIC — p-crésol restreint STSC": (CN_RESTRICTED, "p-crésol restreint"),
    "Bay oil présent IECIC 2021. Estragole (chavicol) : RESTREINT STSC. Vérifier teneur sur COA": (CN_RESTRICTED, "Estragole (chavicol) restreint. " + CN_CHECK_COA),
    "Présent IECIC 2021. Géraniol restreint dans STSC si teneur élevée": (CN_RESTRICTED, "Geraniol restreint si teneur élevée"),
    "Présent IECIC 2021. Thymol : restreint STSC si présent en quantité": (CN_RESTRICTED, "Thymol restreint si présent en quantité"),
    "Restreint STSC — vérifier teneur": (CN_RESTRICTED, CN_CHECK_COA),
    "Restreint STSC — composants cinnamates": (CN_RESTRICTED, "Via les cinnamates"),
    "Restreint probable STSC — vérifier": (TO_CHECK, "Restriction STSC probable"),
    "Présent IECIC — vérifier restriction STSC": (TO_CHECK, "Présent à l'IECIC ; restriction STSC à vérifier"),
    "Vérifier composants IECIC 2021": (TO_CHECK, "Vérifier les composants à l'IECIC 2021"),
    "HAP non conforme STSC si non rectifié": (TO_CHECK, "Non conforme STSC (HAP) si non rectifié"),
    "Allergènes": (TO_CHECK, "Allergènes"),
    "Avertissement": (TO_CHECK, "Avertissement"),
    "banned": (BANNED, None),
})

# Colonne « Signification Chine » : None = redondant avec le statut, supprimé.
CHINA_MEANING = table({
    "Allowed": None,
    "No restriction": None,
    "Approved ingredient": None,
    "Allowed plant extract": None,
    "Allowed perfume ingredient": None,
    "safe": None,
    "Approved preservative": "Conservateur autorisé",
    "Must control sensitization": "Contrôler le risque de sensibilisation",
    "En IECIC avec restriction : teneur max dans STSC. Déclaration sur étiquette si dépassement": "Teneur maximale fixée par la STSC ; mention sur l'étiquette en cas de dépassement",
    "En IECIC avec restriction : teneur max dans STSC. Déclaration étiquette requise": "Teneur maximale fixée par la STSC ; mention sur l'étiquette obligatoire",
    "Autorisé. Méthyl eugénol naturellement présent : RESTREINT STSC. Surveillance COA obligatoire": "Methyl Eugenol naturellement présent et restreint : surveillance du COA obligatoire",
    "Irritation in high dose": "Irritant à forte dose",
    "Monitor citrus allergens": "Surveiller les allergènes des agrumes",
    "Autorisé. Estragole (chavicol) : RESTREINT dans STSC. Vérifier teneur COA. Eugénol restreint selon teneur": "Estragole (chavicol) restreint, Eugenol restreint selon la teneur. " + CN_CHECK_COA,
    "Sensitization possibleSensitization possible": "Sensibilisation possible",
    "Must respect 0.001% allergen threshold": "Respecter le seuil de 0,001 % pour les allergènes",
    "Restricted / discouraged": None,
    "Control pulegone/menthofuran (<~1%)": "Contrôler la pulégone et le menthofurane (< ~1 %)",
    "Autorisé. Thymol : RESTREINT STSC selon teneur et catégorie produit. Vérifier chémotype + COA": "Thymol restreint selon la teneur et la catégorie de produit. Vérifier le chémotype et le COA",
    "Strong material (Low use)": "Matière puissante (faible dosage)",
    "Vérifier chaque composant en IECIC": "Vérifier chaque composant à l'IECIC",
})


# ---------------------------------------------------------------------------
# MENA (GSO 1943) : valeur -> (statut, note)
# « GSO 1944 / 1945 / 1946 » sont des erreurs de recopie Excel : la norme
# applicable aux parfums est la GSO 1943.
# ---------------------------------------------------------------------------
GSO_OK = "Conforme GSO 1943"
GSO_DECL = "Déclarable GSO 1943 (allergènes)"

MENA = table({
    "Follows IFRA & Allergen": (GSO_OK, None),
    "Conforme GSO 1943": (GSO_OK, None),
    "Conforme GSO 1944": (GSO_OK, None),
    "Conforme GSO 1945": (GSO_OK, None),
    "Conforme GSO 1946": (GSO_OK, None),
    "Conforme GSO 1943 (dans limites IFRA)": (GSO_OK, "Dans les limites IFRA"),
    "Conforme GSO 1943. Même logique IFRA/EU": (GSO_OK, "Mêmes règles que l'IFRA et l'UE"),
    "Conforme GSO si dans limites IFRA. p-Crésol: restreint": (GSO_OK, "Dans les limites IFRA ; p-crésol restreint"),
    "Conforme GSO si dans limites. Surveiller hydrolyse": (GSO_OK, "Dans les limites ; surveiller l'hydrolyse"),
    "Déclarable GSO 1943 (liste EU étendue)": (GSO_DECL, "Liste UE étendue"),
    "EU allergène déclarable GSO 1943": (GSO_DECL, None),
    "EU allergène → déclarable GSO 1943": (GSO_DECL, None),
    "Allergène EU déclarable GSO 1943 si ≥ 0.001% produit fini leave-on": (GSO_DECL, LEAVE_ON),
    "Multiples EU allergènes déclarables GSO": (GSO_DECL, "Plusieurs allergènes"),
    "EU allergènes multiples déclarables GSO 1943": (GSO_DECL, "Plusieurs allergènes"),
    "4+ EU allergènes déclarables GSO 1943": (GSO_DECL, "Au moins 4 allergènes"),
    "Conforme GSO 1943 dans limites EU. Allergène EU déclarable sur étiquette si ≥ 0.001%": (GSO_DECL, "Dans les limites UE ; allergène à déclarer sur l'étiquette " + LEAVE_ON),
    "Conforme GSO 1943 dans limites EU. Allergène EU déclarable si ≥ 0.001%": (GSO_DECL, "Dans les limites UE ; allergène " + LEAVE_ON),
    "Limonène déclarable GSO 1943 si ≥ 0.001%": (GSO_DECL, "Limonene " + LEAVE_ON),
    "Linalol déclarable GSO 1943 (liste EU 2023) si ≥ 0.001%": (GSO_DECL, "Linalool " + LEAVE_ON + " (liste UE 2023)"),
    "Camphre + linalol déclarables GSO 1943": (GSO_DECL, "Camphre, Linalool"),
    "Alcool benzylique déclarable GSO 1943": (GSO_DECL, "Benzyl Alcohol"),
    "Déclarable si ≥ 0.001% (GSO = EU)": (GSO_DECL, LEAVE_ON + " (GSO = règles UE)"),
    "β-caryophyllène déclarable GSO 1943 (liste EU 2023) si ≥ 0.001%": (GSO_DECL, "β-caryophyllène " + LEAVE_ON + " (liste UE 2023)"),
    "Géraniol + citronellol déclarables GSO 1943": (GSO_DECL, "Geraniol, Citronellol"),
    "Géraniol déclarable GSO 1943 si ≥ 0.001%": (GSO_DECL, "Geraniol " + LEAVE_ON),
    "Linalol + géraniol déclarables GSO 1943": (GSO_DECL, "Linalool, Geraniol"),
    "Déclarer linalol si ≥ 0.001% (GSO 1943 = listes EU)": (GSO_DECL, "Linalool " + LEAVE_ON),
    "Alpha-isométhyl ionone déclarable GSO": (GSO_DECL, "Alpha-Isomethyl Ionone"),
    "GSO 1943 = EU. Allergènes multiples déclarables. Méthyl eugénol restreint. Limite propre IFRA 0.6% Cat. 4": (GSO_DECL, "Plusieurs allergènes ; Methyl Eugenol restreint ; limite IFRA propre 0,6 % en Cat.4"),
    "GSO 1943 = EU. Estragole : restreint EU/IFRA (très basse limite). Eugénol : allergène déclarable. ⚠ Vérifier conformité stricte": (GSO_DECL, "Estragole restreint (limite très basse) ; Eugenol déclarable. Vérifier la conformité au cas par cas"),
    "GSO 1943 = EU. Thymol déclarable si ≥ 0.001%. CT thymol : vérifier conformité IFRA": (GSO_DECL, "Thymol " + LEAVE_ON + " ; chémotype thymol : vérifier la conformité IFRA"),
    "GSO 1943 = EU. Géraniol, citronellol, eugénol, farnésol déclarables. Méthyl eugénol : restreint": (GSO_DECL, "Geraniol, Citronellol, Eugenol, Farnesol ; Methyl Eugenol restreint"),
    "Phototoxique — vérifier GSO 1943": (TO_CHECK, "Phototoxique"),
    "Phototoxique si non FCF — linalol déclarable GSO": (TO_CHECK, "Phototoxique si non FCF ; Linalool déclarable"),
    "Vérifier composants vs listes GSO 1943": (TO_CHECK, "Vérifier les composants par rapport aux listes GSO 1943"),
    "Prohibé ou très restreint GSO 1943": (BANNED, "Interdit ou très restreint"),
    "Banned": (BANNED, None),
})


# ---------------------------------------------------------------------------
# Stabilité
# ---------------------------------------------------------------------------
PHYSICO = table({
    "Stable": "Stable",
    "stable": "Stable",
    "Oxidation": "Oxydation",
    "Ester hydrolysis": "Hydrolyse (ester)",
    "Ester hydrolysis + terpene oxidation": "Hydrolyse (ester) + oxydation (terpènes)",
    "Rapid hydrolysis": "Hydrolyse rapide",
    "Oxidation (citronellol, geraniol)": "Oxydation (Citronellol, Geraniol)",
    "Ester hydrolysis (slow)": "Hydrolyse lente (ester)",
    "Terpene oxidation": "Oxydation (terpènes)",
    "Oxidation / polymerization": "Oxydation + polymérisation",
    "Oxidation/polymerization": "Oxydation + polymérisation",
    "Oxidation + polymerization": "Oxydation + polymérisation",
    "Oxidation and polymerization": "Oxydation + polymérisation",
    "Oxidative polymerization": "Polymérisation oxydative",
    "Oxidation / slight polymerization": "Oxydation + légère polymérisation",
    "Oxidation of conjugated system": "Oxydation (système conjugué)",
    "Oxidation (terpene)": "Oxydation (terpènes)",
    "Oxidation + isomerization": "Oxydation + isomérisation",
    "Rapid oxidation (monoterpene)": "Oxydation rapide (monoterpènes)",
    "Oxidation (linalool-rich)": "Oxydation (riche en Linalool)",
    "Aldehyde oxidation": "Oxydation (aldéhydes)",
    "Oxidation (phenolic ether)": "Oxydation (éther phénolique)",
    "Oxidation (linalool, linalyl acetate)": "Oxydation (Linalool, acétate de linalyle)",
    "Oxidation (sulfur compounds very reactive)": "Oxydation (composés soufrés très réactifs)",
    "Oxidation (complex natural extract)": "Oxydation (extrait naturel complexe)",
    "Oxidation of aldehydes and wax crystallization": "Oxydation (aldéhydes) + cristallisation des cires",
    "Oxidation + resinification (depsides, atranol traces)": "Oxydation + résinification (depsides, traces d'atranol)",
    "Oxidation (thiols, terpenes)": "Oxydation (thiols, terpènes)",
    "Ronge plastique.": "Attaque les plastiques",
    "Hydrolyse + oxydation": "Hydrolyse + oxydation",
    "Photoisomerization": "Photo-isomérisation",
    "Oxidation of phenolic alcohol": "Oxydation (alcool phénolique)",
    "Lactone ring hydrolysis": "Hydrolyse (cycle lactone)",
    "Citrus/terpene oxidation": "Oxydation (agrumes, terpènes)",
    "Crystallization in alcoholic solutions (physical instability)": "Cristallisation en solution alcoolique (instabilité physique)",
    "Photodegradation (UV-sensitive ester)": "Photodégradation (ester sensible aux UV)",
    "Oxidation (terpenes/resins)": "Oxydation (terpènes, résines)",
    "Oxidation (phenols + terpenes)": "Oxydation (phénols, terpènes)",
    "Oxidation des sesquiterpènes": "Oxydation (sesquiterpènes)",
    "Oxidation of sesquiterpenes": "Oxydation (sesquiterpènes)",
    "Oxidation (sesquiterpenes)": "Oxydation (sesquiterpènes)",
    "Oxidation (lipids)": "Oxydation (lipides)",
    "Lipid oxidation": "Oxydation (lipides)",
    "Photooxidation at double bond": "Photo-oxydation (double liaison)",
    "Autoxidation = hydroperoxides (Slower due to dilution)": "Auto-oxydation → hydroperoxydes (ralentie par la dilution)",
    "Phenolic oxidation": "Oxydation (phénols)",
    "Oxidation (phenolic)": "Oxydation (phénols)",
    "Oxidation of phenolic compounds": "Oxydation (phénols)",
    "Acetal hydrolysis": "Hydrolyse (acétal)",
    "Hydrolysis": "Hydrolyse",
    "Oxidation (limonene, linalyl acetate)": "Oxydation (Limonene, acétate de linalyle)",
    "Rapid oxidation (α-pinene rich)": "Oxydation rapide (riche en α-pinène)",
    "Autoxidation of citronellol and geraniol forming hydroperoxides": "Auto-oxydation du Citronellol et du Geraniol → hydroperoxydes",
    "Aldehyde oxidation and discoloration": "Oxydation (aldéhydes) + décoloration",
    "Rosissement : Sensible UV": "Rosissement (sensible aux UV)",
    "Aldehyde reactivity": "Réactivité (aldéhydes)",
    "Oxidation = hydroperoxides": "Oxydation → hydroperoxydes",
    "Oxidation (hydroperoxides formation)": "Oxydation → hydroperoxydes",
    "Oxidation (monoterpenes + resins)": "Oxydation (monoterpènes, résines)",
    "Oxidation (ether with unsaturation)": "Oxydation (éther insaturé)",
    "Oxidation (unsaturated resins)": "Oxydation (résines insaturées)",
    "Oxidation (resin)": "Oxydation (résine)",
    "Oxidation of estragole and linalool": "Oxydation (Estragole, Linalool)",
    "Oxidation of phthalides and terpenes": "Oxydation (phtalides, terpènes)",
    "Citral oxidation": "Oxydation (Citral)",
    "Oxidation of eugenol = quinones": "Oxydation de l'Eugenol → quinones",
    "Oxidation + degradation": "Oxydation + dégradation",
    "Strong autoxidation of limonene = hydroperoxides": "Forte auto-oxydation du Limonene → hydroperoxydes",
    "Strong autoxidation": "Forte auto-oxydation",
    "Oxidation (geraniol-rich)": "Oxydation (riche en Geraniol)",
    "Oxidation of monoterpenes": "Oxydation (monoterpènes)",
    "Oxidation of linalool and sclareol traces": "Oxydation (Linalool, traces de sclaréol)",
    "Oxidation (phenols + terpenes: thymol)": "Oxydation (phénols, terpènes : thymol)",
    "Oxidation (slight, long-term)": "Légère oxydation à long terme",
    "Oxidation (terpene oxide)": "Oxydation (oxyde terpénique)",
    "Aldehyde oxidation = acids": "Oxydation des aldéhydes → acides",
    "Aldehyde oxidation to corresponding acids": "Oxydation des aldéhydes → acides correspondants",
    "Oxidation (slow)": "Oxydation lente",
})

TRIGGERING = table({
    "O₂; UV; T > 25 °C": "O₂ ; UV ; T > 25 °C",
    "O₂; UV; T > 30 °C": "O₂ ; UV ; T > 30 °C",
    "O₂, UV, T > 30 °C": "O₂ ; UV ; T > 30 °C",
    "Oxygen + light ~24–72 h": "O₂ ; lumière ; 24–72 h",
    "pH < 4 or > 9; T > 40 °C; moisture": "pH < 4 ou > 9 ; T > 40 °C ; humidité",
    "pH < 4 or > 9; humidity; T > 40 °C": "pH < 4 ou > 9 ; T > 40 °C ; humidité",
    "pH < 4 or > 9; T > 40 °C; moisture > 5%": "pH < 4 ou > 9 ; T > 40 °C ; humidité > 5 %",
    "O₂; light; T > 25 °C": "O₂ ; lumière ; T > 25 °C",
    "O₂; UV; T > 20–25 °C": "O₂ ; UV ; T > 20–25 °C",
    "Oxygen + humidity ~30–40 °C": "O₂ ; humidité ; T ≈ 30–40 °C",
    "pH < 4 or > 9; T > 40 °C": "pH < 4 ou > 9 ; T > 40 °C",
    "O₂; UV; T > 25–30 °C": "O₂ ; UV ; T > 25–30 °C",
    "UV exposure 300–400 nm for ~24–48 h": "UV 300–400 nm ; 24–48 h",
    "O₂, UV, pH < 5; T > 25 °C": "O₂ ; UV ; pH < 5 ; T > 25 °C",
    "Water > 1%; pH < 5; T > 25 °C": "Eau > 1 % ; pH < 5 ; T > 25 °C",
    "pH < 5; water > 1%; T > 25 °C": "Eau > 1 % ; pH < 5 ; T > 25 °C",
    "pH < 5; presence of water > 1%; T > 25 °C": "Eau > 1 % ; pH < 5 ; T > 25 °C",
    "O₂; T > 30 °C": "O₂ ; T > 30 °C",
    "O₂; light; T > 20–25 °C": "O₂ ; lumière ; T > 20–25 °C",
    "O₂; UV; T > 25 °C; prolonged storage": "O₂ ; UV ; T > 25 °C ; stockage prolongé",
    "Oxidation during storage at ~40 °C; wax precipitation below ~10 °C": "Oxydation au stockage vers 40 °C ; précipitation des cires sous 10 °C",
    "Air + >30 °C for 1–3 months": "Air ; T > 30 °C ; 1–3 mois",
    "Humidité + pH extrêmes + ~40 °C ; Oxygen + light ~24–72 h": "Humidité ; pH extrêmes ; T ≈ 40 °C — ou O₂ ; lumière ; 24–72 h",
    "High humidity (>60% RH), >30 °C, months": "Humidité > 60 % HR ; T > 30 °C ; plusieurs mois",
    "UV exposure 254–365 nm for ~12–48 h": "UV 254–365 nm ; 12–48 h",
    "Oxygen ~25–40 °C": "O₂ ; T ≈ 25–40 °C",
    "Oxygen exposure at ~25–40 °C": "O₂ ; T ≈ 25–40 °C",
    "Oxygen exposure during storage at ~25–40 °C": "O₂ ; stockage à 25–40 °C",
    "Oxygen exposure during storage at ~25–40 °C for several weeks": "O₂ ; stockage à 25–40 °C ; plusieurs semaines",
    "Presence of water under alkaline conditions (pH > 8) at ~40 °C": "Eau ; pH > 8 ; T ≈ 40 °C",
    "≥25 °C + oxygen, 1–2 months": "O₂ ; T ≥ 25 °C ; 1–2 mois",
    "Air exposure 2–6 weeks (RT); faster at 40 °C": "Air ; 2–6 semaines à température ambiante, plus rapide à 40 °C",
    "Air + light, weeks–months": "Air ; lumière ; semaines à mois",
    "Air + light weeks–months": "Air ; lumière ; semaines à mois",
    "Light + air, 1–3 months at 25 °C or 2–4 weeks at 40 °C": "Air ; lumière ; 1–3 mois à 25 °C ou 2–4 semaines à 40 °C",
    "Temperature below ~15 °C in ethanol solutions (>1–2 %)": "T < 15 °C en solution alcoolique (> 1–2 %)",
    "Exposition prolongée à l’air ; accélérée à ~40 °C": "Air prolongé ; accéléré à 40 °C",
    "Air exposure; accelerated at ~40 °C": "Air prolongé ; accéléré à 40 °C",
    "Prolonged air exposure at ~40 °C": "Air prolongé ; T ≈ 40 °C",
    "O₂; T > 30 °C; long storage": "O₂ ; T > 30 °C ; stockage prolongé",
    "Air + light 1–3 months": "Air ; lumière ; 1–3 mois",
    "pH < 5; water presence; T > 30 °C": "Eau ; pH < 5 ; T > 30 °C",
    "Oxygen exposure and light for ~24–72 h or storage at ~40 °C": "O₂ ; lumière ; 24–72 h — ou stockage à 40 °C",
    "UV exposure ~24–72 h or storage at ~40 °C for several weeks": "UV ; 24–72 h — ou stockage à 40 °C plusieurs semaines",
    "UV exposure 300–400 nm for ~24–72 h; accelerated aging at 40–45°C with oxygen": "UV 300–400 nm ; 24–72 h ; vieillissement accéléré à 40–45 °C sous O₂",
    "≥25 °C, light exposure, weeks–months": "Lumière ; T ≥ 25 °C ; semaines à mois",
    "Oxygen + light ~24–72 h; storage >35–40 °C": "O₂ ; lumière ; 24–72 h ; stockage > 35–40 °C",
    "Air + heat >25 °C for weeks–months": "Air ; T > 25 °C ; semaines à mois",
    "Air + light 1–2 months (RT) or 2–3 weeks at 40 °C": "Air ; lumière ; 1–2 mois à température ambiante ou 2–3 semaines à 40 °C",
    "Oxygen exposure + light ~24–72 h; very sensitive at ~25–40 °C": "O₂ ; lumière ; 24–72 h ; très sensible à 25–40 °C",
    "Air + heat months at RT, faster at 40 °C": "Air ; chaleur ; plusieurs mois à température ambiante, plus rapide à 40 °C",
    "Oxygen exposure at ~25–40 °C for several weeks; UV ~24–48 h accelerates": "O₂ ; T ≈ 25–40 °C ; plusieurs semaines ; accéléré par UV (24–48 h)",
    "Oxygen + UV ~24–48 h": "O₂ ; UV ; 24–48 h",
    "Oxygen exposure and UV for ~24–48 h": "O₂ ; UV ; 24–48 h",
    "Air + light days–weeks at RT; very fast at 40 °C (1–2 weeks)": "Air ; lumière ; jours à semaines à température ambiante, très rapide à 40 °C (1–2 semaines)",
    "O₂; light; T > 25–30 °C": "O₂ ; lumière ; T > 25–30 °C",
    "Presence of water and heating around ~40 °C": "Eau ; T ≈ 40 °C",
    "≥25 °C + air exposure for 3–6 months; accelerated at 40 °C / 75% RH (1–2 months)": "Air ; T ≥ 25 °C ; 3–6 mois — accéléré à 40 °C / 75 % HR (1–2 mois)",
    "O₂; light; T > 40 °C": "O₂ ; lumière ; T > 40 °C",
})

IMPACT = table({
    "Loss of floral sweetness": "Perte de la douceur florale",
    "Converts to benzaldehyde": "Transformation en benzaldéhyde",
    "Loss of aldehydic freshness": "Perte de la fraîcheur aldéhydée",
    "Formation of pinene oxides = off-notes": "Formation d'oxydes de pinène → fausses notes",
    "Loss of freshness + allergen formation": "Perte de fraîcheur + formation d'allergènes",
    "Off-notes + allergen formation": "Fausses notes + formation d'allergènes",
    "Peroxide formation, strong off-notes": "Formation de peroxydes, fortes fausses notes",
    "Formation of peroxides → strong off-notes": "Formation de peroxydes, fortes fausses notes",
    "Loss of fresh lemony facet": "Perte de la facette citronnée fraîche",
    "Loss of fresh spicy note": "Perte de la note épicée fraîche",
    "Peroxides formed": "Formation de peroxydes",
    "Peroxide formation": "Formation de peroxydes",
    "Slight discoloration, odor modification": "Légère décoloration, odeur modifiée",
    "Loss of freshness, slight harshness": "Perte de fraîcheur, légère dureté",
    "Rapid degradation of green/sulfur facet": "Dégradation rapide de la facette verte et soufrée",
    "Rapid loss of green/sulfur note": "Perte rapide de la note verte et soufrée",
    "Darkening, slight indolic shift, loss of freshness": "Brunissement, légère dérive indolée, perte de fraîcheur",
    "Cloudiness or odor modification": "Trouble ou odeur modifiée",
    "Darkening, moss note becomes heavier": "Brunissement, la note mousse s'alourdit",
    "Green note softens": "La note verte s'adoucit",
    "Fresh rosy note decreases": "La note rosée fraîche diminue",
    "Slight loss of woody-amber note over time": "Légère perte de la note boisée-ambrée avec le temps",
    "Slight decrease in woody note over time": "Légère baisse de la note boisée avec le temps",
    "Odor degradation + oxidation products": "Dégradation de l'odeur + produits d'oxydation",
    "Loss of fruity floral top": "Perte de la tête fruitée florale",
    "Perte de fraîcheur": "Perte de fraîcheur",
    "Loss of freshness": "Perte de fraîcheur",
    "Loss of green floral note": "Perte de la note florale verte",
    "Loss of phenolic/floral nuance": "Perte de la nuance phénolée et florale",
    "Loss of sweet floral note": "Perte de la note florale sucrée",
    "Odor shift (alcohol formation)": "Dérive olfactive (formation d'alcool)",
    "Slight decrease in odor intensity": "Légère baisse d'intensité",
    "Formation of cinnamaldehyde": "Formation de cinnamaldéhyde",
    "Slight discoloration": "Légère décoloration",
    "Slight discoloration (yellowing)": "Légère décoloration (jaunissement)",
    "Loss of sweet note": "Perte de la note sucrée",
    "Decrease of coconut note": "Baisse de la note coco",
    "Fatty/rancid notes": "Notes grasses, rances",
    "Aldehydic note fades": "La note aldéhydée s'estompe",
    "Harsh/acidic notes": "Notes dures, acides",
    "Color change + odor deviation": "Changement de couleur + dérive olfactive",
    "Odor weakening": "Affaiblissement de l'odeur",
    "Formation of crystals causing turbidity": "Formation de cristaux, trouble",
    "Discoloration, loss of grape/orange-blossom note": "Décoloration, perte de la note raisin / fleur d'oranger",
    "Resin darkening, odor alteration": "Brunissement de la résine, odeur altérée",
    "Loss of spicy/clove freshness": "Perte de la fraîcheur épicée (girofle)",
    "Légère modification boisée": "Légère modification de la note boisée",
    "Slight woody modification": "Légère modification de la note boisée",
    "Slight rancidity, wax note changes": "Léger rancissement, la note cireuse évolue",
    "Decrease of jasmine character": "Baisse du caractère jasmin",
    "Formation of allergenic oxidation products": "Formation de produits d'oxydation allergisants",
    "Formation of sensitizing oxidation products": "Formation de produits d'oxydation sensibilisants",
    "Loss of fruity-rosy power": "Perte de puissance fruitée-rosée",
    "Color change + sensitization": "Changement de couleur + sensibilisation",
    "Releases aldehyde → instability": "Libère un aldéhyde → instabilité",
    "Loss of rosy freshness and formation of allergenic oxidation products": "Perte de la fraîcheur rosée + formation de produits d'oxydation allergisants",
    "Yellow to brown coloration": "Coloration jaune à brune",
    "Yellowing and slight weakening of the moss note": "Jaunissement, léger affaiblissement de la note mousse",
    "Off-odors + instability": "Mauvaises odeurs + instabilité",
    "Loss of freshness, resin thickening": "Perte de fraîcheur, épaississement de la résine",
    "Loss of floral diffusion": "Perte de diffusion florale",
    "Reduced floral diffusion": "Diffusion florale réduite",
    "Rapid degradation": "Dégradation rapide",
    "Very unstable ester": "Ester très instable",
    "Very unstable": "Très instable",
    "Very short-lived fruity note": "Note fruitée très fugace",
    "Loss of sharp green note": "Perte de la note verte vive",
    "Loss of woody softness": "Perte de la douceur boisée",
    "Loss of fresh herbal note": "Perte de la note herbacée fraîche",
    "Tar note becomes harsher": "La note goudron devient plus dure",
    "Darkening, smoky note change": "Brunissement, la note fumée évolue",
    "Off-notes (heavier, less fresh)": "Fausses notes (plus lourd, moins frais)",
    "Increased allergen content": "Teneur en allergènes accrue",
    "Darkening, loss of spiciness": "Brunissement, perte du côté épicé",
    "Increased toxicity (pulegone-related degradation)": "Toxicité accrue (dégradation liée à la pulégone)",
    "Oxidized allergens (limonene oxides)": "Allergènes oxydés (oxydes de Limonene)",
    "Rapid loss of freshness, formation of allergenic peroxides": "Perte rapide de fraîcheur, formation de peroxydes allergisants",
    "Peroxide formation, alteration of floral profile": "Formation de peroxydes, profil floral altéré",
    "Rancidity": "Rancissement",
    "Rancidity + peroxide formation": "Rancissement + formation de peroxydes",
    "Loss of herbal freshness": "Perte de la fraîcheur herbacée",
    "Loss of aromatic freshness, phenolic harshness increases": "Perte de la fraîcheur aromatique, dureté phénolée accrue",
    "Acid formation = weaker scent": "Formation d'acides → odeur affaiblie",
    "Loss of floral freshness, slight yellowing": "Perte de la fraîcheur florale, léger jaunissement",
    "Strong discoloration, odor change": "Forte décoloration, odeur modifiée",
    "Formation of hydroperoxides (allergen risk)": "Formation d'hydroperoxydes (risque allergène)",
    "Darkening, phenolic harshness increases": "Brunissement, dureté phénolée accrue",
    "Minor odor change": "Légère modification de l'odeur",
    "Loss of delicate floral top": "Perte de la tête florale délicate",
    "Thickening, balsamic shift": "Épaississement, dérive balsamique",
    "Degradation of citrus freshness": "Dégradation de la fraîcheur hespéridée",
    "Dark brown coloration": "Coloration brun foncé",
    "Loss of fruity sweetness": "Perte de la douceur fruitée",
    "Reduced floral note": "Note florale réduite",
    "Loss of fresh rosy top, slight waxy note appears": "Perte de la tête rosée fraîche, apparition d'une légère note cireuse",
    "Formation of salicylic acid": "Formation d'acide salicylique",
    "Loss of balsamic sweetness": "Perte de la douceur balsamique",
    "Darkening, balsamic deepening": "Brunissement, la note balsamique s'approfondit",
    "Sensitizer formation → allergen risk": "Formation de sensibilisants → risque allergène",
    "Loss of green note": "Perte de la note verte",
    "Loss of green freshness": "Perte de la fraîcheur verte",
})


# ---------------------------------------------------------------------------
# Recombinaison : valeur -> (risque oui/non, note en français)
# ---------------------------------------------------------------------------
RECOMBI = table({
    "No": (False, None),
    "no": (False, None),
    "Aucun": (False, None),
    "allowed": (False, None),
    "No regulatory interaction": (False, None),
    "?": (None, None),
    "Compatible with lactones": (False, "Compatible avec les lactones"),
    "Compatible with vanillin / ethylvanillin": (False, "Compatible avec la vanilline et l'éthylvanilline"),
    "Compatible with benzyl derivatives": (False, "Compatible avec les dérivés benzyliques"),
    "Peut contribuer à l'exposition géraniol totale en analyse ; pas de Recombi IFRA identifiée": (
        False, "Pas de recombinaison IFRA identifiée ; peut contribuer à l'exposition totale en Geraniol"),
    "Cumul allergènes (benzyl, linalool)": (True, "Cumul d'allergènes (composés benzyliques, Linalool)"),
    "cumulative allergen exposure": (True, "Cumul d'exposition aux allergènes"),
    "Présent dans absolues (jasmin, rose, ylang) et bases florales → cumul fréquent avec ingrédients naturels": (
        True, "Présent dans les absolues (jasmin, rose, ylang) et les bases florales : cumul fréquent avec les naturels"),
    "Terpène oxydable : forme des hydroperoxydes allergisants au contact de l'air → utiliser obligatoirement avec antioxydant (BHT ou tocophérol). Contribue au pool limonène total": (
        True, "Terpène oxydable : forme des hydroperoxydes allergisants à l'air. Antioxydant obligatoire (BHT ou tocophérol). Contribue au total de Limonene"),
    "Cumule benzyl benzoate (Cat.4 = 26.7%), benzyl cinnamate (2.1%), alcool benzylique (2.7%). Surveiller cumul dans formule": (
        True, "Cumule Benzyl Benzoate (Cat.4 = 26,7 %), Benzyl Cinnamate (2,1 %) et Benzyl Alcohol (2,7 %). Surveiller le cumul dans la formule"),
    "RECOMBI CRITIQUE : toute HE citronnée (bergamote 4–8%, citron, litsée, lemongrass) apporte du citral → dépassement quasi-certain de 0.6% Cat. 4": (
        True, "Recombinaison critique : toute HE citronnée (bergamote 4–8 %, citron, litsée, lemongrass) apporte du Citral → dépassement quasi certain de 0,6 % en Cat.4"),
    "ECOMBI CRITIQUE : Géraniol + acétate de géranyle (hydrolyse) + formiate de géranyle (hydrolyse) + HE riches en géraniol (palmarosa, rose, géranium) → cumul très fréquent > 1.8%": (
        True, "Recombinaison critique : Geraniol + acétate et formiate de géranyle (par hydrolyse) + HE riches en Geraniol (palmarosa, rose, géranium) → cumul très fréquent au-delà de 1,8 %"),
    "Camphre déclarable EU Reg. 2023/1545. Linalol déclarable. Spéc. IFRA linalol : antioxydant requis. Cumul linalol avec bergamote, patchouli, coriandre si co-formulation": (
        True, "Camphre et Linalool déclarables (règlement UE 2023/1545). Spécification IFRA du Linalool : antioxydant obligatoire. Cumul de Linalool avec bergamote, patchouli, coriandre"),
    "Contient thiols et pyrazines caractéristiques — pas d'allergènes EU majeurs mais restriction IFRA propre à respecter": (
        True, "Contient des thiols et pyrazines ; pas d'allergène UE majeur, mais restriction IFRA propre à respecter"),
    "Limite propre 0.60% Cat. 4 TRÈS BASSE + cumule 4-5 allergènes EU. Avec alcool benzylique ou eugénol déjà en formule → dépassement quasi-inévitable à dosage normal": (
        True, "Limite propre très basse (0,6 % en Cat.4) + 4 à 5 allergènes UE. Avec Benzyl Alcohol ou Eugenol déjà en formule : dépassement quasi inévitable à dosage normal"),
    "RECOMBI CRITIQUE : limite 0.1% très basse. Si treemoss aussi en formule → les deux s'additionnent contre la limite 0.1%. Pratiquement impossible de formuler un chypré classique sans dépasser cette limite": (
        True, "Recombinaison critique : limite très basse (0,1 %). Avec de la mousse d'arbre en formule, les deux s'additionnent sur cette limite : un chypre classique la dépasse presque toujours"),
    "RECOMBI CRITIQUE : limite 0.28% basse + cumul alcool benzylique et farnésol. Avec absolues florales → dépassement EU allergènes": (
        True, "Recombinaison critique : limite basse (0,28 %) + cumul de Benzyl Alcohol et Farnesol. Avec des absolues florales : dépassement des seuils allergènes UE"),
    "RECOMBI CRITIQUE MULTIPLE : limite propre 0.60% Cat.4. Cumule géraniol + citronellol + eugénol + farnésol + méthyl eugénol. Même CAS que rose bulgare. Teneur méthyl eugénol à vérifier COA vs limite 0.01%": (
        True, "Recombinaison critique multiple : limite propre 0,6 % en Cat.4. Cumule Geraniol, Citronellol, Eugenol, Farnesol, Methyl Eugenol. Même CAS que la rose de Bulgarie. Vérifier la teneur en Methyl Eugenol sur le COA (limite 0,01 %)"),
    "Phototoxicité + sensibilisation. Limite basse. Standard révisé Amend. 51. Utiliser avec précaution": (
        True, "Phototoxicité + sensibilisation, limite basse (standard révisé, amendement 51). À utiliser avec précaution"),
    "With Cedrol, Cedrene": (True, "Avec Cedrol, Cedrene"),
    "With Caryophyllene, Limonene": (True, "Avec caryophyllène, Limonene"),
    "Hydrolyse → géraniol libre ; cumul avec géraniol dans formule à surveiller (limite géraniol Cat. 4 = 1.8%)": (
        True, "Hydrolyse → Geraniol libre : surveiller le cumul avec le Geraniol de la formule (limite Cat.4 = 1,8 %)"),
    "cumulative with linalool": (True, "Cumul avec le Linalool"),
    "Précurseur du p-crésol (prohibé). Vérifier pureté — teneur en p-crésol libre doit être inférieure aux spécifications IFRA. Cumul avec p-crésol si présence naturelle (ylang, narcisse)": (
        True, "Précurseur du p-crésol (interdit) : vérifier que la teneur en p-crésol libre respecte la spécification IFRA. Cumul avec le p-crésol naturel (ylang, narcisse)"),
    "Hydrolyse partielle → pipéronal (héliotropine) restreint IFRA (1.8% Cat.4) et EU allergène déclarable": (
        True, "Hydrolyse partielle → pipéronal (héliotropine), restreint IFRA (1,8 % en Cat.4) et allergène UE déclarable"),
    "Terpineol, Linalool": (True, "Avec Terpineol, Linalool"),
    "With other aromatic ketones (e.g. methyl acetophenone)": (True, "Avec d'autres cétones aromatiques (ex. méthylacétophénone)"),
    "Limite basse 0.17% Cat.4. Précurseur des alcool et aldéhyde cinnamiques (tous restreints IFRA). Présent naturellement dans le styrax, le benjoin, la cannelle — cumul fréquent": (
        True, "Limite basse (0,17 % en Cat.4). Précurseur de Cinnamyl Alcohol et Cinnamal (restreints IFRA). Présent naturellement dans le styrax, le benjoin, la cannelle : cumul fréquent"),
    "Cumul cétones aromatiques (faible)": (True, "Faible cumul avec les cétones aromatiques"),
    "Limite basse 0.25% Cat.4. Présent dans HE cannelle feuille, styrax, pérou balsam → cumul fréquent": (
        True, "Limite basse (0,25 % en Cat.4). Présent dans l'HE de feuille de cannelle, le styrax, le baume du Pérou : cumul fréquent"),
    "With C8, C9, C10 aldehydes + Citral": (True, "Avec aldéhydes C8, C9, C10 et Citral"),
    "With C9, C10, C11 aldehydes + Citral": (True, "Avec aldéhydes C9, C10, C11 et Citral"),
    "With Phenylacetaldehyde, Cinnamic aldehyde": (True, "Avec Phenylacetaldehyde, Cinnamal"),
    "cumulative rose-ketone family": (True, "Cumul avec la famille des cétones de rose"),
    "With Citral, Limonene, Linalool, C8–C11 aldehydes": (True, "Avec Citral, Limonene, Linalool et aldéhydes C8–C11"),
    "With Citral, C8–C11 aldehydes": (True, "Avec Citral et aldéhydes C8–C11"),
    "Avec amines → instable (schiff base)": (True, "Instable avec les amines (formation de bases de Schiff)"),
    "Teneur élevée en β-caryophyllène → déclarable si ≥ 0.001% produit fini (règlement EU 2023/1545, en vigueur juillet 2026). Calculer la contribution": (
        True, "Teneur élevée en β-caryophyllène : déclarable si ≥ 0,001 % dans le produit fini (règlement UE 2023/1545, en vigueur en juillet 2026). Calculer la contribution"),
    "RECOMBI CRITIQUE : version déterpénée concentre l'eugénol. À 4% en formule ≈ 2.6-2.8% eugénol → au-delà de la limite 2.5%. Contient estragole (chavicol) avec limite Cat. 4 très basse Amend. 51 → double contrainte eugénol + estragole": (
        True, "Recombinaison critique : la version déterpénée concentre l'Eugenol. À 4 % en formule ≈ 2,6–2,8 % d'Eugenol, au-delà de la limite de 2,5 %. Contient aussi de l'Estragole (chavicol, limite Cat.4 très basse) : double contrainte"),
    "cumulative with other terpene oils": (True, "Cumul avec les autres huiles riches en terpènes"),
    "cumulative with citrus oils and terpene-rich essential oils": (True, "Cumul avec les huiles d'agrumes et les HE riches en terpènes"),
    "terpene allergen accumulation": (True, "Cumul d'allergènes terpéniques"),
    "Avoid combining with citrus oils rich in limonene (orange, lemon)": (True, "Éviter l'association avec les agrumes riches en Limonene (orange, citron)"),
    "Présent naturellement dans lavande, lavandin, mélilot, fève tonka → cumul fréquent avec HE lavandacées. Vérifier teneur sur COA des naturels co-formulés": (
        True, "Présent naturellement dans la lavande, le lavandin, le mélilot, la fève tonka : cumul fréquent avec les HE de lavande. Vérifier la teneur sur le COA des naturels associés"),
    "sum with α-, β-damascone (rose ketones)": (True, "S'additionne avec l'α- et la β-damascone (cétones de rose)"),
    "With eugenol & isoeugenol": (True, "Avec Eugenol et Isoeugenol"),
    "PHOTOTOXIQUE si non FCF. Riche en linalol, limonène, acétate de linalyle → cumul EU allergènes. Vérifier si FCF ou exprimé brut": (
        True, "Phototoxique si non FCF. Riche en Linalool, Limonene, acétate de linalyle : cumul d'allergènes UE. Vérifier s'il s'agit d'une qualité FCF ou exprimée brute"),
    "Contient alpha-pinène (oxydable) + limonène (EU étendu 2023). Antioxydanter": (
        True, "Contient de l'alpha-pinène (oxydable) et du Limonene (liste UE étendue 2023). Ajouter un antioxydant"),
    "Hautement oxydable → hydroperoxydes allergisants (sensitiseur puissant à l'état oxydé). Utiliser impérativement avec antioxydant (BHT/tocophérol). Stocker sous azote": (
        True, "Très oxydable → hydroperoxydes allergisants (sensibilisant puissant une fois oxydé). Antioxydant obligatoire (BHT ou tocophérol). Stocker sous azote"),
    "RECOMBI CRITIQUE : géraniol + citronellol simultanément. Avec palmarosa, rose bulgare, géraniol Extra → dépassement systématique limite géraniol 1.8%. Formiate citronellyle hydrolyse → citronellol supplémentaire": (
        True, "Recombinaison critique : Geraniol et Citronellol à la fois. Avec palmarosa, rose de Bulgarie, Geraniol Extra : dépassement systématique de la limite Geraniol (1,8 %). Le formiate de citronellyle s'hydrolyse en Citronellol supplémentaire"),
    "Avec Fl. Oranger : (Case B)": (True, "Avec la fleur d'oranger (cas B)"),
    "Avec Ylang : (Case C)": (True, "Avec l'ylang (cas C)"),
    "Avec Sal. Benzyle : (Case C)": (True, "Avec le Benzyl Salicylate (cas C)"),
    "Monitor cumulative exposure with geraniol/citronellol oils": (True, "Surveiller le cumul avec les huiles riches en Geraniol et Citronellol"),
    "Alpha-pinène oxydable → hydroperoxydes. Antioxydanter. Contribue au cumul limonène EU (EU étendu 2023)": (
        True, "Alpha-pinène oxydable → hydroperoxydes. Ajouter un antioxydant. Contribue au cumul de Limonene (liste UE étendue 2023)"),
    "Hydrolyse possible → alcool benzylique (sensibilisant ; limite Cat. 4 = 2.7%) – surveiller proportion": (
        True, "Hydrolyse possible → Benzyl Alcohol (sensibilisant, limite Cat.4 = 2,7 %) : surveiller la proportion"),
    "Hydrolyse possible → alcool benzylique (limite Cat. 4 = 2.7%) – surveiller cumul": (
        True, "Hydrolyse possible → Benzyl Alcohol (limite Cat.4 = 2,7 %) : surveiller le cumul"),
    "Hydrolyse partielle → citronellol ; cumul avec citronellol libre à vérifier": (
        True, "Hydrolyse partielle → Citronellol : vérifier le cumul avec le Citronellol libre"),
    "Terpènes oxydables (alpha-pinène, beta-pinène) → hydroperoxydes. Antioxydanter. Contribue au cumul limonène": (
        True, "Terpènes oxydables (alpha- et bêta-pinène) → hydroperoxydes. Ajouter un antioxydant. Contribue au cumul de Limonene"),
    "Limite IFRA porte sur TOUS les isomères de méthyl ionone (α, β, γ) cumulés → surveiller si plusieurs utilisés": (
        True, "La limite IFRA porte sur tous les isomères de méthylionone (α, β, γ) cumulés : surveiller si plusieurs sont utilisés"),
    "Avec chaleur = toxicité": (True, "Toxique à la chaleur"),
    "Chauffe = dégradation": (True, "Se dégrade à la chaleur"),
    "Avec épices = irritation": (True, "Irritant en association avec les épices"),
    "PROHIBÉ (non rectifié). Contient HAP (hydrocarbures aromatiques polycycliques) → carcinogènes potentiels. Usage restreint au birch tar rectifié selon spécification IFRA": (
        True, "Interdit sous forme non rectifiée : contient des HAP (cancérogènes potentiels). Seul le goudron de bouleau rectifié est utilisable, selon la spécification IFRA"),
    "Cumul hydrocarbures aromatiques (PAH)": (True, "Cumul d'hydrocarbures aromatiques polycycliques (HAP)"),
    "Très toxique": (True, "Très toxique"),
    "Cumul furocoumarines (avec agrumes)": (True, "Cumul de furocoumarines (avec les agrumes)"),
    "With Citral, Geraniol, citronellol": (True, "Avec Citral, Geraniol, Citronellol"),
    "With Linalool, Geraniol, Citronellol": (True, "Avec Linalool, Geraniol, Citronellol"),
    "Cumul eugenol (avec cannelle, baie)": (True, "Cumul d'Eugenol (avec cannelle, baies)"),
    "With Spearmint / Mentha oils": (True, "Avec les huiles de menthe verte et de menthe"),
    "With Menthe pouliot / pennyroyal oils": (True, "Avec les huiles de menthe pouliot"),
    "RECOMBI CRITIQUE : palmarosa = source n°1 de géraniol. À 2% elle occupe ~94% du quota disponible. Avec rose bulgare, géraniol Extra, acétate géranyle, HE géranium → dépassement systématique de 1.8%": (
        True, "Recombinaison critique : la palmarosa est la première source de Geraniol ; à 2 % elle occupe ~94 % du quota. Avec rose de Bulgarie, Geraniol Extra, acétate de géranyle, HE de géranium : dépassement systématique de 1,8 %"),
    "Cumul linalool / linalyl acetate": (True, "Cumul Linalool / acétate de linalyle"),
    "Schiff base concern : en présence d'amines, formation de bases de Schiff → contribution cumulative sur la limite Hélional": (
        True, "Avec des amines, formation de bases de Schiff : contribution cumulée sur la limite de l'Hélional"),
    "additive floral aldehyde sensitizers / forms schiff base combined with methyl anthranylate": (
        True, "S'additionne aux aldéhydes floraux sensibilisants ; forme une base de Schiff avec le Methyl Anthranilate"),
    "With other quinolines / nitrogen aromatics": (True, "Avec les autres quinoléines et composés aromatiques azotés"),
    "Cumul eugenol/isoeugenol = dépassement rapide": (True, "Cumul Eugenol / Isoeugenol : dépassement rapide"),
    "Linalol déclarable EU Reg. 2023/1545 si ≥ 0.001% leave-on (applicable juillet 2026). Spéc. IFRA obligatoire (antioxydant). Cumul avec HE lavande, bergamote, coriandre, patchouli, HE coriandre graine": (
        True, "Linalool déclarable (règlement UE 2023/1545, applicable en juillet 2026) si ≥ 0,001 % sans rinçage. Spécification IFRA obligatoire (antioxydant). Cumul avec les HE de lavande, bergamote, coriandre (graines), patchouli"),
    "With unsaturated lipids": (True, "Avec les lipides insaturés"),
    "Peut libérer du p-crésol par hydrolyse (prohibé à 0.005% Cat.4). Vérifier teneur en p-crésol libre sur COA. Nommer correctement : methyl p-cresol ≠ methyl paracresol (isomère)": (
        True, "Peut libérer du p-crésol par hydrolyse (interdit au-delà de 0,005 % en Cat.4). Vérifier la teneur en p-crésol libre sur le COA. Attention au nom : méthyl p-crésol ≠ méthyl paracrésol (isomère)"),
    "Riche en linalol + géraniol → double cumul EU allergènes. Linalol déclarable + géraniol déclarable si ≥ 0.001%. Cumul avec palmarosa, géraniol Extra": (
        True, "Riche en Linalool et Geraniol, tous deux déclarables si ≥ 0,001 % : double cumul d'allergènes UE. Cumul avec palmarosa, Geraniol Extra"),
    "cumulative phenols": (True, "Cumul de phénols"),
    "RECOMBI CRITIQUE MULTIPLE : limite propre 0.60% Cat. 4 + cumule géraniol (~15%), citronellol (~35%), eugénol, farnésol, méthyl eugénol. Seule à 5-6% elle épuise le quota géraniol 1.8%. Combinée avec palmarosa, géraniol Extra, acétate géranyle → dépassement systématique. Vérifier teneur méthyl eugénol sur COA vs limite 0.01%": (
        True, "Recombinaison critique multiple : limite propre 0,6 % en Cat.4 + Geraniol (~15 %), Citronellol (~35 %), Eugenol, Farnesol, Methyl Eugenol. À 5–6 % elle épuise seule le quota de Geraniol (1,8 %) ; avec palmarosa, Geraniol Extra, acétate de géranyle : dépassement systématique. Vérifier la teneur en Methyl Eugenol sur le COA (limite 0,01 %)"),
    "RECOMBI CRITIQUE : contient cinnamaldéhyde (limite Cat.4 extrêmement basse = 0.05%) + alcool cinnamique (0.25%) + eugénol. Avec cannelle, épices → cumul systématique": (
        True, "Recombinaison critique : contient du Cinnamal (limite Cat.4 très basse, 0,05 %), du Cinnamyl Alcohol (0,25 %) et de l'Eugenol. Avec cannelle et épices : cumul systématique"),
    "sum with dimethylcyclohexenecarbaldehyde isomers": (True, "S'additionne avec les isomères du diméthylcyclohexènecarbaldéhyde"),
    "Très présente dans fèves tonka (coumarine+vanilline), styrax, benjoin, bois de santal, extractifs vanille → cumul fréquent en parfumerie orientale. Calculer contribution totale": (
        True, "Très présente dans la fève tonka (Coumarin + vanilline), le styrax, le benjoin, le santal, les extraits de vanille : cumul fréquent en parfumerie orientale. Calculer la contribution totale"),
    "Précurseur structurel de l'eugénol — surveiller cumul avec eugénol si HE de girofle ou bois de gaïac co-formulés": (
        True, "Précurseur structurel de l'Eugenol : surveiller le cumul avec l'Eugenol si de l'HE de girofle ou du bois de gaïac sont présents"),
})


# ---------------------------------------------------------------------------
# Fiche labo
# ---------------------------------------------------------------------------
FLAVOR_TYPO_FIXES = [
    ("citonellyl", "citronellyle"),
    ("acetate de citronellyle", "acétate de citronellyle"),
    ("citornellol", "citronellol"),
    ("methylehexanal", "méthylhexanal"),
    ("methyleheptanal", "méthylheptanal"),
    ("2methylnonanal", "2-méthylnonanal"),
    ("2methyloctanal", "2-méthyloctanal"),
    ("pésence", "présence"),
    ("présence de acétate", "présence d'acétate"),
    ("présence de heptanol", "présence d'heptanol"),
    ("terpenoide", "terpénoïde"),
    ("geraniol", "géraniol"),
]
# Messages collés par erreur dans la colonne flavor.
FLAVOR_GARBAGE = {key("Ah oui super merci")}

FLAVOR_RESTRICTION = table({
    "Methyl eugenol": "Methyl Eugenol",
    "Risque methyl eugenol": "Methyl Eugenol (risque)",
    "Coumarine": "Coumarin",
    "Methyl eugenol / Safrole": "Methyl Eugenol, Safrole",
    "Methyl eugenol / safrole": "Methyl Eugenol, Safrole",
    "Safrole / methyl eugenol": "Methyl Eugenol, Safrole",
    "Risque safrol / Methyl eugenol": "Methyl Eugenol, Safrole (risque)",
    "Risque methyl eugenol / safrol": "Methyl Eugenol, Safrole (risque)",
    "Risque estragol": "Estragole (risque)",
    "Estragol": "Estragole",
    "Thuyone": "Thujone",
    "Peroxyde, Methyl-Eugenol": "Methyl Eugenol, peroxydes",
})
