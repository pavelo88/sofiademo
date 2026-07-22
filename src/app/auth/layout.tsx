'use client';

import { FirebaseClientProvider } from '@/firebase/client-provider';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <FirebaseClientProvider>{children}</FirebaseClientProvider>;
}
