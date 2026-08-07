# Source catalog

Starting points, not answers. Treat every endpoint, indicator ID, and table
number here as a hypothesis to confirm against the source's current
documentation — series get renamed, retired, and re-based. If a search turns up
something better covered or more recent for a topic, use that instead.

- [Countries](#countries)
- [U.S. states](#us-states)
- [Bulk-download patterns](#bulk-download-patterns)
- [Traps](#traps)

## Countries

**Economy and finance**
- World Bank World Development Indicators — the default for GDP, income,
  poverty, and most macro series. ~1,500 indicators, near-universal coverage,
  free API, every series carries its own upstream citation.
- IMF World Economic Outlook database — better for very recent years and
  forecasts; publishes twice a year with a stated vintage.
- UNCTADstat — trade, investment, shipping, maritime connectivity.
- UN National Accounts Main Aggregates — when you need a UN-consistent series.

**Trade and industry**
- UN Comtrade — bilateral goods trade by HS code. The source for any "largest
  exporter of X" question. Coverage is good but reporting lags vary by country,
  and non-reporters are genuinely missing rather than zero.
- Observatory of Economic Complexity (OEC) and CEPII BACI — cleaned,
  reconciled versions of Comtrade; BACI is the academic standard.
- USGS Mineral Commodity Summaries — production of specific minerals and
  materials (silicon, lithium, rare earths) by country, annual, well documented.
- World Semiconductor Trade Statistics, SEMI — industry bodies; often
  region-level rather than country-level, so check before committing.

**Population and demography**
- UN World Population Prospects — population, fertility, life expectancy,
  migration, age structure. Complete coverage, revised every two years.
- UN DESA International Migrant Stock; UNHCR for refugee counts.

**Health**
- WHO Global Health Observatory — the broadest documented health indicator set.
- IHME Global Burden of Disease — modelled estimates, deep coverage, heavy
  methodology; say "modelled estimate" in the notes when you use it.
- UNAIDS, UNICEF (child health, nutrition, WASH).

**Education and work**
- UNESCO Institute for Statistics — enrolment, literacy, spending.
- ILOSTAT — employment, wages, hours, informality. Modelled series are
  labelled; prefer the reported ones where coverage allows.

**Energy, environment, climate**
- Our World in Data — energy, emissions, food, and much else, each chart with a
  clean CSV download and the upstream source named. Usually the fastest route to
  a well-cited, wide-coverage column.
- Energy Institute Statistical Review (formerly BP), Ember (electricity), IEA.
- Global Carbon Budget for CO2; FAOSTAT for land, crops, livestock, forests.
- World Bank/WRI for water; Yale EPI for composite environmental indices.

**Governance, crime, society**
- V-Dem, Freedom House, World Bank Worldwide Governance Indicators — all
  indices; state clearly that they're expert-coded ratings, not measurements.
- Transparency International CPI; UNODC for homicide and prison population;
  Institute for Economics and Peace for conflict indices.

**Technology and infrastructure**
- ITU DataHub — internet use, mobile subscriptions, broadband.
- Ookla / M-Lab for measured connection speeds (measurement panel, not census).
- ICAO, IATA, UPU for aviation and post.

## U.S. states

- **Census Bureau ACS** — the workhorse for anything about people: commuting,
  income, housing, language, education, disability. 1-year tables for states are
  reliable; note the survey year.
- **BLS** — employment, unemployment (LAUS), wages (OES), CPI (metro only, not
  all states), workplace injuries.
- **BEA** — state GDP, personal income, consumer spending.
- **CDC WONDER / NCHS** — mortality, natality, life expectancy by state.
  Suppression rules blank out small counts; that's a real blank, not an error.
- **FBI Crime Data Explorer** — reported crime, with the caveat that agency
  participation varies by state and year; be careful comparing states.
- **EIA State Energy Data System (SEDS)** — production, consumption, prices.
- **NCES** — schools, enrolment, spending, outcomes.
- **USDA NASS** — agriculture and land use.
- **Tax Foundation, KFF, Ballotpedia** — useful and generally well sourced, but
  secondary; prefer the underlying federal source when it exists.

## Bulk-download patterns

Confirm these against current docs before relying on them; they change.

- World Bank API returns JSON or CSV for all countries in one call, with an
  indicator code and a per-page parameter large enough to avoid pagination.
- Census APIs take a variable list and a geography wildcard for all states, and
  need the correct dataset path for the vintage year.
- Our World in Data grapher pages expose a direct CSV download for the exact
  chart you're looking at, which is usually the cleanest path.
- FAOSTAT, UNdata, ILOSTAT, and WHO GHO all offer full-domain bulk files —
  larger, but they avoid stitching multiple queries together.

Whatever the route, save the exact URL you used into `--source-url`. "World Bank
WDI" is not a citation; the specific indicator endpoint is.

## Traps

- **Aggregates in country files.** World Bank files include "World", "Euro area",
  income groups, and regions. `add_topic.py` recognizes and drops them, but
  eyeball the skip list — an unfamiliar label that gets silently dropped is worth
  a look.
- **Territories.** Hong Kong, Macao, Puerto Rico, Greenland, and the French
  overseas departments appear in many datasets and are not rows here.
- **Kosovo and Taiwan.** Frequently absent, or hidden under "Kosovo (UNSCR 1244)"
  and "Taiwan, Province of China" / "Chinese Taipei". Both are canonical rows;
  check for them explicitly rather than accepting the blank.
- **"Latest available year" columns.** Convenient, but the years differ by
  country. Stage the year column and let the manifest record the range, or the
  book will imply a single snapshot that doesn't exist.
- **Units.** Millions vs units, local currency vs USD, per 1,000 vs per 100,000,
  short tons vs tonnes. Read the column header of the source file, not just its
  title.
- **Modelled vs reported.** Many wide-coverage datasets achieve that coverage by
  imputing. Coverage bought with imputation is worth having, but say so in the
  notes.
- **Nominal vs PPP vs constant prices** for anything monetary. Pick one, and put
  it in the title and slug.
