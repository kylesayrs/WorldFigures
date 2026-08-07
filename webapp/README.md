# World Figures — webapp

A small, mobile-friendly viewer for the pocket world figures book. It reads
directly from the repo's data files — nothing is duplicated or generated:

- `../topics/*.csv` — one file per chapter (category); each row is a topic
  (`topic,description,scope,status`). This drives the table of contents.
- `../data/countries.csv` / `../data/us_states.csv` — the transposed masters;
  a topic with a matching field row has data, otherwise it renders greyed out.
- `../data/sources_manifest.csv` — supplies each topic's title, unit, and
  source citation when available.

No build step is needed to pick up new data — CSVs are read at build/dev time
via Vite, so adding a topic row or a data column and reloading is enough.

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
