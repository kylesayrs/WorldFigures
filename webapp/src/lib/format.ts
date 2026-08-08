const SMALL_WORDS = new Set(['and', 'or', 'of', 'the', 'a', 'an', 'in', 'on', 'to', 'for']);
const ACRONYMS = new Set(['gdp', 'ppp', 'usd', 'hdi', 'un', 'us', 'uk', 'eu', 'co2']);

export function humanizeSlug(slug: string): string {
  return slug
    .split('_')
    .map((w, i) => {
      if (ACRONYMS.has(w)) return w.toUpperCase();
      if (SMALL_WORDS.has(w) && i !== 0) return w;
      return w[0]?.toUpperCase() + w.slice(1);
    })
    .join(' ');
}

export function formatNumber(n: number): string {
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e11 || abs < 1e-3)) {
    return n.toExponential(2);
  }
  const maximumFractionDigits = abs >= 100 ? 0 : abs >= 1 ? 2 : 4;
  return new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(n);
}

function singleScopeLabel(scope: string): string {
  const s = scope.trim().toLowerCase();
  if (s === 'countries') return 'Countries';
  if (s === 'states') return 'U.S. States';
  return humanizeSlug(scope);
}

export function scopeLabel(scopes: string[]): string {
  if (scopes.length === 0) return 'Unspecified';
  return scopes.map(singleScopeLabel).join(' & ');
}

/** Collapse one or more source dates (each possibly already a "YYYY-YYYY"
 * range, e.g. when an entity type's own vintage varies by row) into a single
 * display string: a bare year if every date agrees, otherwise the overall
 * "YYYY-YYYY" span. */
export function combineVintage(dates: (string | undefined)[]): string {
  const years = dates
    .flatMap((d) => (d ? d.match(/\d{4}/g) ?? [] : []))
    .map(Number);
  if (years.length === 0) return '';
  const min = Math.min(...years);
  const max = Math.max(...years);
  return min === max ? String(min) : `${min}-${max}`;
}
