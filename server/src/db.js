import pg from 'pg';
import fs from 'node:fs';

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000
});

// DATE columns come back as plain 'YYYY-MM-DD' strings (no timezone shifts)
pg.types.setTypeParser(1082, (v) => v);
// BIGINT as number (values here are far below 2^53)
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));

export async function migrate() {
  const sql = fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
  await pool.query(sql);
}
