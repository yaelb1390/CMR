/**
 * Genera el calendario de pagos basado en la frecuencia y monto.
 *
 * @param {number} montoAprobado - Monto total del préstamo
 * @param {number} tasaInteres - Tasa de interés (ej. 0.05 para 5%)
 * @param {number} totalCuotas - Número de cuotas
 * @param {string} frecuencia - 'diario'|'semanal'|'quincenal'|'mensual'
 * @param {Date|string} fechaInicio - Fecha de inicio del préstamo
 * @returns {Array} - Array de objetos representando las cuotas
 */
export function generarCalendarioCuotas(montoAprobado, tasaInteres, totalCuotas, frecuencia, fechaInicio) {
  const cuotas = [];
  const montoCapital = montoAprobado / totalCuotas;
  // Simplificación: interés fijo sobre el capital inicial por el periodo del préstamo
  // (Puede ajustarse a saldos insolutos dependiendo de las reglas de negocio)
  const montoInteres = (montoAprobado * tasaInteres) / totalCuotas;
  const montoCuotaTotal = montoCapital + montoInteres;

  let fechaVencimiento = new Date(fechaInicio);

  for (let i = 1; i <= totalCuotas; i++) {
    // Avanzar la fecha según frecuencia
    if (i > 1) { // La primera cuota podría ser a un periodo de distancia desde el inicio
       if (frecuencia === 'diario') {
         fechaVencimiento.setDate(fechaVencimiento.getDate() + 1);
       } else if (frecuencia === 'semanal') {
         fechaVencimiento.setDate(fechaVencimiento.getDate() + 7);
       } else if (frecuencia === 'quincenal') {
         fechaVencimiento.setDate(fechaVencimiento.getDate() + 15);
       } else if (frecuencia === 'mensual') {
         fechaVencimiento.setMonth(fechaVencimiento.getMonth() + 1);
       }
    }

    cuotas.push({
      numero_cuota: i,
      monto_cuota: Math.round(montoCuotaTotal * 100) / 100,
      monto_capital: Math.round(montoCapital * 100) / 100,
      monto_interes: Math.round(montoInteres * 100) / 100,
      fecha_vencimiento: new Date(fechaVencimiento),
      estado: 'pendiente'
    });
  }

  return cuotas;
}
