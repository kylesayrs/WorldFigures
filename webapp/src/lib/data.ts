import { parseCsvObjects, parseCsvRows, type CsvRow } from './csv';
import { getCategoryTheme, type CategoryTheme } from './theme';
import { humanizeSlug } from './format';

// data/<entity_type>.csv masters grow one column at a time as topics get
// researched, but the set of entity types itself is small and changes rarely
// (see data/manifest.md's ENTITY_TYPES registry), so it's read as a glob
// keyed by filename rather than fixed imports — a new entity type just needs
// a new master file on disk, no code change here.
const masterModules = import.meta.glob('../../../data/*.csv', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

import tableOfContentsCsv from '../../../topics/table_of_contents.csv?raw';
import sourcesManifestCsv from '../../../data/sources_manifest.csv?raw';

// topics/table_of_contents.csv has no status legend of its own anymore
// (topics/manifest.md documents the two values in prose); kept here since
// the UI wants a human-readable description for the "no data yet" tooltip.
const STATUS_LEGEND: Record<string, string> = {
  todo: 'Not yet researched and merged into data/.',
  done: 'Researched and merged — a column exists in the corresponding data/<entity_type>.csv.',
};

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

/** One entity type's slice of a topic (e.g. the "countries" values for gdp_nominal) — each entity type researched separately, so each gets its own source citation. */
export interface EntityGroup {
  entityType: string;
  label: string;
  values: PlaceValue[];
  source: SourceInfo | null;
}

export interface TopicEntry {
  slug: string;
  description: string;
  status: string;
  statusDescription: string;
  scopes: string[];
  entityGroups: EntityGroup[];
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

/** A transposed master CSV: header row is entity codes, each following row is `field,value,value,...`. The first data row is always the entity's human-readable name (see data/manifest.md). */
interface TransposedMaster {
  entityCodes: string[];
  fields: Map<string, string[]>;
}

function parseTransposedMaster(text: string): TransposedMaster {
  const rows = parseCsvRows(text);
  if (rows.length === 0) return { entityCodes: [], fields: new Map() };
  const [header, ...rest] = rows;
  const entityCodes = header.slice(1);
  const fields = new Map<string, string[]>();
  for (const r of rest) {
    const [fieldName, ...values] = r;
    if (!fieldName) continue;
    fields.set(fieldName.trim(), values);
  }
  return { entityCodes, fields };
}

function nameValues(master: TransposedMaster): string[] | undefined {
  return master.fields.values().next().value;
}

function numericValue(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, '').trim();
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function placeValuesForTopic(master: TransposedMaster, topicSlug: string): PlaceValue[] {
  const values = master.fields.get(topicSlug);
  const names = nameValues(master);
  if (!values || !names) return [];
  const out: PlaceValue[] = [];
  master.entityCodes.forEach((code, i) => {
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

/** entity_type -> master, loaded from data/*.csv (sources_manifest.csv isn't a master, so it's skipped). */
function loadEntityMasters(): Map<string, TransposedMaster> {
  const masters = new Map<string, TransposedMaster>();
  for (const [path, raw] of Object.entries(masterModules)) {
    const fileName = path.slice(path.lastIndexOf('/') + 1);
    if (fileName === 'sources_manifest.csv') continue;
    const entityType = fileName.replace(/\.csv$/i, '');
    masters.set(entityType, parseTransposedMaster(raw));
  }
  return masters;
}

/** (entity_type, topic_slug) -> SourceInfo; a topic can cite a different source per entity type (e.g. countries from the IMF, states from the BEA). */
function loadSourceManifest(): Map<string, SourceInfo> {
  const rows = parseCsvObjects(sourcesManifestCsv);
  const map = new Map<string, SourceInfo>();
  for (const r of rows) {
    if (!r.topic_slug || !r.entity_type) continue;
    map.set(`${r.entity_type}:${r.topic_slug}`, {
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

// Fixed display order for top-level categories (topics/table_of_contents.csv's
// "header" column); anything not listed here sorts after, alphabetically.
const HEADER_ORDER = [
  'demographics',
  'geography',
  'economics',
  'industry',
  'politics',
  'society',
  'culture',
];

function headerSortKey(slug: string): [number, string] {
  const index = HEADER_ORDER.indexOf(slug);
  return [index === -1 ? HEADER_ORDER.length : index, slug];
}

interface TocRow extends CsvRow {
  topic: string;
  entity_type: string;
  header: string;
  sub_header: string;
  description: string;
  status: string;
}

export function countTopics(section: CategorySection): number {
  return section.subheaders.reduce((n, s) => n + s.topics.length, 0);
}

export function countFilledTopics(section: CategorySection): number {
  return section.subheaders.reduce((n, s) => n + s.topics.filter((t) => t.hasData).length, 0);
}

export function loadCategories(): CategorySection[] {
  const entityMasters = loadEntityMasters();
  const sourceManifest = loadSourceManifest();
  const tocRows = parseCsvObjects(tableOfContentsCsv) as TocRow[];

  // header -> sub_header -> topic -> merged rows across entity types.
  const categoryMap = new Map<
    string,
    Map<string, Map<string, { description: string; status: string; entityTypes: string[] }>>
  >();

  for (const row of tocRows) {
    if (!row.topic || !row.header || !row.sub_header) continue;
    if (!categoryMap.has(row.header)) categoryMap.set(row.header, new Map());
    const subheaderMap = categoryMap.get(row.header)!;
    if (!subheaderMap.has(row.sub_header)) subheaderMap.set(row.sub_header, new Map());
    const topicMap = subheaderMap.get(row.sub_header)!;

    const existing = topicMap.get(row.topic);
    if (existing) {
      existing.entityTypes.push(row.entity_type);
      if (!existing.description && row.description) existing.description = row.description;
    } else {
      topicMap.set(row.topic, {
        description: row.description ?? '',
        status: row.status ?? '',
        entityTypes: [row.entity_type],
      });
    }
  }

  const categories: CategorySection[] = Array.from(categoryMap.entries())
    .map(([headerSlug, subheaderMap]) => {
      const subheaders: SubheaderSection[] = Array.from(subheaderMap.entries())
        .map(([subheaderSlug, topicMap]) => {
          const topics: TopicEntry[] = Array.from(topicMap.entries())
            .map(([slug, meta]) => {
              const entityGroups: EntityGroup[] = meta.entityTypes.map((entityType) => {
                const master = entityMasters.get(entityType);
                const values = master ? placeValuesForTopic(master, slug) : [];
                return {
                  entityType,
                  label: humanizeSlug(entityType),
                  values,
                  source: sourceManifest.get(`${entityType}:${slug}`) ?? null,
                };
              });
              return {
                slug,
                description: meta.description,
                status: meta.status,
                statusDescription: STATUS_LEGEND[meta.status] ?? '',
                scopes: meta.entityTypes,
                entityGroups,
                hasData: entityGroups.some((g) => g.values.length > 0),
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
        slug: headerSlug,
        theme: getCategoryTheme(headerSlug),
        subheaders,
      };
    })
    .sort((a, b) => {
      const [ai, aSlug] = headerSortKey(a.slug);
      const [bi, bSlug] = headerSortKey(b.slug);
      return ai - bi || aSlug.localeCompare(bSlug);
    });

  return categories;
}
