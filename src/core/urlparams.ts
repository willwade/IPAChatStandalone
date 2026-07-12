/** Read-only access to the current page's URL query parameters. */

const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');

export const urlParams = {
  get(name: string): string | null {
    return params.get(name);
  },
  has(name: string): boolean {
    return params.has(name);
  },
  /** Get a param and split on commas into a trimmed string array. */
  getList(name: string): string[] | null {
    const v = params.get(name);
    if (v == null) return null;
    return v.split(',').map((s) => s.trim()).filter(Boolean);
  },
  /** Parse ?key=value&key2=value2 from a hash fragment or arbitrary string. */
  raw: params,
};
