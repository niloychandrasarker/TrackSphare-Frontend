import { Pool, QueryResultRow } from 'pg';

// Use pooled connection for queries, direct for migrations
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Conservative pool size for Neon serverless
const pool = new Pool({
  connectionString,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('Unexpected pg pool error:', err);
});

/**
 * Execute a parameterized SQL query.
 * Always use parameterized queries — never string-interpolate user input.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[]
) {
  const client = await pool.connect();
  try {
    const result = await client.query<T>(sql, params);
    return result;
  } finally {
    client.release();
  }
}

export { pool };
