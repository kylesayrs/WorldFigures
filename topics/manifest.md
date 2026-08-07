# topics/

`table_of_contents.csv` is the to-do list for the book: every statistic we
intend to add, whether it's been researched yet, and which kind of entity it's
measured across. Nothing in the `research-world-figures` skill's scripts reads
this file — it's a tracker for humans and agents deciding what to work on next,
not an input to the data pipeline in `data/`.

## Columns

| Column | Meaning |
|---|---|
| `topic` | snake_case slug. Matches the column name the value ends up under in `data/<entity_type>.csv` once researched (see `data/manifest.md`). No year in the slug. |
| `entity_type` | What each value in this topic is *about* — `countries`, `states`, `banks`, `companies`, `funds`, etc. The registered entity types and their data files live in `data/manifest.md`. |
| `header` | Top-level chapter this topic is displayed under (e.g. `economics`, `health`). Purely a presentation grouping for the webapp — nothing in the data pipeline reads it. |
| `sub_header` | Section within `header` (e.g. `gdp`, `disease_and_mortality`). Same caveat as `header`. |
| `description` | Short human-readable description of the measure, good enough to scan the list and pick a topic. |
| `status` | `todo` or `done` — see below. |

The same `topic` slug can appear more than once with different `entity_type`
values when the same measure is meant to be researched for more than one kind
of entity (e.g. `gdp_nominal` for both `countries` and `states` — two
independent columns in two different master files). `(topic, entity_type)`
is the unique key; `header`/`sub_header` are always the same across those
rows, since the grouping describes the topic, not the entity type.

## Status values

| Status | Meaning |
|---|---|
| `todo` | Not yet researched and merged into `data/`. |
| `done` | Researched and merged — a column with this name exists in the corresponding `data/<entity_type>.csv` and a row for it exists in `data/sources_manifest.csv`. |

## A note on entity_type

This file used to assume every topic was either a per-country or a per-state
statistic, organized as `topics/<category>/<subtopic>/{countries,states}.csv`.
That broke down for topics like "largest banks" or "largest non-financial
companies," where each *row* of the eventual dataset is a bank or a company,
not a place — forcing those into a countries/states shape would have meant
either one bogus "which country has the biggest bank" number or 197 blank
cells. `entity_type` makes the actual unit of measurement explicit instead of
assumed.

Adding a topic for a new kind of entity doesn't require anything in this file
beyond picking an `entity_type` value — see `data/manifest.md` for what's
needed on the data side (registering the entity type in the skill's
`ENTITY_TYPES`).
