import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await query("SELECT valor FROM configuracion_financiera WHERE clave = 'logo_base64'");
    if (res.rows.length > 0 && res.rows[0].valor) {
      const base64Data = res.rows[0].valor;
      
      const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      
      return NextResponse.json({
        totalLength: base64Data.length,
        hasMatches: !!matches,
        mimeType: matches ? matches[1] : null,
        bufferLength: matches ? matches[2].length : 0,
        startsWith: base64Data.substring(0, 50),
        endsWith: base64Data.substring(base64Data.length - 50)
      });
    }
    return NextResponse.json({ error: 'No logo' });
  } catch (err) {
    return NextResponse.json({ error: err.message });
  }
}
