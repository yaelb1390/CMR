import pg from 'pg';
import bcrypt from 'bcryptjs';

const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
};

const pool = new pg.Pool(poolConfig);

async function migrate() {
  try {
    console.log("Creando tabla de usuarios...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        nombre VARCHAR(100) NOT NULL,
        rol VARCHAR(20) NOT NULL DEFAULT 'colaborador',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("Añadiendo columna 'registrado_por' a prestamos...");
    await pool.query(`
      ALTER TABLE prestamos
      ADD COLUMN IF NOT EXISTS registrado_por VARCHAR(100) DEFAULT 'Sistema'
    `);

    console.log("Creando tabla de pagos...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pagos (
        id SERIAL PRIMARY KEY,
        numero_prestamo VARCHAR(50) NOT NULL,
        cedula VARCHAR(11) NOT NULL,
        monto_pagado NUMERIC(12,2) NOT NULL,
        metodo_pago VARCHAR(50) NOT NULL DEFAULT 'efectivo',
        fecha_pago TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        registrado_por VARCHAR(100) DEFAULT 'Sistema',
        comentario TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_pagos_prestamo ON pagos(numero_prestamo);
    `);

    console.log("Creando usuario administrador por defecto...");
    const checkAdmin = await pool.query("SELECT * FROM usuarios WHERE username = 'admin'");
    if (checkAdmin.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await pool.query(
        "INSERT INTO usuarios (username, password_hash, nombre, rol) VALUES ($1, $2, $3, $4)",
        ['admin', hashedPassword, 'Administrador', 'admin']
      );
      console.log("Usuario 'admin' creado con contraseña 'admin123'.");
    } else {
      console.log("El usuario 'admin' ya existe.");
    }

    console.log("Migración completada con éxito.");
  } catch (error) {
    console.error("Error durante la migración:", error);
  } finally {
    await pool.end();
  }
}

migrate();
