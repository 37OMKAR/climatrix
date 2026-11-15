// Company-name matching used by "show this company's facilities".
// Compares the full set of meaningful words (not just the first one), so "State Grid" does not
// match "State of California" and "City of London" does not match every "City of …" site.
import { Asset } from '../types/climate';

const STOP = new Set([
  'the', 'of', 'inc', 'corp', 'corporation', 'company', 'co', 'group', 'plc', 'ltd', 'limited', 'llc', 'holding', 'holdings', 'and',
  'sa', 'se', 'nv', 'ag', 'as', 'asa', 'ab', 'oyj', 'spa', 'bv', 'gmbh', 'kk', 'pte', 'pty', 'bhd',
]);
// Generic words that never identify a company on their own
const GENERIC = new Set(['state', 'city', 'port', 'united', 'government', 'china', 'national', 'new', 'republic', 'ministry', 'department',
  'international', 'global', 'authority', 'of', 'public', 'energy', 'power']);

export const entityTokens = (s: string): string[] =>
  (s ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ø/gi, 'o').replace(/&/g, 'and')
    .toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter((w) => w.length > 0 && !STOP.has(w));

/** Back-compat: first distinctive word. */
export const entityKey = (s: string) => entityTokens(s).find((w) => !GENERIC.has(w)) ?? entityTokens(s)[0] ?? '';

/** True when every distinctive word of the shorter name appears in the longer one. */
export function sameEntity(a: string, b: string): boolean {
  const ta = entityTokens(a), tb = entityTokens(b);
  if (!ta.length || !tb.length) return false;
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const distinctive = short.filter((w) => !GENERIC.has(w));
  if (!distinctive.length) return short.join(' ') === long.join(' ');
  const set = new Set(long);
  return short.every((w) => set.has(w));
}

export function assetsForEntity(name: string, pool: Asset[]): Asset[] {
  if (!entityTokens(name).length) return [];
  return pool.filter((a) => sameEntity(name, a.entityName) || sameEntity(name, a.parentEntity));
}
