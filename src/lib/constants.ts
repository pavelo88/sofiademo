export const OT_STATUS = {
  REGISTRADA: 'Registrada',
  EN_PROCESO: 'En Proceso',
  COMPLETADA: 'Completada'
} as const;

const normalizeStatusText = (status: unknown): string =>
  String(status || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase();

export const normalizeOtStatus = (status: unknown): string => {
  const normalized = normalizeStatusText(status);
  if (['abierta', 'registrada', 'pendiente'].includes(normalized)) return OT_STATUS.REGISTRADA;
  if (['en proceso', 'en progreso', 'proceso'].includes(normalized)) return OT_STATUS.EN_PROCESO;
  if (['completada', 'completa', 'cerrada', 'finalizada'].includes(normalized)) return OT_STATUS.COMPLETADA;
  return String(status || OT_STATUS.REGISTRADA).trim() || OT_STATUS.REGISTRADA;
};

// Lista de estados en los que una OT se considera "Activa" (puede recibir horas, gastos o informes)
export const ACTIVE_OT_STATUSES = [
  OT_STATUS.EN_PROCESO,
  OT_STATUS.REGISTRADA,
  'Abierta',
  'En Progreso',
  'en proceso',
  'registrada'
];

export const isActiveOtStatus = (status: unknown): boolean =>
  [OT_STATUS.REGISTRADA, OT_STATUS.EN_PROCESO].includes(normalizeOtStatus(status) as any);

export const isCompletedOtStatus = (status: unknown): boolean =>
  normalizeOtStatus(status) === OT_STATUS.COMPLETADA;

// Lista de estados estándar de la app (para dropdowns y filtros)
export const STANDARD_OT_STATUSES = [
  OT_STATUS.REGISTRADA,
  OT_STATUS.EN_PROCESO,
  OT_STATUS.COMPLETADA
];
