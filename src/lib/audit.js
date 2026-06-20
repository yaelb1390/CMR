import { query } from './db.js';

/**
 * Registra una acción en la tabla de auditoría.
 *
 * @param {object} params - Parámetros de auditoría
 * @param {string} params.tabla - Nombre de la tabla afectada (ej. 'prestamos', 'clientes')
 * @param {string} params.accion - Acción realizada ('INSERT', 'UPDATE', 'DELETE')
 * @param {string|number} params.registro_id - ID o identificador (ej. cédula) del registro afectado
 * @param {object|null} params.datos_anteriores - Estado del registro antes de la acción
 * @param {object|null} params.datos_nuevos - Estado del registro después de la acción
 * @param {object} params.usuario - Objeto del usuario autenticado ({ id, nombre, rol })
 * @param {string} params.ip - Dirección IP del cliente
 */
export async function registrarAuditoria({
  tabla,
  accion,
  registro_id,
  datos_anteriores = null,
  datos_nuevos = null,
  usuario = null,
  ip = 'unknown'
}) {
  try {
    const userId = usuario ? usuario.id : null;
    const userName = usuario ? usuario.nombre : 'Sistema';

    // No esperar a la base de datos (fire and forget en lo posible, pero lo hacemos await por seguridad en serverless)
    await query(
      `INSERT INTO auditoria (
        tabla, accion, registro_id, datos_anteriores, datos_nuevos, usuario_id, usuario_nombre, ip_address
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        tabla,
        accion,
        String(registro_id),
        datos_anteriores ? JSON.stringify(datos_anteriores) : null,
        datos_nuevos ? JSON.stringify(datos_nuevos) : null,
        userId,
        userName,
        ip
      ]
    );
  } catch (err) {
    // Solo logueamos el error de auditoría, no debe romper el flujo principal
    console.error('Error registrando auditoría:', err.message);
  }
}
