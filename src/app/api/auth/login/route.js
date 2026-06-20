import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';

export async function POST(request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: "Faltan credenciales." }, { status: 400 });
    }

    const res = await query("SELECT * FROM usuarios WHERE username = $1", [username]);
    if (res.rows.length === 0) {
      return NextResponse.json({ error: "Credenciales inválidas." }, { status: 401 });
    }

    const user = res.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!passwordMatch) {
      return NextResponse.json({ error: "Credenciales inválidas." }, { status: 401 });
    }

    const secretKey = new TextEncoder().encode(process.env.JWT_SECRET || 'super_secret_jwt_key_12345');
    
    const token = await new SignJWT({
      id: user.id,
      username: user.username,
      rol: user.rol,
      nombre: user.nombre
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('8h')
      .sign(secretKey);

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, username: user.username, rol: user.rol, nombre: user.nombre }
    });

    response.cookies.set({
      name: 'auth_token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8 // 8 hours
    });

    return response;
  } catch (err) {
    console.error("Login API error:", err);
    return NextResponse.json({ error: "Error en el servidor al iniciar sesión." }, { status: 500 });
  }
}
