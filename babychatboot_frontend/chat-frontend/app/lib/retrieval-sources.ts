export interface Evidence { title: string; url: string; publisher: string; revisedOn: string; version: string; page: number; excerpt: string; jurisdiction?: string; minAgeMonths?: number | null; maxAgeMonths?: number | null; }
export function readSources(value: string | null | undefined): Evidence[] {
  if (!value || value.length > 20000) return [];
  try {
    const rows: unknown = JSON.parse(value);
    if (!Array.isArray(rows)) return [];
    return rows.slice(0, 5).filter((row): row is Evidence => {
      if (!row || typeof row !== 'object') return false;
      for (const key of ['title', 'url', 'publisher', 'revisedOn', 'version', 'excerpt']) if (typeof row[key] !== 'string') return false;
      if (row.excerpt.length > 4000 || typeof row.page !== 'number' || !Number.isInteger(row.page) || row.page < 0) return false;
      if (row.jurisdiction != null && typeof row.jurisdiction !== 'string') return false;
      for (const key of ['minAgeMonths', 'maxAgeMonths']) if (row[key] != null && (!Number.isInteger(row[key]) || row[key] < 0 || row[key] > 216)) return false;
      const url = new URL(row.url);
      return url.protocol === 'https:' && !url.username && !url.password;
    });
  } catch { return []; }
}
