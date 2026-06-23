import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

async function ensureFechaUltimaAlertaColumnExists() {
  try {
    await query(`
      ALTER TABLE prestamos 
      ADD COLUMN IF NOT EXISTS fecha_ultima_alerta TIMESTAMP WITH TIME ZONE;
    `);
  } catch (err) {
    console.error("Error ensuring fecha_ultima_alerta column exists:", err);
  }
}

export async function POST(request) {
  try {
    // 1. Ensure the column exists
    await ensureFechaUltimaAlertaColumnExists();

    const body = await request.json();
    const { cedula, tipo } = body; // tipo: 'mora' or 'preventivo'

    if (!cedula || !tipo) {
      return NextResponse.json({ error: "Cédula y tipo de notificación son requeridos." }, { status: 400 });
    }

    // 2. Fetch client + loan details (JOIN clientes para obtener nombre, telefono y direccion)
    const clientRes = await query(
      `SELECT p.cedula, c.nombre AS nombre_cliente, p.numero_prestamo, 
              p.cuota_mensual, p.balance_pendiente, p.dias_atraso, 
              c.telefono, c.direccion 
       FROM prestamos p
       LEFT JOIN clientes c ON p.cedula = c.cedula
       WHERE p.cedula = $1 AND p.estado != 'pagado'
       ORDER BY p.created_at DESC LIMIT 1`,
      [cedula]
    );

    if (clientRes.rows.length === 0) {
      return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
    }

    const client = clientRes.rows[0];

    // Check if phone number is present
    if (!client.telefono || !client.telefono.trim()) {
      return NextResponse.json({
        error: "El cliente no tiene un número de teléfono registrado. Edita su información e ingresa uno primero."
      }, { status: 400 });
    }

    // 3. Get Webhook URL
    const n8nUrl = process.env.N8N_WEBHOOK_URL;
    console.log("N8N_WEBHOOK_URL value:", n8nUrl);
    console.log("All env keys:", Object.keys(process.env).filter(k => k.includes('N8N')));
    if (!n8nUrl) {
      return NextResponse.json({
        error: `N8N_WEBHOOK_URL no configurada. Vars disponibles: ${Object.keys(process.env).filter(k => k.includes('N8N')).join(', ')}`
      }, { status: 500 });
    }

    // 4. Build payload for n8n
    const payload = {
      cedula: client.cedula,
      nombre: client.nombre_cliente,
      numero_prestamo: client.numero_prestamo,
      cuota: parseFloat(client.cuota_mensual),
      balance_pendiente: parseFloat(client.balance_pendiente),
      dias_atraso: parseInt(client.dias_atraso),
      telefono: client.telefono.trim(),
      tipo: tipo
    };

    // 5. Send webhook to n8n
    const response = await fetch(n8nUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const responseText = await response.text();
      console.error(`n8n webhook failed: ${response.status} - ${responseText}`);
      return NextResponse.json({
        error: `El servidor n8n respondió con error (${response.status}). Verifique la conexión.`
      }, { status: 502 });
    }

    // 6. Update database record with alert timestamp
    await query(
      "UPDATE prestamos SET fecha_ultima_alerta = NOW() WHERE cedula = $1",
      [cedula]
    );

    return NextResponse.json({
      success: true,
      message: "Notificación enviada con éxito a n8n."
    });

  } catch (err) {
    console.error("POST notifications error:", err);
    return NextResponse.json({ error: "Error interno al procesar el envío de alertas." }, { status: 500 });
  }
}
