export function humanizeSlug(slug: string): string {
  return slug
    .split('_')
    .map((w) => (w.length <= 3 && w === w.toLowerCase() ? w.toUpperCase() : w[0]?.toUpperCase() + w.slice(1)))
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

export function scopeLabel(scope: string): string {
  const s = scope.trim().toLowerCase();
  if (s === 'countries') return 'Countries';
  if (s === 'states') return 'U.S. States';
  if (s === 'both') return 'Countries & U.S. States';
  return scope || 'Unspecified';
}
