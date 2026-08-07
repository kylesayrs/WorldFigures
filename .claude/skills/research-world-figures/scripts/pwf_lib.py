"""Shared helpers for the pocket-world-figures skill.

Everything here exists to protect one invariant: the master CSVs always contain
exactly the canonical rows, in a stable order, and a topic column is either
filled with a value that came from the cited source or left blank.
"""

import csv
import difflib
import os
import re
import sys
import unicodedata

SKILL_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# The skill lives at <project_root>/.claude/skills/<skill_name>/; the canonical
# country/state lists live in <project_root>/assets, alongside the rest of the
# project's data, not bundled inside the skill.
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(SKILL_DIR)))
ASSETS = os.path.join(PROJECT_ROOT, "assets")

SCOPES = {
    "countries": {
        "asset": "countries.csv",
        "key_col": "iso3",
        "name_col": "country",
        "master": "countries.csv",
        "extra_cols": ["iso2"],
    },
    "states": {
        "asset": "us_states.csv",
        "key_col": "state_code",
        "name_col": "state",
        "master": "us_states.csv",
        "extra_cols": ["fips"],
    },
}

MANIFEST = "sources_manifest.csv"

MANIFEST_COLUMNS = [
    "scope",
    "topic_slug",
    "title",
    "unit",
    "value_type",
    "data_year",
    "source_name",
    "source_url",
    "publisher",
    "published",
    "retrieved",
    "coverage_filled",
    "coverage_total",
    "definition",
    "notes",
]

# Labels that regularly appear in source files but are not rows in our books.
# Matching one of these is a normal, expected drop -- not an error worth stopping for.
AGGREGATE_PATTERNS = [
    r"^world$", r"^total$", r"^all countries$", r"^global$",
    r"income$", r"^income", r"oecd", r"european union", r"^euro area$", r"^eu\b",
    r"^africa", r"^asia", r"^europe$", r"^oceania$", r"^americas$", r"^north america$",
    r"^latin america", r"^south asia$", r"^middle east", r"^sub-saharan",
    r"^east asia", r"^central asia", r"^caribbean", r"^pacific",
    r"aggregate", r"^arab world$", r"^small states$", r"demographic dividend",
    r"^fragile and conflict", r"^heavily indebted", r"^ida\b", r"^ibrd\b",
    r"^least developed", r"^landlocked", r"^small island",
    # In the states scope a national total row shows up as "United States"; in the
    # countries scope the name resolves to USA before this list is consulted.
    r"^united states$", r"^u ?s total$", r"^u ?s ?a? territories$",
]

# Real places that are simply not rows in these books (dependencies, autonomous
# territories, partially recognized states). Dropping them is routine, so they
# are reported rather than treated as a matching failure.
TERRITORY_PATTERNS = [
    r"^hong kong", r"^macao", r"^macau", r"^puerto rico", r"^guam$", r"^greenland$",
    r"^new caledonia$", r"^french polynesia$", r"^bermuda$", r"^cayman", r"^aruba$",
    r"^curacao$", r"^sint maarten", r"^saint martin$", r"^saint barthelemy$",
    r"^bonaire", r"^faroe", r"^gibraltar$", r"^isle of man$", r"^jersey$",
    r"^guernsey$", r"^channel islands$", r"virgin islands", r"^american samoa$",
    r"^northern mariana", r"^cook islands$", r"^niue$", r"^tokelau$",
    r"^turks and caicos", r"^anguilla$", r"^montserrat$", r"^falkland",
    r"^western sahara$", r"^reunion$", r"^mayotte$", r"^martinique$",
    r"^guadeloupe$", r"^french guiana$", r"^svalbard", r"^wallis", r"^saint pierre",
    r"^saint helena", r"^antarctica$", r"^aland", r"^norfolk island$",
    r"^christmas island$", r"^cocos", r"^pitcairn$", r"^british indian ocean",
    r"^northern cyprus", r"^somaliland$", r"^abkhazia$", r"^south ossetia$",
    r"^transnistria$", r"^south georgia", r"^bouvet", r"^heard",
]


def norm(s):
    """Normalize a place name for matching: case, accents, punctuation, articles."""
    s = unicodedata.normalize("NFKD", str(s))
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower().strip()
    s = s.replace("&", " and ")
    s = re.sub(r"\bst\.?\b", "saint", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    s = re.sub(r"\bthe\b", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def read_csv(path):
    with open(path, newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def write_csv(path, fieldnames, rows):
    """Write atomically so an interrupted run can't leave a truncated master."""
    tmp = path + ".tmp"
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(tmp, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, lineterminator="\n",
                           extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in fieldnames})
    os.replace(tmp, path)


def load_canonical(scope):
    cfg = SCOPES[scope]
    rows = read_csv(os.path.join(ASSETS, cfg["asset"]))
    for r in rows:
        r["_aliases"] = [a for a in (r.get("aliases") or "").split("|") if a]
    return rows


def build_index(scope):
    """Map every normalized name/code/alias to a canonical key."""
    cfg = SCOPES[scope]
    idx = {}

    def put(text, key):
        n = norm(text)
        if n and n not in idx:
            idx[n] = key

    for r in load_canonical(scope):
        key = r[cfg["key_col"]]
        put(key, key)
        put(r[cfg["name_col"]], key)
        for col in cfg["extra_cols"]:
            if r.get(col):
                put(r[col], key)
        for a in r["_aliases"]:
            put(a, key)
    return idx


def non_row_reason(label):
    """Why this label is legitimately not a row, or None if it should have matched."""
    n = norm(label)
    if any(re.search(p, n) for p in AGGREGATE_PATTERNS):
        return "aggregate/total"
    if any(re.search(p, n) for p in TERRITORY_PATTERNS):
        return "territory/not a row"
    return None


class Resolver:
    """Resolves source-provided labels to canonical keys.

    Exact and alias matches are silent. Close matches are accepted but reported,
    because a typo'd match is still worth a human glance. Anything else is
    returned unresolved rather than guessed -- a wrong country row is a much
    worse outcome than a blank one.
    """

    FUZZY_ACCEPT = 0.93
    FUZZY_SUGGEST = 0.80

    def __init__(self, scope, manual_map=None):
        self.scope = scope
        self.idx = build_index(scope)
        self.keys = set(self.idx.values())
        self.manual = {norm(k): v for k, v in (manual_map or {}).items()}
        self.fuzzy = []      # (source_label, matched_key, score)
        self.dropped = []    # (source_label, reason)

    def resolve(self, label):
        n = norm(label)
        if not n:
            return None
        if n in self.manual:
            return self.manual[n]
        if n in self.idx:
            return self.idx[n]
        reason = non_row_reason(label)
        if reason:
            self.dropped.append((label, reason))
            return None
        close = difflib.get_close_matches(n, list(self.idx), n=1,
                                          cutoff=self.FUZZY_ACCEPT)
        if close:
            key = self.idx[close[0]]
            score = difflib.SequenceMatcher(None, n, close[0]).ratio()
            self.fuzzy.append((label, key, round(score, 3)))
            return key
        return None

    def suggest(self, label):
        n = norm(label)
        out = []
        for cand in difflib.get_close_matches(n, list(self.idx), n=3,
                                              cutoff=self.FUZZY_SUGGEST):
            out.append(self.idx[cand])
        return out


NUM_STRIP = re.compile(r"[,$%\s\u00a0]")


def clean_number(raw):
    """Return a numeric string, or None if it isn't a number.

    Values are stored as given (no reformatting or rounding) so the master CSV
    keeps the source's precision; rounding is a typesetting decision, not a
    storage one.
    """
    if raw is None:
        return None
    s = str(raw).strip()
    if s == "" or s.lower() in {"na", "n/a", "nan", "null", "..", "...", "-", "—"}:
        return None
    s2 = NUM_STRIP.sub("", s)
    s2 = s2.replace("(", "-").replace(")", "")
    try:
        float(s2)
    except ValueError:
        return None
    return s2


def master_path(data_dir, scope):
    return os.path.join(data_dir, SCOPES[scope]["master"])


def manifest_path(data_dir):
    return os.path.join(data_dir, MANIFEST)


def load_master(data_dir, scope):
    path = master_path(data_dir, scope)
    if not os.path.exists(path):
        die("no master at %s -- run scripts/init_masters.py --data-dir %s first"
            % (path, data_dir))
    with open(path, newline="", encoding="utf-8-sig") as f:
        r = csv.DictReader(f)
        return list(r.fieldnames), list(r)


def die(msg):
    print("ERROR: " + msg, file=sys.stderr)
    sys.exit(1)
