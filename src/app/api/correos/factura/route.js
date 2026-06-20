import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import nodemailer from 'nodemailer';

export async function POST(request) {
  try {
    const body = await request.json();
    const { pagoId } = body;

    if (!pagoId) {
      return NextResponse.json({ error: "El ID del pago es requerido." }, { status: 400 });
    }

    // Obtener información completa del pago, préstamo y cliente
    const pagoRes = await query(`
      SELECT 
        p.id as recibo_no, p.fecha_pago, p.monto_pagado, p.metodo_pago, p.registrado_por,
        pr.numero_prestamo, pr.balance_pendiente, pr.cuota_mensual,
        c.nombre as cliente_nombre, c.cedula, c.email as cliente_email
      FROM pagos p
      JOIN prestamos pr ON p.numero_prestamo = pr.numero_prestamo
      JOIN clientes c ON p.cedula = c.cedula
      WHERE p.id = $1
    `, [pagoId]);

    if (pagoRes.rows.length === 0) {
      return NextResponse.json({ error: "No se encontró el pago." }, { status: 404 });
    }

    const pago = pagoRes.rows[0];

    // Verificar si el cliente tiene correo
    if (!pago.cliente_email) {
      return NextResponse.json({ error: "El cliente no tiene un correo electrónico registrado." }, { status: 400 });
    }

    // Configuración de SMTP (Idealmente de variables de entorno)
    // Para Gmail: SMTP_HOST='smtp.gmail.com', SMTP_PORT=465, SMTP_SECURE=true
    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = parseInt(process.env.SMTP_PORT || '465');
    const smtpSecure = process.env.SMTP_SECURE !== 'false'; // true by default for 465
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpUser || !smtpPass) {
      return NextResponse.json({ error: "El sistema no tiene un correo emisor configurado (Falta SMTP_USER y SMTP_PASS en .env)." }, { status: 500 });
    }

    // Generar Transportador de NodeMailer
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    // Formatear montos
    const formatCurrency = (val) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(val || 0).replace('DOP', 'RD$');
    const balanceAnterior = parseFloat(pago.monto_pagado) + parseFloat(pago.balance_pendiente);

    // Obtener URL del logo (esto asume que el sistema está en un dominio público, si es local usaremos una imagen incrustada o URL absoluta si existe)
    // Por simplicidad en correos, el logo se puede inyectar como base64, o usar el nombre de la empresa como fallback.
    
    const configuracionRes = await query("SELECT config_value FROM configuracion WHERE config_key = 'logo_base64'");
    let logoHtml = `<h2 style="color: #1E3A5F; margin: 0;">Préstamos BM</h2>`;
    if (configuracionRes.rows.length > 0 && configuracionRes.rows[0].config_value) {
      logoHtml = `<img src="${configuracionRes.rows[0].config_value}" alt="Logo" style="max-height: 60px; max-width: 200px;" />`;
    }

    // Diseño del correo (HTML)
    const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-bottom: 1px solid #e5e7eb;">
        ${logoHtml}
      </div>
      <div style="padding: 30px;">
        <h3 style="color: #0f172a; margin-top: 0;">Factura de Pago de Préstamo</h3>
        <p style="color: #475569; font-size: 14px;">Hola <b>${pago.cliente_nombre}</b>,</p>
        <p style="color: #475569; font-size: 14px;">Hemos recibido tu pago exitosamente. A continuación, te presentamos el detalle de tu factura:</p>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px;">
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #64748b;">No. de Recibo</td>
            <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #0f172a; text-align: right; font-weight: bold;">#${String(pago.recibo_no).padStart(6, '0')}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #64748b;">No. de Préstamo</td>
            <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #0f172a; text-align: right;">${pago.numero_prestamo}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #64748b;">Fecha de Pago</td>
            <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #0f172a; text-align: right;">${new Date(pago.fecha_pago).toLocaleString('es-DO')}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #64748b;">Método de Pago</td>
            <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #0f172a; text-align: right; text-transform: capitalize;">${pago.metodo_pago}</td>
          </tr>
        </table>

        <div style="margin-top: 24px; background-color: #f8fafc; padding: 16px; border-radius: 6px;">
          <table style="width: 100%; font-size: 14px;">
            <tr>
              <td style="color: #64748b; padding-bottom: 8px;">Balance Anterior:</td>
              <td style="text-align: right; color: #0f172a; padding-bottom: 8px;">${formatCurrency(balanceAnterior)}</td>
            </tr>
            <tr>
              <td style="color: #10b981; font-weight: bold; font-size: 16px; padding-bottom: 8px;">Monto Recibido:</td>
              <td style="text-align: right; color: #10b981; font-weight: bold; font-size: 16px; padding-bottom: 8px;">${formatCurrency(pago.monto_pagado)}</td>
            </tr>
            <tr>
              <td style="color: #ef4444; font-weight: bold; font-size: 15px; border-top: 1px solid #e2e8f0; padding-top: 8px;">Balance Pendiente:</td>
              <td style="text-align: right; color: #ef4444; font-weight: bold; font-size: 15px; border-top: 1px solid #e2e8f0; padding-top: 8px;">${formatCurrency(pago.balance_pendiente)}</td>
            </tr>
          </table>
        </div>

        <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 30px;">
          Atendido por: ${pago.registrado_por}<br>
          Este es un recibo generado automáticamente por el sistema.
        </p>
      </div>
    </div>
    `;

    // Configurar el mensaje
    const mailOptions = {
      from: `"CRM Préstamos BM" <${smtpUser}>`,
      to: pago.cliente_email,
      subject: `Factura de Pago #${String(pago.recibo_no).padStart(6, '0')} - Préstamos BM`,
      html: htmlContent,
    };

    // Enviar correo
    await transporter.sendMail(mailOptions);

    return NextResponse.json({ success: true, message: "Factura enviada correctamente." });
  } catch (error) {
    console.error("Error enviando factura por correo:", error);
    return NextResponse.json({ error: "Error interno al enviar el correo." }, { status: 500 });
  }
}
