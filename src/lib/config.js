import { query } from './db.js';

// Memoria caché simple en el servidor
let configCache = {};
let lastFetch = 0;
const CACHE_TTL = 1000 * 60 * 5; // 5 minutos

/**
 * Obtiene un valor de la configuración financiera desde la base de datos.
 * Usa caché en memoria para evitar saturar la BD.
 *
 * @param {string} clave - La clave del parámetro
 * @param {any} valorPorDefecto - Valor a retornar si no existe
 * @returns {Promise<any>}
 */
export async function getConfig(clave, valorPorDefecto = null) {
  const now = Date.now();

  // Si el caché expiró, recargar toda la config
  if (now - lastFetch > CACHE_TTL || Object.keys(configCache).length === 0) {
    try {
      const res = await query('SELECT clave, valor, tipo FROM configuracion_financiera');
      const newCache = {};
      res.rows.forEach(row => {
        let val = row.valor;
        if (row.tipo === 'decimal') val = parseFloat(val);
        else if (row.tipo === 'integer') val = parseInt(val, 10);
        else if (row.tipo === 'booleano') val = val === 'true';
        newCache[row.clave] = val;
      });
      configCache = newCache;
      lastFetch = now;
    } catch (err) {
      console.warn('Error cargando configuracion_financiera (tal vez la tabla no existe aún):', err.message);
      // Fallback al default sin actualizar lastFetch
    }
  }

  if (configCache[clave] !== undefined) {
    return configCache[clave];
  }

  return valorPorDefecto;
}

/**
 * Invalida el caché manualmente (útil tras actualizar config).
 */
export function invalidateConfigCache() {
  lastFetch = 0;
  configCache = {};
}
