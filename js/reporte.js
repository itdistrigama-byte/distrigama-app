// ── DISTRIGAMA · js/reporte.js ── Mi día, estadísticas, reporte de cierre
import { db, state, NOW, FMT_DATE } from './config.js';
import { collection, query, where, onSnapshot }
  from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ── MI DÍA ──
function updDia(){
  const today = NOW.toLocaleDateString('es-VE');
  const t = state.censo;
  
  // Contar visitas
  document.getElementById('s-tot').textContent=t.length;
  
  // Cargar pedidos del día desde Firestore
  const q = query(collection(db,'pedidos'),
    where('vendedor_uid','==',state.currentUser.uid),
    where('fecha','==',today));
  
  onSnapshot(q, snap => {
    const pedidosHoy = snap.docs.map(d => ({id:d.id,...d.data()}));
    
    // Actualizar contadores
    document.getElementById('s-ped').textContent=pedidosHoy.length;
    document.getElementById('s-ape').textContent=t.filter(e=>e.res==='Apertura en proceso').length;
    document.getElementById('s-a').textContent=t.filter(e=>e.tipo==='A').length;
    document.getElementById('s-b').textContent=t.filter(e=>e.tipo==='B').length;
    document.getElementById('s-c').textContent=t.filter(e=>e.tipo==='C').length;
    
    // Generar reporte — contar TODOS los resultados
    const vend=state.userProfile?.nombre||'[vendedor]';
    const ped=pedidosHoy.length;
    
    // Los 9 resultados posibles
    const cnt = res => t.filter(e=>e.res===res).length;
    const noResp   = cnt('No se encontró responsable');
    const ctcPrel  = cnt('Contacto preliminar (WhatsApp/teléfono)');
    const presCat  = cnt('Presentación inicial (catálogo)');
    const convPol  = cnt('Conversación de políticas (sin fecha)');
    const visAcor  = cnt('Visita preliminar completada (fecha acordada)');
    const propPed  = cnt('Proposición de pedido (en revisión)');
    const pedCerr  = cnt('Pedido cerrado');
    const noInt    = cnt('No interesado (rechazo activo)');
    const compPres = cnt('Competencia presente (cliente satisfecho)');
    const sinRes   = t.filter(e=>!e.res).length;
    
    let r=`📊 REPORTE CIERRE DE DÍA\n${FMT_DATE} · Vendedor: ${vend}\n\n`;
    r+=`📍 Visitas totales: ${t.length}   |   ✅ Pedidos: ${ped}\n`;
    r+=`👥 Tipo A: ${t.filter(e=>e.tipo==='A').length}  B: ${t.filter(e=>e.tipo==='B').length}  C: ${t.filter(e=>e.tipo==='C').length}\n\n`;
    r+=`── RESULTADOS DE VISITA ──\n`;
    if(pedCerr)   r+=`✅✅ Pedido cerrado: ${pedCerr}\n`;
    if(propPed)   r+=`✅  Proposición de pedido (en revisión): ${propPed}\n`;
    if(visAcor)   r+=`✅  Visita completada (fecha acordada): ${visAcor}\n`;
    if(convPol)   r+=`⚠️  Conversación de políticas (sin fecha): ${convPol}\n`;
    if(presCat)   r+=`⚠️  Presentación inicial (catálogo): ${presCat}\n`;
    if(ctcPrel)   r+=`❌  Contacto preliminar (WhatsApp): ${ctcPrel}\n`;
    if(noResp)    r+=`❌  No se encontró responsable: ${noResp}\n`;
    if(noInt)     r+=`❌  No interesado (rechazo activo): ${noInt}\n`;
    if(compPres)  r+=`❌  Competencia presente: ${compPres}\n`;
    if(sinRes)    r+=`⬜  Sin resultado registrado: ${sinRes}\n`;
    
    if(t.length){
      r+=`\n\nDETALLE VISITAS:\n`;
      t.forEach(e=>{r+=`• ${e.nom} (Tipo ${e.tipo}) — ${e.res||'Sin resultado'}\n`;});
    }
    
    if(pedidosHoy.length){
      r+=`\n\nDETALLE PEDIDOS:\n`;
      pedidosHoy.forEach(p=>{
        r+=`• ${p.cliente_nombre} - Total: $${p.total.toFixed(2)} ${p.state.moneda}\n`;
      });
    }
    
    document.getElementById('rpt').textContent=r;
  });
}
window.sendRpt=()=>{window.open(`https://wa.me/584242679283?text=${encodeURIComponent(document.getElementById('rpt').textContent)}`,'_blank');};

window.updDia = updDia; // usado por el dispatcher de tabs (sw)
