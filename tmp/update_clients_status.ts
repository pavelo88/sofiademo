import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

console.log('Firebase Config:', { ...firebaseConfig, apiKey: '***' });

async function updateExistingClients() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  
  const querySnapshot = await getDocs(collection(db, 'clientes'));
  console.log(`Found ${querySnapshot.size} clients.`);
  
  for (const clientDoc of querySnapshot.docs) {
    const data = clientDoc.data();
    if (!data.status) {
      console.log(`Updating client ${clientDoc.id} to approved.`);
      await updateDoc(doc(db, 'clientes', clientDoc.id), { status: 'approved' });
    }
  }
}

updateExistingClients().catch(console.error);
