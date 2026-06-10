// ── DISTRIGAMA · js/config.js ── Firebase init + constantes + estado global compartido
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCU1lzx0N9Qm-jKP9ElFrWvR-Uh6etvSuY",
  authDomain: "distrigama-campo.firebaseapp.com",
  projectId: "distrigama-campo",
  storageBucket: "distrigama-campo.firebasestorage.app",
  messagingSenderId: "835153963795",
  appId: "1:835153963795:web:a397d9e88ef2edbd0f48e6"
};

export const app = initializeApp(FIREBASE_CONFIG);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const APP_VERSION = '5.9'; // ← incrementar cada deploy
export const NOW = new Date();
export const FMT_DATE = NOW.toLocaleDateString('es-VE',{day:'2-digit',month:'short',year:'numeric'});
export const FMT_TIME = () => new Date().toLocaleTimeString('es-VE',{hour:'2-digit',minute:'2-digit'});
window._NOW = NOW; window._FMT_DATE = FMT_DATE; window._FMT_TIME = FMT_TIME;

// Estado global compartido entre módulos (antes: variables sueltas en index.html)
export const state = {
  currentUser: null,
  userProfile: null,
  censo: [],
  cart: [],
  disc: 35,
  moneda: 'USD',
  selTipo: '',
  selLineas: [],
  catFilter: '',
  gpsCoords: null,
  notifications: JSON.parse(localStorage.getItem('dg_notifs_v1')||'[]'),
  lastManualVer: localStorage.getItem('dg_manual_ver')||'0'
};
Object.defineProperty(window, '_cart', { get: () => state.cart });

document.getElementById('hdr-date').textContent = FMT_DATE;
