import pg from 'pg';
import bcrypt from 'bcryptjs';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkAndResetUsers() {

  try {
    console.log('\n=== VERIFICANDO USUARIOS EN LA BD ===\n');

    // List all users
    const users = await pool.query('SELECT id, username, nombre, rol, password_hash FROM usuarios')

    if (users.rows.length === 0) {
      console.log('⚠️  No hay usuarios en la base de datos. Creando admin...');
    } else {
      console.log(`Encontrados ${users.rows.length} usuario(s):\n`);
      for (const u of users.rows) {
        console.log(`  ID: ${u.id}`);
        console.log(`  Username: ${u.username}`);
        console.log(`  Nombre: ${u.nombre}`);
        console.log(`  Rol: ${u.rol}`);
        console.log(`  Hash: ${u.password_hash.substring(0, 30)}...`);
        console.log('');
      }
    }

    // Reset admin password to 'admin123'
    const NEW_PASSWORD = 'admin123';
    const newHash = await bcrypt.hash(NEW_PASSWORD, 10);

    const existing = await pool.query("SELECT id FROM usuarios WHERE username = 'admin'");

    if (existing.rows.length > 0) {
      await pool.query(
        "UPDATE usuarios SET password_hash = $1 WHERE username = 'admin'",
        [newHash]
      );
      console.log(`✅ Contraseña del usuario 'admin' RESETEADA a: ${NEW_PASSWORD}`);
    } else {
      await pool.query(
        "INSERT INTO usuarios (username, password_hash, nombre, rol) VALUES ($1, $2, $3, $4)",
        ['admin', newHash, 'Administrador', 'admin']
      );
      console.log(`✅ Usuario 'admin' CREADO con contraseña: ${NEW_PASSWORD}`);
    }

    // Verify the new hash works
    const verify = await pool.query("SELECT password_hash FROM usuarios WHERE username = 'admin'");
    const ok = await bcrypt.compare(NEW_PASSWORD, verify.rows[0].password_hash);
    console.log(`\n🔐 Verificación bcrypt: ${ok ? '✅ CORRECTA' : '❌ FALLÓ'}`);
    console.log('\n=== CREDENCIALES DE ACCESO ===');
    console.log(`  Usuario: admin`);
    console.log(`  Contraseña: ${NEW_PASSWORD}`);
    console.log('===============================\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkAndResetUsers();
