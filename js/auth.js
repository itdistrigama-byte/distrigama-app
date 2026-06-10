// ── DISTRIGAMA · js/auth.js ── Login, roles, autorización + panel admin
import { auth, db, state } from './config.js';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut }
  from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { doc, getDoc, getDocs, setDoc, updateDoc, collection, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { fbEl, renderNotifs, listenManualUpdates, listenAppVersion } from './utils.js';
import { loadCenso } from './censo.js';

// ── AUTH ──
window.signInGoogle = async () => {
  const provider = new GoogleAuthProvider();
  try { await signInWithPopup(auth, provider); }
  catch(e) { console.error(e); alert('Error al iniciar sesión: ' + e.message); }
};

window.signOutUser = async () => {
  await signOut(auth);
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('waiting-screen').style.display = 'none';
    document.getElementById('app').style.display = 'none';
    return;
  }
  state.currentUser = user;
  document.getElementById('login-screen').style.display = 'none';
  
  const profileRef = doc(db, 'vendedores', user.uid);
  const snap = await getDoc(profileRef);
  
  if (!snap.exists()) {
    // No profile → show setup
    document.getElementById('setup-screen').style.display = 'flex';
    document.getElementById('waiting-screen').style.display = 'none';
    document.getElementById('app').style.display = 'none';
  } else {
    const data = snap.data();
    
    // Migration: if director email but missing autorizado field, auto-authorize
    if (user.email === 'itdistrigama@gmail.com' && !data.autorizado) {
      await updateDoc(profileRef, { 
        autorizado: true, 
        rol: 'director', 
        ciudad: data.ciudad || 'caracas' 
      });
      data.autorizado = true;
      data.rol = 'director';
      data.ciudad = data.ciudad || 'caracas';
    }
    
    if (!data.autorizado) {
      // Profile exists but NOT authorized → show waiting
      document.getElementById('setup-screen').style.display = 'none';
      document.getElementById('waiting-screen').style.display = 'flex';
      document.getElementById('waiting-email').textContent = user.email;
      document.getElementById('app').style.display = 'none';
    } else {
      // Authorized → start app
      state.userProfile = data;
      document.getElementById('setup-screen').style.display = 'none';
      document.getElementById('waiting-screen').style.display = 'none';
      startApp();
    }
  }
});

window.saveSetup = async () => {
  const btn = document.querySelector('#setup-screen .btn-g');
  document.activeElement?.blur();
  const nom = document.getElementById('su-nombre').value.trim();
  const tel = document.getElementById('su-tel').value.trim();
  if (!nom || !tel) { fbEl('su-fb','⚠ Nombre y teléfono son obligatorios','var(--al)','var(--a)'); return; }

  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
  document.getElementById('su-fb').textContent = '';

  try {
    const isDirector = state.currentUser.email === 'itdistrigama@gmail.com';

    await setDoc(doc(db,'vendedores',state.currentUser.uid), {
      nombre: nom,
      telefono: tel,
      email: state.currentUser.email,
      uid: state.currentUser.uid,
      rol: isDirector ? 'director' : null,
      ciudad: isDirector ? 'caracas' : '',
      ruta_principal: '',
      activo: true,
      autorizado: isDirector ? true : false,
      fecha_registro: serverTimestamp()
    });

    if (isDirector) {
      state.userProfile = { nombre: nom, rol: 'director', ciudad: 'caracas', ruta_principal: '', autorizado: true };
      document.getElementById('setup-screen').style.display = 'none';
      startApp();
    } else {
      document.getElementById('setup-screen').style.display = 'none';
      document.getElementById('waiting-screen').style.display = 'flex';
      document.getElementById('waiting-email').textContent = state.currentUser.email;
    }
  } catch (e) {
    fbEl('su-fb', '⚠ Error al guardar: ' + e.message + '. Verifica tu conexión e intenta de nuevo.', 'var(--al)', 'var(--a)');
    if (btn) { btn.disabled = false; btn.textContent = 'Enviar solicitud'; }
  }
};

function startApp() {
  document.getElementById('app').style.display = 'block';
  
  const rolLabel = state.userProfile.rol === 'director' ? '👑 Director' : 
                   state.userProfile.rol === 'coordinador' ? '📋 Coordinador' : '🏃 Vendedor';
  document.getElementById('hdr-user').textContent = state.userProfile.nombre + ' · ' + rolLabel;
  
  // Show/hide Admin tab based on role
  const adminTab = document.getElementById('tab-admin');
  if (state.userProfile.rol === 'director') {
    adminTab.style.display = '';
  } else {
    adminTab.style.display = 'none';
  }
  
  // Pre-fill vendedor in pedido
  document.getElementById('p-vend').value = state.userProfile.nombre || '';
  // Set ruta default in state.censo
  const rutaSel = document.getElementById('c-ruta');
  if (state.userProfile.ruta_principal) rutaSel.value = state.userProfile.ruta_principal;
  // Load today's state.censo
  loadCenso();
  // Listen for manual updates
  listenManualUpdates();
  listenAppVersion();
  // Listen for state.notifications
  renderNotifs();
  window.renderProds();
}

// ── ADMIN FUNCTIONS ──
async function loadAdminPanel() {
  if (state.userProfile.rol !== 'director') return;
  
  // Load ALL vendedores
  const snap = await getDocs(collection(db, 'vendedores'));
  const pending = [];
  const active = [];
  
  snap.forEach(d => {
    const data = { id: d.id, ...d.data() };
    if (!data.autorizado) pending.push(data);
    else active.push(data);
  });
  
  // Render pending
  const pendingEl = document.getElementById('admin-pending');
  if (pending.length === 0) {
    pendingEl.innerHTML = '<div class="admin-card" style="text-align:center;color:var(--muted);font-size:13px">✅ No hay solicitudes pendientes</div>';
  } else {
    pendingEl.innerHTML = pending.map(u => `
      <div class="admin-card">
        <div class="admin-user">
          <div class="admin-user-info">
            <div class="admin-user-name">${u.nombre || 'Sin nombre'} <span class="admin-badge badge-pendiente">Pendiente</span></div>
            <div class="admin-user-email">${u.email}</div>
            <div class="admin-user-meta">Tel: ${u.telefono || '—'} · Registrado: ${u.fecha_registro ? new Date(u.fecha_registro.seconds*1000).toLocaleDateString('es-VE') : '—'}</div>
          </div>
          <div class="admin-actions">
            <button class="btn-sm btn-sm-g" onclick="openApproveModal('${u.id}','${u.nombre || ''}','${u.email}')">Aprobar</button>
            <button class="btn-sm btn-sm-r" onclick="rejectUser('${u.id}')">Rechazar</button>
          </div>
        </div>
      </div>
    `).join('');
  }
  
  // Render active
  const activeEl = document.getElementById('admin-active');
  if (active.length === 0) {
    activeEl.innerHTML = '<div class="admin-card" style="text-align:center;color:var(--muted);font-size:13px">No hay usuarios activos</div>';
  } else {
    activeEl.innerHTML = active.map(u => {
      const badgeClass = u.rol === 'director' ? 'badge-director' : u.rol === 'coordinador' ? 'badge-coordinador' : 'badge-vendedor';
      const rolLabel = u.rol === 'director' ? 'Director' : u.rol === 'coordinador' ? 'Coordinador' : 'Vendedor';
      return `
      <div class="admin-card">
        <div class="admin-user">
          <div class="admin-user-info">
            <div class="admin-user-name">${u.nombre} <span class="admin-badge ${badgeClass}">${rolLabel}</span></div>
            <div class="admin-user-email">${u.email}</div>
            <div class="admin-user-meta">Ciudad: ${u.ciudad || '—'} · Ruta: ${u.ruta_principal || '—'} · Tel: ${u.telefono || '—'}</div>
          </div>
          <div class="admin-actions">
            <button class="btn-sm btn-sm-m" onclick="openApproveModal('${u.id}','${u.nombre}','${u.email}')">Editar</button>
          </div>
        </div>
      </div>
    `}).join('');
  }
}

window.openApproveModal = (uid, nombre, email) => {
  document.getElementById('modal-uid').value = uid;
  document.getElementById('modal-user-info').textContent = nombre + ' (' + email + ')';
  document.getElementById('modal-rol').value = '';
  document.getElementById('modal-ciudad').value = '';
  document.getElementById('modal-ruta').value = '';
  document.getElementById('modal-approve').classList.add('on');
};

window.closeModal = () => {
  document.getElementById('modal-approve').classList.remove('on');
};

window.confirmApprove = async () => {
  const uid = document.getElementById('modal-uid').value;
  const rol = document.getElementById('modal-rol').value;
  const ciudad = document.getElementById('modal-ciudad').value;
  const ruta = document.getElementById('modal-ruta').value;
  
  if (!rol || !ciudad) {
    fbEl('modal-fb','⚠ Rol y ciudad son obligatorios','var(--al)','var(--a)');
    return;
  }
  
  try {
    await updateDoc(doc(db, 'vendedores', uid), {
      rol: rol,
      ciudad: ciudad,
      ruta_principal: ruta,
      autorizado: true,
      activo: true
    });
    closeModal();
    loadAdminPanel(); // Refresh
  } catch(e) {
    fbEl('modal-fb','❌ Error: ' + e.message,'var(--rl)','var(--r)');
  }
};

window.rejectUser = async (uid) => {
  if (!confirm('¿Seguro que deseas rechazar este usuario? Se eliminará su perfil.')) return;
  try {
    const { deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    await deleteDoc(doc(db, 'vendedores', uid));
    loadAdminPanel();
  } catch(e) {
    alert('Error: ' + e.message);
  }
};

window.loadAdminPanel = loadAdminPanel; // usado por el dispatcher de tabs (sw)
