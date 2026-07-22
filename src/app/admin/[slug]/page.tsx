'use client';

import Clients from '@/app/admin/components/clients';
import Expenses from '@/app/admin/components/expenses';
import FiltersLog from '@/app/admin/components/FiltersLog';
import Hours from '@/app/admin/components/hours'; // <-- Importamos el nuevo archivo de horas
import Import from '@/app/admin/components/import';
import Jobs from '@/app/admin/components/jobs';
import Reports from '@/app/admin/components/reports';
import Users from '@/app/admin/components/users';
import WebRequests from '@/app/admin/components/web-requests';
import { useParams } from 'next/navigation';

const componentMap: { [key: string]: React.ComponentType } = {
  users: Users,
  clients: Clients,
  jobs: Jobs,
  expenses: Expenses, // Gastos carga Expenses
  hours: Hours,       // <-- Horas ahora carga Hours
  filters: FiltersLog,
  reports: Reports,
  import: Import,
  'web-requests': WebRequests,
};

export default function AdminDynamicPage() {
  const params = useParams();
  const slug = params.slug as string;
  const ComponentToRender = componentMap[slug];

  if (!ComponentToRender) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-500 font-medium italic">Página no encontrada o en construcción.</p>
      </div>
    );
  }

  return <ComponentToRender />;
}