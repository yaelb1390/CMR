import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function GET() {
  try {
    // Asegurar que la columna permisos exista en usuarios (self-healing)
    await query(`
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS permisos JSONB DEFAULT '[]'
    `);
    const res = await query("SELECT id, username, nombre, rol, permisos, created_at FROM usuarios ORDER BY id ASC");
    return NextResponse.json({ data: res.rows.map(row => ({
      ...row,
      permisos: Array.isArray(row.permisos) ? row.permisos : []
    })) });
  } catch (err) {
    return NextResponse.json({ error: "Error al obtener usuarios" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { username, password, nombre, rol, permisos } = body;

    if (!username || !password || !nombre || !rol) {
      return NextResponse.json({ error: "Todos los campos son obligatorios" }, { status: 400 });
    }

    const check = await query("SELECT id FROM usuarios WHERE username = $1", [username]);
    if (check.rows.length > 0) {
      return NextResponse.json({ error: "El usuario ya existe" }, { status: 409 });
    }

    // Asegurar que la columna permisos exista en usuarios (self-healing)
    await query(`
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS permisos JSONB DEFAULT '[]'
    `);

    const hashedPassword = await bcrypt.hash(password, 10);
    const userPermisos = Array.isArray(permisos) ? permisos : [];
    
    await query(
      "INSERT INTO usuarios (username, password_hash, nombre, rol, permisos) VALUES ($1, $2, $3, $4, $5)",
      [username, hashedPassword, nombre, rol, JSON.stringify(userPermisos)]
    );

    return NextResponse.json({ success: true, message: "Usuario creado" }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Error al crear usuario" }, { status: 500 });
  }
}
