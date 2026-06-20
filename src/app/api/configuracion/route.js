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
    const user = await getCurrentUser(request);
    if (!user || user.rol !== 'admin') {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const res = await query('SELECT clave, valor, descripcion, tipo FROM configuracion_financiera ORDER BY clave');
    return NextResponse.json({ data: res.rows });
  } catch (err) {
    console.error("Config GET API error:", err);
    return NextResponse.json({ error: "Error al obtener configuración" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.rol !== 'admin') {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { clave, valor } = body;

    if (!clave || valor === undefined) {
      return NextResponse.json({ error: "Clave y valor requeridos" }, { status: 400 });
    }

    // Get old value for audit
    const oldRes = await query('SELECT valor FROM configuracion_financiera WHERE clave = $1', [clave]);
    const oldValor = oldRes.rows.length > 0 ? oldRes.rows[0].valor : null;

    await query(
      `INSERT INTO configuracion_financiera (clave, valor, actualizado_por) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (clave) DO UPDATE SET valor = $2, actualizado_por = $3, updated_at = CURRENT_TIMESTAMP`,
      [clave, valor, user.nombre]
    );

    // Auditoría
    try {
      const { registrarAuditoria } = await import('@/lib/audit');
      await registrarAuditoria({
        tabla: 'configuracion_financiera',
        accion: 'UPDATE',
        registro_id: clave,
        datos_anteriores: { valor: oldValor },
        datos_nuevos: { valor },
        usuario: user
      });
    } catch (e) {
      console.error("Error en auditoría:", e);
    }

    return NextResponse.json({ success: true, message: "Configuración actualizada" });
  } catch (err) {
    console.error("Config PUT API error:", err);
    return NextResponse.json({ error: "Error al actualizar configuración" }, { status: 500 });
  }
}
