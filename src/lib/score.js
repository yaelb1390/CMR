/**
 * Calcula el score crediticio de un cliente (0–100).
 * La fórmula pondera: puntualidad (60%), liquidaciones (30%), sin incumplimientos (10%).
 *
 * @param {object} stats - Estadísticas del cliente
 * @returns {{ score: number, clasificacion: string, estrellas: number, color: string }}
 */
export function calcularScore(stats) {
  const {
    cuotas_puntuales = 0,
    cuotas_tardias = 0,
    prestamos_liquidados = 0,
    total_prestamos = 0,
    max_dias_atraso = 0,
    promedio_dias_atraso = 0,
  } = stats;

  const totalCuotas = cuotas_puntuales + cuotas_tardias;

  // Factor de puntualidad (0–1): cuotas a tiempo / total cuotas
  const factorPuntualidad = totalCuotas > 0 ? cuotas_puntuales / totalCuotas : 1;

  // Factor de liquidaciones (0–1): préstamos liquidados / total
  const factorLiquidacion = total_prestamos > 0 ? prestamos_liquidados / total_prestamos : 0;

  // Factor de incumplimientos: penaliza según máximo atraso
  let factorIncumplimiento = 1;
  if (max_dias_atraso > 90) factorIncumplimiento = 0;
  else if (max_dias_atraso > 60) factorIncumplimiento = 0.3;
  else if (max_dias_atraso > 30) factorIncumplimiento = 0.6;
  else if (max_dias_atraso > 15) factorIncumplimiento = 0.8;
  else if (max_dias_atraso > 7) factorIncumplimiento = 0.9;

  // Penalización adicional por promedio de días de atraso
  const penalizacionPromedio = Math.min(promedio_dias_atraso / 100, 0.2);

  // Score ponderado
  const scoreRaw =
    factorPuntualidad * 60 +
    factorLiquidacion * 30 +
    factorIncumplimiento * 10 -
    penalizacionPromedio * 10;

  const score = Math.max(0, Math.min(100, Math.round(scoreRaw * 10) / 10));

  // Clasificación según rango
  let clasificacion, estrellas, color;

  if (score >= 90) {
    clasificacion = 'excelente';
    estrellas = 5;
    color = '#10B981'; // verde
  } else if (score >= 75) {
    clasificacion = 'muy_bueno';
    estrellas = 4;
    color = '#3B82F6'; // azul
  } else if (score >= 55) {
    clasificacion = 'bueno';
    estrellas = 3;
    color = '#F59E0B'; // amarillo
  } else if (score >= 35) {
    clasificacion = 'regular';
    estrellas = 2;
    color = '#F97316'; // naranja
  } else {
    clasificacion = 'riesgoso';
    estrellas = 1;
    color = '#EF4444'; // rojo
  }

  return { score, clasificacion, estrellas, color };
}

/**
 * Textos de clasificación para mostrar en pantalla.
 */
export const CLASIFICACION_LABELS = {
  excelente: '⭐⭐⭐⭐⭐ Excelente',
  muy_bueno: '⭐⭐⭐⭐ Muy Bueno',
  bueno: '⭐⭐⭐ Bueno',
  regular: '⭐⭐ Regular',
  riesgoso: '⭐ Riesgoso',
  nuevo: '🆕 Nuevo Cliente',
};

export const CLASIFICACION_COLORS = {
  excelente: '#10B981',
  muy_bueno: '#3B82F6',
  bueno: '#F59E0B',
  regular: '#F97316',
  riesgoso: '#EF4444',
  nuevo: '#6B7280',
};
