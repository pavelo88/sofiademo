import Dexie, { type Table } from 'dexie';

/**
 * @fileOverview Arquitectura de base de datos local (IndexedDB) para Energy Engine.
 * Utiliza Dexie.js para gestionar el almacenamiento persistente en el dispositivo del inspector,
 * permitiendo el funcionamiento offline-first y la sincronización posterior con Firebase.
 */

// --- INTERFACES DE DATOS LOCALES ---

export interface HojaTrabajoLocal {
  id?: number;           // Clave primaria autoincremental local
  firebaseId: string;   // ID del documento en Firestore (ej: 2026-AG-001)
  synced: boolean;       // Estado de sincronización
  data: any;             // El objeto completo del informe
  createdAt: Date;       // Fecha de creación local
}

export interface RegistroJornadaLocal {
  id?: number;
  firebaseId: string;
  synced: boolean;
  data: any;
  createdAt: Date;
}

export interface GastoLocal {
  id?: number;
  firebaseId: string;
  synced: boolean;
  data: any;
  createdAt: Date;
}

export interface GastoReportLocal {
  id?: number;
  firebaseId: string;
  synced: boolean;
  data: any;
  createdAt: Date;
}

export interface LocalConfig {
  key: string;           // Ej: 'contador_hoja-trabajo', 'pin_hash', 'user_id'
  value: any;            // El valor del contador o el hash
}

export interface ClienteCache {
  id: string;            // ID de Firestore
  nombre: string;        // Nombre comercial
  direccion?: string;
}

export interface ClientePendiente {
  id?: number;
  firebaseId: string;
  synced: boolean;
  data: any;
  createdAt: Date;
}

export interface ImagenLocal {
  id?: number;
  reportId: string;      // ID del informe al que pertenece
  base64Data: string;    // Imagen codificada en base64
  fileName: string;
  mimeType: string;
  uploadedUrl?: string;  // URL de Firebase después de sincronizar
  synced: boolean;
  createdAt: Date;
}

export interface FirmaLocal {
  id?: number;
  userEmail: string;
  base64Data: string;
  createdAt: Date;
  uploadedUrl?: string;
}

export interface SyncQueue {
  id?: number;
  recordId: string;      // ID del registro en hojas_trabajo
  recordType: 'hoja-trabajo' | 'gasto' | 'bitacora-filtros',
  status: 'pending' | 'retrying' | 'failed';
  retryCount: number;
  lastError: string;
  createdAt: Date;
  lastRetry: Date;
}

export interface OrdenTrabajoCache {
  id: string;
  data: any;
  estado: string;
  inspectorIds: string[];
  createdAt: Date;
}

export interface InformeCache {
  id: string;
  orderId: string;
  data: any;
  createdAt: Date;
  imageCount: number;    // Solo guardamos cuántas fotos tenía
}

export interface FiltroCache {
  id: string;
  data: any;
  createdAt: Date;
}

// --- CLASE DE BASE DE DATOS ---

export class LocalDB extends Dexie {
  hojas_trabajo!: Table<HojaTrabajoLocal>;
  registros_jornada!: Table<RegistroJornadaLocal>;
  gastos!: Table<GastoLocal>;
  gastos_report!: Table<GastoReportLocal>;
  configuracion!: Table<LocalConfig>;
  clientes_cache!: Table<ClienteCache>;
  clientes_pendientes!: Table<ClientePendiente>;
  seguridad!: Table<any>;
  imagenes!: Table<ImagenLocal>;
  firmas!: Table<FirmaLocal>;
  sync_queue!: Table<SyncQueue>;
  ordenes_cache!: Table<OrdenTrabajoCache>;
  informes_cache!: Table<InformeCache>;
  filtros_cache!: Table<FiltroCache>;

  constructor() {
    super('EnergyEngineDB');

    this.version(7).stores({
      hojas_trabajo: '++id, firebaseId, synced, createdAt',
      registros_jornada: '++id, firebaseId, synced, createdAt',
      gastos: '++id, firebaseId, synced, createdAt, [data.stopId]', 
      gastos_report: '++id, firebaseId, synced, createdAt',
      configuracion: 'key',
      clientes_cache: 'id, nombre',
      clientes_pendientes: '++id, firebaseId, synced, createdAt',
      seguridad: 'email, createdAt',
      imagenes: '++id, reportId, synced, createdAt',
      firmas: '++id, userEmail, createdAt',
      sync_queue: '++id, recordId, status, createdAt',
      ordenes_cache: 'id, estado, [inspectorIds]',
      informes_cache: 'id, orderId, createdAt',
      filtros_cache: 'id, createdAt'
    });
  }

  /**
   * Obtiene y aumenta el contador para un tipo de documento, reiniciándose cada año
   */
    private getCounterKey(type: string, userEmail: string, year: number): string {
    const safeType = String(type || '').trim().toLowerCase();
    const safeYear = year || new Date().getFullYear();
    const owner = String(userEmail || '').trim().toLowerCase();
    const safeOwner = owner ? owner.replace(/[^a-z0-9@._-]/g, '_') : 'global';
    return `contador_${safeOwner}_${safeType}_${safeYear}`;
  }

  async getSequence(type: string, userEmail: string, year: number): Promise<number> {
    const key = this.getCounterKey(type, userEmail, year);
    const config = await this.configuracion.get(key);
    if (config && typeof config.value === 'number') return config.value;

    // Compatibilidad con contadores legacy sin usuario.
    const legacyKey = `contador_${String(type || '').trim().toLowerCase()}_${year || new Date().getFullYear()}`;
    const legacy = await this.configuracion.get(legacyKey);
    return (legacy && typeof legacy.value === 'number') ? legacy.value : 0;
  }

  async setSequence(type: string, userEmail: string | undefined, value: number, year: number): Promise<void> {
    const key = this.getCounterKey(type, userEmail || 'global', year);
    await this.configuracion.put({ key, value: Math.max(0, Number(value) || 0) });
  }

  /**
   * Obtiene y aumenta el contador por tipo + usuario + anio.
   */
  async getNextSequence(type: string, userEmail: string, year: number): Promise<number> {
    const currentValue = await this.getSequence(type, userEmail, year);
    const nextValue = currentValue + 1;
    await this.setSequence(type, userEmail, nextValue, year);
    return nextValue;
  }
}

export const db = new LocalDB();
