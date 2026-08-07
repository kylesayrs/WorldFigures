#!/usr/bin/env python3
"""Create the master CSVs and the source manifest, or repair existing ones.

Safe to re-run: existing topic columns and values are preserved. Rows that
drifted (renamed, reordered, deleted) are restored to the canonical set, and
any row keys found in the master but not in the canonical list are reported
rather than silently dropped.

    python3 scripts/init_masters.py --data-dir data
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pwf_lib import (MANIFEST_COLUMNS, SCOPES, load_canonical, manifest_path,
                     master_path, read_csv, read_master_csv, write_csv,
                     write_master_csv)


def init_scope(data_dir, scope, verbose=True):
    cfg = SCOPES[scope]
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


def init_manifest(data_dir, verbose=True):
    path = manifest_path(data_dir)
    rows = read_csv(path) if os.path.exists(path) else []
    write_csv(path, MANIFEST_COLUMNS, rows)
    if verbose:
        print("%-10s %s  entries=%d" % ("manifest", path, len(rows)))


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data-dir", default="data")
    ap.add_argument("--scope", choices=list(SCOPES) + ["all"], default="all")
    args = ap.parse_args()

    os.makedirs(args.data_dir, exist_ok=True)
    scopes = list(SCOPES) if args.scope == "all" else [args.scope]
    for s in scopes:
        init_scope(args.data_dir, s)
    init_manifest(args.data_dir)


if __name__ == "__main__":
    main()
