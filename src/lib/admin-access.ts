'use client';

import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  query,
  where,
} from 'firebase/firestore';

type UserDocData = Record<string, unknown>;

const normalizeText = (value: unknown): string =>
  typeof value === 'string' ? value.normalize('NFKC').trim().toLowerCase() : '';

export const normalizeAdminEmail = (value: string): string =>
  normalizeText(value);

const toRoleList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter(Boolean);
  }
  const single = normalizeText(value);
  return single ? [single] : [];
};

export const extractUserRoles = (userData: UserDocData | null | undefined): string[] => {
  if (!userData) return [];

  const roles = [
    ...toRoleList(userData.roles),
    ...toRoleList(userData.role),
    ...toRoleList(userData.rol),
  ];

  return Array.from(new Set(roles));
};

export const hasAdminRole = (userData: UserDocData | null | undefined): boolean => {
  const roles = extractUserRoles(userData);
  return roles.includes('admin') || roles.includes('super') || roles.includes('superadmin');
};

const buildUniqueKey = (docId: string, data: UserDocData) => {
  const emailValue = normalizeText(data.email);
  return `${docId}::${emailValue}`;
};

export const fetchAdminCandidatesByEmail = async (firestore: Firestore, email: string): Promise<UserDocData[]> => {
  const normalizedEmail = normalizeAdminEmail(email);
  if (!normalizedEmail) return [];

  const candidates: UserDocData[] = [];
  const seen = new Set<string>();

  const pushSnapshot = (snapshot: any) => {
    if (!snapshot?.exists?.()) return;
    const data = snapshot.data() as UserDocData;
    const key = buildUniqueKey(snapshot.id || '', data);
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(data);
  };

  // 1) Intento principal: id del documento = email normalizado.
  try {
    const byIdServer = await getDocFromServer(doc(firestore, 'usuarios', normalizedEmail));
    pushSnapshot(byIdServer);
  } catch {
    // Ignorar y seguir con fallback.
  }

  // 2) Fallback cache/local.
  try {
    const byIdCached = await getDoc(doc(firestore, 'usuarios', normalizedEmail));
    pushSnapshot(byIdCached);
  } catch {
    // Ignorar y seguir con fallback.
  }

  // 3) Fallback por campo email.
  const emailCandidates = Array.from(new Set([email.trim(), normalizedEmail])).filter(Boolean);
  for (const emailCandidate of emailCandidates) {
    try {
      const byField = await getDocs(
        query(collection(firestore, 'usuarios'), where('email', '==', emailCandidate))
      );
      byField.docs.forEach((docSnap) => pushSnapshot(docSnap));
    } catch {
      // Ignorar y continuar.
    }
  }

  return candidates;
};
