import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    
    // Select payment and join client info
    const res = await query(`
      SELECT p.*, pr.nombre_cliente, pr.monto_aprobado, pr.cuota_mensual, pr.estado as estado_prestamo, pr.dias_atraso
      FROM pagos p
      LEFT JOIN prestamos pr ON p.numero_prestamo = pr.numero_prestamo
      WHERE p.id = $1
    `, [id]);

    if (res.rows.length === 0) {
      return NextResponse.json({ error: "No se encontró ningún registro de pago con este ID." }, { status: 404 });
    }

    const row = res.rows[0];
    return NextResponse.json({
      data: {
        ...row,
        monto_pagado: parseFloat(row.monto_pagado),
        monto_aprobado: parseFloat(row.monto_aprobado),
        cuota_mensual: parseFloat(row.cuota_mensual),
        dias_atraso: parseInt(row.dias_atraso)
      }
    });

  } catch (err) {
    console.error("GET payment detail API error:", err);
    return NextResponse.json({ error: "Error de base de datos al obtener el detalle del pago." }, { status: 500 });
  }
}
