import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const term = searchParams.get('q') || '';

    if (!term.trim()) {
      return NextResponse.json({ data: [] });
    }

    const res = await query(`
      SELECT c.cedula, c.nombre as nombre_cliente, 
             COALESCE((SELECT SUM(balance_pendiente) FROM prestamos p WHERE p.cedula = c.cedula AND p.estado != 'pagado'), 0) as balance_pendiente,
             (CASE WHEN EXISTS (SELECT 1 FROM prestamos p WHERE p.cedula = c.cedula AND p.estado = 'activo') THEN 'activo' 
                   WHEN EXISTS (SELECT 1 FROM prestamos p WHERE p.cedula = c.cedula AND p.estado = 'atrasado') THEN 'atrasado'
                   ELSE 'nuevo' END) as estado
      FROM clientes c
      WHERE c.cedula ILIKE $1 OR c.nombre ILIKE $1
      LIMIT 5
    `, [`%${term}%`]);

    return NextResponse.json({
      data: res.rows.map(row => ({
        ...row,
        balance_pendiente: parseFloat(row.balance_pendiente)
      }))
    });
  } catch (err) {
    console.error("Global Search API error:", err);
    return NextResponse.json({ error: "Error de base de datos al realizar la búsqueda." }, { status: 500 });
  }
}
