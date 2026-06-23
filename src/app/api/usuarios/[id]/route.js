import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { nombre, rol, password, permisos } = body;

    if (!nombre || !rol) {
      return NextResponse.json({ error: "Nombre y rol son obligatorios" }, { status: 400 });
    }

    // Asegurar que la columna permisos exista en usuarios (self-healing)
    await query(`
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS permisos JSONB DEFAULT '[]'
    `);

    const userPermisos = Array.isArray(permisos) ? permisos : [];

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await query(
        "UPDATE usuarios SET nombre = $1, rol = $2, password_hash = $3, permisos = $4 WHERE id = $5",
        [nombre, rol, hashedPassword, JSON.stringify(userPermisos), id]
      );
    } else {
      await query(
        "UPDATE usuarios SET nombre = $1, rol = $2, permisos = $3 WHERE id = $4",
        [nombre, rol, JSON.stringify(userPermisos), id]
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Error al actualizar usuario" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    // prevent deleting admin if it's the last one
    const check = await query("SELECT rol FROM usuarios WHERE id = $1", [id]);
    if (check.rows.length === 0) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    // Protección: no permitir eliminar el último administrador
    if (check.rows[0].rol === 'admin') {
      const adminCount = await query("SELECT COUNT(*) as cnt FROM usuarios WHERE rol = 'admin'");
      if (parseInt(adminCount.rows[0].cnt) <= 1) {
        return NextResponse.json({ error: "No se puede eliminar el único administrador del sistema." }, { status: 400 });
      }
    }

    await query("DELETE FROM usuarios WHERE id = $1", [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Error al eliminar usuario" }, { status: 500 });
  }
}
