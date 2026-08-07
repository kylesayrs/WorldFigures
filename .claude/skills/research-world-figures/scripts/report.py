#!/usr/bin/env python3
"""Show what's in the masters and where the holes are.

    python3 scripts/report.py --data-dir data
    python3 scripts/report.py --data-dir data --topic gdp_usd

Flags three things worth catching before the book goes anywhere: topic columns
with no manifest entry (unciteable), manifest entries with no column (stale),
and (fixed-roster entity types only) rows that are empty across the board --
usually a matching failure, not a world in which micro-states have no data at
all. Open-roster entity types (banks, companies, ...) don't have a fixed
denominator, so their topics are reported as entity counts rather than
N/total percentages.
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pwf_lib import ENTITY_TYPES, load_master, manifest_path, read_csv


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data-dir", default="data")
    ap.add_argument("--entity-type", dest="scope",
                    choices=list(ENTITY_TYPES) + ["all"], default="all")
    ap.add_argument("--topic", help="list the blank rows for one topic")
    args = ap.parse_args()

    mpath = manifest_path(args.data_dir)
    manifest = read_csv(mpath) if os.path.exists(mpath) else []
    scopes = list(ENTITY_TYPES) if args.scope == "all" else [args.scope]

    for scope in scopes:
        cfg = ENTITY_TYPES[scope]
        roster = cfg["roster"]
        base = [cfg["key_col"], cfg["name_col"]] + cfg["extra_cols"]
        cols, rows = load_master(args.data_dir, scope)
        topics = [c for c in cols if c not in base]
        documented = {e["topic_slug"] for e in manifest if e.get("entity_type") == scope}

        print("== %s: %d rows, %d topics%s" % (
            scope, len(rows), len(topics), "" if roster == "fixed" else " (open roster)"))
        for t in topics:
            filled = sum(1 for r in rows if (r.get(t) or "").strip())
            mark = " " if t in documented else "!"
            if roster == "fixed":
                print("  %s %-34s %3d/%-3d (%3.0f%%)" % (mark, t, filled, len(rows),
                                                         100.0 * filled / len(rows)))
            else:
                print("  %s %-34s %3d value(s)" % (mark, t, filled))
            if args.topic == t:
                blanks = [r[cfg["name_col"]] for r in rows if not (r.get(t) or "").strip()]
                if blanks and roster == "fixed":
                    print("      blank: %s" % ", ".join(blanks))

        undocumented = [t for t in topics if t not in documented]
        stale = sorted(documented - set(topics))
        if undocumented:
            print("  ! no manifest entry (add one before using in the book): %s"
                  % ", ".join(undocumented))
        if stale:
            print("  ! manifest entry with no column: %s" % ", ".join(stale))

        if roster == "fixed":
            empties = [r[cfg["name_col"]] for r in rows
                       if topics and not any((r.get(t) or "").strip() for t in topics)]
            if empties and len(topics) >= 3:
                print("  ! rows blank on every topic (check name matching): %s"
                      % ", ".join(empties))


if __name__ == "__main__":
    main()
