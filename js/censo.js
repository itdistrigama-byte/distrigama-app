// ── DISTRIGAMA · js/censo.js ── Prospección, validación RIF, GPS
import { db, state, NOW, FMT_TIME } from './config.js';
import { doc, getDoc, getDocs, setDoc, addDoc, collection, query, where, orderBy, onSnapshot, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { fbEl } from './utils.js';

// ── CENSO ──
export async function loadCenso() {
  const today = NOW.toLocaleDateString('es-VE');
  const q = query(collection(db,'visitas'),
    where('vendedor_uid','==',state.currentUser.uid),
    where('fecha_str','==',today),
    orderBy('timestamp','desc'));
  onSnapshot(q, snap => {
    state.censo = snap.docs.map(d => ({id:d.id,...d.data()}));
    renderCenso();
  });
}

window.setTipo = (t) => {
  state.selTipo = t;
  ['A','B','C'].forEach(x => {
    const el = document.getElementById('t'+x);
    el.className = 'tipo-btn' + (x===t ? ' on-'+t : '');
  });
};

window.tgLinea = (el, n) => {
  el.classList.toggle('on');
  state.selLineas = state.selLineas.includes(n) ? state.selLineas.filter(x=>x!==n) : [...state.selLineas, n];
};

window.setPillDate = (daysAhead) => {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  document.getElementById('c-prox-fecha').value = `${yyyy}-${mm}-${dd}`;
  ['pill-man','pill-3d','pill-sem'].forEach(id => {
    document.getElementById(id)?.classList.remove('active');
  });
  const map = {1:'pill-man', 3:'pill-3d', 7:'pill-sem'};
  if (map[daysAhead]) document.getElementById(map[daysAhead])?.classList.add('active');
};

window.clearPills = () => {
  ['pill-man','pill-3d','pill-sem'].forEach(id => {
    document.getElementById(id)?.classList.remove('active');
  });
};

window.captureGPS = () => {
  const status = document.getElementById('gps-status');
  status.textContent = 'Obteniendo ubicación...';
  navigator.geolocation.getCurrentPosition(
    pos => {
      state.gpsCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      status.textContent = `✅ ${state.gpsCoords.lat.toFixed(5)}, ${state.gpsCoords.lng.toFixed(5)}`;
      status.style.color = 'var(--g)';
    },
    err => {
      status.textContent = '⚠ No se pudo obtener GPS: ' + err.message;
      status.style.color = 'var(--r)';
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
};

window.normalizarRIF = (rif) => {
  // Quita guiones, espacios y convierte a mayúsculas
  return rif.toUpperCase().replace(/[-\s]/g, '').trim();
};

window.formatearRIF = (rif) => {
  const limpio = window.normalizarRIF(rif);
  if (limpio.length !== 10) return limpio; // Inválido
  // Formato: J-41035545-0
  return `${limpio.substring(0, 1)}-${limpio.substring(1, 9)}-${limpio.substring(9)}`;
};

window.validarRIF = async () => {
  const rifInput = document.getElementById('c-rif');
  const rif = rifInput.value.trim();
  if (!rif) return; // Campo vacío es OK
  
  const rifNormalizado = window.normalizarRIF(rif);
  
  // Validar formato
  if (rifNormalizado.length !== 10 || !rifNormalizado.match(/^[JVE]/)) {
    fbEl('c-fb','⚠ RIF inválido. Debe ser: J-41035545-0','var(--al)','var(--a)');
    return;
  }
  
  // Buscar duplicados en Firestore
  try {
    const q = query(collection(db,'visitas'), where('rif_normalizado','==',rifNormalizado));
    const snap = await getDocs(q);
    if (snap.docs.length > 0) {
      const existing = snap.docs[0].data();
      fbEl('c-fb',`⚠ Este RIF ya está registrado: ${existing.nom}. Verifica si es el mismo local.`,'var(--al)','var(--a)');
    }
  } catch(e) {
    // Silencioso si hay error (base de datos no inicializada aún)
  }
  
  // Mostrar formato correcto
  rifInput.value = window.formatearRIF(rifNormalizado);
};

window.saveCenso = async () => {
  const nom = document.getElementById('c-nom').value.trim();
  const rifInput = document.getElementById('c-rif').value.trim();
  if (!nom || !state.selTipo || !rifInput) { fbEl('c-fb','⚠ Nombre, tipo y RIF son obligatorios','var(--al)','var(--a)'); return; }
  
  // Validar RIF
  const rifNormalizado = window.normalizarRIF(rifInput);
  if (rifNormalizado.length !== 10 || !rifNormalizado.match(/^[JVE]/)) {
    fbEl('c-fb','⚠ RIF inválido. Formato: J-41035545-0','var(--al)','var(--a)');
    return;
  }
  const rifFormato = window.formatearRIF(rifNormalizado);
  
  // Check if client already exists
  try {
    const clienteSnap = await getDoc(doc(db, 'clientes', rifNormalizado));
    if (clienteSnap.exists()) {
      const existing = clienteSnap.data();
      fbEl('c-fb',`⚠ RIF ya registrado: ${existing.nombre}. Búscalo en Cartera.`,'var(--al)','var(--a)');
      return;
    }
  } catch(e) { console.error('Error checking client:', e); }
  
  const today = NOW.toLocaleDateString('es-VE');
  const ciudad = state.userProfile.ciudad || 'caracas';
  const ruta = document.getElementById('c-ruta').value;
  
  try {
    // 1. Create client
    await setDoc(doc(db, 'clientes', rifNormalizado), {
      rif_normalizado: rifNormalizado,
      rif_formato: rifFormato,
      nombre: nom,
      tipo: state.selTipo,
      contacto_nombre: document.getElementById('c-ctc-nom').value || '',
      contacto_telefono: document.getElementById('c-ctc-tel').value || '',
      direccion: '',
      ciudad: ciudad,
      ruta: ruta,
      etapa: 'prospecto',
      vendedor_uid: state.currentUser.uid,
      vendedor_nombre: state.userProfile.nombre,
      proxima_accion: document.getElementById('c-obs')?.value?.trim() || '',
      proxima_accion_fecha: (() => {
        const fd = document.getElementById('c-prox-fecha')?.value;
        if (!fd) return null;
        const [y,m,d] = fd.split('-').map(Number);
        const horaStr = document.getElementById('c-prox-hora')?.value || '';
        if (horaStr) {
          const match = horaStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
          if (match) {
            let hh = parseInt(match[1]);
            const mm = parseInt(match[2]);
            const ap = match[3].toUpperCase();
            if (ap==='PM' && hh!==12) hh+=12;
            if (ap==='AM' && hh===12) hh=0;
            return new Date(y, m-1, d, hh, mm, 0);
          }
        }
        return new Date(y, m-1, d);
      })(),
      fecha_creacion: serverTimestamp(),
      ultima_visita: serverTimestamp(),
      total_visitas: 1,
      total_pedidos: 0,
      total_cobrado_usd: 0,
      lineas: [...state.selLineas]
    });
    
    // 2. Save visita
    await addDoc(collection(db,'visitas'), {
      nom, tipo: state.selTipo,
      tipo_visita: 'censo_nuevo',
      contacto_nombre: document.getElementById('c-ctc-nom').value,
      contacto_telefono: document.getElementById('c-ctc-tel').value,
      rif_normalizado: rifNormalizado,
      rif_formato: rifFormato,
      ruta: ruta,
      ciudad: ciudad,
      lineas: [...state.selLineas],
      res: document.getElementById('c-res').value,
      obs: document.getElementById('c-obs').value,
      proxima_accion: document.getElementById('c-obs')?.value?.trim() || '',
      proxima_accion_fecha: (() => {
        const fd = document.getElementById('c-prox-fecha')?.value;
        if (!fd) return null;
        const [y,m,d] = fd.split('-').map(Number);
        const horaStr = document.getElementById('c-prox-hora')?.value || '';
        if (horaStr) {
          const match = horaStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
          if (match) {
            let hh = parseInt(match[1]);
            const mm = parseInt(match[2]);
            const ap = match[3].toUpperCase();
            if (ap==='PM' && hh!==12) hh+=12;
            if (ap==='AM' && hh===12) hh=0;
            return new Date(y, m-1, d, hh, mm, 0);
          }
        }
        return new Date(y, m-1, d);
      })(),
      lat: state.gpsCoords?.lat || null,
      lng: state.gpsCoords?.lng || null,
      hora: FMT_TIME(),
      fecha_str: today,
      vendedor_uid: state.currentUser.uid,
      vendedor_nombre: state.userProfile.nombre,
      timestamp: serverTimestamp()
    });
    
    // Reset form
    ['c-nom','c-ctc-nom','c-ctc-tel','c-obs','c-rif'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('c-ruta').value = state.userProfile.ruta_principal || '';
    document.getElementById('c-res').value = '';
    document.getElementById('c-prox-fecha').value = '';
    document.getElementById('c-prox-hora').value = '';
    ['pill-man','pill-3d','pill-sem'].forEach(id => document.getElementById(id)?.classList.remove('active'));
    document.querySelectorAll('.chk').forEach(el=>el.classList.remove('on'));
    state.selTipo = ''; state.selLineas = []; state.gpsCoords = null;
    ['A','B','C'].forEach(x=>document.getElementById('t'+x).className='tipo-btn');
    document.getElementById('gps-status').textContent = 'Sin ubicación registrada';
    document.getElementById('gps-status').style.color = '';
    fbEl('c-fb','✅ Cliente registrado y state.censo guardado','var(--gl)','var(--g)');
  } catch(e) {
    fbEl('c-fb','❌ Error al guardar: ' + e.message,'var(--rl)','var(--r)');
  }
};

function renderCenso() {
  document.getElementById('c-cnt').textContent = state.censo.length;
  const cont = document.getElementById('c-list');
  if (!state.censo.length) {
    cont.innerHTML = '<div class="empty"><div class="empty-ico">📋</div><div>Sin registros aún hoy</div></div>';
    return;
  }
  cont.innerHTML = state.censo.map(e => `
    <div class="sv-item">
      <div style="flex:1">
        <div class="sv-name">${e.nom}<span class="badge ba-${e.tipo}">${e.tipo}</span></div>
        <div class="sv-meta">${e.ruta||'Sin ruta'} · ${e.hora||''}</div>
        ${e.contacto_nombre?`<div class="sv-meta">👤 ${e.contacto_nombre}${e.contacto_telefono?' · '+e.contacto_telefono:''}</div>`:''}
        ${e.lineas?.length?`<div class="sv-meta">🏪 ${e.lineas.join(', ')}</div>`:''}
        ${e.res?`<div class="sv-meta">📌 ${e.res}</div>`:''}
        ${e.lat?`<div class="sv-meta"><a href="https://maps.google.com/?q=${e.lat},${e.lng}" target="_blank" style="color:var(--g);font-weight:600">📍 Ver en Maps</a></div>`:''}
      </div>
    </div>`).join('');
}
