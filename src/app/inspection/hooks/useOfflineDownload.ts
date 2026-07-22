'use client';

import { useState, useCallback } from 'react';
import { useInspectionCache } from './useInspectionCache';

export function useOfflineDownload(firestore: any, userEmail: string | null | undefined, isOnline: boolean) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');

  const { refreshCache } = useInspectionCache(isOnline, firestore, userEmail);

  const downloadAll = useCallback(async () => {
    if (!isOnline || !firestore || !userEmail) return false;

    setIsDownloading(true);
    setProgress(0);
    setStatus('Iniciando descarga...');

    try {
      // Simular progreso por fases
      setProgress(20);
      setStatus('Descargando clientes...');
      await new Promise(resolve => setTimeout(resolve, 500));

      setProgress(40);
      setStatus('Descargando órdenes de trabajo...');
      await new Promise(resolve => setTimeout(resolve, 500));

      setProgress(60);
      setStatus('Descargando informes...');
      await new Promise(resolve => setTimeout(resolve, 500));

      setProgress(80);
      setStatus('Descargando horas y gastos...');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Ejecutar refreshCache real
      await refreshCache();

      setProgress(100);
      setStatus('Descarga completada');
      await new Promise(resolve => setTimeout(resolve, 1000));

      return true;
    } catch (err) {
      console.error('Error en descarga offline:', err);
      setStatus('Error en descarga');
      return false;
    } finally {
      setIsDownloading(false);
      setProgress(0);
      setStatus('');
    }
  }, [isOnline, firestore, userEmail, refreshCache]);

  return { isDownloading, progress, downloadAll, status };
}