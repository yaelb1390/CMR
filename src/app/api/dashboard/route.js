import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const [
      clientesStatsRes,
      prestamosStatsRes,
      carteraRes,
      alertasRes,
      moraTotalRes
    ] = await Promise.all([
      query(`
        SELECT 
          COUNT(*) as total_clientes,
          SUM(CASE WHEN clasificacion = 'excelente' THEN 1 ELSE 0 END) as excelentes,
          SUM(CASE WHEN clasificacion = 'riesgoso' THEN 1 ELSE 0 END) as morosos,
          SUM(CASE WHEN prestamos_liquidados > 0 AND total_prestamos = prestamos_liquidados THEN 1 ELSE 0 END) as historicos,
          SUM(capital_prestado) as capital_prestado,
          SUM(capital_pagado) as capital_recuperado
        FROM clientes
      `),
      query(`
        SELECT 
          COUNT(*) as total_prestamos,
          SUM(CASE WHEN estado = 'activo' THEN 1 ELSE 0 END) as activos,
          SUM(CASE WHEN estado = 'pagado' THEN 1 ELSE 0 END) as liquidados,
          SUM(CASE WHEN estado = 'atrasado' THEN 1 ELSE 0 END) as atrasados
        FROM prestamos
      `),
      query(`
        SELECT COALESCE(SUM(balance_pendiente), 0) as capital_pendiente 
        FROM prestamos 
        WHERE estado IN ('activo','atrasado')
      `),
      query(`
        SELECT c.nombre as nombre_cliente, p.cedula, p.numero_prestamo, p.balance_pendiente, p.dias_atraso, p.estado 
        FROM prestamos p
        LEFT JOIN clientes c ON p.cedula = c.cedula
        WHERE p.dias_atraso > 0 AND p.balance_pendiente > 0 AND p.estado != 'pagado'
        ORDER BY p.dias_atraso DESC LIMIT 20
      `),
      query(`
        SELECT COALESCE(SUM(mora_acumulada), 0) as total_mora 
        FROM prestamos 
        WHERE dias_atraso > 0 AND balance_pendiente > 0 AND estado != 'pagado'
      `)
    ]);

    const cStats = clientesStatsRes.rows[0];
    const pStats = prestamosStatsRes.rows[0];

    // Calculamos activos como total - históricos
    const historicos = parseInt(cStats.historicos) || 0;
    const activos = (parseInt(cStats.total_clientes) || 0) - historicos;

    return NextResponse.json({
      metrics: {
        clientesActivos: activos,
        clientesHistoricos: historicos,
        prestamosActivos: parseInt(pStats.activos) || 0,
        prestamosLiquidados: parseInt(pStats.liquidados) || 0,
        capitalPrestado: parseFloat(cStats.capital_prestado) || 0,
        capitalRecuperado: parseFloat(cStats.capital_recuperado) || 0,
        capitalPendiente: parseFloat(carteraRes.rows[0].capital_pendiente) || 0,
        clientesExcelentes: parseInt(cStats.excelentes) || 0,
        clientesMorosos: parseInt(cStats.morosos) || 0,
        prestamosEnMora: parseInt(pStats.atrasados) || 0,
        montoTotalMora: parseFloat(moraTotalRes.rows[0].total_mora) || 0
      },
      alertas: alertasRes.rows.map(row => ({
        ...row,
        balance_pendiente: parseFloat(row.balance_pendiente),
        dias_atraso: parseInt(row.dias_atraso)
      }))
    });
  } catch (err) {
    console.error("Dashboard API error:", err);
    return NextResponse.json({ error: "No se pudo conectar a la base de datos o ejecutar la consulta." }, { status: 500 });
  }
}
