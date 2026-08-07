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
