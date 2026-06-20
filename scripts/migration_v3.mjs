import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log("Alterando tabla clientes para agregar metodos de desembolso...");
    await client.query(`
      ALTER TABLE clientes 
      ADD COLUMN IF NOT EXISTS metodo_desembolso VARCHAR(20) DEFAULT 'efectivo',
      ADD COLUMN IF NOT EXISTS banco_nombre VARCHAR(100),
      ADD COLUMN IF NOT EXISTS numero_cuenta VARCHAR(50)
    `);

    await client.query('COMMIT');
    console.log("Migracion completada exitosamente.");
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error durante la migracion:", err);
  } finally {
    client.release();
    pool.end();
  }
}

runMigration();
