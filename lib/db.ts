import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;

export const HAS_DB = !!DATABASE_URL;

// Lazily created so the module can be imported when DATABASE_URL is unset.
let _sql: ReturnType<typeof neon> | null = null;

function getSql() {
  if (!_sql) {
    if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');
    _sql = neon(DATABASE_URL);
  }
  return _sql;
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const db = getSql();
  const rows = await db(sql, params);
  return rows as T[];
}
