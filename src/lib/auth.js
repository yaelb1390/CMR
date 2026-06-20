import { jwtVerify } from 'jose';

/**
 * Extrae y verifica el usuario autenticado desde la cookie auth_token.
 * Centraliza la lógica que estaba duplicada en cada API route.
 * @param {Request} request
 * @returns {Promise<{id, username, rol, nombre} | null>}
 */
export async function getCurrentUser(request) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) return null;
    const secretKey = new TextEncoder().encode(
      process.env.JWT_SECRET || 'super_secret_jwt_key_12345'
    );
    const { payload } = await jwtVerify(token, secretKey);
    return payload;
  } catch {
    return null;
  }
}

/**
 * Retorna la IP del cliente desde los headers de la request.
 * @param {Request} request
 * @returns {string}
 */
export function getClientIp(request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}
