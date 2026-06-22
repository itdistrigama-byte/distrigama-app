// ── DISTRIGAMA · js/plan.js ── Plan semanal: vista por proxima_accion_fecha, ruta, recordatorios, resumen
import { db, state, NOW } from './config.js';
import { collection, query, where, orderBy, limit, getDocs, Timestamp }
  from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { updateNotifBadge } from './utils.js';

const ETAPA_LABEL = { prospecto:'Prospecto', contactado:'Contactado', propuesta:'Propuesta', cliente_activo:'Activo', recompra:'Recompra' };
const DIA_LABEL = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

let planFiltro = 'todas'; // todas | pendientes | completadas

// ── fechas de la semana (lunes a domingo) ──
function inicioSemana(d) {
  const x = new Date(d);
  const dow = x.getDay(); // 0=domingo
  const diff = dow === 0 ? -6 : 1 - dow;
  x.setDate(x.getDate() + diff);
  x.setHours(0,0,0,0);
  return x;
}
function finSemana(d) {
  const ini = inicioSemana(d);
  const fin = new Date(ini);
  fin.setDate(fin.getDate() + 6);
  fin.setHours(23,59,59,999);
  return fin;
}
function inicioHoy(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }

const telDigits = t => {
  if (!t) return null;
  let d = String(t).replace(/\D/g,'');
  if (!d) return null;
  if (d.startsWith('0')) d = '58'+d.slice(1);
  if (!d.startsWith('58')) d = '58'+d;
  return d;
};

const fechaCliente = c => c.proxima_accion_fecha ? new Date(c.proxima_accion_fecha.seconds*1000) : null;

// ── recordatorio automático (1x por día) ──
function avisarAtrasadas(n) {
  const hoyStr = NOW.toDateString();
  const last = localStorage.getItem('dg_plan_alert_date');
  if (n > 0 && last !== hoyStr) {
    state.notifications.unshift({
      id: Date.now(),
      title: '📅 Plan semanal',
      body: `Tienes ${n} visita${n>1?'s':''} atrasada${n>1?'s':''} esta semana`,
      time: new Date().toLocaleTimeString('es-VE',{hour:'2-digit',minute:'2-digit'}),
      read: false
    });
    localStorage.setItem('dg_notifs_v1', JSON.stringify(state.notifications));
    localStorage.setItem('dg_plan_alert_date', hoyStr);
    updateNotifBadge();
  }
}

window.setPlanFiltro = (mode, el) => {
  planFiltro = mode;
  document.querySelectorAll('#scr-plan .ck-card').forEach(c => c.classList.remove('on'));
  if (el) el.classList.add('on');
  renderPlan();
};

window.renderPlan = async () => {
  const el = document.getElementById('plan-list');
  if (!el) return;
  if (!db || !state.currentUser) {
    el.innerHTML = '<div style="padding:32px;text-align:center;color:var(--muted);font-size:13px">Inicia sesión para ver tu plan</div>';
    return;
  }
  el.innerHTML = '<div style="padding:40px 20px;text-align:center;color:var(--muted);font-size:14px"><div style="font-size:40px;margin-bottom:12px;opacity:.4">📅</div>Cargando plan de la semana...</div>';
  try {
    const ini = inicioSemana(NOW);
    const fin = finSemana(NOW);
    const hoyIni = inicioHoy(NOW);

    // 1) clientes del vendedor con próxima acción hasta el fin de esta semana (incluye atrasadas de semanas previas)
    const qCli = query(collection(db,'clientes'),
      where('vendedor_uid','==', state.currentUser.uid),
      orderBy('proxima_accion_fecha','asc'),
      limit(300));
    const snapCli = await getDocs(qCli);
    let docs = snapCli.docs
      .map(d => d.data())
      .filter(c => {
        const f = fechaCliente(c);
        return f && f <= fin;
      });

    // 2) visitas registradas esta semana por el vendedor → marca quién ya fue atendido
    const qVis = query(collection(db,'visitas'),
      where('vendedor_uid','==', state.currentUser.uid),
      where('timestamp','>=', Timestamp.fromDate(ini)),
      where('timestamp','<=', Timestamp.fromDate(fin)));
    const snapVis = await getDocs(qVis);
    const completadasSet = new Set(snapVis.docs.map(v => v.data().rif_normalizado).filter(Boolean));

    // recordatorio automático de atrasadas (antes de aplicar filtros de UI)
    const atrasadasTotal = docs.filter(c => fechaCliente(c) < hoyIni).length;
    avisarAtrasadas(atrasadasTotal);

    // filtro por ruta
    const ruta = document.getElementById('plan-ruta')?.value || '';
    if (ruta) docs = docs.filter(c => c.ruta === ruta);

    // resumen (sobre el set ya filtrado por ruta, antes del filtro pendientes/completadas)
    const totalSemana = docs.length;
    const completadas = docs.filter(c => completadasSet.has(c.rif_normalizado)).length;
    const pendientes = totalSemana - completadas;
    document.getElementById('pk-total').textContent = totalSemana;
    document.getElementById('pk-pendn').textContent = pendientes;
    document.getElementById('pk-compn').textContent = completadas;

    // filtro de KPI (todas/pendientes/completadas)
    if (planFiltro === 'pendientes') docs = docs.filter(c => !completadasSet.has(c.rif_normalizado));
    if (planFiltro === 'completadas') docs = docs.filter(c => completadasSet.has(c.rif_normalizado));

    if (!docs.length) {
      el.innerHTML = '<div style="padding:40px 20px;text-align:center;color:var(--muted);font-size:14px"><div style="font-size:40px;margin-bottom:12px;opacity:.4">✅</div>Nada que mostrar con este filtro</div>';
      return;
    }

    // agrupar por día (atrasadas primero, luego lun..dom de la semana actual)
    const grupos = new Map(); // key -> { label, items }
    docs.forEach(c => {
      const f = fechaCliente(c);
      let key, label;
      if (f < hoyIni) {
        key = 'atrasadas'; label = '⚠ Atrasadas';
      } else {
        const sameDay = (a,b) => a.toDateString()===b.toDateString();
        if (sameDay(f, NOW)) { key='hoy'; label = '📅 Hoy · ' + f.toLocaleDateString('es-VE',{day:'2-digit',month:'short'}); }
        else {
          const mañana = new Date(NOW); mañana.setDate(mañana.getDate()+1);
          if (sameDay(f, mañana)) { key='mañana'; label = '📅 Mañana · ' + f.toLocaleDateString('es-VE',{day:'2-digit',month:'short'}); }
          else { key = f.toDateString(); label = '📅 ' + DIA_LABEL[f.getDay()] + ' ' + f.toLocaleDateString('es-VE',{day:'2-digit',month:'short'}); }
        }
      }
      if (!grupos.has(key)) grupos.set(key, { label, items: [] });
      grupos.get(key).items.push(c);
    });

    // orden de grupos: atrasadas, hoy, mañana, luego cronológico
    const ordenKey = k => k==='atrasadas' ? -2 : k==='hoy' ? -1 : k==='mañana' ? 0 : new Date(k).getTime();
    const gruposOrdenados = [...grupos.entries()].sort((a,b) => ordenKey(a[0]) - ordenKey(b[0]));

    el.innerHTML = gruposOrdenados.map(([key, g]) => {
      const isAtrasadas = key === 'atrasadas';
      const filas = g.items.map(c => {
        const hecha = completadasSet.has(c.rif_normalizado);
        const tel = telDigits(c.contacto_telefono);
        const f = fechaCliente(c);
        const hStr = f && (f.getHours()!==0||f.getMinutes()!==0) ? ' · '+f.toLocaleTimeString('es-VE',{hour:'2-digit',minute:'2-digit'}) : '';
        return `<div class="cart-row" onclick="openFicha('${c.rif_normalizado}')">
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              ${hecha?'<span style="color:var(--g)">✅</span> ':''}${c.nombre||'Sin nombre'} ${c.tipo?`<span class="badge ba-${c.tipo}">${c.tipo}</span>`:''}
            </div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px">${c.rif_formato||c.rif_normalizado} · ${c.ruta||'—'} · ${ETAPA_LABEL[c.etapa]||c.etapa||'—'}</div>
            <div style="font-size:11px;margin-top:3px;color:${isAtrasadas&&!hecha?'var(--r)':'var(--muted)'}">${c.proxima_accion||'Sin nota'}${hStr}</div>
          </div>
          ${tel?`<a class="cart-act" href="tel:+${tel}" onclick="event.stopPropagation()" title="Llamar">📞</a>
          <a class="cart-act" href="https://wa.me/${tel}" target="_blank" onclick="event.stopPropagation()" title="WhatsApp">💬</a>`:''}
        </div>`;
      }).join('');
      return `<div class="plan-day-hdr" style="${isAtrasadas?'color:var(--r)':''}">${g.label} · ${g.items.length}</div>${filas}`;
    }).join('');
  } catch(e) {
    console.error('Plan:', e);
    el.innerHTML = `<div style="padding:24px;text-align:center;color:var(--a);font-size:13px">⚠ Error: ${e.message}</div>`;
  }
};
