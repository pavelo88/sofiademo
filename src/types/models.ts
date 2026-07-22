import { Timestamp } from "firebase/firestore";

export interface User {
  id: string;
  email: string;
  nombre: string;
  roles: string[];
  [key: string]: any;
}

export interface Client {
  id: string;
  nombre: string;
  email?: string;
  telefono?: string;
  [key: string]: any;
}

export interface GastoItem {
  id?: string;
  inspectorId: string;
  inspectorNombre: string;
  fecha: Date | Timestamp | string | any;
  rubro: string;
  monto: number;
  descripcion: string;
  forma_pago: string;
  clienteId: string;
  clienteNombre: string;
  orderId?: string | null;
  estado?: string;
  createdAt?: Timestamp | Date | any;
  [key: string]: any;
}

export interface HoraItem {
  id?: string;
  inspectorId: string;
  inspectorNombre: string;
  fecha: Date | Timestamp | string | any;
  clienteId: string;
  clienteNombre: string;
  actividad: string;
  horasNormales: number;
  horasExtras: number;
  horasEspeciales: number;
  orderId?: string | null;
  estado?: string;
  createdAt?: Timestamp | Date | any;
  [key: string]: any;
}
