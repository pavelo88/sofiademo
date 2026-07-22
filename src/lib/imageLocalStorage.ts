// Genera un nombre único para la imagen para evitar duplicados en la base de datos
export function generateImageKey(customId?: string): string {
  const ts = Date.now()
  const rand = Math.random().toString(36).substring(2, 8)
  return `${customId ?? 'img'}_${ts}_${rand}`
}

// Abre la base de datos local del navegador (IndexedDB)
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('localImageStore', 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('images')) {
        db.createObjectStore('images')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// Guarda la imagen físicamente en el navegador y devuelve su clave única
export async function storeImageLocally(file: File, customId?: string): Promise<string> {
  if (!('indexedDB' in window)) {
    throw new Error('IndexedDB no está soportado en este navegador')
  }
  const db = await openDatabase()
  const key = generateImageKey(customId)
  return new Promise<string>((resolve, reject) => {
    const tx = db.transaction('images', 'readwrite')
    const store = tx.objectStore('images')
    const putRequest = store.put(file, key)
    putRequest.onsuccess = () => resolve(key)
    putRequest.onerror = () => reject(putRequest.error)
    tx.oncomplete = () => db.close()
  })
}

// Recupera el archivo de la imagen usando su clave única para poder subirla a Firebase
export async function getLocalImage(key: string): Promise<Blob | null> {
  const db = await openDatabase()
  return new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction('images', 'readonly')
    const store = tx.objectStore('images')
    const getRequest = store.get(key)
    getRequest.onsuccess = () => resolve(getRequest.result as Blob ?? null)
    getRequest.onerror = () => reject(getRequest.error)
    tx.oncomplete = () => db.close()
  })
}

// Borra la imagen de la memoria del navegador
export async function deleteLocalImage(key: string): Promise<void> {
  const db = await openDatabase()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('images', 'readwrite')
    const store = tx.objectStore('images')
    const delRequest = store.delete(key)
    delRequest.onsuccess = () => resolve()
    delRequest.onerror = () => reject(delRequest.error)
    tx.oncomplete = () => db.close()
  })
}

// Devuelve una lista con las claves de todas las imágenes que están guardadas y pendientes de subir
export async function listAllImageKeys(): Promise<string[]> {
  const db = await openDatabase()
  return new Promise<string[]>((resolve, reject) => {
    const tx = db.transaction('images', 'readonly')
    const store = tx.objectStore('images')
    const keys: string[] = []
    const cursorRequest = store.openCursor()
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result
      if (cursor) {
        keys.push(cursor.key as string)
        cursor.continue()
      } else {
        resolve(keys)
      }
    }
    cursorRequest.onerror = () => reject(cursorRequest.error)
    tx.oncomplete = () => db.close()
  })
}

// Elimina la imagen de la memoria local una vez que confirmamos que se subió con éxito a Firebase
export async function cleanupAfterUpload(key: string): Promise<void> {
  await deleteLocalImage(key)
}
