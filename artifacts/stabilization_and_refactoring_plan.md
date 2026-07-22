# Plan de Estabilización y Refactorización: Módulo de Inspección

Este documento resume las mejoras implementadas para garantizar la continuidad operativa en modo offline y define la hoja de ruta para la optimización del código.

## 1. Estado Actual (Logros de Estabilización)

Se han resuelto los bloqueos críticos que impedían el uso de la aplicación sin conexión:

*   **Acceso Blindado (Bypass de Seguridad)**: Se modificó `layout.tsx` y `page.tsx` para detectar el estado `navigator.onLine`. Si el dispositivo está offline, el sistema confía en la identidad local almacenada en Dexie y evita consultas fallidas a Firestore que causaban el spinner infinito.
*   **Service Worker v3**: Se implementó una estrategia de **Caché Dinámica** en `public/sw.js`. Ahora la app guarda automáticamente cada sección visitada, permitiendo que la interfaz cargue instantáneamente incluso en modo avión.
*   **Registro de Gastos Offline-First**: El componente `RegistroGastoForm.tsx` fue reescrito para guardar siempre en local primero (`dbLocal.gastos`). La sincronización con la nube ocurre en segundo plano con un timeout de 5s para no bloquear al usuario.
*   **Persistencia de Identidad**: Se aseguró que el email del inspector y su clave cifrada (hash) se guarden en `dbLocal.seguridad` ordenados por fecha, permitiendo re-ingresos offline sin errores de permisos.

## 2. Archivos Críticos y su Función

*   `src/app/inspection/page.tsx`: Orquestador principal. Gestiona la navegación y el bucle de sincronización de fondo.
*   `src/app/inspection/layout.tsx`: Guardián de acceso. Permite el bypass offline.
*   `src/app/auth/inspection/page.tsx`: Portal de entrada. Maneja el login tanto online (Firebase) como offline (Dexie + Hash).
*   `src/lib/db-local.ts`: Definición de esquemas de IndexedDB (Clientes, Gastos, Seguridad).
*   `public/sw.js`: Controlador de la PWA y almacenamiento de archivos de interfaz.

## 3. Plan de Refactorización Sugerido

El archivo `page.tsx` actual supera las 1,200 líneas y debe dividirse para mejorar la mantenibilidad:

### Fase A: Extracción de Lógica (Custom Hooks)
1.  **`useInspectionSync.ts`**: Mover la función `syncOfflineData` y sus efectos relacionados. Debe gestionar las subidas de Informes, Gastos y Horas.
2.  **`useInspectionIdentity.ts`**: Mover la carga del `offlineEmail`, `userFullName` y la lógica de detección de modo (`online`/`offline`).

### Fase B: Componentización de la UI
1.  **`InspectionViewManager.tsx`**: Extraer el bloque `renderContent` que actúa como router interno.
2.  **`SyncStatusOverlay.tsx`**: Mover el indicador visual de sincronización (el loader fijo).

### Fase C: Optimización de PWA
1.  Implementar una lista de pre-caché más exhaustiva en `sw.js` para incluir todas las rutas de `/auth/inspection` y activos críticos.

## 4. Notas para los Desarrolladores

> [!IMPORTANT]
> **No restaurar validaciones estrictas de Firebase en el Layout**: Cualquier intento de usar `getDocFromServer` u operaciones de red obligatorias sin verificar `navigator.onLine` causará que la app se cuelgue en dispositivos con conexión intermitente.

> [!TIP]
> **Sincronización de Gastos**: Los gastos se suben uno a uno en el bucle de `page.tsx`. Si se añaden nuevos campos al formulario de gastos, asegúrese de actualizar tanto el esquema de Dexie como la función de mapeo en el orquestador de sincronización.
