/** Read-only, CASE-INSENSITIVE access to the page's URL query parameters.
 *  `?speakMode=each`, `?speakmode=each`, `?SPEAKMODE=EACH` all resolve the same.
 *  Parameter names are matched case-insensitively (URLSearchParams.get is not);
 *  values are returned verbatim — callers normalise enum values themselves. */

const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');

// Build a lowercased-key lookup so name lookups are case-insensitive.
const byLowerKey = new Map<string, string>();
for (const [k, v] of params.entries()) {
  const lk = k.toLowerCase();
  if (!byLowerKey.has(lk)) byLowerKey.set(lk, v); // first occurrence wins
}

export const urlParams = {
  get(name: string): string | null {
    return byLowerKey.get(name.toLowerCase()) ?? null;
  },
  has(name: string): boolean {
    return byLowerKey.has(name.toLowerCase());
  },
  /** Get a param and split on commas into a trimmed string array. */
  getList(name: string): string[] | null {
    const v = byLowerKey.get(name.toLowerCase());
    if (v == null) return null;
    return v.split(',').map((s) => s.trim()).filter(Boolean);
  },
  /** The raw URLSearchParams object (case-sensitive) for advanced uses. */
  raw: params,
};
