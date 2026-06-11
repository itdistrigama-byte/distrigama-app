// ── DISTRIGAMA · js/panel.js ── Panel de operación v6.2: Hoy / Análisis / Equipo
// Bloque "Pedidos" (pipeline + velocidad de cierre) oculto hasta Fase 5.
import { db, state, NOW, FMT_DATE } from './config.js';
import { doc, getDoc, getDocs, collection, query, where, orderBy, limit }
  from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const BLOQUES = ['hoy','analisis','equipo'];
let cur = 'hoy';
let _cache = null;
let _cacheTs = 0;

window.showPanel = (b, el) => {
  cur = b;
  BLOQUES.forEach(x => {
    const blk = document.getElementById('pnl-'+x);
    if (blk) blk.style.display = x===b ? 'block' : 'none';
    const btn = document.getElementById('pb-'+x);
    if (btn) btn.classList.toggle('on', x===b);
  });
};

// deslizar lateralmente para cambiar de bloque
let _x0 = null;
document.addEventListener('DOMContentLoaded', () => {
  const p = document.getElementById('pnl-body');
  if (!p) return;
  p.addEventListener('pointerdown', e => _x0 = e.clientX);
  p.addEventListener('pointerup', e => {
    if (_x0 === null) return;
    const dx = e.clientX - _x0; _x0 = null;
    if (Math.abs(dx) < 45) return;
    const vis = BLOQUES.filter(b => document.getElementById('pb-'+b)?.style.display !== 'none');
    let i = vis.indexOf(cur) + (dx < 0 ? 1 : -1);
    i = (i + vis.length) % vis.length;
    window.showPanel(vis[i], null);
  });
});

const esJefe = () => ['director','coordinador'].includes(state.userProfile?.rol);
const tsDate = t => t?.seconds ? new Date(t.seconds*1000) : null;

async function fetchData() {
  // cache 2 min para no releer Firestore en cada cambio de tab
  if (_cache && Date.now() - _cacheTs < 120000) return _cache;
  const jefe = esJefe();
  const qPed = jefe
    ? query(collection(db,'pedidos'), orderBy('timestamp','desc'), limit(500))
    : query(collection(db,'pedidos'), where('vendedor_uid','==',state.currentUser.uid));
  const qVis = jefe
    ? query(collection(db,'visitas'), orderBy('timestamp','desc'), limit(500))
    : query(collection(db,'visitas'), where('vendedor_uid','==',state.currentUser.uid));
  const [pSnap, vSnap, cfgSnap] = await Promise.all([
    getDocs(qPed), getDocs(qVis), getDoc(doc(db,'config','app'))
  ]);
  _cache = {
    pedidos: pSnap.docs.map(d=>d.data()),
    visitas: vSnap.docs.map(d=>d.data()),
    meta: Number(cfgSnap.exists() ? (cfgSnap.data().meta_diaria||0) : 0)
  };
  _cacheTs = Date.now();
  return _cache;
}

export async function renderPanel() {
  if (!state.currentUser) return;
  if (esJefe()) document.getElementById('pb-equipo').style.display = '';
  try {
    const { pedidos, visitas, meta } = await fetchData();
    const d7 = Date.now() - 7*86400000;
    const d30 = Date.now() - 30*86400000;
    const d60 = Date.now() - 60*86400000;

    // ── HOY ──
    const hoy = pedidos.filter(p => p.fecha === FMT_DATE);
    const ventasHoy = hoy.reduce((s,p)=>s+(p.total||0),0);
    const ticket = hoy.length ? ventasHoy/hoy.length : 0;
    const visHoy = visitas.filter(v => v.fecha_str === NOW.toLocaleDateString('es-VE')).length;
    document.getElementById('pnl-ventas').textContent = '$'+ventasHoy.toFixed(2) + (meta ? ' / $'+meta.toFixed(0) : '');
    document.getElementById('pnl-sub').textContent = hoy.length+' pedidos · '+visHoy+' visitas · ticket $'+ticket.toFixed(2);
    const ring = document.getElementById('pnl-ring');
    const ringTxt = document.getElementById('pnl-ring-txt');
    if (meta > 0) {
      const pct = Math.min(100, Math.round(ventasHoy/meta*100));
      ring.setAttribute('stroke-dasharray', (pct*2.14).toFixed(0)+' 214');
      ringTxt.textContent = pct+'%';
    } else {
      ringTxt.textContent = '—';
      document.getElementById('pnl-sub').textContent += ' · define meta_diaria en config/app';
    }

    // ── ANÁLISIS: embudo semana ──
    const vSem = visitas.filter(v => tsDate(v.timestamp) > new Date(d7));
    const prop = vSem.filter(v => v.res === 'Proposición de pedido (en revisión)').length;
    const cierre = vSem.filter(v => v.res === 'Pedido cerrado').length;
    const tot = vSem.length || 1;
    const fila = (lbl, n, pct, color) =>
      `<div><div style="font-size:11px;color:var(--muted);margin-bottom:2px">${lbl} — ${n}</div><div style="height:12px;background:${color};border-radius:4px;width:${Math.max(4,pct)}%"></div></div>`;
    document.getElementById('pnl-funnel').innerHTML =
      fila('Visitas', vSem.length, 100, '#9FE1CB') +
      fila('Proposición', prop, prop/tot*100, '#5DCAA5') +
      fila('Pedido cerrado', cierre + ' ('+Math.round(cierre/tot*100)+'%)', cierre/tot*100, '#1D9E75');

    // ── ANÁLISIS: recurrencia del mes (ventana 60 días) ──
    const porCliente = {};
    pedidos.forEach(p => {
      const t = tsDate(p.timestamp); if (!t || t < new Date(d60)) return;
      const k = p.cliente_rif || p.cliente_nombre || '?';
      const reciente = t > new Date(d30);
      porCliente[k] = porCliente[k] || { mes:0, prev:0 };
      if (reciente) porCliente[k].mes++; else porCliente[k].prev++;
    });
    let rec=0, nuevos=0, inact=0;
    Object.values(porCliente).forEach(c => {
      if (c.mes >= 2) rec++;
      else if (c.mes === 1) nuevos++;
      else if (c.prev > 0) inact++;
    });
    document.getElementById('pnl-rec-t').textContent = 'Clientes con pedidos (30 días): '+(rec+nuevos);
    document.getElementById('pnl-rec').innerHTML =
      rec+' recurrentes (2+ pedidos) · '+nuevos+' con un pedido'+
      (inact ? `<div style="color:var(--r);margin-top:4px">⚠ ${inact} inactivos: compraban y este mes no</div>` : '');

    // ── EQUIPO: ranking semanal (solo director/coordinador) ──
    if (esJefe()) {
      const porVend = {};
      pedidos.forEach(p => {
        const t = tsDate(p.timestamp); if (!t || t < new Date(d7)) return;
        const k = p.vendedor_nombre || p.vendedor || '?';
        porVend[k] = porVend[k] || { total:0, n:0 };
        porVend[k].total += (p.total||0); porVend[k].n++;
      });
      const rank = Object.entries(porVend).sort((a,b)=>b[1].total-a[1].total).slice(0,8);
      document.getElementById('pnl-rank').innerHTML = rank.length
        ? rank.map(([n,v],i)=>`<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--border)"><span>${i+1}. ${n}</span><span><b>$${v.total.toFixed(2)}</b> <span style="color:var(--muted);font-size:11px">tkt $${(v.total/v.n).toFixed(0)}</span></span></div>`).join('')
        : '<div style="color:var(--muted)">Sin pedidos esta semana</div>';
      document.getElementById('pnl-meta-info').textContent = meta ? 'Meta diaria global: $'+meta.toFixed(0)+' por vendedor' : 'Meta diaria no configurada (config/app → meta_diaria)';
    }
  } catch(e) {
    console.error('Panel:', e);
    const el = document.getElementById('pnl-sub');
    if (el) el.textContent = '⚠ '+e.message;
  }
}
window.renderPanel = renderPanel;
