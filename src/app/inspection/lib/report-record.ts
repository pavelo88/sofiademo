'use client';

const REPORT_FORM_TYPES = new Set([
  'hoja-trabajo',
  'informe-revision',
  'informe-tecnico',
  'informe-simplificado',
  'revision-basica',
]);

const asText = (value: unknown) => (typeof value === 'string' ? value : '');

const OT_ID_PATTERN = /^OT-\d{4}-\d{4}(?:-.+)?$/i;
const CREATION_REPORT_ID_PATTERN = /^(HT|IR|IT|IS|RB)-[A-Z]{2}-\d{4}-\d{4}$/i;
const APPROVAL_REPORT_ID_PATTERN = /^(HT|IR|IT|IS|RB)-\d{4}-\d{3}$/i;

export const isOtLikeId = (value: unknown) => OT_ID_PATTERN.test(asText(value).trim());

export const isCreationReportId = (value: unknown) => CREATION_REPORT_ID_PATTERN.test(asText(value).trim());

export const isApprovalReportId = (value: unknown) => APPROVAL_REPORT_ID_PATTERN.test(asText(value).trim());

export const getSafeReportId = (value: unknown) => {
  const text = asText(value).trim();
  if (isCreationReportId(text) || isApprovalReportId(text)) return text;
  return '';
};

export const isWorkOrderSeed = (record: any) => {
  if (!record) return false;

  const formType = asText(record.formType).toLowerCase();
  if (formType === 'job') return true;
  if (REPORT_FORM_TYPES.has(formType)) return false;

  const recordId = asText(record.id) || asText(record.numero_informe) || asText(record.firebaseId);
  return isOtLikeId(recordId);
};

export const getExistingReportId = (record: any) => {
  if (!record || isWorkOrderSeed(record)) return '';
  const candidates = [record.numero_informe, record.firebaseId, record.id];
  for (const candidate of candidates) {
    const text = asText(candidate).trim();
    if (isCreationReportId(text)) return text;
  }
  return '';
};

export const getCreationReportId = getExistingReportId;

export const isExistingReportSeed = (record: any) => !!getExistingReportId(record);

export const getLinkedOrderId = (record: any) => {
  if (!record) return '';
  const candidates = [record.orderId, record.numero_ot, record.originalJobId, record.jobId, record.id];
  for (const candidate of candidates) {
    const text = asText(candidate).trim();
    if (isOtLikeId(text)) return text;
  }
  return '';
};

export const getReportDisplayId = (record: any) => {
  if (!record) return '';
  const approvalId = getSafeReportId(record.numero_final);
  if (approvalId && !isOtLikeId(approvalId)) return approvalId;
  return getExistingReportId(record);
};
