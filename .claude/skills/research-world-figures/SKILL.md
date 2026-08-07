---
name: research-world-figures
description: Research a statistic for every country or U.S. state and add it to the "pocket world figures" master CSVs. Use this whenever the user names a topic they want per-country or per-state numbers for -- GDP, life expectancy, silicon exports, average commute duration, prison population, anything of that shape -- or asks to find a dataset covering all countries/states, add a column to the world figures book, check coverage of an existing topic, or refresh a topic with newer data. Trigger it even when the request is phrased casually ("get me broadband speeds by country", "what's the commute time in each state") and even when the user doesn't mention the book, CSVs, or this skill by name.
---

# Pocket world figures

Build one column at a time in a book of per-country and per-state statistics. A
column is finished when every row either holds a number traceable to one cited
source or is deliberately blank, and the manifest records where that number came
from.

The failure mode this workflow guards against is a plausible-looking column
assembled from three different vintages of two different definitions, with a few
values filled in from memory. That column is worse than no column, because
nothing in the CSV shows it happened. Every rule below exists to make that
impossible.

## The loop

1. **Pin down the measure.** A topic name is not yet a measure. "GDP" could be
   nominal, PPP, per capita, or growth rate. "Commute duration" could be mean
   travel time for workers, median, or one-way vs round trip. Pick the version a
   general-reader reference book would print, note it, and say which one you
   picked in your final message. If genuinely ambiguous and the choice changes
   the story the number tells, ask.

   Superlative topics ("largest silicon exporter") are one measure in disguise:
   find per-country silicon exports and the superlative falls out of the column,
   which is more useful for the book than a single sentence.

2. **Find the source.** See "Choosing a source" below and
   `references/source-catalog.md` for vetted starting points by domain.

3. **Get the data as a file, not as prose.** Download the source's own CSV/JSON
   (bulk download, API, or data-explorer export). Transcribing numbers from an
   article, a Wikipedia table, or a PDF table by hand is where errors enter and
   where provenance quietly dies.

   If `curl`/`requests` are blocked by network restrictions, use `web_fetch` on
   the data URL — API endpoints returning CSV or JSON work fine — and write the
   response to a staging file.

4. **Stage it.** Write `staging/<topic_slug>.csv` with at minimum a place column
   and a value column; add a year column if the source's "latest available" year
   varies by country. Keep the source's own precision — no rounding.

5. **Merge it.**

   ```bash
   python3 scripts/init_masters.py --data-dir data      # first run only, safe to repeat
   python3 scripts/add_topic.py --scope countries --topic <slug> \
     --input staging/<slug>.csv --key-col country --value-col value \
     --title "..." --unit "..." --source-name "..." --source-url "..." \
     --publisher "..." --published YYYY-MM-DD --data-year YYYY \
     --definition "..." --dry-run
   ```

   `--dry-run` first, always. It prints coverage, fuzzy matches, skipped
   aggregates, every unresolved label, and a `vintage` line checking `--data-year`
   against last calendar year. Resolve unmatched labels (`--map "Label=ISO3"` for
   real matches, `--drop "Label"` for non-rows); if the vintage line says
   REJECTED, either find a source dated to last year or, for topics that
   genuinely don't refresh annually, re-run with `--allow-stale-year` and a
   `--notes` explanation. Then re-run without `--dry-run`.

6. **Open a PR.** Never commit a topic directly to `main`.

   - If the current branch is `main`, create and switch to `topic/<slug>`
     first; otherwise commit on the current branch.
   - Stage exactly what this run touched: the master file(s) you merged into
     (`data/countries.csv` and/or `data/us_states.csv`), `data/sources_manifest.csv`,
     and `staging/<slug>.csv`.
   - Commit (e.g. `Add <topic> column`), push with `-u origin <branch>`, and
     open the PR:

     ```bash
     gh pr create --base main --title "Add <topic> column" --body "$(cat <<'EOF'
     Measure: <what you picked, e.g. mean one-way commute time, workers 16+>
     Source: <publisher> — <source-name>, <source-url>
     Data year: <YYYY>  Coverage: <N>/197 (or /51)
     Notable gaps: <large places missing, or "none">
     EOF
     )"
     ```
   - If `gh pr create` fails because a PR already exists for the branch (a
     refresh of a topic you opened earlier), that's fine — note the existing
     PR URL instead of erroring out.

7. **Report back.** Tell the user the measure you chose, the source, the data
   year, coverage (`N/197` or `N/51`), which notable rows are blank, and the
   PR URL. If a large country is missing, say so plainly — that's the kind of
   gap a reader notices.

## Choosing a source

Prefer, in rough order:

1. **An official statistical body or a UN/IGO agency** — BLS, Census, BEA, Eurostat,
   World Bank, IMF, UN agencies, WHO, FAO, ITU, OECD.
2. **A curated aggregator that documents its upstream sources** — Our World in
   Data above all, which republishes agency data with the original citation and
   a stated download date.
3. **A well-documented academic or NGO dataset** with a methodology paper —
   V-Dem, IHME, Transparency International.

Judge candidates on four things:

- **Coverage.** Aim for all or nearly all rows. A source covering 40 countries
  isn't a world figure; keep looking. Below roughly half the rows, tell the user
  what you found and let them decide whether the column is worth having.
- **How many sources.** Default to one source per column; see "How many sources
  to accept" below for when a second, well-aligned source is allowed instead of
  leaving gaps blank.
- **Documented vintage, and last calendar year specifically.** You need the year
  the values describe *and* the release date; an undated number can't be
  footnoted. Beyond that, the data year itself must be *last* calendar year —
  today minus one. If today is in 2026, only 2025-dated values are acceptable;
  2024 is stale and 2026 (this year) is usually still incomplete. Recompute this
  from the current date each time, don't reuse a number from an earlier session.
  `add_topic.py` enforces this on `--data-year` and rejects a mismatch unless you
  pass `--allow-stale-year` with a `--notes` explanation — reserve that for
  topics (census, some V-Dem/IHME series) that are never updated annually.
- **Consistent definition across rows.** Watch for sources that mix survey years,
  switch between administrative and modelled estimates, or change denominators
  by country. Note the caveat in `--notes` when unavoidable.

### How many sources to accept

Default is **strict: one source per column.** Splicing in a second source to
patch gaps mixes definitions and vintages invisibly, and that's worse than a
blank cell. Don't combine sources unless the rule below is satisfied — leave
the gaps blank instead.

The user sets the strictness for a given topic (ask if it isn't clear which
they want, and default to strict when they haven't said):

| Level | What's allowed |
|---|---|
| **strict** (default) | Exactly one source. Gaps stay blank. |
| **moderate** | A second source may fill gaps in an otherwise-strong first source, but only if both publish the **same definition, comparable collection methodology, and the same data year**. A different vintage or a different definition of the same-sounding metric disqualifies it — leave those rows blank instead. |
| **lenient** | Sources from different publishers may be combined even if methodology alignment is closer to "compatible" than "identical" (e.g. two agencies both reporting modelled estimates against the same standard) — as long as the user has explicitly asked for lenient sourcing for this topic. |

Whatever the level, combining sources requires all of the following, not just
one:

1. Both sources describe the **same measure** (same units, same population,
   same what's-counted) — not just a similarly-named one.
2. Both are dated to the **same data year** — the previous-calendar-year rule
   above still applies to every source in the mix, no exceptions.
3. You can state in one sentence *why* they're compatible ("both use the ILO
   harmonized unemployment definition and the same reference period") — if you
   can't articulate that sentence, they're not aligned, they're just similar.

When you do combine sources, record all of them: join `--source-name` /
`--source-url` / `--publisher` with `; ` and use `--notes` to name the second
source explicitly and state the one-sentence alignment reason from point 3.
Say in your final report that the column draws on more than one source and why.

**Don't guess values.** Never fill a cell from your own knowledge, an LLM-ish
recollection of "roughly right" figures, or interpolation. A blank cell is a
correct statement about what the source covers.

**Sanity-check before merging.** Look at the top and bottom five values and ask
whether they're plausible — a country at 100× its neighbours usually means a
unit mismatch (thousands vs units, local currency vs USD) or a stray aggregate
row that slipped through. Check one or two values against a second source; a
mismatch means you've misread the column, not that the source is wrong.

## Data layout

`data/countries.csv` and `data/us_states.csv` hold one column per place and one
row per field. The first row is a header of place codes (iso3 / state_code);
every row below it is a field, starting with `country` / `state` and `iso2` /
`fips`, then one row per topic:

```
field,AFG,ALB,DZA,...
country,Afghanistan,Albania,Algeria,...
iso2,AF,AL,DZ,...
gdp_usd,20.1e9,18.9e9,...
```

This layout keeps diffs small. Places are fixed at 197 / 51 columns, but topics
accumulate forever, one per skill run. Adding a topic appends a single row, and
refreshing one (`--force`) changes exactly that row -- a reviewer can see what
changed at a glance. `add_topic.py` and `init_masters.py` handle reading and
writing this shape for you -- `pwf_lib.read_master_csv` / `write_master_csv`
are the only places that know the on-disk shape; everywhere else in the code
works with the natural one-row-per-place representation instead.

`data/sources_manifest.csv` is one row per topic (its columns -- title, unit,
vintage, source, coverage -- are fixed metadata fields, not a growing set), so
adding or refreshing a topic there is already a single-row diff.

```
data/countries.csv          field row, then country/iso2/topic rows, one column per iso3
data/us_states.csv          field row, then state/fips/topic rows, one column per state_code
data/sources_manifest.csv   one row per topic: title, unit, vintage, source, coverage
staging/<slug>.csv          raw extraction, kept for auditing (one row per place, as fetched)
```

`assets/countries.csv` and `assets/us_states.csv` (the canonical place lists
the masters are built from) hold one row per place instead -- they're static
reference data, not a growing set of topics, so there's no diff problem
to solve there.

Places are fixed: **197 countries** (193 UN members, plus Holy See and Palestine
as observers, plus Taiwan and Kosovo) and **51 state columns** (50 states + DC).
The scripts restore this set on every run, so a topic can never quietly add or
drop a place. Dependencies and territories (Hong Kong, Puerto Rico, Greenland)
are not rows; they're recognized and skipped.

Topic slugs are snake_case, no year in the name (`gdp_usd`, not `gdp_2024_usd`) —
the year lives in the manifest so refreshing a topic doesn't orphan the column.
Include the unit or basis when it disambiguates: `gdp_per_capita_ppp`,
`mean_commute_minutes`, `silicon_exports_usd`.

Refreshing a topic later: same command with `--force`, which replaces the column
and updates the manifest entry in place.

## Scripts

| Script | Use |
|---|---|
| `scripts/init_masters.py` | Create or repair the masters and manifest. Idempotent; preserves existing topic columns. |
| `scripts/add_topic.py` | Merge staged values into a master + write the manifest entry. `--dry-run` reports without writing. Rejects `--data-year` values other than last calendar year unless `--allow-stale-year` is passed. |
| `scripts/report.py` | Coverage per topic, undocumented columns, rows blank everywhere. |

Run `--help` on any of them for the full flag list.

## Worked example: average commute duration, U.S. states

The measure a reference book prints is mean travel time to work in minutes for
workers 16+ who don't work from home. The Census Bureau's American Community
Survey publishes it; the cleanest derivation is aggregate travel time divided by
the number of commuters, both in the same ACS table release.

Search for the current ACS 1-year detailed-table API endpoint and confirm the
variable IDs against the Census variable list before using them — table and
variable names do change between vintages. Then:

```bash
# fetch -> staging/mean_commute_minutes.csv with columns: state,value
python3 scripts/add_topic.py --scope states --topic mean_commute_minutes \
  --input staging/mean_commute_minutes.csv --key-col state --value-col value \
  --title "Mean travel time to work" --unit "minutes" \
  --source-name "ACS 1-year estimates, aggregate travel time / workers who commute" \
  --source-url "<endpoint or table URL>" --publisher "U.S. Census Bureau" \
  --published <release date> --data-year <survey year> \
  --definition "Mean one-way travel time to work, workers 16+ not working from home" \
  --dry-run
```

The national total row and Puerto Rico appear in ACS output and are skipped
automatically; DC resolves to the `DC` row.

## When there's no good source

Say so, rather than assembling something weaker and presenting it as a column.
Report what you found: the best partial source and its coverage, why it falls
short (too few countries, undated, inconsistent definitions, paywalled, wrong
vintage), and the nearest well-covered measure that *would* work. "Household
silicon consumption has no per-country source, but silicon and silicon-product
exports by value are in UN Comtrade for 170 countries" is a useful answer. A
half-invented column is not.

A common way this happens now: the best source's newest data is a year or more
stale relative to last calendar year. That's a real gap, not a rounding error —
report it as one. Options, in order: keep looking for a source with last year's
values; ask the user whether `--allow-stale-year` is acceptable for this
specific topic (with a reason, e.g. "ACS 1-year estimates for this table won't
be out until Q4"); or leave the column for a later refresh. Don't quietly accept
an older vintage to avoid an empty-handed report.
