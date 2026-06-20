import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { jwtVerify } from 'jose';

async function getCurrentUser(request) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) return null;
    const secretKey = new TextEncoder().encode(process.env.JWT_SECRET || 'super_secret_jwt_key_12345');
    const { payload } = await jwtVerify(token, secretKey);
    return payload;
  } catch (err) {
    return null;
  }
}



export async function GET(request, { params }) {
  try {
    await ensureMetodosDesembolsoExist();
    const { cedula } = await params;

    // 1. Obtener datos del cliente
    const clientRes = await query(`
      SELECT id, cedula, nombre, telefono, telefono2, direccion, fecha_ingreso,
        score_crediticio, clasificacion, total_prestamos, prestamos_liquidados,
        capital_prestado, capital_pagado, intereses_pagados,
        cuotas_puntuales, cuotas_tardias, max_dias_atraso, promedio_dias_atraso,
        metodo_desembolso, banco_nombre, numero_cuenta, email,
        created_at
      FROM clientes WHERE cedula = $1
    `, [cedula]);
    if (clientRes.rows.length === 0) {
      return NextResponse.json({ error: "No se encontró ningún cliente con esa cédula." }, { status: 404 });
    }

    const clientData = clientRes.rows[0];

    // 2. Obtener lista de préstamos del cliente
    const loansRes = await query(`
      SELECT 
        numero_prestamo, monto_aprobado, balance_pendiente, cuota_mensual, 
        fecha_proximo_pago, estado, dias_atraso, tipo_frecuencia, 
        total_cuotas, cuotas_pagadas, created_at
      FROM prestamos 
      WHERE cedula = $1
      ORDER BY created_at DESC
    `, [cedula]);

    return NextResponse.json({
      data: {
        ...clientData,
        prestamos: loansRes.rows.map(row => ({
          ...row,
          monto_aprobado: parseFloat(row.monto_aprobado),
          balance_pendiente: parseFloat(row.balance_pendiente),
          cuota_mensual: parseFloat(row.cuota_mensual)
        }))
      }
    });
  } catch (err) {
    console.error("Client GET Detail API error:", err);
    return NextResponse.json({ error: "Error de base de datos al obtener el detalle del cliente." }, { status: 500 });
  }
}

async function ensureMetodosDesembolsoExist() {
  try {
    await query(`
      ALTER TABLE clientes 
      ADD COLUMN IF NOT EXISTS metodo_desembolso VARCHAR(20) DEFAULT 'efectivo',
      ADD COLUMN IF NOT EXISTS banco_nombre VARCHAR(100),
      ADD COLUMN IF NOT EXISTS numero_cuenta VARCHAR(50),
      ADD COLUMN IF NOT EXISTS email VARCHAR(150)
    `);
  } catch (err) {
    console.error("Error ensuring columns:", err);
  }
}

export async function PUT(request, { params }) {
  try {
    await ensureMetodosDesembolsoExist();
    const { cedula } = await params;
    const body = await request.json();
    const { nombre, telefono, telefono2, direccion, metodo_desembolso, banco_nombre, numero_cuenta, email } = body;
    const user = await getCurrentUser(request);

    // Check if client exists
    const checkRes = await query("SELECT * FROM clientes WHERE cedula = $1", [cedula]);
    if (checkRes.rows.length === 0) {
      return NextResponse.json({ error: "No se encontró ningún cliente con esta cédula." }, { status: 404 });
    }

    const oldData = checkRes.rows[0];

    // Validation
    if (!nombre || nombre.trim().length < 3 || nombre.trim().length > 100) {
      return NextResponse.json({ error: "El nombre completo debe tener entre 3 y 100 caracteres." }, { status: 400 });
    }

    // Update Client
    await query(`
      UPDATE clientes SET
        nombre = $1,
        telefono = $2,
        telefono2 = $3,
        direccion = $4,
        metodo_desembolso = $5,
        banco_nombre = $6,
        numero_cuenta = $7,
        email = $8,
        updated_at = CURRENT_TIMESTAMP
      WHERE cedula = $9
    `, [
      nombre.trim(),
      telefono || null,
      telefono2 || null,
      direccion || null,
      metodo_desembolso || 'efectivo',
      banco_nombre || null,
      numero_cuenta || null,
      email || null,
      cedula
    ]);

    // Auditoría
    try {
      const { registrarAuditoria } = await import('@/lib/audit');
      await registrarAuditoria({
        tabla: 'clientes',
        accion: 'UPDATE',
        registro_id: cedula,
        datos_anteriores: { nombre: oldData.nombre, telefono: oldData.telefono, telefono2: oldData.telefono2, direccion: oldData.direccion },
        datos_nuevos: { nombre: nombre.trim(), telefono, telefono2, direccion },
        usuario: user
      });
    } catch (e) {
      console.error("Error en auditoría:", e);
    }

    return NextResponse.json({
      success: true,
      message: "Datos del cliente actualizados correctamente",
      data: { cedula, nombre }
    });
  } catch (err) {
    console.error("Client PUT API error:", err);
    return NextResponse.json({ error: "Error de base de datos al actualizar el cliente." }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { cedula } = await params;
    const user = await getCurrentUser(request);

    if (!user || user.rol !== 'admin') {
      return NextResponse.json({ error: "Solo los administradores pueden eliminar clientes." }, { status: 403 });
    }

    const checkRes = await query("SELECT * FROM clientes WHERE cedula = $1", [cedula]);
    if (checkRes.rows.length === 0) {
      return NextResponse.json({ error: "No se encontró ningún cliente con esta cédula." }, { status: 404 });
    }

    const oldData = checkRes.rows[0];

    // Check if client has active loans
    const loansRes = await query("SELECT id FROM prestamos WHERE cedula = $1 AND estado != 'pagado'", [cedula]);
    if (loansRes.rows.length > 0) {
      return NextResponse.json({ error: "No se puede eliminar un cliente con préstamos activos." }, { status: 400 });
    }

    await query("DELETE FROM clientes WHERE cedula = $1", [cedula]);

    // Auditoría
    try {
      const { registrarAuditoria } = await import('@/lib/audit');
      await registrarAuditoria({
        tabla: 'clientes',
        accion: 'DELETE',
        registro_id: cedula,
        datos_anteriores: oldData,
        usuario: user
      });
    } catch (e) {
      console.error("Error en auditoría:", e);
    }

    return NextResponse.json({
      success: true,
      message: "Cliente eliminado correctamente"
    });
  } catch (err) {
    console.error("Client DELETE API error:", err);
    return NextResponse.json({ error: "Error de base de datos al eliminar el cliente." }, { status: 500 });
  }
}
