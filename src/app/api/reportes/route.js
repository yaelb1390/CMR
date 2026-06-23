import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request) {
  try {
    // 1. Cartera en riesgo (Mora) segmentada
    const riskQuery = await query(`
      SELECT 
        COALESCE(SUM(CASE WHEN dias_atraso > 0 AND dias_atraso <= 30 THEN balance_pendiente ELSE 0 END), 0) as mora_30_monto,
        COALESCE(COUNT(CASE WHEN dias_atraso > 0 AND dias_atraso <= 30 THEN 1 END), 0) as mora_30_cant,
        
        COALESCE(SUM(CASE WHEN dias_atraso > 30 AND dias_atraso <= 90 THEN balance_pendiente ELSE 0 END), 0) as mora_90_monto,
        COALESCE(COUNT(CASE WHEN dias_atraso > 30 AND dias_atraso <= 90 THEN 1 END), 0) as mora_90_cant,
        
        COALESCE(SUM(CASE WHEN dias_atraso > 90 THEN balance_pendiente ELSE 0 END), 0) as mora_mas_90_monto,
        COALESCE(COUNT(CASE WHEN dias_atraso > 90 THEN 1 END), 0) as mora_mas_90_cant,
        
        COALESCE(SUM(CASE WHEN dias_atraso > 0 THEN balance_pendiente ELSE 0 END), 0) as total_mora_monto,
        COALESCE(COUNT(CASE WHEN dias_atraso > 0 THEN 1 END), 0) as total_mora_cant
      FROM prestamos
    `);
    
    const riskMetrics = riskQuery.rows[0];

    // Detail lists for Mora (JOIN clientes para obtener nombre_cliente)
    const listMoraQuery = await query(`
      SELECT p.cedula, c.nombre AS nombre_cliente, p.numero_prestamo, 
             p.balance_pendiente, p.cuota_mensual, p.dias_atraso, p.estado
      FROM prestamos p
      LEFT JOIN clientes c ON p.cedula = c.cedula
      WHERE p.dias_atraso > 0 AND p.balance_pendiente > 0
      ORDER BY p.dias_atraso DESC
    `);

    // 2. Cobros por periodo (Pagos)
    // Note: uses timezone-independent INTERVAL calculation
    const paymentsSummaryQuery = await query(`
      SELECT
        COALESCE(SUM(CASE WHEN fecha_pago >= NOW() - INTERVAL '1 day' THEN monto_pagado ELSE 0 END), 0) as cobros_hoy,
        COALESCE(SUM(CASE WHEN fecha_pago >= NOW() - INTERVAL '7 days' THEN monto_pagado ELSE 0 END), 0) as cobros_semana,
        COALESCE(SUM(CASE WHEN fecha_pago >= NOW() - INTERVAL '30 days' THEN monto_pagado ELSE 0 END), 0) as cobros_mes
      FROM pagos
    `);

    const paymentsMetrics = paymentsSummaryQuery.rows[0];

    // List of payments in the last 30 days
    const listPaymentsQuery = await query(`
      SELECT p.id, p.numero_prestamo, p.cedula, pr.nombre_cliente, p.monto_pagado, p.metodo_pago, p.fecha_pago, p.registrado_por
      FROM pagos p
      LEFT JOIN prestamos pr ON p.numero_prestamo = pr.numero_prestamo
      WHERE p.fecha_pago >= NOW() - INTERVAL '30 days'
      ORDER BY p.fecha_pago DESC
    `);

    // 3. Préstamos por vencer (próximos 14 días)
    const upcomingMaturitiesQuery = await query(`
      SELECT cedula, nombre_cliente, numero_prestamo, balance_pendiente, cuota_mensual, fecha_proximo_pago, estado
      FROM prestamos
      WHERE estado = 'activo' 
        AND balance_pendiente > 0
        AND fecha_proximo_pago >= CURRENT_DATE 
        AND fecha_proximo_pago <= CURRENT_DATE + INTERVAL '14 days'
      ORDER BY fecha_proximo_pago ASC
    `);

    return NextResponse.json({
      metrics: {
        carteraRiesgo: {
          mora30monto: parseFloat(riskMetrics.mora_30_monto),
          mora30cant: parseInt(riskMetrics.mora_30_cant),
          mora90monto: parseFloat(riskMetrics.mora_90_monto),
          mora90cant: parseInt(riskMetrics.mora_90_cant),
          moraMas90monto: parseFloat(riskMetrics.mora_mas_90_monto),
          moraMas90cant: parseInt(riskMetrics.mora_mas_90_cant),
          totalMoraMonto: parseFloat(riskMetrics.total_mora_monto),
          totalMoraCant: parseInt(riskMetrics.total_mora_cant)
        },
        cobros: {
          hoy: parseFloat(paymentsMetrics.cobros_hoy),
          semana: parseFloat(paymentsMetrics.cobros_semana),
          mes: parseFloat(paymentsMetrics.cobros_mes)
        }
      },
      lists: {
        mora: listMoraQuery.rows.map(r => ({ ...r, balance_pendiente: parseFloat(r.balance_pendiente), cuota_mensual: parseFloat(r.cuota_mensual), dias_atraso: parseInt(r.dias_atraso) })),
        pagos: listPaymentsQuery.rows.map(r => ({ ...r, monto_pagado: parseFloat(r.monto_pagado) })),
        vencimientos: upcomingMaturitiesQuery.rows.map(r => ({ ...r, balance_pendiente: parseFloat(r.balance_pendiente), cuota_mensual: parseFloat(r.cuota_mensual) }))
      }
    });

  } catch (err) {
    console.error("GET reports API error:", err);
    return NextResponse.json({ error: "Error de base de datos al generar reportes." }, { status: 500 });
  }
}
