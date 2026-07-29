import ModernBackground from '@/components/site/ModernBackground';
import ParticleBackground from '@/components/site/ParticleBackground';
import SEOStructuredData from '@/components/site/seo-structured-data';
import { ThemeProvider } from '@/components/site/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const fontBody = Inter({
  subsets: ['latin'],
  variable: '--font-body',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://sof-ia-tech.vercel.app'),
  title: 'Nombre de tu Empresa  |  Sistema de Gestión & Inspecciones',
  applicationName: 'Nombre de tu Empresa',
  description: 'Plataforma integral para gestión de ordenes de trabajo, informes de inspección técnica y control operativo.',
  keywords: [
    'inspecciones técnicas', 'órdenes de trabajo', 'mantenimiento industrial',
    'gestión de servicios', 'asistencia técnica', 'informes de campo'
  ],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Nombre de tu Empresa',
  },
  icons: {
    apple: '/icon-192.png',
  },
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    url: 'https://sof-ia-tech.vercel.app',
    title: 'Nombre de tu Empresa | Gestión Operativa e Inspecciones',
    description: 'Soluciones integrales para digitalizar inspecciones técnicas, órdenes de trabajo y reporte de servicios.',
    siteName: 'Nombre de tu Empresa',
    images: [
      {
        url: '/hero.png',
        width: 1200,
        height: 630,
        alt: 'Nombre de tu Empresa - Sistema Demo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nombre de tu Empresa | Plataforma de Inspección',
    description: 'Soluciones integrales para digitalizar inspecciones técnicas y soporte de campo.',
    images: ['/hero.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#10b981',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning className="bg-transparent">
      {/* TRANSPARENCIA TOTAL: 
          - bg-transparent elimina cualquier color de fondo sólido.
          - relative z-10 asegura que el contenido flote sobre los fondos animados.
      */}
      <body className={cn(
        'min-h-screen font-body antialiased bg-transparent text-foreground relative',
        fontBody.variable
      )}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
            {/* Los fondos se renderizan detrás de todo */}
            <ParticleBackground />
            <ModernBackground />
            <SEOStructuredData />

            {/* z-10 para que el texto sea legible y cliqueable */}
            <main className="relative z-10 flex flex-col min-h-screen">
              {children}
            </main>

            <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
