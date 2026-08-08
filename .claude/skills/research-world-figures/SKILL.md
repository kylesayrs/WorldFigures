---
name: research-world-figures
description: Research a statistic for every country or U.S. state and add it to the "pocket world figures" master CSVs. Use this whenever the user names a topic they want per-country or per-state numbers for -- GDP, life expectancy, silicon exports, average commute duration, prison population, anything of that shape -- or asks to find a dataset covering all countries/states, add a column to the world figures book, check coverage of an existing topic, or refresh a topic with newer data. Trigger it even when the request is phrased casually ("get me broadband speeds by country", "what's the commute time in each state") and even when the user doesn't mention the book, CSVs, or this skill by name.
argument-hint: <topic> <scope>
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

## Arguments

Invoke as `/research-world-figures <topic> <scope>`, e.g.
`/research-world-figures gdp_per_capita_ppp countries`.

- `<topic>` — snake_case topic name, matching the `topic` column in
  `topics/table_of_contents.csv`. Not unique on its own — see the `<slug>`
  definition below.
- `<scope>` — the entity type the topic is measured across, matching the
  `entity_type` column (`countries`, `states`, `banks`, `companies`, `funds`,
  ...). This is the same value that goes to `--entity-type` in step 5 below.

On invocation:

1. Parse `$ARGUMENTS` into `<topic>` and `<scope>`. If either is missing, ask
   rather than guessing — a mismatched slug creates an orphan row that nothing
   else will ever match later. Create a scratch staging directory for this run
   (e.g. `mktemp -d`) and use it for every staging file below — staging files
   are working data for the merge step, not something to commit.
2. Look up the row where `topic == <topic>` and `entity_type == <scope>` in
   `topics/table_of_contents.csv`; `(topic, entity_type)` is the unique key.
   Its `description` column is the starting point for "Pin down the measure"
   below — a scan-the-list hint, not a full definition, so still nail down the
   exact version (nominal vs PPP, mean vs median, etc.) yourself.
   - No matching row: tell the user this `(topic, scope)` pair isn't in the
     to-do list and confirm whether to add it or proceed anyway.
   - Row found with `status=done`: confirm with the user that this is an
     intentional refresh (you'll use `--force` in step 5) before continuing.
3. Define `<slug>` as `<topic>_<scope>` (e.g. `gdp_nominal_countries`,
   `gdp_nominal_states`). `<topic>` alone is **not** unique — the same topic
   is often researched for more than one scope, as two independent columns in
   two different master files — so anywhere below that needs a unique
   filename or branch name (the staging file, the git branch) uses `<slug>`,
   not `<topic>`. The `--topic` flag passed to `add_topic.py` in step 5 stays
   `<topic>` alone: it's just the column name within that scope's own master
   file, so it doesn't need the scope suffix.

If the skill triggers from a topic named in conversation rather than explicit
arguments, infer `<topic>`/`<scope>` the same way and check
`topics/table_of_contents.csv` for a matching row; if nothing matches, proceed
using the topic as described in chat.

## Required Steps

1. **Pin down the measure.** A topic name is not yet a measure. "GDP" could be
   nominal, PPP, per capita, or growth rate. "Commute duration" could be mean
   travel time for workers, median, or one-way vs round trip. Start from the
   `description` looked up above (or the user's phrasing, if there was no
   matching row), and pick the specific version a general-reader reference
   book would print. Note it, and say which one you picked in your final
   message. If genuinely ambiguous and the choice changes the story the
   number tells, ask.

   Superlative topics ("largest silicon exporter") are one measure in disguise:
   find per-country silicon exports and the superlative falls out of the column,
   which is more useful for the book than a single sentence.

2. **Find the source.** See `references/choosing-sources.md` and
   `references/source-catalog.md` for vetted starting points by domain.
   **Do not accept a source(s) if it does not meet the acceptance criteria**.

3. **Get the data** Download the source's own CSV/JSON
   (bulk download, API, or data-explorer export) whenever possible.

   If `curl`/`requests` are blocked by network restrictions, use `web_fetch` on
   the data URL — API endpoints returning CSV or JSON work fine — and write the
   response to a staging file.

   When you fetch via an API rather than a browsable page, keep track of two
   URLs, not one: the raw query you actually called (with its parameters),
   and — separately — the API's own documentation or indicator landing page,
   the one a human reader would open to see the series' definition, update
   schedule, and license (e.g. `https://data.worldbank.org/indicator/<code>`
   for a World Bank indicator, not `https://api.worldbank.org/v2/...`). You'll
   need both in step 5: the documentation page is `--source-url`, the raw
   query should be included in `--notes`.

4. **Stage it.** Write `$STAGING_DIR/<slug>.csv` (the scratch directory from
   step 1 of "Arguments") with at minimum a place column
   and a value column; add a year column if the source's "latest available" year
   varies by country. Keep the source's own precision — no rounding.

5. **Merge it.** Identify the scripts folder and use it to merge data and sources
   ```bash
   SCRIPTS="$(git rev-parse --show-toplevel)/.claude/skills/research-world-figures/scripts"
   python3 "$SCRIPTS/init_masters.py"      # first run only, safe to repeat
   python3 "$SCRIPTS/add_topic.py" --entity-type countries --topic <topic> \
     --input "$STAGING_DIR/<slug>.csv" --key-col country --value-col value \
     --title "..." --unit "..." --source-name "..." --source-url "..." \
     --publisher "..." --published YYYY-MM-DD --data-date YYYY-MM-DD \
     --definition "..." --dry-run
   ```

   `--entity-type` is whatever kind of thing the topic's rows are about —
   `countries` and `states` for most topics, but a topic like "largest banks"
   is `banks`, not `countries` (see "Entity types" below).

   `--source-url` should be a page a human reader can open to understand the
   series — the documentation or landing page you tracked in step 3 — not the
   raw query URL, whenever the source publishes a separate one. When you
   fetched via a raw API call, put that exact call (with its query
   parameters) in `--notes`, e.g. `--notes "API:
   https://api.worldbank.org/v2/country/all/indicator/NY.GDP.MKTP.CD?format=json&mrnev=1"`.
   If the source genuinely has no separate documentation page — a bare CSV
   download with nothing else — `--source-url` can be the raw URL directly;
   don't invent a documentation link that doesn't exist.

   `--dry-run` first, always. It prints coverage, fuzzy matches, skipped
   aggregates, every unresolved label, and a `vintage` line checking
   `--data-date` (or each `--date-col` row) against the last-two-calendar-years
   window — see "Documented vintage" below. Resolve unmatched labels
   (`--map "Label=ISO3"` for real matches, `--drop "Label"` for non-rows); if
   the vintage line says REJECTED, either find more current values or, for
   topics that genuinely don't refresh annually, re-run with
   `--allow-stale-year` and a `--notes` explanation. Then re-run without
   `--dry-run`.

   Watch out for any `conflicts` notices. Use judgement to resolve conflicting
   jurisdictions, aiming to preserve data granularity wherever possible.

6. **Mark the topic done.** In `topics/table_of_contents.csv`, set `status`
   to `done` for the `(topic, entity_type)` row matching this run — matching
   `<topic>`/`<scope>` from "Arguments" above. If the lookup in step 2 of
   "Arguments" found no row (a topic not yet on the to-do list) and the user
   said to proceed anyway, append a new row instead, with `status=done` and a
   short `description`. This edit goes in the same commit as the data changes
   below — the to-do list and the data it describes should never drift apart.

7. **Open a PR.** Never commit a topic directly to `main`.

   - Work on a locally-unique branch, regardless of what's currently checked
     out — a stale worktree elsewhere may already hold `topic/<slug>` itself:

     ```bash
     git checkout -B "topic/<slug>.$(date +%s)" origin/main
     ```

   - Stage exactly what this run touched: the master file you merged into
     (e.g. `data/countries.csv`, `data/states.csv`, `data/banks.csv`),
     `data/sources_manifest.csv`, and `topics/table_of_contents.csv`. The
     staging file lives in `$STAGING_DIR`, outside the repo, and is never
     committed.
   - Commit (e.g. `Add <topic> column (<scope>)`), then push to the real
     target name via refspec — this is what actually lands on `topic/<slug>`,
     not the locally-unique name above:

     ```bash
     git push --force-with-lease origin "HEAD:topic/<slug>"
     ```

   - Open the PR:

     ```bash
     gh pr create --base main --head "topic/<slug>" --title "Add <topic> column (<scope>)" --body "$(cat <<'EOF'
     Measure: <what you picked, e.g. mean one-way commute time, workers 16+>
     Source: <publisher> — <source-name>, <source-url>
     Data date: <YYYY-MM-DD, or YYYY if that's all the source gives>  Coverage: <N>/197 (or /51)
     Notable gaps: <large places missing, or "none">
     EOF
     )"
     ```
   - If `gh pr create` fails because a PR already exists for the branch (a
     refresh of a topic you opened earlier), that's fine — note the existing
     PR URL instead of erroring out.

8. **Report back.** Tell the user the measure you chose, the source, the data
   year, coverage (`N/197` or `N/51`), which notable rows are blank, that
   `topics/table_of_contents.csv` is now marked `done` for this topic/scope,
   and the PR URL. If a large country is missing, say so plainly — that's the
   kind of gap a reader notices.

## Entity types

Every topic is measured across some **entity type** — `countries` and
`states` cover most topics, but a topic like "largest banks" is about banks,
not places, so it's `entity_type=banks`, with its own master
(`data/banks.csv`) and its own rows. Forcing an entity-based topic into
`countries`/`states` produces either a meaningless "which country has the
biggest bank" number or 197 blank cells — pick the entity type the topic is
actually about.

Full details (the transposed master-CSV shape, the fixed-vs-open roster
distinction, the currently registered entity types, and how to register a new
one) live in `data/manifest.md` — read it before adding a topic for an entity
type you haven't used before. Short version:

- **`countries`, `states`** — fixed roster. 197 countries (193 UN members +
  Holy See, Palestine, Taiwan, Kosovo) / 51 states+DC, restored on every
  `init_masters.py` run from `assets/countries.csv` / `assets/us_states.csv`.
  An input label that doesn't match a canonical row is an error to fix with
  `--map`/`--drop` — dependencies and territories (Hong Kong, Puerto Rico,
  Greenland) are recognized and skipped, not treated as new rows.
- **`companies`, `banks`, `funds`** — open roster, currently empty (no topic
  has been researched for them yet). There's no canonical list; `add_topic.py`
  adds a new row automatically the first time an entity's name appears and
  reuses that row (fuzzy-matched) the next time the same entity shows up in a
  later topic.
- Adding an entity type nobody's used before (e.g. `universities`) is a
  five-line addition to `ENTITY_TYPES` in `pwf_lib.py` — see `data/manifest.md`
  for the exact shape. Do this before staging a topic that needs it.

`data/sources_manifest.csv` is one row per `(entity_type, topic)` — its
columns (title, unit, vintage, source, coverage) are fixed metadata fields, so
adding or refreshing a topic there is already a single-row diff.

```
data/countries.csv          field row, then country/iso2/topic rows, one column per iso3
data/states.csv             field row, then state/fips/topic rows, one column per state_code
data/banks.csv              field row, then name/topic rows, one column per bank (open roster)
data/sources_manifest.csv   one row per (entity_type, topic): title, unit, vintage, source, coverage
data/manifest.md            full data-layout reference
$STAGING_DIR/<slug>.csv     raw extraction, scratch temp dir (not committed); slug = <topic>_<scope>
topics/table_of_contents.csv  to-do list of topics, by entity_type: topic,entity_type,description,status
topics/manifest.md          explains table_of_contents.csv
```

Topic names are snake_case, no year in the name (`gdp_usd`, not `gdp_2024_usd`) —
the year lives in the manifest so refreshing a topic doesn't orphan the column.
`<topic>` alone is the column name and is reused across scopes (see
"Arguments" above for how `<slug>` differs). Include the unit or basis when it
disambiguates: `gdp_per_capita_ppp`,
`mean_commute_minutes`, `silicon_exports_usd`.

Refreshing a topic later: same command with `--force`, which replaces the column
and updates the manifest entry in place.

## Scripts

All three live at `.claude/skills/research-world-figures/scripts/`, not at a
top-level `scripts/` — see the path note in "Merge it" above (step 5).

| Script | Use |
|---|---|
| `init_masters.py` | Create or repair the masters and manifest. Idempotent; preserves existing topic columns (and, for open-roster entity types, existing rows). |
| `add_topic.py` | Merge staged values into a master + write the manifest entry. `--dry-run` reports without writing. Rejects `--data-date` (or any `--date-col` row) dated outside today's year minus 4 through today's year unless `--allow-stale-year` is passed. |
| `report.py` | Coverage per topic, undocumented columns, rows blank everywhere (fixed-roster entity types), or entity counts per topic (open-roster). |

Run `--help` on any of them for the full flag list. `--data-dir` defaults to
that script's own project root (resolved from the script file's location) —
you shouldn't need to pass it.

## Worked example: average commute duration, U.S. states

The measure a reference book prints is mean travel time to work in minutes for
workers 16+ who don't work from home. The Census Bureau's American Community
Survey publishes it; the cleanest derivation is aggregate travel time divided by
the number of commuters, both in the same ACS table release.

Search for the current ACS 1-year detailed-table API endpoint and confirm the
variable IDs against the Census variable list before using them — table and
variable names do change between vintages. Then:

```bash
# fetch -> $STAGING_DIR/mean_commute_minutes_states.csv with columns: state,value
python3 "$SCRIPTS/add_topic.py" --entity-type states --topic mean_commute_minutes \
  --input "$STAGING_DIR/mean_commute_minutes_states.csv" --key-col state --value-col value \
  --title "Mean travel time to work" --unit "minutes" \
  --source-name "ACS 1-year estimates, aggregate travel time / workers who commute" \
  --source-url "https://www.census.gov/data/developers/data-sets/acs-1year.html" \
  --publisher "U.S. Census Bureau" \
  --published <release date> --data-date <survey year, or exact "as of" date> \
  --definition "Mean one-way travel time to work, workers 16+ not working from home" \
  --notes "API: <the exact detailed-table endpoint + variable IDs you queried>" \
  --dry-run
```

The national total row and Puerto Rico appear in ACS output and are skipped
automatically; DC resolves to the `DC` row.
