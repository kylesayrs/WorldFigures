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

2. **Find the source.** See "Choosing a source" below and
   `references/source-catalog.md` for vetted starting points by domain.

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

   Default to keeping a dependency or territory separate from its parent —
   drop it (or leave it as its own row, for entity types where it has one)
   rather than folding it into the parent's number. Only sum it into the
   parent when the *source itself* treats it that way: either the source
   gives you a single pre-merged figure for the parent that already includes
   the dependency (nothing to sum — just use that row as-is), or the source
   splits out sub-national pieces of a country that has no other row of its
   own (Scotland, Northern Ireland, Wales → United Kingdom, when the source
   has no separate "United Kingdom" row at all) and summing is the only way
   to get that country onto the roster. If the source reports the dependency
   as its own distinct entry *alongside* a separate entry for the parent —
   Hong Kong and Macao alongside China; Greenland, the Faroe Islands, Aruba,
   Curaçao, and Sint Maarten alongside Denmark/Netherlands; Bermuda, the
   Cayman Islands, and other UK/US overseas territories alongside the
   UK/US — that's a sign the source itself keeps them separate, so you
   should too: drop the dependency, use the parent's own row unmodified.
   Summing in that case invents a total the source never published and
   inflates the parent above the commonly-cited figure a reader would
   expect. When you do sum (the "no separate parent row" case), `add_topic.py`'s
   `--map` resolves a label to a key but does not sum values that land on the
   same key: two input labels mapped to the same country silently keep only
   the last one processed (it prints a one-line `conflicts` notice, but the
   write still succeeds and the dropped value isn't recorded anywhere).
   Pre-summing in the staging file is the only way to get a correct total.

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

## Choosing a source

Prefer, in rough order:

1. **An official statistical body or a UN/IGO agency** — BLS, Census, BEA, Eurostat,
   World Bank, IMF, UN agencies, WHO, FAO, ITU, OECD.
2. **A curated aggregator that documents its upstream sources** — Our World in
   Data above all, which republishes agency data with the original citation and
   a stated download date, Wikipedia, World Bank Group.
3. **A well-documented academic or NGO dataset** with a methodology paper —
   V-Dem, IHME, Transparency International.

For a list of recommended sources, see `references/source-catalog.md`.

Judge candidates on three things:

- **Coverage.** Aim for all or nearly all rows. A source covering 40 countries
  isn't a world figure; keep looking. If after pruning for vintage, the source
  is missing >50% of the rows, or is missing key entities like China, India, or
  Taiwan, consider picking a new source or supplementing with an additional
  source. If the coverage is still bad, mention the lack of coverage in the PR
  description and in the source notes.
  
  **It's okay to accept a source with gaps in the data.** It is up to your best
  judgement whether the gaps should be filled with an additional or replacement
  source.

- **Documented vintage.** Attempt to use data which is up-to-date and consistent
  across all entities. Reject data which is too out-of-date.

  When a source gives one date per entity, use `--date-col` to specify which
  column contains dates. This is used to compute the source's `date` field in
  the source manifest, and is computed as the span of each row's year. If dates
  are not available on a per-entity granularity, use `--data-date` to describe
  the most precise date range of the data (e.g. `2025-12-31`, `2000-2024`).

  The hard window, past which `add_topic.py` rejects without an explicit
  override, is **today minus 4 through today's year**, inclusive (2022–2026
  if today is in 2026). This is a ceiling, not a target: don't stop looking
  once an older source turns up if a more recent (or this-year) one is
  findable. Recompute the window from the current date each run, don't reuse
  a number from an earlier session.

  If, after researching, it is not possible to find sources with enough data which
  falls within the vintage window, use `--allow-stale-year` and explain the situation
  using `--notes`.

  Cumulative all-time totals (Nobel Prizes, Olympic medals, World Cup titles —
  a running career/history tally, not a yearly snapshot) still need a `--data-date`,
  but it means "as of the most recent completed event," not "the date this number
  describes." Use the year of the latest edition/award covered by the source (e.g.
  `2025` for Nobel Prizes if the source includes the 2025 announcements).

- **Quality and Consistency.** Watch for sources that mix survey years,
  switch between administrative and modelled estimates, or change denominators
  by country. Note the caveat in `--notes` when unavoidable.

### Mixing multiple sources

Often, a single source will not contain enough data to cover all entities within the
vintage requirements. In this case, decide whether the missing data is important enough
to merit an additional source.

When mixing with an additional source, check for the following:

1. All sources describe the **same measure** (same units, same population,
   same what's-counted) — not just a similarly-named one.
2. All are dated to the **same data year** — the previous-calendar-year rule
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

**Sanity-check before mixing.** Look at the top and bottom five values of each source
and ask whether they're plausible — a country at 100× its neighbours usually means a
unit mismatch (thousands vs units, local currency vs USD) or a stray aggregate
row that slipped through. Check one or two values against a second source; a
mismatch means you've misread the column, not that the source is wrong.

## When there's no good source

Sometimes, the a source that you pick will fail to meet the sourcing criteria
described above. If this is the case, consider either mixing in an additional source
or picking a new source. If, after research, it seems that there is not combination
of sources which maintains sufficient data coverage and quality, then pick the best
partial source and describe why the available sources fall short (too few countries,
undated, inconsistent definitions, paywalled, wrong vintage), and the nearest
well-covered measure that *would* work. "Household silicon consumption has no
per-country source, but silicon and silicon-product exports by value are in UN
Comtrade for 170 countries" is a useful answer. A half-invented column is not.

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
