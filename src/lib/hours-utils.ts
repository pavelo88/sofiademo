import hoursConfig from '@/config/hours_config.json';
import { format, isSaturday, isSunday } from 'date-fns';

export interface HoursBreakdown {
  normal: number;
  extra: number;
  special: number;
}

/**
 * Calcula el desglose de horas basado en la fecha y el total.
 * Regla: 8h normales, el resto extras. 
 * Si es festivo o fin de semana, todas son especiales.
 */
export function calculateHoursBreakdown(totalHours: number, date: Date | string, accumulatedNormalHours: number = 0): HoursBreakdown {
  const d = typeof date === 'string' ? new Date(date) : date;
  const dateStr = format(d, 'yyyy-MM-dd');

  // 1. Verificar Festivos
  const isHoliday = hoursConfig.configuracion_horas.festivos_oficiales.some(f => f.fecha === dateStr);

  // 2. Verificar Fines de Semana
  const isWeekend = isSaturday(d) || isSunday(d);

  if (isHoliday || isWeekend) {
    return {
      normal: 0,
      extra: 0,
      special: Number(totalHours.toFixed(2))
    };
  }

  // 3. Día Laboral Normal
  // Limite de horas normales disponibles en el día (máximo 8)
  const remainingNormalHours = Math.max(0, 8 - accumulatedNormalHours);
  
  const normal = Math.min(totalHours, remainingNormalHours);
  const extra = Math.max(0, totalHours - normal);

  return {
    normal: Number(normal.toFixed(2)),
    extra: Number(extra.toFixed(2)),
    special: 0
  };
}

export function formatTechnicianName(name: string): string {
  if (!name) return '';
  
  // 1. Limpiar si es un email
  const cleanName = name.split('@')[0];
  
  // 2. Si ya tiene espacios y no es email, probablemente ya sea un nombre completo
  if (name.includes(' ') && !name.includes('@')) return name;

  // 3. Casos específicos solicitados
  const map: Record<string, string> = {
    'CARLOSAMARILLA': 'CARLOS AMARILLA',
    'JUANCABRAL': 'JUAN CABRAL',
    'carlosamarilla': 'Carlos Amarilla',
    'juancabral': 'Juan Cabral'
  };

  if (map[cleanName]) return map[cleanName];
  if (map[cleanName.toUpperCase()]) return map[cleanName.toUpperCase()];

  // 4. Intentar separar por CamelCase si no está en el mapa
  const separated = cleanName.replace(/([a-z])([A-Z])/g, '$1 $2');
  
  return separated;
}
