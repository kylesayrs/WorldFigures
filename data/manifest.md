# data/

One master CSV per **entity type** — the kind of thing a topic's values are
about (a country, a U.S. state, a bank, a company, ...) — plus one shared
`sources_manifest.csv` recording where every merged column came from. Files
here are produced and repaired by the `research-world-figures` skill's
scripts (`.claude/skills/research-world-figures/scripts/`); the entity types
themselves are registered in `pwf_lib.py`'s `ENTITY_TYPES`.

## Master CSV shape

Every master is transposed — one column per entity, one row per field —
because the entity set (197 countries, 51 states, ...) is fixed or slow-
growing while topics accumulate forever. This keeps diffs small: adding a
topic appends one row, refreshing one changes exactly that row.

```
field,AFG,ALB,DZA,...
country,Afghanistan,Albania,Algeria,...
iso2,AF,AL,DZ,...
gdp_usd,20.1e9,18.9e9,...
```

`read_master_csv` / `write_master_csv` in `pwf_lib.py` are the only code that
knows this on-disk shape; everywhere else works with the natural
one-row-per-entity representation.

## Fixed vs. open roster entity types

An entity type's **roster** is either:

- **`fixed`** — the entity set never changes. `countries` and `states` are the two today: their rows come from a canonical list in `assets/*.csv` (197 countries, 51 states), and `init_masters.py` restores exactly that set on every run. An input label that doesn't match a canonical entity is a hard error in `add_topic.py` — fix it with `--map`/`--drop`, don't guess.
- **`open`** — there's no canonical list; the roster is whatever entities have shown up in a merged topic so far. `companies`, `banks`, and `funds` are registered this way, currently with **zero rows** — no one has researched a company/bank/fund topic yet, so there's nothing to seed a roster from. `init_masters.py` never resets an open master, just makes sure the file exists. `add_topic.py` matches an input label against entities already in the master (fuzzy match included) and, if nothing matches, adds it as a new row automatically — a bank appearing in a ranking for the first time isn't an error, it's the roster growing.

| Entity type | Roster | Master file | Canonical source |
|---|---|---|---|
| `countries` | fixed | `countries.csv` | `assets/countries.csv` (197 UN members + Holy See, Palestine, Taiwan, Kosovo) |
| `states` | fixed | `states.csv` | `assets/us_states.csv` (50 states + DC) |
| `companies` | open | `companies.csv` | none — grows from data |
| `banks` | open | `banks.csv` | none — grows from data |
| `funds` | open | `funds.csv` | none — grows from data |

### Registering a new entity type

Add one entry to `ENTITY_TYPES` in `pwf_lib.py`:

```python
"universities": {
    "roster": "open",
    "key_col": "entity_id",
    "name_col": "name",
    "master": "universities.csv",
    "extra_cols": [],
},
```

then run `python3 scripts/init_masters.py --data-dir data --entity-type universities`
once to create the empty master. `add_topic.py`/`report.py` work immediately
— no canonical roster has to exist first. (A `fixed`-roster type additionally
needs an `assets/<name>.csv` canonical list with `key_col`/`name_col`/
`aliases` columns; see `assets/countries.csv` for the shape.)

## `sources_manifest.csv`

One row per `(entity_type, topic_slug)` — fixed metadata columns (title,
unit, vintage, source, coverage), not a growing set, so adding or refreshing
a topic is a single-row diff here too. `coverage_total` is blank for
open-roster entity types, since there's no fixed denominator to report a
percentage against.

## Related

`topics/table_of_contents.csv` and `topics/manifest.md` track which topics
are still to be researched, by entity type. Nothing here reads that file —
it's a to-do list, not a pipeline input.
