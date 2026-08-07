import type { PlaceValue, SourceInfo } from '../lib/data';
import type { CategoryTheme } from '../lib/theme';
import { formatNumber } from '../lib/format';

interface Props {
  values: PlaceValue[];
  unit: string;
  theme: CategoryTheme;
}

export function PlaceList({ values, unit, theme }: Props) {
  return (
    <ol
      className="max-h-72 overflow-y-auto rounded-lg text-sm"
      style={{ backgroundColor: 'rgba(255,255,255,0.5)' }}
    >
      {values.map((v, i) => (
        <li
          key={v.code}
          className="flex items-baseline justify-between gap-3 px-3 py-1.5 border-b last:border-b-0"
          style={{ borderColor: theme.border }}
        >
          <span className="flex items-baseline gap-2 min-w-0">
            <span className="tabular-nums text-xs opacity-50 w-6 shrink-0">{i + 1}</span>
            <span className="truncate font-medium">{v.name}</span>
          </span>
          <span className="tabular-nums shrink-0 whitespace-nowrap">
            {v.numeric !== null ? formatNumber(v.numeric) : v.raw}
            {unit && <span className="ml-1 opacity-60 text-xs">{unit}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function SourceFootnote({ source }: { source: SourceInfo }) {
  return (
    <p className="mt-3 text-xs opacity-70 leading-snug">
      Source:{' '}
      {source.sourceUrl ? (
        <a href={source.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
          {source.sourceName || source.sourceUrl}
        </a>
      ) : (
        source.sourceName
      )}
      {source.publisher && ` — ${source.publisher}`}
      {source.dataYear && ` (${source.dataYear})`}
    </p>
  );
}
