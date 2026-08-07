import { parseCsvObjects, parseCsvRows, type CsvRow } from './csv';
import { getCategoryTheme, type CategoryTheme } from './theme';
import { humanizeSlug } from './format';

// Fixed master files, imported directly.
import countriesCsv from '../../../data/countries.csv?raw';
import statesCsv from '../../../data/us_states.csv?raw';
import sourcesManifestCsv from '../../../data/sources_manifest.csv?raw';

// topics/ grows one file at a time as the project's research skill runs, so
// it's read as a recursive glob rather than fixed imports. Shape:
//   topics/<category>/<subheader>/<scope>.csv   (exactly two directories deep)
//   topics/manifest.csv                          (status code legend, not a topic file)
const topicModules = import.meta.glob('../../../topics/**/*.csv', {
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
  status: string;
  statusDescription: string;
  scopes: string[];
  source: SourceInfo | null;
  countryValues: PlaceValue[];
  stateValues: PlaceValue[];
  hasData: boolean;
}

export interface SubheaderSection {
  slug: string;
  label: string;
  topics: TopicEntry[];
}

export interface CategorySection {
  slug: string;
  theme: CategoryTheme;
  subheaders: SubheaderSection[];
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

function loadSourceManifest(): Map<string, SourceInfo> {
  const rows = parseCsvObjects(sourcesManifestCsv);
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

function statusLegendFromRows(rows: CsvRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of rows) {
    if (!r.status) continue;
    map.set(r.status, r.description ?? '');
  }
  return map;
}

/** Path segments under topics/, e.g. "…/topics/economics/gdp/countries.csv" -> ["economics", "gdp", "countries.csv"]. */
function topicsPathSegments(path: string): string[] {
  const marker = '/topics/';
  const idx = path.indexOf(marker);
  const rel = idx === -1 ? path : path.slice(idx + marker.length);
  return rel.split('/').filter(Boolean);
}

interface RawTopicFile {
  category: string;
  subheader: string;
  scope: string;
  rows: CsvRow[];
}

/**
 * Walks the topics/ glob and splits it into per-file entries plus the status
 * legend. topics/ is expected to be exactly two directories deep
 * (category/subheader) before the scope CSV — topics/manifest.csv is the one
 * sanctioned exception, since it's a status legend rather than a topic file.
 * Anything else at the wrong depth is a structural mistake in the data, not
 * a case the UI should silently paper over, so it throws.
 */
function loadTopicsFolder(): { rawFiles: RawTopicFile[]; statusLegend: Map<string, string> } {
  const rawFiles: RawTopicFile[] = [];
  let statusLegend = new Map<string, string>();

  for (const [path, raw] of Object.entries(topicModules)) {
    const parts = topicsPathSegments(path);

    if (parts.length === 1 && parts[0] === 'manifest.csv') {
      statusLegend = statusLegendFromRows(parseCsvObjects(raw));
      continue;
    }

    if (parts.length !== 3) {
      const depth = Math.max(parts.length - 1, 0);
      throw new Error(
        `Malformed topics/ entry at "${path}": expected exactly 2 levels of nesting ` +
          `(topics/<category>/<subheader>/<scope>.csv), found depth ${depth} ("${parts.join('/')}"). ` +
          'Fix the folder structure or the topics loader in src/lib/data.ts.',
      );
    }

    const [category, subheader, fileName] = parts;
    rawFiles.push({
      category,
      subheader,
      scope: fileName.replace(/\.csv$/i, ''),
      rows: parseCsvObjects(raw),
    });
  }

  return { rawFiles, statusLegend };
}

export function countTopics(section: CategorySection): number {
  return section.subheaders.reduce((n, s) => n + s.topics.length, 0);
}

export function countFilledTopics(section: CategorySection): number {
  return section.subheaders.reduce((n, s) => n + s.topics.filter((t) => t.hasData).length, 0);
}

export function loadCategories(): CategorySection[] {
  const countries = parseTransposedMaster(countriesCsv);
  const states = parseTransposedMaster(statesCsv);
  const sourceManifest = loadSourceManifest();
  const { rawFiles, statusLegend } = loadTopicsFolder();

  const categoryMap = new Map<string, Map<string, RawTopicFile[]>>();
  for (const file of rawFiles) {
    if (!categoryMap.has(file.category)) categoryMap.set(file.category, new Map());
    const subheaderMap = categoryMap.get(file.category)!;
    if (!subheaderMap.has(file.subheader)) subheaderMap.set(file.subheader, []);
    subheaderMap.get(file.subheader)!.push(file);
  }

  const categories: CategorySection[] = Array.from(categoryMap.entries())
    .map(([categorySlug, subheaderMap]) => {
      const subheaders: SubheaderSection[] = Array.from(subheaderMap.entries())
        .map(([subheaderSlug, files]) => {
          // Merge same-slug topics across scope files (e.g. gdp_nominal defined in
          // both countries.csv and states.csv) into a single entry.
          const bySlug = new Map<string, { description: string; status: string; scopes: string[] }>();
          for (const file of files) {
            for (const row of file.rows) {
              if (!row.topic) continue;
              const existing = bySlug.get(row.topic);
              if (existing) {
                existing.scopes.push(file.scope);
                if (!existing.description && row.description) existing.description = row.description;
              } else {
                bySlug.set(row.topic, {
                  description: row.description ?? '',
                  status: row.status ?? '',
                  scopes: [file.scope],
                });
              }
            }
          }

          const topics: TopicEntry[] = Array.from(bySlug.entries())
            .map(([slug, meta]) => {
              const source = sourceManifest.get(slug) ?? null;
              const countryValues = meta.scopes.includes('countries')
                ? placeValuesForTopic(countries, 'country', slug)
                : [];
              const stateValues = meta.scopes.includes('states')
                ? placeValuesForTopic(states, 'state', slug)
                : [];
              return {
                slug,
                description: meta.description,
                status: meta.status,
                statusDescription: statusLegend.get(meta.status) ?? '',
                scopes: meta.scopes,
                source,
                countryValues,
                stateValues,
                hasData: countryValues.length > 0 || stateValues.length > 0,
              };
            })
            .sort((a, b) => a.slug.localeCompare(b.slug));

          return {
            slug: subheaderSlug,
            label: humanizeSlug(subheaderSlug),
            topics,
          };
        })
        .sort((a, b) => a.label.localeCompare(b.label));

      return {
        slug: categorySlug,
        theme: getCategoryTheme(categorySlug),
        subheaders,
      };
    })
    .sort((a, b) => a.theme.label.localeCompare(b.theme.label));

  return categories;
}
