// ── DISTRIGAMA · js/cartera.js ── Cartera CRM, etapas, ficha cliente, historial
import { db, state } from './config.js';
import { doc, getDoc, getDocs, collection, query, where, orderBy, limit }
  from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ── CARTERA ──
let cFilter = 'todos';
const ETAPA_LABEL = { prospecto:'Prospecto', contactado:'Contactado', propuesta:'Propuesta', cliente_activo:'Activo', recompra:'Recompra' };
const ETAPA_COLOR = { prospecto:'#FAEEDA;color:#633806', contactado:'#E6F1FB;color:#0C447C', propuesta:'#EEEDFE;color:#3C3489', cliente_activo:'#E1F5EE;color:#085041', recompra:'#E1F5EE;color:#0F6E56' };

window.setCFilter = (val, el) => {
  cFilter = val;
  document.querySelectorAll('#scr-cartera .chip').forEach(c=>c.classList.remove('on'));
  el.classList.add('on');
  renderCartera();
};

window.renderCartera = async () => {
  const el = document.getElementById('c-list');
  if (!db || !state.currentUser) { el.innerHTML='<div style="padding:32px;text-align:center;color:var(--muted);font-size:13px">Inicia sesión para ver tu cartera</div>'; return; }
  el.innerHTML='<div style="padding:32px;text-align:center;color:var(--muted);font-size:13px">Cargando...</div>';
  try {
    const srch = (document.getElementById('c-srch')?.value||'').toLowerCase();
    let q = query(collection(db,'clientes'), where('vendedor_uid','==',state.currentUser.uid), orderBy('ultima_visita','desc'), limit(100));
    if (state.userProfile?.rol==='director') q = query(collection(db,'clientes'), orderBy('ultima_visita','desc'), limit(100));
    const snap = await getDocs(q);
    let docs = snap.docs.map(d=>d.data());
    if (cFilter!=='todos') docs = docs.filter(d=>d.etapa===cFilter);
    if (srch) docs = docs.filter(d=>(d.nombre||'').toLowerCase().includes(srch)||(d.rif_formato||'').toLowerCase().includes(srch));
    if (!docs.length) { el.innerHTML='<div style="padding:40px 20px;text-align:center;color:var(--muted);font-size:14px"><div style="font-size:36px;margin-bottom:10px;opacity:.4">🔍</div>Sin resultados</div>'; return; }
    el.innerHTML = docs.map(c=>{
      const ec = ETAPA_COLOR[c.etapa]||'#F1EFE8;color:#444441';
      const [bg,txt] = ec.split(';color:');
      const ult = c.ultima_visita ? new Date(c.ultima_visita.seconds*1000).toLocaleDateString('es-VE',{day:'2-digit',month:'short'}) : '—';
      const proxFechaStr = (() => {
        if (!c.proxima_accion_fecha) return null;
        const pd = new Date(c.proxima_accion_fecha.seconds*1000);
        const hasTime = pd.getHours()!==0||pd.getMinutes()!==0;
        const dateStr = pd.toLocaleDateString('es-VE',{weekday:'short',day:'2-digit',month:'short'});
        const timeStr = hasTime ? ' · '+pd.toLocaleTimeString('es-VE',{hour:'2-digit',minute:'2-digit',hour12:true}) : '';
        return dateStr+timeStr;
      })();
      return `<div onclick="openFicha('${c.rif_normalizado}')" style="padding:14px 16px;border-bottom:1px solid var(--border);cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.nombre||'Sin nombre'}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">${c.rif_formato||c.rif_normalizado} · Ruta ${c.ruta||'—'}</div>
          ${proxFechaStr ? `<div style="font-size:11px;color:var(--g);margin-top:3px;font-weight:500">📅 ${proxFechaStr}</div>` : '<div style="font-size:11px;color:var(--muted);margin-top:3px">Sin próxima visita</div>'}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
          <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:99px;background:${bg};color:${txt}">${ETAPA_LABEL[c.etapa]||c.etapa}</span>
          <span style="font-size:10px;color:var(--muted)">${ult}</span>
        </div>
      </div>`;
    }).join('');
  } catch(e) { el.innerHTML=`<div style="padding:24px;text-align:center;color:var(--a);font-size:13px">⚠ Error: ${e.message}</div>`; }
};

let _fichaData = null;
window.openFicha = async (rif) => {
  const modal = document.getElementById('modal-ficha');
  modal.style.display='block';
  document.getElementById('fc-nombre').textContent='Cargando...';
  document.getElementById('fc-rif').textContent='';
  document.getElementById('fc-etapa-badge').textContent='';
  document.getElementById('fc-visitas').textContent='—';
  document.getElementById('fc-pedidos').textContent='—';
  document.getElementById('fc-cobrado').textContent='—';
  document.getElementById('fc-proxima').textContent='Sin definir';
  document.getElementById('fc-proxima-fecha').textContent='';
  document.getElementById('fc-historial').textContent='Cargando...';
  try {
    const snap = await getDoc(doc(db,'clientes',rif));
    if (!snap.exists()) { document.getElementById('fc-nombre').textContent='Cliente no encontrado'; return; }
    const c = snap.data(); _fichaData = c;
    const ec = ETAPA_COLOR[c.etapa]||'#F1EFE8;color:#444441';
    const [bg,txt] = ec.split(';color:');
    document.getElementById('fc-nombre').textContent = c.nombre||'Sin nombre';
    document.getElementById('fc-rif').textContent = (c.rif_formato||rif) + (c.ciudad ? ' · '+c.ciudad : '');
    const badge = document.getElementById('fc-etapa-badge');
    badge.textContent = ETAPA_LABEL[c.etapa]||c.etapa||'—';
    badge.style.cssText = `display:inline-block;margin-top:6px;font-size:11px;font-weight:700;padding:3px 10px;border-radius:99px;background:${bg};color:${txt}`;
    document.getElementById('fc-visitas').textContent = c.total_visitas||0;
    document.getElementById('fc-pedidos').textContent = c.total_pedidos||0;
    document.getElementById('fc-cobrado').textContent = c.total_cobrado_usd ? '$'+Number(c.total_cobrado_usd).toFixed(2) : '$0.00';
    document.getElementById('fc-proxima').textContent = c.proxima_accion||'Sin definir';
    if (c.proxima_accion_fecha) {
      const d = new Date(c.proxima_accion_fecha.seconds*1000);
      const hasTime = d.getHours()!==0||d.getMinutes()!==0;
      const dStr = d.toLocaleDateString('es-VE',{weekday:'short',day:'2-digit',month:'short',year:'numeric'});
      const tStr = hasTime ? ' · '+d.toLocaleTimeString('es-VE',{hour:'2-digit',minute:'2-digit',hour12:true}) : '';
      document.getElementById('fc-proxima-fecha').textContent = dStr+tStr;
    }
    // load visit history
    const vSnap = await getDocs(query(collection(db,'visitas'), where('rif_normalizado','==',rif), orderBy('timestamp','desc'), limit(10)));
    if (vSnap.empty) { document.getElementById('fc-historial').textContent='Sin visitas registradas'; return; }
    document.getElementById('fc-historial').innerHTML = vSnap.docs.map(v=>{
      const vd = v.data();
      const fecha = vd.fecha_str || (vd.timestamp ? new Date(vd.timestamp.seconds*1000).toLocaleDateString('es-VE') : '—');
      return `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
        <div style="width:8px;height:8px;border-radius:50%;background:var(--g);margin-top:4px;flex-shrink:0"></div>
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--text)">${vd.resultado||vd.tipo_visita||'Visita'}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">${fecha}${vd.observaciones?' · '+vd.observaciones:''}</div>
        </div>
      </div>`;
    }).join('');
  } catch(e) { document.getElementById('fc-historial').textContent='Error: '+e.message; }
};

window.closeFicha = () => { document.getElementById('modal-ficha').style.display='none'; _fichaData=null; };
