// ── DISTRIGAMA · js/cartera.js ── Cartera CRM v6.2: KPIs, tabla priorizada, ficha con contacto
import { db, state, NOW, FMT_TIME } from './config.js';
import { doc, getDoc, getDocs, updateDoc, addDoc, collection, query, where, orderBy, limit, serverTimestamp, increment }
  from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { fbEl } from './utils.js';

let cKpi = 'todos';
let _fichaData = null;
let _fichaRif = null;
let _fichaCoords = null;

const ETAPA_LABEL = { prospecto:'Prospecto', contactado:'Contactado', propuesta:'Propuesta', cliente_activo:'Activo', recompra:'Recompra' };
const ETAPA_COLOR = { prospecto:'#FAEEDA;color:#633806', contactado:'#E6F1FB;color:#0C447C', propuesta:'#EEEDFE;color:#3C3489', cliente_activo:'#E1F5EE;color:#085041', recompra:'#E1F5EE;color:#0F6E56' };
const CADENCIA = { A: 30, B: 60, C: 90 };

const diasSin = c => c.ultima_visita ? Math.floor((NOW - new Date(c.ultima_visita.seconds*1000))/86400000) : null;
const atrasado = c => { const d = diasSin(c); return !!(c.tipo && CADENCIA[c.tipo] && d !== null && d > CADENCIA[c.tipo]); };
const esHoy = c => {
  if (!c.proxima_accion_fecha) return false;
  return new Date(c.proxima_accion_fecha.seconds*1000).toDateString() === NOW.toDateString();
};
const sinProx = c => !c.proxima_accion_fecha;
const telDigits = t => {
  if (!t) return null;
  let d = String(t).replace(/\D/g,'');
  if (!d) return null;
  if (d.startsWith('0')) d = '58'+d.slice(1);
  if (!d.startsWith('58')) d = '58'+d;
  return d;
};

window.setCKpi = (mode, el) => {
  cKpi = mode;
  document.querySelectorAll('.ck-card').forEach(c=>c.classList.remove('on'));
  if (el) el.classList.add('on');
  renderCartera();
};

window.renderCartera = async () => {
  const el = document.getElementById('cart-list');
  if (!db || !state.currentUser) { el.innerHTML='<div style="padding:32px;text-align:center;color:var(--muted);font-size:13px">Inicia sesión para ver tu cartera</div>'; return; }
  try {
    let q = query(collection(db,'clientes'), where('vendedor_uid','==',state.currentUser.uid), orderBy('ultima_visita','desc'), limit(200));
    if (state.userProfile?.rol==='director') q = query(collection(db,'clientes'), orderBy('ultima_visita','desc'), limit(200));
    const snap = await getDocs(q);
    let docs = snap.docs.map(d=>d.data());

    // KPIs sobre la cartera completa
    document.getElementById('ck-total').textContent = docs.length;
    document.getElementById('ck-atras').textContent = docs.filter(atrasado).length;
    document.getElementById('ck-sinprox').textContent = docs.filter(sinProx).length;
    document.getElementById('ck-hoy').textContent = docs.filter(esHoy).length;

    // filtro por KPI
    if (cKpi === 'atrasados') docs = docs.filter(atrasado);
    if (cKpi === 'sinprox') docs = docs.filter(sinProx);
    if (cKpi === 'hoy') docs = docs.filter(esHoy);

    // filtros por selects + búsqueda
    const ruta = document.getElementById('cart-ruta')?.value || '';
    const tipo = document.getElementById('cart-tipo')?.value || '';
    const etapa = document.getElementById('cart-etapa')?.value || '';
    const srch = (document.getElementById('c-srch')?.value||'').toLowerCase();
    if (ruta) docs = docs.filter(d=>d.ruta===ruta);
    if (tipo) docs = docs.filter(d=>d.tipo===tipo);
    if (etapa) docs = docs.filter(d=>d.etapa===etapa);
    if (srch) docs = docs.filter(d=>(d.nombre||'').toLowerCase().includes(srch)||(d.rif_formato||'').toLowerCase().includes(srch)||(d.rif_normalizado||'').toLowerCase().includes(srch));

    // orden
    const orden = document.getElementById('cart-orden')?.value || 'dias';
    if (orden === 'dias') docs.sort((a,b)=>{
      const da = diasSin(a) ?? -1, db_ = diasSin(b) ?? -1;
      const ra = a.tipo&&CADENCIA[a.tipo] ? da/CADENCIA[a.tipo] : da/90;
      const rb = b.tipo&&CADENCIA[b.tipo] ? db_/CADENCIA[b.tipo] : db_/90;
      return rb - ra; // más atrasado relativo a su cadencia primero
    });
    if (orden === 'prox') docs.sort((a,b)=>{
      const fa = a.proxima_accion_fecha?.seconds ?? Infinity;
      const fb = b.proxima_accion_fecha?.seconds ?? Infinity;
      return fa - fb;
    });
    if (orden === 'nombre') docs.sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||''));

    if (!docs.length) { el.innerHTML='<div style="padding:40px 20px;text-align:center;color:var(--muted);font-size:14px"><div style="font-size:36px;margin-bottom:10px;opacity:.4">🔍</div>Sin resultados</div>'; return; }

    el.innerHTML = docs.map(c=>{
      const ec = ETAPA_COLOR[c.etapa]||'#F1EFE8;color:#444441';
      const [bg,txt] = ec.split(';color:');
      const d = diasSin(c);
      const atr = atrasado(c);
      const tel = telDigits(c.contacto_telefono);
      const ultStr = d===null ? '—' : (atr
        ? `<span style="color:var(--r);font-weight:700">${d}d ⚠</span><br><span style="font-size:10px;color:var(--muted)">cadencia ${CADENCIA[c.tipo]}d</span>`
        : `hace ${d}d`);
      const prox = (() => {
        if (!c.proxima_accion_fecha) return '<span style="color:var(--a)">sin definir</span>';
        const pd = new Date(c.proxima_accion_fecha.seconds*1000);
        const s = pd.toLocaleDateString('es-VE',{weekday:'short',day:'2-digit',month:'short'});
        return esHoy(c) ? `<span style="color:var(--g);font-weight:700">${s}</span>` : s;
      })();
      return `<div class="cart-row" onclick="openFicha('${c.rif_normalizado}')">
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.nombre||'Sin nombre'} ${c.tipo?`<span class="badge ba-${c.tipo}">${c.tipo}</span>`:''}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">${c.rif_formato||c.rif_normalizado} · ${c.ruta||'—'} · <span style="background:${bg};color:${txt};padding:0 6px;border-radius:99px;font-size:10px;font-weight:700">${ETAPA_LABEL[c.etapa]||c.etapa||'—'}</span></div>
          <div style="font-size:11px;margin-top:3px;display:flex;gap:10px"><span>${ultStr}</span><span>📅 ${prox}</span></div>
        </div>
        ${tel?`<a class="cart-act" href="tel:+${tel}" onclick="event.stopPropagation()" title="Llamar">📞</a>
        <a class="cart-act" href="https://wa.me/${tel}" target="_blank" onclick="event.stopPropagation()" title="WhatsApp">💬</a>`:''}
      </div>`;
    }).join('');
  } catch(e) { el.innerHTML=`<div style="padding:24px;text-align:center;color:var(--a);font-size:13px">⚠ Error: ${e.message}</div>`; }
};

window.openFicha = async (rif) => {
  const modal = document.getElementById('modal-ficha');
  modal.style.display='block';
  _fichaRif = rif; _fichaCoords = null;
  ['fc-rif','fc-proxima-fecha'].forEach(id=>document.getElementById(id).textContent='');
  document.getElementById('fc-nombre').textContent='Cargando...';
  document.getElementById('fc-etapa-badge').textContent='';
  document.getElementById('fc-tipo-badge').innerHTML='';
  ['fc-visitas','fc-pedidos','fc-cobrado'].forEach(id=>document.getElementById(id).textContent='—');
  ['fc-ctc','fc-dir','fc-lineas'].forEach(id=>document.getElementById(id).textContent='—');
  document.getElementById('fc-proxima').textContent='Sin definir';
  document.getElementById('fc-historial').textContent='Cargando...';
  document.getElementById('fc-btn-map').style.display='none';
  ['fc-seg-res','fc-seg-obs','fc-seg-fecha','fc-seg-hora'].forEach(id=>document.getElementById(id).value='');
  try {
    const snap = await getDoc(doc(db,'clientes',rif));
    if (!snap.exists()) { document.getElementById('fc-nombre').textContent='Cliente no encontrado'; return; }
    const c = snap.data(); _fichaData = c;
    const ec = ETAPA_COLOR[c.etapa]||'#F1EFE8;color:#444441';
    const [bg,txt] = ec.split(';color:');
    document.getElementById('fc-nombre').textContent = c.nombre||'Sin nombre';
    document.getElementById('fc-rif').textContent = (c.rif_formato||rif) + (c.ciudad ? ' · '+c.ciudad : '') + (c.ruta ? ' · '+c.ruta : '');
    const badge = document.getElementById('fc-etapa-badge');
    badge.textContent = ETAPA_LABEL[c.etapa]||c.etapa||'—';
    badge.style.cssText = `display:inline-block;font-size:11px;font-weight:700;padding:3px 10px;border-radius:99px;background:${bg};color:${txt}`;
    if (c.tipo) document.getElementById('fc-tipo-badge').innerHTML = `<span class="badge ba-${c.tipo}">${c.tipo} · cada ${CADENCIA[c.tipo]}d</span>`;
    document.getElementById('fc-etapa-sel').value = c.etapa||'prospecto';
    // contacto
    document.getElementById('fc-ctc').textContent = (c.contacto_nombre||'—') + (c.contacto_telefono ? ' · '+c.contacto_telefono : '');
    document.getElementById('fc-dir').textContent = c.direccion || '—';
    document.getElementById('fc-lineas').textContent = (c.lineas||[]).join(', ') || '—';
    // stats
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
    // historial (y captura de coordenadas para el botón Mapa)
    const vSnap = await getDocs(query(collection(db,'visitas'), where('rif_normalizado','==',rif), orderBy('timestamp','desc'), limit(10)));
    if (vSnap.empty) { document.getElementById('fc-historial').textContent='Sin visitas registradas'; return; }
    document.getElementById('fc-historial').innerHTML = vSnap.docs.map(v=>{
      const vd = v.data();
      if (!_fichaCoords && vd.lat) { _fichaCoords = { lat: vd.lat, lng: vd.lng }; document.getElementById('fc-btn-map').style.display=''; }
      const fecha = vd.fecha_str || (vd.timestamp ? new Date(vd.timestamp.seconds*1000).toLocaleDateString('es-VE') : '—');
      return `<div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
        <div style="width:8px;height:8px;border-radius:50%;background:var(--g);margin-top:4px;flex-shrink:0"></div>
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--text)">${vd.res||vd.resultado||vd.tipo_visita||'Visita'}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">${fecha}${vd.obs?' · '+vd.obs:(vd.observaciones?' · '+vd.observaciones:'')}</div>
        </div>
      </div>`;
    }).join('');
  } catch(e) { document.getElementById('fc-historial').textContent='Error: '+e.message; }
};

window.closeFicha = () => { document.getElementById('modal-ficha').style.display='none'; _fichaData=null; _fichaRif=null; _fichaCoords=null; };

// Acciones de contacto
window.fichaCall = () => {
  const t = telDigits(_fichaData?.contacto_telefono);
  if (!t) { fbEl('fc-seg-fb','⚠ Este cliente no tiene teléfono registrado','var(--al)','var(--a)'); return; }
  window.open('tel:+'+t, '_self');
};
window.fichaWA = () => {
  const t = telDigits(_fichaData?.contacto_telefono);
  if (!t) { fbEl('fc-seg-fb','⚠ Este cliente no tiene teléfono registrado','var(--al)','var(--a)'); return; }
  window.open('https://wa.me/'+t, '_blank');
};
window.fichaMap = () => {
  if (!_fichaCoords) return;
  window.open(`https://maps.google.com/?q=${_fichaCoords.lat},${_fichaCoords.lng}`, '_blank');
};

window.setEtapa = async (etapa) => {
  if (!_fichaRif) return;
  try {
    await updateDoc(doc(db,'clientes',_fichaRif), { etapa });
    const ec = ETAPA_COLOR[etapa]||'#F1EFE8;color:#444441';
    const [bg,txt] = ec.split(';color:');
    const badge = document.getElementById('fc-etapa-badge');
    badge.textContent = ETAPA_LABEL[etapa]||etapa;
    badge.style.cssText = `display:inline-block;font-size:11px;font-weight:700;padding:3px 10px;border-radius:99px;background:${bg};color:${txt}`;
    if (_fichaData) _fichaData.etapa = etapa;
    fbEl('fc-seg-fb','✅ Etapa actualizada a '+(ETAPA_LABEL[etapa]||etapa),'var(--gl)','var(--g)');
    renderCartera();
  } catch(e) {
    fbEl('fc-seg-fb','❌ Error al cambiar etapa: '+e.message,'var(--rl)','var(--r)');
  }
};

window.saveSeguimiento = async () => {
  if (!_fichaRif || !_fichaData) return;
  const res = document.getElementById('fc-seg-res').value;
  const obs = document.getElementById('fc-seg-obs').value.trim();
  if (!res) { fbEl('fc-seg-fb','⚠ Selecciona el resultado de la visita','var(--al)','var(--a)'); return; }
  const proxFecha = (() => {
    const fd = document.getElementById('fc-seg-fecha').value;
    if (!fd) return null;
    const [y,m,d] = fd.split('-').map(Number);
    const hh = document.getElementById('fc-seg-hora').value;
    if (hh) { const [h,min] = hh.split(':').map(Number); return new Date(y, m-1, d, h, min, 0); }
    return new Date(y, m-1, d);
  })();
  try {
    await addDoc(collection(db,'visitas'), {
      tipo_visita: 'seguimiento',
      nom: _fichaData.nombre || '',
      tipo: _fichaData.tipo || '',
      rif_normalizado: _fichaRif,
      rif_formato: _fichaData.rif_formato || _fichaRif,
      ruta: _fichaData.ruta || '',
      ciudad: _fichaData.ciudad || '',
      lineas: _fichaData.lineas || [],
      res, obs,
      proxima_accion: obs,
      proxima_accion_fecha: proxFecha,
      lat: null, lng: null,
      hora: FMT_TIME(),
      fecha_str: NOW.toLocaleDateString('es-VE'),
      vendedor_uid: state.currentUser.uid,
      vendedor_nombre: state.userProfile.nombre,
      timestamp: serverTimestamp()
    });
    const upd = { ultima_visita: serverTimestamp(), total_visitas: increment(1) };
    if (obs) upd.proxima_accion = obs;
    if (proxFecha) upd.proxima_accion_fecha = proxFecha;
    await updateDoc(doc(db,'clientes',_fichaRif), upd);
    fbEl('fc-seg-fb','✅ Seguimiento registrado','var(--gl)','var(--g)');
    ['fc-seg-res','fc-seg-obs','fc-seg-fecha','fc-seg-hora'].forEach(id=>document.getElementById(id).value='');
    openFicha(_fichaRif);
    renderCartera();
  } catch(e) {
    fbEl('fc-seg-fb','❌ Error al guardar: '+e.message,'var(--rl)','var(--r)');
  }
};

window.pedidoFromFicha = () => {
  if (_fichaData) {
    document.getElementById('p-cli').value = _fichaData.nombre || '';
    document.getElementById('p-rif').value = _fichaData.rif_formato || _fichaRif || '';
    document.getElementById('p-tel').value = _fichaData.contacto_telefono || '';
    document.getElementById('p-dir').value = _fichaData.direccion || '';
  }
  closeFicha();
  window.sw('pedido');
};
