#!/usr/bin/env python3
"""Merge a staged values file into a master CSV and record its provenance.

The staged file is whatever you extracted from the source: it needs a column of
place names (or ISO3 / postal codes) and a column of values. Everything else --
matching to canonical rows, leaving gaps blank, keeping column order stable --
happens here.

    python3 scripts/add_topic.py --entity-type countries --topic gdp_usd \\
      --input /tmp/pwf-staging/gdp.csv --key-col country --value-col value \\
      --title "GDP (current US$)" --unit "current US$" \\
      --source-name "World Bank WDI, NY.GDP.MKTP.CD" \\
      --source-url "https://api.worldbank.org/v2/..." \\
      --publisher "World Bank" --published 2026-07-01 --data-date 2025-12-31

Fixed-roster entity types (countries, states): nothing is written unless every
input label either resolves to a canonical row, is a recognized aggregate, or
is explicitly dropped with --drop. That check is the point of the script: an
unresolved label usually means a real country is about to go missing.

Open-roster entity types (banks, companies, ...): there's no canonical row set
to check against, so an input label that doesn't match an entity already in
the master is added as a new row instead of being reported as unmatched.

--data-date (or the values a --date-col resolves to) must be dated to last
calendar year -- today's year minus one. Give the most precise date the source
states (YYYY-MM-DD, YYYY-MM, or bare YYYY); a mismatched year is rejected
unless you pass --allow-stale-year, which requires an explanation in --notes.
"""

import argparse
import csv
import datetime
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pwf_lib import (ENTITY_TYPES, MANIFEST_COLUMNS, Resolver, clean_number,
                     die, load_master, manifest_path, master_path, read_csv,
                     write_csv, write_master_csv)

BASE = {s: [c["key_col"], c["name_col"]] + c["extra_cols"] for s, c in ENTITY_TYPES.items()}


def parse_pairs(items, sep="="):
    out = {}
    for it in items or []:
        if sep not in it:
            die("expected LABEL%sKEY, got %r" % (sep, it))
        k, v = it.split(sep, 1)
        out[k.strip()] = v.strip()
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--entity-type", dest="scope", required=True, choices=list(ENTITY_TYPES))
    ap.add_argument("--topic", required=True, help="column name, snake_case, no year")
    ap.add_argument("--input", required=True, help="staged CSV/TSV of values")
    ap.add_argument("--key-col", required=True, help="column holding place names or codes")
    ap.add_argument("--value-col", required=True)
    ap.add_argument("--date-col", help="optional per-row column giving the date "
                    "(or year) each value refers to")
    ap.add_argument("--data-dir", default="data")

    ap.add_argument("--title", required=True, help="human-readable topic name")
    ap.add_argument("--unit", default="", help='e.g. "current US$", "minutes", "per 100,000"')
    ap.add_argument("--value-type", default="number",
                    choices=["number", "rate", "percent", "index", "rank", "text"])
    ap.add_argument("--source-name", required=True, help="dataset name + series/table ID")
    ap.add_argument("--source-url", required=True)
    ap.add_argument("--publisher", required=True, help="BLS, World Bank, Our World in Data ...")
    ap.add_argument("--published", default="", help="when the source published this release")
    ap.add_argument("--data-date", default="",
                    help="date the values refer to -- YYYY-MM-DD, YYYY-MM, or "
                         "YYYY, as precise as the source states; the year must "
                         "be last calendar year unless --allow-stale-year is passed")
    ap.add_argument("--definition", default="", help="what exactly is counted")
    ap.add_argument("--notes", default="", help="caveats a reader of the book would need")

    ap.add_argument("--map", action="append", metavar="LABEL=KEY",
                    help="resolve a stubborn label by hand, e.g. --map \"Turkiye=TUR\"")
    ap.add_argument("--drop", action="append", metavar="LABEL",
                    help="intentionally discard an input row")
    ap.add_argument("--force", action="store_true", help="overwrite an existing topic column")
    ap.add_argument("--dry-run", action="store_true", help="report only, write nothing")
    ap.add_argument("--allow-stale-year", action="store_true",
                    help="override the previous-calendar-year data vintage rule "
                         "(explain why in --notes; the override is recorded there too)")
    ap.add_argument("--allow-unmatched", action="store_true",
                    help="write anyway, leaving unresolved labels out (use sparingly)")
    args = ap.parse_args()

    cfg = ENTITY_TYPES[args.scope]
    key_col, name_col = cfg["key_col"], cfg["name_col"]
    roster = cfg["roster"]
    if args.topic in BASE[args.scope]:
        die("topic %r collides with a reserved column" % args.topic)

    # ---- read staged values -------------------------------------------------
    delim = "\t" if args.input.endswith((".tsv", ".tab")) else ","
    with open(args.input, newline="", encoding="utf-8-sig") as f:
        staged = list(csv.DictReader(f, delimiter=delim))
    if not staged:
        die("%s has no rows" % args.input)
    for col in (args.key_col, args.value_col):
        if col not in staged[0]:
            die("column %r not in %s (has: %s)"
                % (col, args.input, ", ".join(staged[0])))

    dropset = {d.strip().lower() for d in (args.drop or [])}
    res = Resolver(args.scope, parse_pairs(args.map), data_dir=args.data_dir)

    values, dates, unmatched, unparsed, dupes = {}, {}, [], [], []
    for row in staged:
        label = (row.get(args.key_col) or "").strip()
        if not label or label.lower() in dropset:
            continue
        raw = row.get(args.value_col)
        val = raw if args.value_type == "text" else clean_number(raw)
        if val is None or str(val).strip() == "":
            if raw not in (None, "") and args.value_type != "text":
                unparsed.append((label, raw))
            continue
        key = res.resolve(label)
        if key is None:
            if not any(label == d[0] for d in res.dropped):
                unmatched.append(label)
            continue
        if key in values and str(values[key]) != str(val):
            dupes.append((label, key, values[key], val))
        values[key] = str(val).strip()
        if args.date_col and row.get(args.date_col):
            dates[key] = str(row[args.date_col]).strip()

    # ---- data vintage ---------------------------------------------------------
    # Rule: the book only takes sources dated to last calendar year (today's
    # year minus one). A stray current-year or older-vintage source is a much
    # easier mistake to make than it looks -- catch it before it's merged.
    data_date = args.data_date
    if not data_date and dates:
        ds = sorted({d for d in dates.values() if d})
        data_date = ds[0] if len(ds) == 1 else "%s-%s" % (ds[0], ds[-1])
    target_year = datetime.date.today().year - 1
    found_years = [int(y) for y in re.findall(r"\d{4}", data_date or "")]
    stale = (not found_years) or (max(found_years) != target_year)
    if stale and args.allow_stale_year:
        override_note = "[vintage override: date=%s, expected %d]" % (
            data_date or "(none)", target_year)
        args.notes = (args.notes + " " + override_note).strip()

    # ---- report -------------------------------------------------------------
    cols, master = load_master(args.data_dir, args.scope)
    if roster == "open":
        # An open master may not have a name/extra-col row yet (e.g. its very
        # first merge) -- make sure identity columns exist before any row
        # gets appended, or names silently never get written.
        identity_cols = [name_col] + cfg["extra_cols"]
        cols = [key_col] + identity_cols + [c for c in cols if c not in ([key_col] + identity_cols)]
    total = len(master)
    filled = sum(1 for r in master if r[key_col] in values)
    missing = [r[name_col] for r in master if r[key_col] not in values]

    print("topic     : %s  (%s)" % (args.topic, args.scope))
    print("vintage   : date=%s, expected %d%s" % (
        data_date or "(none)", target_year,
        "" if not stale else (" -- OVERRIDDEN" if args.allow_stale_year else " -- REJECTED")))
    if roster == "fixed":
        print("coverage  : %d/%d rows (%.0f%%)" % (
            filled, total, 100.0 * filled / total if total else 0.0))
    else:
        print("coverage  : %d value(s) -- %d new entit%s, %d matched an existing row"
              % (len(values), len(res.created), "y" if len(res.created) == 1 else "ies",
                 len(values) - len(res.created)))
        if res.created:
            shown = ", ".join(l for l, k in res.created[:15]) + (
                ", ..." if len(res.created) > 15 else "")
            print("new       : %s" % shown)
    if res.fuzzy:
        print("fuzzy     : %s" % "; ".join("%s -> %s (%.2f)" % f for f in res.fuzzy))
    if res.dropped:
        print("skipped   : %d input rows (%s%s)"
              % (len(res.dropped), ", ".join(d[0] for d in res.dropped[:6]),
                 ", ..." if len(res.dropped) > 6 else ""))
    if dupes:
        print("conflicts : %s" % "; ".join("%s->%s %s vs %s" % d for d in dupes))
    if unparsed:
        print("non-numeric: %d value(s) ignored, e.g. %s"
              % (len(unparsed), unparsed[:3]))
    if roster == "fixed" and missing:
        shown = ", ".join(missing[:15]) + (", ..." if len(missing) > 15 else "")
        print("blank     : %d rows -- %s" % (len(missing), shown))
    if unmatched:
        print("\nUNMATCHED input labels (%d) -- resolve before writing:" % len(unmatched))
        for lab in unmatched[:40]:
            sug = res.suggest(lab)
            print("  %-40s %s" % (lab, ("did you mean: " + ", ".join(sug)) if sug
                                  else "(no close canonical row)"))
        print("  Fix with --map \"LABEL=KEY\" (a real match) or --drop \"LABEL\" "
              "(not a row in this book).")
        if not args.allow_unmatched:
            sys.exit(2)

    if stale and not args.allow_stale_year:
        print("\nVINTAGE REJECTED -- this book only takes data dated to last "
              "calendar year (%d). Find a source with %d-dated values, or pass "
              "--allow-stale-year and explain why in --notes." % (target_year, target_year))
        sys.exit(2)

    if args.topic in cols and not args.force:
        die("topic column %r already exists -- pass --force to replace it" % args.topic)
    if args.dry_run:
        print("\n[dry run] nothing written")
        return

    # ---- write master -------------------------------------------------------
    if args.topic not in cols:
        cols = cols + [args.topic]
    if roster == "open" and res.created:
        # New entities discovered this run aren't in `master` yet -- append
        # them as new rows (open rosters grow, they're never reset).
        for label, key in res.created:
            master.append({key_col: key, name_col: label})
    for r in master:
        r[args.topic] = values.get(r[key_col], "")
    write_master_csv(master_path(args.data_dir, args.scope), cols, master, key_col)

    # ---- upsert manifest ----------------------------------------------------
    mpath = manifest_path(args.data_dir)
    entries = read_csv(mpath) if os.path.exists(mpath) else []
    entry = {
        "entity_type": args.scope, "topic_slug": args.topic, "title": args.title,
        "unit": args.unit, "value_type": args.value_type, "date": data_date,
        "source_name": args.source_name, "source_url": args.source_url,
        "publisher": args.publisher, "published": args.published,
        "retrieved": datetime.date.today().isoformat(),
        "coverage_filled": len(values) if roster == "open" else filled,
        "coverage_total": "" if roster == "open" else total,
        "definition": args.definition, "notes": args.notes,
    }
    entries = [e for e in entries
               if not (e.get("entity_type") == args.scope and e.get("topic_slug") == args.topic)]
    entries.append(entry)
    entries.sort(key=lambda e: (e.get("entity_type", ""), e.get("topic_slug", "")))
    write_csv(mpath, MANIFEST_COLUMNS, entries)

    print("\nwrote %s and %s" % (master_path(args.data_dir, args.scope), mpath))


if __name__ == "__main__":
    main()
