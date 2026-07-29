'use client';

import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Cloud,
  Code2,
  Cpu,
  Database,
  Layers,
  Shield,
  Smartphone,
  Zap
} from 'lucide-react';
import { useAdminHeader } from '../components/AdminHeaderContext';
import { ArchitectureCard } from './components/ArchitectureCard';
import { CodeBlock } from './components/CodeBlock';

export default function TechnicalDocsPage() {
  useAdminHeader('Arquitectura del Sistema');

  return (
    <div className="space-y-8 pb-20">
      {/* Hero Section */}
      <div className="relative p-8 rounded-3xl overflow-hidden bg-slate-900 text-white shadow-2xl">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Code2 className="w-64 h-64 rotate-12" />
        </div>
        <div className="relative z-10">
          <Badge className="mb-4 bg-emerald-500 hover:bg-emerald-600 border-none px-4 py-1 text-xs font-black uppercase tracking-tighter">
            Página de Prueba
          </Badge>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-2">
            Infraestructura
          </h1>
          <p className="text-slate-400 max-w-2xl text-lg leading-relaxed font-medium">
            [PÁGINA DE PRUEBA] Toda la información, textos y diagramas de esta sección son meramente demostrativos. Puedes reemplazarlos fácilmente con la arquitectura real de tu proyecto.
          </p>
        </div>
      </div>

      {/* Grid de Arquitectura */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <ArchitectureCard
          title="Frontend Híbrido"
          description="Next.js 14 con App Router para una mezcla óptima de SSR y Client Components."
          icon={Layers}
          tags={['Next.js', 'React', 'TS']}
          details={[
            'Renderizado en servidor para SEO crítico',
            'Componentes de cliente para interactividad pesada',
            'Optimización automática de imágenes y fuentes'
          ]}
          color="blue"
        />
        <ArchitectureCard
          title="Persistence Engine"
          description="Estrategia dual de almacenamiento para garantizar operatividad offline total."
          icon={Database}
          tags={['IndexedDB', 'Dexie', 'Firestore']}
          details={[
            'Almacenamiento local prioritario (Dexie.js)',
            'Sincronización reactiva con Firestore',
            'Manejo de conflictos mediante timestamps'
          ]}
          color="emerald"
        />
        <ArchitectureCard
          title="Security & RBAC"
          description="Control de acceso robusto tanto en cliente como en servidor (Edge Rules)."
          icon={Shield}
          tags={['Auth', 'Rules', 'RBAC']}
          details={[
            'Reglas de Firestore validadas por servidor',
            'Tokens de JWT (Firebase Auth)',
            'Auditoría de sesiones activas concurrentes'
          ]}
          color="amber"
        />
        <ArchitectureCard
          title="Serverless Edge"
          description="Lógica de negocio distribuida y escalable mediante servicios cloud."
          icon={Cloud}
          tags={['Firebase', 'Serverless']}
          details={[
            'Cloud Storage para activos binarios',
            'Hosting optimizado para baja latencia',
            'Integraciones AI (Gemini/OpenAI)'
          ]}
          color="purple"
        />
      </div>

      {/* Secciones Detalladas */}
      <Tabs defaultValue="sync" className="w-full">
        <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mb-8">
          <TabsTrigger value="sync" className="rounded-lg px-8 py-2 font-bold uppercase tracking-widest text-[10px]">Sync Engine</TabsTrigger>
          <TabsTrigger value="pdf" className="rounded-lg px-8 py-2 font-bold uppercase tracking-widest text-[10px]">Document Gen</TabsTrigger>
          <TabsTrigger value="pwa" className="rounded-lg px-8 py-2 font-bold uppercase tracking-widest text-[10px]">PWA Architecture</TabsTrigger>
        </TabsList>

        <TabsContent value="sync" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <div className="space-y-4">
              <h3 className="text-2xl font-bold flex items-center gap-2">
                <Zap className="text-yellow-500" /> Motor de Sincronización
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                El sistema utiliza una **Sync Queue** implementada sobre IndexedDB. Cuando un inspector guarda un informe, este se persiste localmente de inmediato con un estado de <code className="bg-slate-100 px-1 rounded">synced: false</code>. Un proceso en segundo plano escucha cambios en la conectividad y realiza el &quot;Push&quot; a Firestore.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2 text-emerald-600 font-bold">
                  ✓ Carga instantánea de formularios sin latencia de red.
                </li>
                <li className="flex items-center gap-2 text-emerald-600 font-bold">
                  ✓ Resiliencia ante cierres inesperados del navegador.
                </li>
                <li className="flex items-center gap-2 text-emerald-600 font-bold">
                  ✓ Gestión automática de reintentos con backoff.
                </li>
              </ul>
            </div>
            <CodeBlock 
              title="db-local.ts"
              code={`// Definición del esquema local con Dexie
this.version(5).stores({
  hojas_trabajo: '++id, firebaseId, synced, createdAt',
  sync_queue: '++id, recordId, status, createdAt',
  imagenes: '++id, reportId, synced, createdAt'
});

// Método de incremento de secuencia offline
async getNextSequence(type, userEmail, year) {
  const currentValue = await this.getSequence(type, userEmail, year);
  const nextValue = currentValue + 1;
  await this.setSequence(type, userEmail, nextValue, year);
  return nextValue;
}`}
            />
          </div>
        </TabsContent>

        <TabsContent value="pdf" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <div className="space-y-4">
              <h3 className="text-2xl font-bold flex items-center gap-2">
                <Smartphone className="text-blue-500" /> Generación de Documentos
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                La generación de PDFs se realiza en el cliente mediante **jspdf** y **html2canvas**. Esto permite previsualizaciones instantáneas y reduce la carga computacional en el servidor. Las imágenes se procesan para optimizar su peso antes de ser incrustadas.
              </p>
            </div>
            <CodeBlock 
              title="pdf-utils.ts"
              code={`export async function generateReportPDF(data, images) {
  const doc = new jsPDF('p', 'mm', 'a4');
  
  // Inserción de cabeceras corporativas
  await addHeader(doc, data.clientInfo);
  
  // Procesamiento asíncrono de imágenes
  for (const img of images) {
    const optimized = await optimizeImage(img.base64);
    doc.addImage(optimized, 'JPEG', x, y, w, h);
  }
  
  return doc.output('blob');
}`}
            />
          </div>
        </TabsContent>

        <TabsContent value="pwa" className="space-y-6">
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <div className="space-y-4">
              <h3 className="text-2xl font-bold flex items-center gap-2">
                <Cpu className="text-purple-500" /> Estrategia de Service Worker
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                El Service Worker está diseñado para la persistencia de la App Shell. Utiliza una estrategia de **Stale-While-Revalidate** para los activos estáticos y una política de **Network-First** para los datos de la API, cayendo siempre a la caché si no hay red.
              </p>
            </div>
            <CodeBlock 
              title="sw.js"
              code={`self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).then((networkResponse) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      });
    })
  );
});`}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
