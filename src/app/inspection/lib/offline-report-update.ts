'use client';

import { db as dbLocal } from '@/lib/db-local';
import { fileToBase64 } from '@/lib/offline-utils';

type QueueOfflineReportUpdateParams = {
  existingDocId: string;
  updatePayload: any;
  images: File[];
  formType: string;
  inspectorSignature?: string | null;
  clientSignature?: string | null;
};

export async function queueOfflineReportUpdate({
  existingDocId,
  updatePayload,
  images,
  formType,
  inspectorSignature,
  clientSignature,
}: QueueOfflineReportUpdateParams) {
  const localData: any = {
    ...updatePayload,
    inspectorSignatureUrl: inspectorSignature,
    clientSignatureUrl: clientSignature,
    isOfflineUpdate: true,
    formType,
    numero_informe: existingDocId,
  };

  const getExtension = (filename: string) => {
    const parts = filename.split('.');
    return parts.length > 1 ? `.${parts.pop()}` : '.jpg';
  };
  const base64Promises = images.map(async (image, index) => {
    const base64 = await fileToBase64(image);
    const name = `camara_${Date.now()}_${index}${getExtension(image.name)}`;
    return { name, base64 };
  });
  localData.imagesBase64 = await Promise.all(base64Promises);

  const existingLocal = await dbLocal.hojas_trabajo
    .where('firebaseId')
    .equals(existingDocId)
    .first();

  if (existingLocal) {
    await dbLocal.hojas_trabajo.update(existingLocal.id!, {
      data: localData,
      synced: false,
    });
  } else {
    await dbLocal.hojas_trabajo.add({
      firebaseId: existingDocId,
      synced: false,
      data: localData,
      createdAt: new Date(),
    });
  }

  const inQueue = await dbLocal.sync_queue
    .where('recordId')
    .equals(existingDocId)
    .first();

  if (!inQueue) {
    await dbLocal.sync_queue.add({
      recordId: existingDocId,
      recordType: 'hoja-trabajo',
      status: 'pending',
      retryCount: 0,
      lastError: '',
      createdAt: new Date(),
      lastRetry: new Date(),
    });
  }
}
