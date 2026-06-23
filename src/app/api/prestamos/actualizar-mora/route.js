import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * POST /api/prestamos/actualizar-mora
 *
 * Recorre todos los préstamos activos o atrasados y recalcula:
 *  - dias_atraso = días transcurridos desde fecha_proximo_pago hasta hoy (si ya pasó)
 *  - estado = 'atrasado' si dias_atraso > 0, 'activo' si no
 *
 * También actualiza fecha_proximo_pago a partir de la próxima cuota
 * pendiente real en la tabla cuotas.
 *
 * Llamar desde un cron, o cada vez que se carga el dashboard.
 */
export async function POST() {
  try {
    // 1. Traer todos los préstamos que aún tienen balance pendiente
    const prestamosRes = await query(`
      SELECT numero_prestamo, fecha_proximo_pago, estado, tipo_frecuencia, dias_atraso
      FROM prestamos
      WHERE estado IN ('activo', 'atrasado') AND balance_pendiente > 0
    `);

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    let actualizados = 0;

    for (const prestamo of prestamosRes.rows) {
      // 2. Buscar la próxima cuota NO pagada (la más antigua)
      const cuotaRes = await query(`
        SELECT fecha_vencimiento
        FROM cuotas
        WHERE numero_prestamo = $1 AND estado != 'pagado'
        ORDER BY numero_cuota ASC
        LIMIT 1
      `, [prestamo.numero_prestamo]);

      let fechaRef;

      if (cuotaRes.rows.length > 0) {
        // Hay cuotas registradas: usar la fecha de la próxima cuota pendiente
        fechaRef = new Date(cuotaRes.rows[0].fecha_vencimiento);
      } else {
        // Sin cuotas registradas: usar fecha_proximo_pago almacenada
        fechaRef = new Date(prestamo.fecha_proximo_pago);
      }

      fechaRef.setHours(0, 0, 0, 0);

      // 3. Calcular días de atraso reales
      const diffMs = hoy - fechaRef;
      const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diasAtraso = Math.max(0, diffDias);

      const nuevoEstado = diasAtraso > 0 ? 'atrasado' : 'activo';

      // 4. Actualizar solo si hay cambio (optimización)
      if (
        parseInt(prestamo.dias_atraso) !== diasAtraso ||
        prestamo.estado !== nuevoEstado ||
        new Date(prestamo.fecha_proximo_pago).toDateString() !== fechaRef.toDateString()
      ) {
        await query(`
          UPDATE prestamos
          SET dias_atraso = $1,
              estado = $2,
              fecha_proximo_pago = $3
          WHERE numero_prestamo = $4
        `, [
          diasAtraso,
          nuevoEstado,
          fechaRef.toISOString().split('T')[0],
          prestamo.numero_prestamo
        ]);
        actualizados++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Mora actualizada. ${actualizados} préstamo(s) actualizados de ${prestamosRes.rows.length} revisados.`,
      actualizados,
      total: prestamosRes.rows.length
    });

  } catch (err) {
    console.error('Error actualizando mora:', err);
    return NextResponse.json({ error: 'Error al actualizar mora.' }, { status: 500 });
  }
}

/**
 * GET /api/prestamos/actualizar-mora
 * Alias para poder llamarlo desde el browser (útil para pruebas).
 */
export async function GET() {
  return POST();
}
