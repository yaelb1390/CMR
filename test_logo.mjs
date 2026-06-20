import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.local') });
dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const res = await pool.query("SELECT valor FROM configuracion_financiera WHERE clave = 'logo_base64'");
    if (res.rows.length > 0 && res.rows[0].valor) {
      const base64Data = res.rows[0].valor;
      console.log('Base64 starts with:', base64Data.substring(0, 50));
      console.log('Total length:', base64Data.length);
      
      const commaIndex = base64Data.indexOf(',');
      if (commaIndex > -1) {
        const part0 = base64Data.substring(0, commaIndex);
        const part1 = base64Data.substring(commaIndex + 1);
        const mimeType = part0.replace('data:', '').replace(';base64', '');
        console.log('Mime type extracted:', mimeType);
        
        const imageBuffer = Buffer.from(part1.trim(), 'base64');
        console.log('Buffer length:', imageBuffer.length);
        
        fs.writeFileSync(path.join(__dirname, 'public', 'test_logo_db.png'), imageBuffer);
        console.log('Wrote to public/test_logo_db.png');
      } else {
        console.log('No comma found in base64 data.');
      }
    } else {
      console.log('No logo found in DB.');
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

run();
