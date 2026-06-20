import pg from 'pg';

const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000, // 10 seconds connection timeout
  max: 10, // Recommended pool size for transaction pooler
  idleTimeoutMillis: 30000,
  ssl: {
    rejectUnauthorized: false
  }
};

let pool;

if (process.env.NODE_ENV === 'production') {
  pool = new pg.Pool(poolConfig);
} else {
  if (!global.dbPool) {
    global.dbPool = new pg.Pool(poolConfig);
  }
  pool = global.dbPool;
}

/**
 * Execute a query with connection pooling and a 1-retry mechanism.
 * @param {string} text - SQL query string
 * @param {any[]} [params] - Query parameters
 * @returns {Promise<pg.QueryResult>}
 */
export async function query(text, params) {
  let retries = 1;
  while (true) {
    try {
      const res = await pool.query(text, params);
      return res;
    } catch (err) {
      if (retries > 0) {
        console.warn(`Database query failed, retrying once. Error: ${err.message}`);
        retries--;
        await new Promise(resolve => setTimeout(resolve, 200)); // small delay before retry
        continue;
      }
      console.error(`Database query failed after retry: ${err.message}`);
      throw err;
    }
  }
}

export default pool;
