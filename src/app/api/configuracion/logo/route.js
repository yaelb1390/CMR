import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { jwtVerify } from 'jose';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

import fs from 'fs';
import path from 'path';

export async function GET(request) {
  try {
    const res = await query("SELECT valor FROM configuracion_financiera WHERE clave = 'logo_base64'");
    if (res.rows.length > 0 && res.rows[0].valor) {
      const base64Data = res.rows[0].valor;
      
      try {
        const parts = base64Data.split('base64,');
        if (parts.length === 2) {
          const mimePart = parts[0];
          const mimeTypeMatch = mimePart.match(/data:([^;]+)/);
          const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/png';
          
          const cleanBase64 = parts[1].replace(/\s/g, '').replace(/%2B/g, '+').replace(/%2F/g, '/').replace(/%3D/g, '=');
          const imageBuffer = Buffer.from(cleanBase64, 'base64');
          
          return new Response(imageBuffer, {
            status: 200,
            headers: {
              'Content-Type': mimeType,
              'Content-Length': imageBuffer.length.toString(),
              'Cache-Control': 'public, max-age=0, must-revalidate',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
      } catch (err) {
        console.error("Error parsing base64 logo:", err);
      }
    }
    
    return NextResponse.redirect(new URL('/logo.png?v=2', request.url));
  } catch (err) {
    console.error("GET logo error:", err);
    return NextResponse.redirect(new URL('/logo.png?v=2', request.url));
  }
}

export async function POST(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.rol !== 'admin') {
      return NextResponse.json({ error: "Acceso denegado. Solo administradores." }, { status: 403 });
    }

    const body = await request.json();
    const { logo_base64 } = body;

    if (!logo_base64 || !logo_base64.startsWith('data:image/')) {
      return NextResponse.json({ error: "Formato de imagen inválido." }, { status: 400 });
    }

    // Calcular el tamaño aproximado en bytes (base64 incrementa el tamaño ~33%)
    const stringLength = logo_base64.length - (logo_base64.indexOf(',') + 1);
    const sizeInBytes = 4 * Math.ceil(stringLength / 3) * 0.5624896334383812;
    
    if (sizeInBytes > 10 * 1024 * 1024) { // 10 MB límite
      return NextResponse.json({ error: "La imagen es muy grande. El límite es 10MB." }, { status: 400 });
    }

    // Asegurar que la columna 'valor' sea TEXT para soportar Base64 largo
    try {
      await query("ALTER TABLE configuracion_financiera ALTER COLUMN valor TYPE TEXT");
    } catch (e) {
      console.warn("Could not alter column type, ignoring:", e.message);
    }

    // Verificar si existe la clave
    const checkRes = await query("SELECT clave FROM configuracion_financiera WHERE clave = 'logo_base64'");
    
    if (checkRes.rows.length > 0) {
      await query("UPDATE configuracion_financiera SET valor = $1 WHERE clave = 'logo_base64'", [logo_base64]);
    } else {
      await query("INSERT INTO configuracion_financiera (clave, valor, descripcion, tipo) VALUES ($1, $2, $3, $4)", 
        ['logo_base64', logo_base64, 'Logo de la empresa en formato Base64', 'texto']);
    }

    try {
      const parts = logo_base64.split('base64,');
      if (parts.length === 2) {
        const cleanBase64 = parts[1].replace(/\s/g, '').replace(/%2B/g, '+').replace(/%2F/g, '/').replace(/%3D/g, '=');
        const imageBuffer = Buffer.from(cleanBase64, 'base64');
        const fs = require('fs');
        const path = require('path');
        fs.writeFileSync(path.join(process.cwd(), 'public', 'logo.png'), imageBuffer);
      }
    } catch (e) {
      console.error("No se pudo escribir logo.png físicamente", e);
    }

    return NextResponse.json({ success: true, message: "Logo actualizado exitosamente." });
  } catch (err) {
    console.error("POST logo error:", err);
    return NextResponse.json({ error: err.message || "Error al actualizar el logo." }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.rol !== 'admin') {
      return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
    }

    await query("DELETE FROM configuracion_financiera WHERE clave = 'logo_base64'");
    
    return NextResponse.json({ success: true, message: "Logo restablecido al valor por defecto." });
  } catch (err) {
    console.error("DELETE logo error:", err);
    return NextResponse.json({ error: "Error al restablecer el logo." }, { status: 500 });
  }
}
