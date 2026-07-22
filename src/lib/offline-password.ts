'use client';

const OFFLINE_PASSWORD_ALGORITHM = 'PBKDF2-SHA256';
const OFFLINE_PASSWORD_ITERATIONS = 210_000;
export const OFFLINE_PASSWORD_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join('');

const hexToBytes = (hex: string) => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index++) {
    bytes[index] = parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
};

const sha256Hex = async (text: string) => {
  const msgBuffer = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return bytesToHex(new Uint8Array(hashBuffer));
};

const randomSalt = () => {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return bytesToHex(salt);
};

const derivePbkdf2Hash = async (password: string, salt: string, iterations: number) => {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: hexToBytes(salt),
      iterations,
    },
    baseKey,
    256
  );

  return bytesToHex(new Uint8Array(bits));
};

const timingSafeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index++) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
};

export const createOfflinePasswordRecord = async (email: string, password: string) => {
  const salt = randomSalt();
  const iterations = OFFLINE_PASSWORD_ITERATIONS;
  const pinHash = await derivePbkdf2Hash(password, salt, iterations);
  const now = new Date();

  return {
    email,
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(now.getTime() + OFFLINE_PASSWORD_MAX_AGE_MS),
    algorithm: OFFLINE_PASSWORD_ALGORITHM,
    iterations,
    salt,
    pinHash,
  };
};

export const isOfflinePasswordExpired = (record: any) => {
  const expiresAt = record?.expiresAt instanceof Date
    ? record.expiresAt
    : record?.expiresAt
      ? new Date(record.expiresAt)
      : null;

  if (expiresAt) return expiresAt.getTime() <= Date.now();

  const createdAt = record?.createdAt instanceof Date
    ? record.createdAt
    : record?.createdAt
      ? new Date(record.createdAt)
      : null;

  return !!createdAt && Date.now() - createdAt.getTime() > OFFLINE_PASSWORD_MAX_AGE_MS;
};

export const verifyOfflinePassword = async (record: any, password: string) => {
  if (!record?.pinHash) return { ok: false, shouldUpgrade: false };

  if (
    record.algorithm === OFFLINE_PASSWORD_ALGORITHM &&
    record.salt &&
    record.iterations
  ) {
    const inputHash = await derivePbkdf2Hash(password, record.salt, Number(record.iterations));
    return { ok: timingSafeEqual(inputHash, String(record.pinHash)), shouldUpgrade: false };
  }

  const legacyHash = await sha256Hex(password);
  return {
    ok: timingSafeEqual(legacyHash, String(record.pinHash)),
    shouldUpgrade: true,
  };
};
