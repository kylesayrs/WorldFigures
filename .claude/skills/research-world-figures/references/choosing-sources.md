# Choosing Sources

When researching sources, prefer, in rough order:

1. **An official statistical body or a UN/IGO agency** — BLS, Census, BEA, Eurostat,
   World Bank, IMF, UN agencies, WHO, FAO, ITU, OECD.
2. **A curated aggregator that documents its upstream sources** — Our World in
   Data above all, which republishes agency data with the original citation and
   a stated download date, Wikipedia, World Bank Group.
3. **A well-documented academic or NGO dataset** with a methodology paper —
   V-Dem, IHME, Transparency International.

For a list of recommended sources, see `references/source-catalog.md`.

Only stop researching once the following **acceptance criteria** have been met.
A topic may and often will require multiple iterations of sources, sometimes
requiring mixing multiple sources:

- **Coverage.** Aim for all or nearly all rows. A source covering 40 countries
  isn't a world figure; keep looking. If after pruning for vintage, the source
  is missing >50% of the rows, or is missing key entities like China, India,
  Taiwan, and/or California, consider picking a new source or supplementing with
  an additional source. If the coverage is still bad, mention the lack of coverage
  in the PR description and in the source notes.
  
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

- **Quality and Consistency.** Prefer a single, high quality source or compilation of
  sources whenever possible. Watch for sources that mix survey years, switch between
  administrative and modelled estimates, or change denominators by country. Note
  caveats in `--notes` when they are unavoidable.

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