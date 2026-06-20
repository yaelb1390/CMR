import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Cargar .env.local manualmente (Next.js no lo expone al correr scripts directamente)
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const envPath = resolve(__dirname, '../.env.local');
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const value = trimmed.substring(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
  console.log('✅ Variables de entorno cargadas desde .env.local');
} catch (e) {
  console.warn('⚠️  No se pudo leer .env.local:', e.message);
}

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ ERROR: No se encontró la variable DATABASE_URL.');
  process.exit(1);
}

console.log('🔗 Conectando a:', DATABASE_URL.replace(/:([^:@]+)@/, ':****@'));

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrateV2() {
  const client = await pool.connect();
  try {
    console.log("Iniciando migración v2...");
    await client.query('BEGIN');

    // 1. Crear tabla configuracion_financiera
    console.log("Creando tabla configuracion_financiera...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS configuracion_financiera (
        id SERIAL PRIMARY KEY,
        clave VARCHAR(50) UNIQUE NOT NULL,
        valor VARCHAR(255) NOT NULL,
        descripcion TEXT,
        tipo VARCHAR(20) DEFAULT 'decimal',
        actualizado_por VARCHAR(100) DEFAULT 'Sistema',
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insertar configuraciones por defecto si no existen
    const defaultConfigs = [
      ['mora_diaria_pct', '0.001', 'Porcentaje de mora diaria (0.001 = 0.1%)', 'decimal'],
      ['mora_semanal_pct', '0.005', 'Porcentaje de mora semanal', 'decimal'],
      ['mora_quincenal_pct', '0.010', 'Porcentaje de mora quincenal', 'decimal'],
      ['mora_mensual_pct', '0.020', 'Porcentaje de mora mensual', 'decimal'],
      ['tasa_interes_default', '0.05', 'Tasa de interés por defecto (0.05 = 5%)', 'decimal'],
      ['dias_gracia_default', '3', 'Días de gracia antes de aplicar mora', 'integer'],
      ['moneda', 'DOP', 'Moneda principal del sistema', 'texto'],
      ['monto_minimo', '1000', 'Monto mínimo de préstamo', 'decimal'],
      ['monto_maximo', '5000000', 'Monto máximo de préstamo', 'decimal'],
    ];

    for (const [clave, valor, descripcion, tipo] of defaultConfigs) {
      await client.query(`
        INSERT INTO configuracion_financiera (clave, valor, descripcion, tipo)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (clave) DO NOTHING
      `, [clave, valor, descripcion, tipo]);
    }

    // 2. Crear tabla clientes
    console.log("Creando tabla clientes...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS clientes (
        id SERIAL PRIMARY KEY,
        cedula VARCHAR(11) UNIQUE NOT NULL,
        nombre VARCHAR(100) NOT NULL,
        telefono VARCHAR(20),
        telefono2 VARCHAR(20),
        direccion TEXT,
        fecha_ingreso TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        score_crediticio NUMERIC(5,2) DEFAULT 100,
        clasificacion VARCHAR(20) DEFAULT 'nuevo',
        total_prestamos INT DEFAULT 0,
        prestamos_liquidados INT DEFAULT 0,
        prestamos_cancelados INT DEFAULT 0,
        capital_prestado NUMERIC(14,2) DEFAULT 0,
        capital_pagado NUMERIC(14,2) DEFAULT 0,
        intereses_pagados NUMERIC(14,2) DEFAULT 0,
        cuotas_puntuales INT DEFAULT 0,
        cuotas_tardias INT DEFAULT 0,
        promedio_dias_atraso NUMERIC(6,2) DEFAULT 0,
        max_dias_atraso INT DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. Alterar tabla prestamos
    console.log("Alterando tabla prestamos...");
    await client.query(`
      ALTER TABLE prestamos 
      ADD COLUMN IF NOT EXISTS tipo_frecuencia VARCHAR(20) DEFAULT 'mensual',
      ADD COLUMN IF NOT EXISTS total_cuotas INT DEFAULT 1,
      ADD COLUMN IF NOT EXISTS cuotas_pagadas INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS tasa_interes NUMERIC(6,4) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS monto_interes NUMERIC(14,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS fecha_inicio DATE,
      ADD COLUMN IF NOT EXISTS fecha_fin DATE,
      ADD COLUMN IF NOT EXISTS mora_acumulada NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS dias_gracia INT DEFAULT 3,
      ADD COLUMN IF NOT EXISTS metodo_desembolso VARCHAR(30) DEFAULT 'efectivo',
      ADD COLUMN IF NOT EXISTS banco_nombre VARCHAR(100),
      ADD COLUMN IF NOT EXISTS numero_cuenta VARCHAR(50)
    `);

    // 4. Crear tabla cuotas
    console.log("Creando tabla cuotas...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS cuotas (
        id SERIAL PRIMARY KEY,
        numero_prestamo VARCHAR(50) NOT NULL,
        cedula VARCHAR(11) NOT NULL,
        numero_cuota INT NOT NULL,
        monto_cuota NUMERIC(12,2) NOT NULL,
        monto_capital NUMERIC(12,2) DEFAULT 0,
        monto_interes NUMERIC(12,2) DEFAULT 0,
        fecha_vencimiento DATE NOT NULL,
        fecha_pago TIMESTAMP WITH TIME ZONE,
        estado VARCHAR(20) DEFAULT 'pendiente',
        dias_atraso INT DEFAULT 0,
        mora_calculada NUMERIC(10,2) DEFAULT 0,
        pago_id INT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 5. Crear tabla auditoria
    console.log("Creando tabla auditoria...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS auditoria (
        id SERIAL PRIMARY KEY,
        tabla VARCHAR(50) NOT NULL,
        accion VARCHAR(20) NOT NULL,
        registro_id VARCHAR(100),
        datos_anteriores JSONB,
        datos_nuevos JSONB,
        usuario_id INT,
        usuario_nombre VARCHAR(100),
        ip_address VARCHAR(45),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 6. Migrar datos existentes de prestamos a clientes
    console.log("Migrando datos de clientes...");
    const prestamosUnicos = await client.query(`
      SELECT DISTINCT ON (cedula) 
        cedula, nombre_cliente, telefono, direccion, created_at, monto_aprobado, balance_pendiente, estado, dias_atraso
      FROM prestamos
      ORDER BY cedula, created_at DESC
    `);

    for (const p of prestamosUnicos.rows) {
      const isLiquidado = p.balance_pendiente <= 0 || p.estado === 'pagado';
      await client.query(`
        INSERT INTO clientes (
          cedula, nombre, telefono, direccion, fecha_ingreso, 
          total_prestamos, prestamos_liquidados, capital_prestado,
          clasificacion, max_dias_atraso
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (cedula) DO NOTHING
      `, [
        p.cedula,
        p.nombre_cliente,
        p.telefono,
        p.direccion,
        p.created_at,
        1, // Asumimos 1 préstamo inicial por ahora
        isLiquidado ? 1 : 0,
        p.monto_aprobado,
        p.dias_atraso > 0 ? 'riesgoso' : (isLiquidado ? 'excelente' : 'bueno'),
        p.dias_atraso || 0
      ]);
    }

    // 7. Generar cuotas para préstamos activos existentes
    console.log("Generando cuotas para préstamos existentes...");
    const prestamosActivos = await client.query(`
      SELECT numero_prestamo, cedula, monto_aprobado, balance_pendiente, cuota_mensual, fecha_proximo_pago
      FROM prestamos
      WHERE estado != 'pagado'
    `);

    for (const p of prestamosActivos.rows) {
      // Verificar si ya tiene cuotas
      const cuotasExistentes = await client.query('SELECT id FROM cuotas WHERE numero_prestamo = $1', [p.numero_prestamo]);
      if (cuotasExistentes.rows.length === 0) {
        // Calcular cuotas restantes aproximadamente
        const balance = parseFloat(p.balance_pendiente);
        const cuota = parseFloat(p.cuota_mensual) || balance;
        let cuotasRestantes = Math.ceil(balance / cuota);
        if (cuotasRestantes === 0) cuotasRestantes = 1;

        let fechaVenc = new Date(p.fecha_proximo_pago);
        if (isNaN(fechaVenc.getTime())) fechaVenc = new Date();

        for (let i = 1; i <= cuotasRestantes; i++) {
          const montoC = i === cuotasRestantes ? (balance - (cuota * (cuotasRestantes - 1))) : cuota;
          await client.query(`
            INSERT INTO cuotas (
              numero_prestamo, cedula, numero_cuota, monto_cuota, monto_capital,
              fecha_vencimiento, estado
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            p.numero_prestamo, p.cedula, i, montoC, montoC,
            fechaVenc.toISOString().split('T')[0], 'pendiente'
          ]);
          
          // Avanzar un mes para la próxima cuota (asumiendo mensual por defecto)
          fechaVenc.setMonth(fechaVenc.getMonth() + 1);
        }
      }
    }

    // 8. Crear Índices de Optimización
    console.log("Creando índices...");
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_prestamos_cedula ON prestamos(cedula);
      CREATE INDEX IF NOT EXISTS idx_prestamos_estado ON prestamos(estado);
      CREATE INDEX IF NOT EXISTS idx_prestamos_numero ON prestamos(numero_prestamo);
      CREATE INDEX IF NOT EXISTS idx_cuotas_prestamo ON cuotas(numero_prestamo);
      CREATE INDEX IF NOT EXISTS idx_cuotas_estado ON cuotas(estado);
      CREATE INDEX IF NOT EXISTS idx_auditoria_tabla ON auditoria(tabla);
    `);

    // 9. Agregar columna telefono2 si no existe (compatibilidad con esquemas ya creados)
    console.log("Verificando columna telefono2...");
    await client.query(`
      ALTER TABLE clientes ADD COLUMN IF NOT EXISTS telefono2 VARCHAR(20)
    `);

    await client.query('COMMIT');
    console.log("✅ Migración v2 completada con éxito.");
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("❌ Error durante la migración v2:", error);
  } finally {
    client.release();
    await pool.end();
  }
}

migrateV2();
