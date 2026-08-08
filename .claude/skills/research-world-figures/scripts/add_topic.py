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
      --source-url "https://data.worldbank.org/indicator/NY.GDP.MKTP.CD" \\
      --notes "API: https://api.worldbank.org/v2/country/all/indicator/NY.GDP.MKTP.CD?format=json" \\
      --publisher "World Bank" --published 2026-07-01 --data-date 2025-12-31

Fixed-roster entity types (countries, states): nothing is written unless every
input label either resolves to a canonical row, is a recognized aggregate, or
is explicitly dropped with --drop. That check is the point of the script: an
unresolved label usually means a real country is about to go missing.

Open-roster entity types (banks, companies, ...): there's no canonical row set
to check against, so an input label that doesn't match an entity already in
the master is added as a new row instead of being reported as unmatched.

--data-date (or the values a --date-col resolves to) must fall within the
window from today's year minus 4 through today's year (inclusive). Give the
most precise date the source states (YYYY-MM-DD, YYYY-MM, or bare YYYY). A
--date-col value is checked per row, not just at the column's newest value:
any individual row older than that floor is flagged even if other rows are
current. A column or row outside the window is rejected unless you pass
--allow-stale-year, which requires an explanation in --notes.

When --date-col is given, the manifest's recorded date is always the span of
the actual per-row years -- a single year (e.g. "2024") if every row agrees,
or a "YYYY-YYYY" range (e.g. "2000-2024") if they don't -- overriding
whatever --data-date was passed. Without --date-col, --data-date is recorded
as given (a single value or a hand-typed range).
"""

import argparse
import csv
import datetime
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pwf_lib import (DEFAULT_DATA_DIR, ENTITY_TYPES, MANIFEST_COLUMNS,
                     Resolver, clean_number, die, load_master, manifest_path,
                     master_path, read_csv, write_csv, write_master_csv)

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
    ap.add_argument("--data-dir", default=DEFAULT_DATA_DIR,
                    help="defaults to this checkout's own data/ dir, resolved "
                         "from this script's file location, not cwd")

    ap.add_argument("--title", required=True, help="human-readable topic name")
    ap.add_argument("--unit", default="", help='e.g. "current US$", "minutes", "per 100,000"')
    ap.add_argument("--value-type", default="number",
                    choices=["number", "rate", "percent", "index", "rank", "text"])
    ap.add_argument("--source-name", required=True, help="dataset name + series/table ID")
    ap.add_argument("--source-url", required=True,
                    help="a page a human reader can open -- the series' own "
                         "documentation/landing page if the source has one, "
                         "not a raw API query URL (put that in --notes instead)")
    ap.add_argument("--publisher", required=True, help="BLS, World Bank, Our World in Data ...")
    ap.add_argument("--published", default="", help="when the source published this release")
    ap.add_argument("--data-date", default="",
                    help="date the values refer to -- YYYY-MM-DD, YYYY-MM, or "
                         "YYYY, as precise as the source states; the year must "
                         "fall within today's year minus 4 through today's "
                         "year unless --allow-stale-year is passed")
    ap.add_argument("--definition", default="", help="what exactly is counted")
    ap.add_argument("--notes", default="",
                    help="caveats a reader of the book would need; also where "
                         "the raw API query URL goes when --source-url is a "
                         "documentation page rather than the fetch URL itself")

    ap.add_argument("--map", action="append", metavar="LABEL=KEY",
                    help="resolve a stubborn label by hand, e.g. --map \"Turkiye=TUR\"")
    ap.add_argument("--drop", action="append", metavar="LABEL",
                    help="intentionally discard an input row")
    ap.add_argument("--force", action="store_true", help="overwrite an existing topic column")
    ap.add_argument("--dry-run", action="store_true", help="report only, write nothing")
    ap.add_argument("--allow-stale-year", action="store_true",
                    help="override the data vintage window, "
                         "for the column overall or for individual --date-col "
                         "rows older than that (explain why in --notes; the "
                         "override is recorded there too)")
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

    # ---- report (load early: the vintage check below needs names for its
    # per-row report) ----------------------------------------------------------
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

    # ---- data vintage -----------------------------------------------------
    # Rule: values must fall within today's year minus 4 through today's
    # year, inclusive -- not just "somewhere in the column is recent." When
    # --date-col gives a date per row, checking only the newest row (the old
    # rule) let individually ancient rows hide behind one fresh one; every
    # row is now checked against the same floor.
    row_years = {}
    if args.date_col:
        for key, d in dates.items():
            ys = [int(y) for y in re.findall(r"\d{4}", d)]
            if ys:
                row_years[key] = max(ys)

    # Per-row dates (--date-col) are the ground truth for vintage, so they
    # always take priority over a manually-typed --data-date: the recorded
    # date is the min-max span of the actual rows, not whatever the caller
    # guessed the column's overall date was.
    data_date = args.data_date
    if row_years:
        years = sorted(set(row_years.values()))
        data_date = str(years[0]) if len(years) == 1 else "%d-%d" % (years[0], years[-1])
    target_year = datetime.date.today().year
    floor_year = target_year - 4
    found_years = [int(y) for y in re.findall(r"\d{4}", data_date or "")]
    range_stale = (not found_years) or not (floor_year <= max(found_years) <= target_year)

    old_rows = sorted(((k, y) for k, y in row_years.items() if y < floor_year),
                       key=lambda kv: kv[1])

    stale = range_stale or bool(old_rows)
    if stale and args.allow_stale_year:
        parts = ["date=%s, expected %d-%d" % (data_date or "(none)", floor_year, target_year)]
        if old_rows:
            parts.append("%d row(s) older than %d" % (len(old_rows), floor_year))
        args.notes = (args.notes + " [vintage override: %s]" % "; ".join(parts)).strip()

    print("topic     : %s  (%s)" % (args.topic, args.scope))
    print("vintage   : date=%s, expected %d-%d%s" % (
        data_date or "(none)", floor_year, target_year,
        "" if not stale else (" -- OVERRIDDEN" if args.allow_stale_year else " -- REJECTED")))
    if old_rows:
        key_to_name = {r[key_col]: r[name_col] for r in master}
        for label, key in getattr(res, "created", []) or []:
            key_to_name.setdefault(key, label)
        shown = ", ".join("%s (%d)" % (key_to_name.get(k, k), y) for k, y in old_rows[:10]) + (
            ", ..." if len(old_rows) > 10 else "")
        print("old rows  : %d row(s) older than %d -- %s" % (len(old_rows), floor_year, shown))
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
        reason = ("outside the %d-%d window" % (floor_year, target_year) if range_stale
                  else "")
        if old_rows:
            reason = (reason + " and " if reason else "") + (
                "%d row(s) older than %d" % (len(old_rows), floor_year))
        print("\nVINTAGE REJECTED -- this book only takes data dated within "
              "%d-%d: %s. Find a source with more current values, or pass "
              "--allow-stale-year and explain why in --notes."
              % (floor_year, target_year, reason))
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
