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

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const tab = searchParams.get('tab') || 'activos'; // 'activos' o 'historicos'
    const limit = parseInt(searchParams.get('limit') || '10');
    const page = parseInt(searchParams.get('page') || '1');
    const offset = (page - 1) * limit;

    let whereClause = [];
    let params = [];
    let paramIndex = 1;

    if (search) {
      whereClause.push(`(cedula ILIKE $${paramIndex} OR nombre ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (tab === 'historicos') {

      // Clientes sin préstamos activos
      whereClause.push(`
        cedula NOT IN (SELECT cedula FROM prestamos WHERE estado != 'pagado')
        AND prestamos_liquidados > 0
      `);
    } else {
      // Clientes con préstamos activos o recién creados sin préstamos
      whereClause.push(`
        (cedula IN (SELECT cedula FROM prestamos WHERE estado != 'pagado')
        OR total_prestamos = 0)
      `);
    }

    const user = await getCurrentUser(request);
    if (user && user.rol !== 'admin') {
      // Colaboradores ven clientes con préstamos activos o atrasados (no pagados)
      whereClause.push(`
        cedula IN (
          SELECT cedula FROM prestamos 
          WHERE estado != 'pagado'
        )
      `);
    }

    const whereSql = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';

    // Query for total count
    const countSql = `SELECT COUNT(*) FROM clientes ${whereSql}`;
    const countRes = await query(countSql, params);
    const totalRecords = parseInt(countRes.rows[0].count);

    // Query for data
    params.push(limit);
    const limitParam = `$${paramIndex}`;
    paramIndex++;
    
    params.push(offset);
    const offsetParam = `$${paramIndex}`;
    
    const selectSql = `
      SELECT id, cedula, nombre, telefono, telefono2, direccion, score_crediticio, clasificacion, total_prestamos, prestamos_liquidados, capital_prestado, capital_pagado
      FROM clientes
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `;

    const dataRes = await query(selectSql, params);

    return NextResponse.json({
      data: dataRes.rows,
      pagination: {
        totalRecords,
        totalPages: Math.ceil(totalRecords / limit),
        currentPage: page,
        limit
      }
    });
  } catch (err) {
    console.error("Clients GET API error:", err);
    return NextResponse.json({ error: "Error de base de datos al listar clientes." }, { status: 500 });
  }
}

async function ensureColumnsExist() {
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

export async function POST(request) {
  try {
    await ensureColumnsExist();
    const user = await getCurrentUser(request);

    const body = await request.json();
    const { cedula, nombre, telefono, telefono2, direccion, metodo_desembolso, banco_nombre, numero_cuenta, email } = body;

    // 1. Validation
    if (!cedula || !/^\d{11}$/.test(cedula)) {
      return NextResponse.json({ error: "La cédula debe contener exactamente 11 dígitos numéricos." }, { status: 400 });
    }

    if (!nombre || nombre.trim().length < 3 || nombre.trim().length > 100) {
      return NextResponse.json({ error: "El nombre completo debe tener entre 3 y 100 caracteres." }, { status: 400 });
    }

    // 2. Check duplicate cedula
    const checkCedula = await query("SELECT id FROM clientes WHERE cedula = $1", [cedula]);
    if (checkCedula.rows.length > 0) {
      return NextResponse.json({ error: "Ya existe un cliente registrado con esta cédula" }, { status: 409 });
    }

    // 3. Insert Client
    await query(`
      INSERT INTO clientes (cedula, nombre, telefono, telefono2, direccion, metodo_desembolso, banco_nombre, numero_cuenta, email) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      cedula,
      nombre.trim(),
      telefono || null,
      telefono2 || null,
      direccion || null,
      metodo_desembolso || 'efectivo',
      banco_nombre || null,
      numero_cuenta || null,
      email || null
    ]);

    // Auditoría
    try {
      const { registrarAuditoria } = await import('@/lib/audit');
      await registrarAuditoria({
        tabla: 'clientes',
        accion: 'INSERT',
        registro_id: cedula,
        datos_nuevos: { cedula, nombre, telefono, direccion, metodo_desembolso },
        usuario: user
      });
    } catch (e) {
      console.error("Error en auditoría:", e);
    }

    return NextResponse.json({
      success: true,
      message: "Cliente registrado correctamente",
      data: { cedula, nombre }
    }, { status: 201 });
  } catch (err) {
    console.error("Clients POST API error:", err);
    return NextResponse.json({ error: "Error de base de datos al guardar el cliente." }, { status: 500 });
  }
}

