// ── DISTRIGAMA · js/utils.js ── Helpers, manual, versión, notificaciones, tabs
import { db, state, APP_VERSION, FMT_TIME } from './config.js';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ── HELPERS ──
export function fbEl(id,msg,bg,col){
  const el=document.getElementById(id);
  el.style.display='block';el.style.background=bg;el.style.color=col;el.textContent=msg;
  setTimeout(()=>el.style.display='none',2800);
}
window.fbEl = fbEl;

// ── MANUAL UPDATES ──
export function listenManualUpdates() {
  onSnapshot(doc(db,'config','manual'), snap => {
    if (!snap.exists()) return;
    const data = snap.data();
    const ver = String(data.version || '0');
    if (ver !== state.lastManualVer && state.lastManualVer !== '0') {
      // New update
      const notif = {
        id: Date.now(),
        title: '📢 Manual actualizado',
        body: data.cambio || 'Se actualizó el manual del vendedor',
        time: FMT_TIME(),
        read: false
      };
      state.notifications.unshift(notif);
      localStorage.setItem('dg_notifs_v1', JSON.stringify(state.notifications));
      document.getElementById('update-banner').classList.add('on');
      updateNotifBadge();
    }
    state.lastManualVer = ver;
    localStorage.setItem('dg_manual_ver', ver);
  });
}

// ── APP VERSION CHECK ──
export function listenAppVersion() {
  onSnapshot(doc(db,'config','app'), snap => {
    if (!snap.exists()) return;
    const remoteVer = String(snap.data().version || APP_VERSION);
    if (remoteVer !== APP_VERSION) {
      document.getElementById('app-update-banner').classList.add('on');
    }
  });
}

window.forceAppUpdate = async () => {
  // Unregister service workers and hard reload
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const reg of regs) await reg.unregister();
  }
  // Clear caches
  if ('caches' in window) {
    const keys = await caches.keys();
    for (const key of keys) await caches.delete(key);
  }
  window.location.reload(true);
};

// ── NOTIFICATIONS ──
window.toggleNotif = () => {
  document.getElementById('notif-panel').classList.toggle('on');
  renderNotifs();
};

window.markAllRead = () => {
  state.notifications = state.notifications.map(n => ({...n, read: true}));
  localStorage.setItem('dg_notifs_v1', JSON.stringify(state.notifications));
  updateNotifBadge();
  renderNotifs();
};

window.openManual = () => {
  document.getElementById('update-banner').classList.remove('on');
  sw('manual');
};

export function updateNotifBadge() {
  const unread = state.notifications.filter(n => !n.read).length;
  const badge = document.getElementById('notif-badge');
  badge.textContent = unread;
  badge.style.display = unread > 0 ? 'flex' : 'none';
}

export function renderNotifs() {
  const list = document.getElementById('notif-list');
  if (!state.notifications.length) {
    list.innerHTML = '<div style="padding:16px;text-align:center;font-size:13px;color:var(--muted)">Sin notificaciones</div>';
    return;
  }
  list.innerHTML = state.notifications.slice(0,20).map(n => `
    <div class="notif-item ${n.read?'':'unread'}">
      <div class="notif-title">${n.title}</div>
      <div class="notif-body">${n.body}</div>
      <div class="notif-time">${n.time||''}</div>
    </div>`).join('');
}

updateNotifBadge();

// ── TABS ──
window.sw = (tab) => {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.tab===tab));
  document.querySelectorAll('.scr').forEach(s => s.classList.toggle('on', s.id==='scr-'+tab));
  if (tab==='dia') window.updDia();
  if (tab==='pedido') window.renderProds();
  if (tab==='cartera') window.renderCartera();
  if (tab==='manual') document.getElementById('notif-panel').classList.remove('on');
  if (tab==='admin') window.loadAdminPanel();
};

window.showMan = (sec, el) => {
  document.querySelectorAll('.man-btn').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
  document.querySelectorAll('.man-section').forEach(s => s.classList.toggle('on', s.id==='man-'+sec));
};
