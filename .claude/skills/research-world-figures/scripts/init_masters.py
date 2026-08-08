#!/usr/bin/env python3
"""Create the master CSVs and the source manifest, or repair existing ones.

Fixed-roster entity types (countries, states): safe to re-run. Existing topic
columns and values are preserved. Rows that drifted (renamed, reordered,
deleted) are restored to the canonical set, and any row keys found in the
master but not in the canonical list are reported rather than silently
dropped.

Open-roster entity types (banks, companies, ...): there's no canonical set to
restore -- this just makes sure the master file exists (creating an empty one
if needed) and otherwise leaves it untouched.

    python3 scripts/init_masters.py
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pwf_lib import (DEFAULT_DATA_DIR, ENTITY_TYPES, MANIFEST_COLUMNS,
                     load_canonical, manifest_path, master_path, read_csv,
                     read_master_csv, write_csv, write_master_csv)


def init_fixed(data_dir, scope, verbose=True):
    cfg = ENTITY_TYPES[scope]
    key_col, name_col = cfg["key_col"], cfg["name_col"]
    base_cols = [key_col, name_col] + cfg["extra_cols"]
    path = master_path(data_dir, scope)

    existing, existing_cols = {}, []
    if os.path.exists(path):
        existing_cols, rows = read_master_csv(path, key_col)
        for r in rows:
            existing[r.get(key_col, "")] = r

    topic_cols = [c for c in existing_cols if c not in base_cols]
    out = []
    for c in load_canonical(scope):
        row = {key_col: c[key_col], name_col: c[name_col]}
        for col in cfg["extra_cols"]:
            row[col] = c.get(col, "")
        prev = existing.get(c[key_col], {})
        for t in topic_cols:
            row[t] = prev.get(t, "")
        out.append(row)

    orphans = sorted(set(existing) - {r[key_col] for r in out} - {""})
    write_master_csv(path, base_cols + topic_cols, out, key_col)
    if verbose:
        print("%-10s %s  rows=%d topics=%d" % (scope, path, len(out), len(topic_cols)))
        if orphans:
            print("  ! row keys in the old file that are not canonical (values dropped): %s"
                  % ", ".join(orphans))
    return len(out)


def init_open(data_dir, scope, verbose=True):
    cfg = ENTITY_TYPES[scope]
    key_col = cfg["key_col"]
    path = master_path(data_dir, scope)

    if os.path.exists(path):
        cols, rows = read_master_csv(path, key_col)
    else:
        cols, rows = [key_col, cfg["name_col"]] + cfg["extra_cols"], []
        write_master_csv(path, cols, rows, key_col)

    if verbose:
        base = [key_col, cfg["name_col"]] + cfg["extra_cols"]
        topics = [c for c in cols if c not in base]
        print("%-10s %s  rows=%d topics=%d (open roster -- untouched)"
              % (scope, path, len(rows), len(topics)))
    return len(rows)


def init_scope(data_dir, scope, verbose=True):
    if ENTITY_TYPES[scope]["roster"] == "fixed":
        return init_fixed(data_dir, scope, verbose)
    return init_open(data_dir, scope, verbose)


def init_manifest(data_dir, verbose=True):
    path = manifest_path(data_dir)
    rows = read_csv(path) if os.path.exists(path) else []
    write_csv(path, MANIFEST_COLUMNS, rows)
    if verbose:
        print("%-10s %s  entries=%d" % ("manifest", path, len(rows)))


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data-dir", default=DEFAULT_DATA_DIR,
                    help="defaults to this checkout's own data/ dir, resolved "
                         "from this script's file location, not cwd")
    ap.add_argument("--entity-type", choices=list(ENTITY_TYPES) + ["all"], default="all")
    args = ap.parse_args()

    os.makedirs(args.data_dir, exist_ok=True)
    scopes = list(ENTITY_TYPES) if args.entity_type == "all" else [args.entity_type]
    for s in scopes:
        init_scope(args.data_dir, s)
    init_manifest(args.data_dir)


if __name__ == "__main__":
    main()
