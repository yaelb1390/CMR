import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { jwtVerify } from 'jose';
import { generarCalendarioCuotas } from '@/lib/cuotas';
import { getConfig } from '@/lib/config';

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

export async function PUT(request, { params }) {
  try {
    const rawParam = (await params).numero_prestamo;
    const numero_prestamo = decodeURIComponent(rawParam);
    const user = await getCurrentUser(request);
    
    // 1. Autorización: Solo Admin puede editar
    if (!user || user.rol !== 'admin') {
      return NextResponse.json({ error: "No autorizado. Solo los administradores pueden editar préstamos." }, { status: 403 });
    }

    const body = await request.json();
    const { 
      monto_aprobado, 
      frecuencia, 
      total_cuotas, 
      fecha_inicio, 
      tasa_interes,
      metodo_desembolso,
      banco_nombre,
      numero_cuenta
    } = body;

    // 2. Verificar existencia del préstamo
    const prestamoRes = await query(`SELECT * FROM prestamos WHERE numero_prestamo = $1`, [numero_prestamo]);
    if (prestamoRes.rows.length === 0) {
      return NextResponse.json({ error: "Préstamo no encontrado." }, { status: 404 });
    }
    const prestamo = prestamoRes.rows[0];

    // 3. Verificar que NO existan cuotas pagadas o parcialmente pagadas
    const cuotasPagadasRes = await query(`
      SELECT COUNT(*) as count FROM cuotas 
      WHERE numero_prestamo = $1 AND estado != 'pendiente'
    `, [numero_prestamo]);
    
    if (parseInt(cuotasPagadasRes.rows[0].count) > 0) {
      return NextResponse.json({ 
        error: "No se puede editar este préstamo porque ya tiene pagos registrados. Si cometió un error, deberá reversar los pagos primero." 
      }, { status: 400 });
    }

    // 4. Validar datos financieros
    const monto = parseFloat(monto_aprobado);
    if (isNaN(monto) || monto <= 0) {
      return NextResponse.json({ error: "Monto inválido." }, { status: 400 });
    }

    const min = parseFloat(await getConfig('monto_minimo', 1000));
    const max = parseFloat(await getConfig('monto_maximo', 5000000));

    if (monto < min) {
      return NextResponse.json({ error: `El monto no puede ser menor a RD$ ${min.toLocaleString()}` }, { status: 400 });
    }
    if (monto > max) {
      return NextResponse.json({ error: `El monto no puede ser mayor a RD$ ${max.toLocaleString()}` }, { status: 400 });
    }

    const cuotasNum = parseInt(total_cuotas);
    if (isNaN(cuotasNum) || cuotasNum <= 0) {
      return NextResponse.json({ error: "Cantidad de cuotas inválida." }, { status: 400 });
    }

    const interes = parseFloat(tasa_interes) || 0.05;
    const fInicio = fecha_inicio ? new Date(fecha_inicio) : new Date(prestamo.created_at);

    // 5. Recalcular el calendario
    const calendario = generarCalendarioCuotas(monto, interes, cuotasNum, frecuencia || prestamo.tipo_frecuencia, fInicio);
    
    const cuotaMensualEstimada = calendario[0].monto_cuota;
    const fechaProximoPago = calendario[0].fecha_vencimiento.toISOString().split('T')[0];
    const balanceTotal = calendario.reduce((sum, c) => sum + c.monto_cuota, 0);

    // INICIO TRANSACCIÓN
    await query('BEGIN');

    // 6. Ajustar el capital prestado del cliente
    // Restamos el viejo monto y sumamos el nuevo
    const diffMonto = monto - parseFloat(prestamo.monto_aprobado);
    if (diffMonto !== 0) {
      await query(`
        UPDATE clientes 
        SET capital_prestado = capital_prestado + $1 
        WHERE cedula = $2
      `, [diffMonto, prestamo.cedula]);
    }

    // 7. Actualizar el préstamo
    await query(`
      UPDATE prestamos SET 
        monto_aprobado = $1, 
        balance_pendiente = $2, 
        cuota_mensual = $3,
        fecha_proximo_pago = $4, 
        tipo_frecuencia = $5, 
        total_cuotas = $6, 
        tasa_interes = $7,
        metodo_desembolso = $8, 
        banco_nombre = $9, 
        numero_cuenta = $10
      WHERE numero_prestamo = $11
    `, [
      monto, balanceTotal, cuotaMensualEstimada,
      fechaProximoPago, frecuencia, cuotasNum, interes,
      metodo_desembolso, banco_nombre, numero_cuenta,
      numero_prestamo
    ]);

    // 8. Borrar cuotas viejas e insertar nuevas
    await query(`DELETE FROM cuotas WHERE numero_prestamo = $1`, [numero_prestamo]);

    for (const c of calendario) {
      await query(`
        INSERT INTO cuotas (
          numero_prestamo, cedula, numero_cuota, monto_cuota, monto_capital, monto_interes, fecha_vencimiento, estado
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        numero_prestamo, prestamo.cedula, c.numero_cuota, c.monto_cuota, c.monto_capital, c.monto_interes,
        c.fecha_vencimiento.toISOString().split('T')[0], 'pendiente'
      ]);
    }

    await query('COMMIT');

    // 9. Auditoría
    try {
      const { registrarAuditoria } = await import('@/lib/audit');
      await registrarAuditoria({
        tabla: 'prestamos',
        accion: 'UPDATE',
        registro_id: numero_prestamo,
        datos_anteriores: {
          monto_aprobado: prestamo.monto_aprobado,
          tasa_interes: prestamo.tasa_interes,
          total_cuotas: prestamo.total_cuotas
        },
        datos_nuevos: { 
          monto_aprobado: monto, 
          tasa_interes: interes, 
          total_cuotas: cuotasNum, 
          frecuencia 
        },
        usuario: user
      });
    } catch (e) {
      console.error("Auditoría falló en actualización de préstamo", e);
    }

    return NextResponse.json({ success: true, message: "Préstamo actualizado correctamente." });

  } catch (err) {
    await query('ROLLBACK');
    console.error("Loans PUT API error:", err);
    return NextResponse.json({ error: "Error interno al actualizar el préstamo." }, { status: 500 });
  }
}
