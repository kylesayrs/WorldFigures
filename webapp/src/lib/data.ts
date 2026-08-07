import { parseCsvObjects, parseCsvRows } from './csv';
import { getCategoryTheme, type CategoryTheme } from './theme';

// Fixed master files, imported directly.
import countriesCsv from '../../../data/countries.csv?raw';
import statesCsv from '../../../data/us_states.csv?raw';
import manifestCsv from '../../../data/sources_manifest.csv?raw';

// The topics/ folder grows one category CSV at a time as the project's
// research skill runs, so it's read as a glob rather than fixed imports.
const topicModules = import.meta.glob('../../../topics/*.csv', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export interface PlaceValue {
  code: string;
  name: string;
  raw: string;
  numeric: number | null;
}

export interface SourceInfo {
  title: string;
  unit: string;
  valueType: string;
  dataYear: string;
  sourceName: string;
  sourceUrl: string;
  publisher: string;
  published: string;
  retrieved: string;
  coverageFilled: string;
  coverageTotal: string;
  definition: string;
  notes: string;
}

export interface TopicEntry {
  slug: string;
  description: string;
  scope: string;
  status: string;
  source: SourceInfo | null;
  countryValues: PlaceValue[];
  stateValues: PlaceValue[];
  hasData: boolean;
}

export interface CategorySection {
  slug: string;
  theme: CategoryTheme;
  topics: TopicEntry[];
}

/** A transposed master CSV: header row is place codes, each following row is `field,value,value,...`. */
interface TransposedMaster {
  placeCodes: string[];
  fields: Map<string, string[]>;
}

function parseTransposedMaster(text: string): TransposedMaster {
  const rows = parseCsvRows(text);
  if (rows.length === 0) return { placeCodes: [], fields: new Map() };
  const [header, ...rest] = rows;
  const placeCodes = header.slice(1);
  const fields = new Map<string, string[]>();
  for (const r of rest) {
    const [fieldName, ...values] = r;
    if (!fieldName) continue;
    fields.set(fieldName.trim(), values);
  }
  return { placeCodes, fields };
}

function numericValue(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, '').trim();
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function placeValuesForTopic(
  master: TransposedMaster,
  nameField: string,
  topicSlug: string,
): PlaceValue[] {
  const values = master.fields.get(topicSlug);
  const names = master.fields.get(nameField);
  if (!values || !names) return [];
  const out: PlaceValue[] = [];
  master.placeCodes.forEach((code, i) => {
    const raw = (values[i] ?? '').trim();
    if (raw === '') return;
    out.push({
      code,
      name: names[i] ?? code,
      raw,
      numeric: numericValue(raw),
    });
  });
  // Rank highest-first, like an almanac; entries with no parseable number sink to the bottom.
  out.sort((a, b) => {
    if (a.numeric === null && b.numeric === null) return a.name.localeCompare(b.name);
    if (a.numeric === null) return 1;
    if (b.numeric === null) return -1;
    return b.numeric - a.numeric;
  });
  return out;
}

function loadManifest(): Map<string, SourceInfo> {
  const rows = parseCsvObjects(manifestCsv);
  const map = new Map<string, SourceInfo>();
  for (const r of rows) {
    if (!r.topic_slug) continue;
    map.set(r.topic_slug, {
      title: r.title ?? '',
      unit: r.unit ?? '',
      valueType: r.value_type ?? '',
      dataYear: r.data_year ?? '',
      sourceName: r.source_name ?? '',
      sourceUrl: r.source_url ?? '',
      publisher: r.publisher ?? '',
      published: r.published ?? '',
      retrieved: r.retrieved ?? '',
      coverageFilled: r.coverage_filled ?? '',
      coverageTotal: r.coverage_total ?? '',
      definition: r.definition ?? '',
      notes: r.notes ?? '',
    });
  }
  return map;
}

function categorySlugFromPath(path: string): string {
  const file = path.split('/').pop() ?? path;
  return file.replace(/\.csv$/i, '');
}

export function loadCategories(): CategorySection[] {
  const countries = parseTransposedMaster(countriesCsv);
  const states = parseTransposedMaster(statesCsv);
  const manifest = loadManifest();

  const categories: CategorySection[] = Object.entries(topicModules)
    .map(([path, raw]) => {
      const slug = categorySlugFromPath(path);
      const rows = parseCsvObjects(raw);
      const topics: TopicEntry[] = rows
        .filter((r) => !!r.topic)
        .map((r) => {
          const source = manifest.get(r.topic) ?? null;
          const countryValues = placeValuesForTopic(countries, 'country', r.topic);
          const stateValues = placeValuesForTopic(states, 'state', r.topic);
          return {
            slug: r.topic,
            description: r.description ?? '',
            scope: r.scope ?? '',
            status: r.status ?? '',
            source,
            countryValues,
            stateValues,
            hasData: countryValues.length > 0 || stateValues.length > 0,
          };
        });
      return {
        slug,
        theme: getCategoryTheme(slug),
        topics,
      };
    })
    .sort((a, b) => a.theme.label.localeCompare(b.theme.label));

  return categories;
}
