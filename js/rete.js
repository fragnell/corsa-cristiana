// rete.js
// Il collegamento con Firebase — per ora solo un canale aperto verso il
// database. La logica di sincronizzazione vera (stato, intenzioni) arriva
// nei prossimi passaggi.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js';
import { getDatabase, ref, set, get, onValue, push, runTransaction, remove, onDisconnect } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-database.js';
const firebaseConfig = {
  apiKey: "AIzaSyAg_QRYERrb_HRWryiecFFRQ_nn9OC1PSo",
  authDomain: "corsa-cristiana.firebaseapp.com",
  databaseURL: "https://corsa-cristiana-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "corsa-cristiana",
  storageBucket: "corsa-cristiana.firebasestorage.app",
  messagingSenderId: "534120039956",
  appId: "1:534120039956:web:1c043bbeb5db6724be0901"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export { ref, set, get, onValue, push, runTransaction, remove, onDisconnect };