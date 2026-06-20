import { getConfig } from './config.js';

/**
 * Calcula la mora acumulada según los días de atraso y la frecuencia del préstamo.
 * Los porcentajes se leen desde la tabla configuracion_financiera (nunca hardcoded).
 *
 * @param {number} montoCuota - Monto de la cuota
 * @param {number} diasAtraso - Días de atraso acumulados
 * @param {string} frecuencia - 'diario'|'semanal'|'quincenal'|'mensual'
 * @returns {Promise<number>} - Monto de mora acumulada
 */
export async function calcularMora(montoCuota, diasAtraso, frecuencia = 'mensual') {
  if (diasAtraso <= 0) return 0;

  // Lee porcentaje de mora diaria desde configuración
  const moraDiariaPct = await getConfig('mora_diaria_pct', 0.001); // 0.1% default
  const diasGracia = await getConfig('dias_gracia_default', 3);

  const diasEfectivos = Math.max(0, diasAtraso - diasGracia);
  if (diasEfectivos === 0) return 0;

  // Mora = cuota × tasa_diaria × días_efectivos
  const mora = montoCuota * moraDiariaPct * diasEfectivos;
  return Math.round(mora * 100) / 100;
}

/**
 * Desglosa la mora completa de un préstamo para mostrar en pantalla.
 *
 * @param {object} prestamo - Objeto del préstamo con todos sus campos
 * @returns {Promise<object>} - Desglose completo de mora
 */
export async function calcularDesgloseMora(prestamo) {
  const {
    cuota_mensual,
    balance_pendiente,
    dias_atraso,
    tipo_frecuencia = 'mensual',
    total_cuotas = 1,
    cuotas_pagadas = 0,
  } = prestamo;

  const cuotaValor = parseFloat(cuota_mensual) || 0;
  const balance = parseFloat(balance_pendiente) || 0;
  const dias = parseInt(dias_atraso) || 0;

  // Cuotas vencidas estimadas según frecuencia
  const diasPorCuota = {
    diario: 1,
    semanal: 7,
    quincenal: 15,
    mensual: 30,
  }[tipo_frecuencia] || 30;

  const cuotasVencidas = dias > 0 ? Math.ceil(dias / diasPorCuota) : 0;
  const capitalPendiente = balance;
  const interesPendiente = 0; // Se calculará con tabla cuotas en v2

  const mora = await calcularMora(cuotaValor, dias, tipo_frecuencia);
  const total = capitalPendiente + interesPendiente + mora;

  return {
    cuotasVencidas,
    diasAtraso: dias,
    capitalPendiente,
    interesPendiente,
    moraAcumulada: mora,
    totalGeneral: total,
  };
}
