// ── DISTRIGAMA · js/pdf-xlsx.js ── Carrito, generador PDF/XLSX, savePedido, WhatsApp
import { db, state, FMT_DATE } from './config.js';
import { doc, getDoc, setDoc, addDoc, updateDoc, collection, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

function isCpvAf(code){ return /^CPV-AF\d+$/.test(code); }

export function renderCart() {
  const empty = document.getElementById('cart-empty');
  const card = document.getElementById('cart-card');
  if (!state.cart.length) { card.style.display='none'; empty.style.display='block'; return; }
  card.style.display='block'; empty.style.display='none';
  document.getElementById('cart-cnt').textContent = state.cart.length;

  // CPV-AF volume discount: 30% when total CPV-AF qty >= 400 (mixed products)
  const cpvAfQty = state.cart.filter(i=>isCpvAf(i.c)).reduce((s,i)=>s+i.qty,0);
  const cpvAfVol = cpvAfQty >= 400;

  const sub = state.cart.reduce((s,i)=>{
    const base = i.p * i.qty;
    return s + (isCpvAf(i.c) && cpvAfVol ? base * 0.70 : base);
  }, 0);
  const subFull = state.cart.reduce((s,i)=>s+i.p*i.qty, 0);

  const amt35 = sub * 0.35;
  const amt40 = sub * 0.35 + (sub * 0.65) * 0.05;
  const after35 = sub - amt35;
  const after40 = sub - amt40;
  const flete35 = after35 * 0.035;
  const flete40 = after40 * 0.035;
  const total35 = after35 + flete35;
  const total40 = after40 + flete40;

  document.getElementById('cart-items').innerHTML = state.cart.map(i=>{
    const isCpv = isCpvAf(i.c);
    const p_full = i.p * i.qty;
    const p_base = (isCpv && cpvAfVol) ? p_full * 0.70 : p_full;
    const p_35 = p_base * 0.65;
    const p_40 = p_base * 0.65 * 0.95;
    const cpvBadge = (isCpv && cpvAfVol)
      ? `<span style="background:#0F6E56;color:#fff;font-size:9px;border-radius:4px;padding:1px 4px;margin-left:4px">-30% VOL</span>`
      : (isCpv ? `<span style="color:var(--muted);font-size:9px;margin-left:4px">${cpvAfQty}/400pz</span>` : '');
    return `
    <div class="cart-item">
      <div><div class="ci-name">${i.n}${cpvBadge}</div><div class="ci-code">${i.c} · ${i.u}</div></div>
      <div class="qty-ctrl">
        <button class="qty-btn" onclick="updQty('${i.c}',${i.qty-1})">−</button>
        <input class="qty-in" type="number" value="${i.qty}" min="1" onchange="updQty('${i.c}',this.value)">
        <button class="qty-btn" onclick="updQty('${i.c}',${i.qty+1})">+</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;font-size:12px;text-align:right;min-width:150px">
        <div><small style="color:var(--muted)">Full</small><br>$${p_full.toFixed(3)}</div>
        <div><small style="color:var(--a)">-35%</small><br>$${p_35.toFixed(3)}</div>
        <div><small style="color:var(--g)">Pronto Pago</small><br>$${p_40.toFixed(3)}</div>
      </div>
      <button class="ci-del" onclick="rmCart('${i.c}')">×</button>
    </div>`;
  }).join('');

  const cpvVolBanner = cpvAfVol
    ? `<div style="background:#E1F5EE;border:1px solid #0F6E56;border-radius:8px;padding:8px 12px;margin-bottom:8px;font-size:12px;color:#0F6E56;font-weight:600">🔩 ${cpvAfQty} piezas CPV-AF — Descuento 30% por volumen aplicado</div>`
    : (cpvAfQty > 0 ? `<div style="background:var(--al);border-radius:8px;padding:8px 12px;margin-bottom:8px;font-size:12px;color:var(--a);font-weight:500">🔩 ${cpvAfQty}/400 piezas CPV-AF — agrega ${400-cpvAfQty} más para activar -30% en conexiones</div>` : '');

  document.getElementById('summary').innerHTML=`
    ${cpvVolBanner}
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:13px;font-weight:700;margin:12px 0;padding:12px 0;border-top:2px solid var(--border);border-bottom:2px solid var(--border)">
      <div style="text-align:center">
        <div style="color:var(--muted);font-size:11px;font-weight:500;margin-bottom:4px">PRECIO FULL (BCV)</div>
        <div style="color:var(--text)">$${subFull.toFixed(3)}</div>
        <div style="font-size:11px;color:var(--muted);font-weight:400;margin-top:8px">Flete: $${(subFull*0.035).toFixed(3)}</div>
        <div style="color:var(--g);margin-top:4px">TOTAL: $${(subFull + subFull*0.035).toFixed(3)}</div>
      </div>
      <div style="text-align:center">
        <div style="color:var(--a);font-size:11px;font-weight:500;margin-bottom:4px">-35% DIVISA</div>
        <div style="color:var(--text)">$${after35.toFixed(3)}</div>
        <div style="font-size:11px;color:var(--muted);font-weight:400;margin-top:8px">Flete: $${flete35.toFixed(3)}</div>
        <div style="color:var(--a);margin-top:4px">TOTAL: $${total35.toFixed(3)}</div>
      </div>
      <div style="text-align:center">
        <div style="color:var(--g);font-size:11px;font-weight:500;margin-bottom:4px">PRONTO PAGO</div>
        <div style="color:var(--text)">$${after40.toFixed(3)}</div>
        <div style="font-size:11px;color:var(--muted);font-weight:400;margin-top:8px">Flete: $${flete40.toFixed(3)}</div>
        <div style="color:var(--g);margin-top:4px">TOTAL: $${total40.toFixed(3)}</div>
      </div>
    </div>`;
}

// ── XLSX GENERATOR ──
function gc(n){let s='';n++;while(n>0){s=String.fromCharCode(64+(n%26||26))+s;n=Math.floor((n-1)/26);}return s;}
const XW={
  _ct:null,_iC(){if(this._ct)return;const t=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[i]=c;}this._ct=t;},
  _c32(b){this._iC();let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=this._ct[(c^b[i])&0xFF]^(c>>>8);return(c^0xFFFFFFFF)>>>0;},
  _s2u(s){const b=[];for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(c<128)b.push(c);else if(c<2048)b.push(0xC0|(c>>6),0x80|(c&63));else b.push(0xE0|(c>>12),0x80|((c>>6)&63),0x80|(c&63));}return new Uint8Array(b);},
  _u32(n){return[n&255,(n>>8)&255,(n>>16)&255,(n>>24)&255];},
  _u16(n){return[n&255,(n>>8)&255];},
  _zip(files){const en=[];let off=0;const out=[];for(const f of files){const nb=this._s2u(f.name);const crc=this._c32(f.data);const sz=f.data.length;const lh=[0x50,0x4B,0x03,0x04,0x14,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,...this._u32(crc),...this._u32(sz),...this._u32(sz),...this._u16(nb.length),0x00,0x00,...nb];const lo=off;out.push(...lh,...f.data);off+=lh.length+sz;en.push({nb,crc,sz,lo});}const cs=off;for(let i=0;i<files.length;i++){const e=en[i];const cd=[0x50,0x4B,0x01,0x02,0x14,0x00,0x14,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,...this._u32(e.crc),...this._u32(e.sz),...this._u32(e.sz),...this._u16(e.nb.length),0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,...this._u32(e.lo),...e.nb];out.push(...cd);off+=cd.length;}const cdz=off-cs;const eo=[0x50,0x4B,0x05,0x06,0x00,0x00,0x00,0x00,...this._u16(files.length),...this._u16(files.length),...this._u32(cdz),...this._u32(cs),0x00,0x00];out.push(...eo);return new Uint8Array(out);},
  _e(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');},
  gen(rows){
    const strs=[];const si={};
    const cell=(v,s)=>{if(v===null||v===undefined||v==='')return'';if(typeof v==='number')return`<c r="__A__" t="n"${s!==undefined?` s="${s}"`:''}><v>${v}</v></c>`;const str=String(v);if(!(str in si)){si[str]=strs.length;strs.push(str);}return`<c r="__A__" t="s"${s!==undefined?` s="${s}"`:''}><v>${si[str]}</v></c>`;};
    let rx='';
    for(let r=0;r<rows.length;r++){const row=rows[r];if(!row?.length)continue;let cx='';for(let c=0;c<row.length;c++){const item=row[c];const addr=gc(c)+(r+1);let xml;if(item&&typeof item==='object')xml=cell(item.v,item.s);else xml=cell(item,undefined);cx+=xml.replace(/__A__/g,addr);}rx+=`<row r="${r+1}">${cx}</row>`;}
    const ss=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strs.length}" uniqueCount="${strs.length}">${strs.map(s=>`<si><t xml:space="preserve">${this._e(s)}</t></si>`).join('')}</sst>`;
    const st=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="4"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/><color rgb="FFFFFFFF"/></font><font><b/><sz val="10"/><name val="Arial"/><color rgb="FF0F6E56"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F6E56"/></fgColor></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE1F5EE"/></fgColor></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFAEEDA"/></fgColor></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color auto="1"/></left><right style="thin"><color auto="1"/></right><top style="thin"><color auto="1"/></top><bottom style="thin"><color auto="1"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="8"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0"/><xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0"><alignment horizontal="center"/></xf><xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0"><alignment horizontal="center"/></xf><xf numFmtId="2" fontId="0" fillId="0" borderId="1" xfId="0"/><xf numFmtId="2" fontId="1" fillId="4" borderId="1" xfId="0"/><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0"><alignment horizontal="right"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>`;
    const ws=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetFormatPr defaultRowHeight="16"/><cols><col min="1" max="1" width="16"/><col min="2" max="2" width="42"/><col min="3" max="3" width="11"/><col min="4" max="4" width="15"/><col min="5" max="5" width="13"/><col min="6" max="6" width="14"/></cols><sheetData>${rx}</sheetData></worksheet>`;
    const wb=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Pedido" sheetId="1" r:id="rId1"/></sheets></workbook>`;
    const ct=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
    const rels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
    const wbr=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
    const e=s=>this._s2u(s);
    return this._zip([{name:'[Content_Types].xml',data:e(ct)},{name:'_rels/.rels',data:e(rels)},{name:'xl/workbook.xml',data:e(wb)},{name:'xl/_rels/workbook.xml.rels',data:e(wbr)},{name:'xl/worksheets/sheet1.xml',data:e(ws)},{name:'xl/sharedStrings.xml',data:e(ss)},{name:'xl/styles.xml',data:e(st)}]);
  }
};

// Returns subtotal after CPV-AF volume discount (30% when >= 400 piezas mixtas)
function calcCartSub() {
  const cpvAfQty = state.cart.filter(i=>isCpvAf(i.c)).reduce((s,i)=>s+i.qty,0);
  const cpvVol = cpvAfQty >= 400;
  return state.cart.reduce((s,i)=>{
    const base = i.p * i.qty;
    return s + (isCpvAf(i.c) && cpvVol ? base * 0.70 : base);
  }, 0);
}

function buildXLSX(){
  const cli=document.getElementById('p-cli').value||'';
  const tel=document.getElementById('p-tel').value||'';
  const rif=document.getElementById('p-rif').value||'';
  const dir=document.getElementById('p-dir').value||'';
  const vend=document.getElementById('p-vend').value||state.userProfile?.nombre||'';
  const cred=document.getElementById('p-cred').value||'Contado';
  const sub=calcCartSub();
  const dAmt = state.disc===40 ? sub*0.35 + (sub*0.65)*0.05 : sub*(state.disc/100);
  const after=sub-dAmt;
  const flete=after*0.035;
  const total=after+flete;
  const dl=state.disc===35?'35% - Pago en divisa':state.disc===40?'35%+5% - Divisa+pronto pago':'Sin descuento';
  const H=v=>({v,s:2});const B=v=>({v,s:7});const N=v=>({v:typeof v==='number'?v:0,s:4});const NT=v=>({v:typeof v==='number'?v:0,s:5});
  const rows=[];
  rows.push([H('GRUPO DISTRIGAMA 20-22, C.A.')]);
  rows.push([{v:'RIF: J-50273301-9',s:7}]);
  rows.push([H('Formato de Pedido')]);
  rows.push([]);
  rows.push([B('CLIENTE:'),cli,null,B('VENDEDOR:'),vend]);
  rows.push([B('TELÉFONO:'),tel,null,B('CIUDAD:'),'CARACAS']);
  rows.push([B('DOCUMENTO:'),rif,null,B('DÍAS DE CRÉDITO:'),cred]);
  rows.push([B('DIRECCIÓN:'),dir]);
  rows.push([B('MONEDA:'),state.moneda,null,B('DESCUENTO:'),dl]);
  rows.push([B('FECHA:'),FMT_DATE]);
  rows.push([]);
  rows.push([{v:'Código',s:3},{v:'Descripción del Producto',s:3},{v:'Cantidad',s:3},{v:'Tipo Empaque',s:3},{v:'Precio Unit.',s:3},{v:'Total',s:3}]);
  for(const i of state.cart) rows.push([{v:i.c,s:1},{v:i.n,s:1},{v:i.qty,s:4},{v:i.u,s:1},N(i.p),N(parseFloat((i.p*i.qty).toFixed(3)))]);
  rows.push([]);
  rows.push([null,null,null,null,B('BASE IMPONIBLE'),NT(parseFloat(sub.toFixed(3)))]);
  if(state.disc>0) rows.push([null,null,null,null,{v:`DESCUENTO ${state.disc}%`,s:7},NT(parseFloat((-dAmt).toFixed(3)))]);
  rows.push([null,null,null,null,B('TRANSPORTE 3.5%'),NT(parseFloat(flete.toFixed(3)))]);
  rows.push([null,null,null,null,{v:'TOTAL',s:2},NT(parseFloat(total.toFixed(3)))]);
  rows.push([]);
  rows.push([{v:'Garantía: 1 año por defecto de fábrica. Nota de crédito o cambio de producto.',s:0}]);
  return rows;
}

window.savePedido = async () => {
  if(!state.cart.length){alert('El carrito está vacío');return;}
  
  const cli=document.getElementById('p-cli').value||'';
  const tel=document.getElementById('p-tel').value||'';
  const rif=document.getElementById('p-rif').value||'';
  const dir=document.getElementById('p-dir').value||'';
  const vend=document.getElementById('p-vend').value||state.userProfile?.nombre||'';
  const cred=document.getElementById('p-cred').value;
  const sub=calcCartSub();
  const dAmt = state.disc===40 ? sub*0.35 + (sub*0.65)*0.05 : sub*(state.disc/100);
  const after=sub-dAmt;
  const flete=after*0.035;
  const total=after+flete;
  
  try {
    await addDoc(collection(db,'pedidos'), {
      cliente_nombre: cli,
      cliente_telefono: tel,
      cliente_rif: rif,
      direccion: dir,
      vendedor: vend,
      vendedor_uid: state.currentUser.uid,
      vendedor_nombre: state.userProfile.nombre,
      ciudad: state.userProfile.ciudad || 'caracas',
      credito: cred,
      moneda: state.moneda,
      items: state.cart.map(i=>({codigo:i.c, nombre:i.n, cantidad:i.qty, precio:i.p, subtotal:parseFloat((i.p*i.qty).toFixed(3))})),
      subtotal: parseFloat(sub.toFixed(3)),
      descuento: state.disc,
      descuento_monto: parseFloat(dAmt.toFixed(3)),
      subtotal_descuento: parseFloat(after.toFixed(3)),
      flete: parseFloat(flete.toFixed(3)),
      total: parseFloat(total.toFixed(3)),
      fecha: FMT_DATE,
      timestamp: serverTimestamp()
    });
    
    // Auto-create client if RIF provided and not in clientes
    if (rif) {
      const rifNorm = window.normalizarRIF ? window.normalizarRIF(rif) : rif.replace(/[-\s]/g,'');
      try {
        const cSnap = await getDoc(doc(db, 'clientes', rifNorm));
        if (!cSnap.exists()) {
          await setDoc(doc(db, 'clientes', rifNorm), {
            rif_normalizado: rifNorm,
            rif_formato: window.formatearRIF ? window.formatearRIF(rifNorm) : rif,
            nombre: cli,
            tipo: '',
            contacto_nombre: '',
            contacto_telefono: tel,
            direccion: dir,
            ciudad: state.userProfile.ciudad || 'caracas',
            ruta: state.userProfile.ruta_principal || '',
            etapa: 'cliente_activo',
            vendedor_uid: state.currentUser.uid,
            vendedor_nombre: state.userProfile.nombre,
            proxima_accion: 'Completar datos de prospección',
            proxima_accion_fecha: null,
            fecha_creacion: serverTimestamp(),
            ultima_visita: serverTimestamp(),
            total_visitas: 0,
            total_pedidos: 1,
            total_cobrado_usd: 0,
            lineas: []
          });
          console.log('✅ Cliente creado desde pedido:', rifNorm);
        } else {
          // Update existing client pedido count
          await updateDoc(doc(db, 'clientes', rifNorm), {
            total_pedidos: (cSnap.data().total_pedidos || 0) + 1,
            ultima_visita: serverTimestamp()
          });
        }
      } catch(e) { console.error('Error auto-creating client:', e); }
    }
    
    console.log('✅ Pedido guardado en Firestore');
    return true;
  } catch(e) {
    console.error('❌ Error al guardar pedido: ' + e.message);
    alert('Error al guardar el pedido: ' + e.message);
    return false;
  }
};

window.dlPDF = async () => {
  if(!state.cart.length){alert('El carrito está vacío');return;}
  const saved = await window.savePedido();
  if(!saved) return;
  
  // Load jsPDF dynamically
  if (!window.jspdf) {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    document.head.appendChild(script);
    await new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = () => reject(new Error('No se pudo cargar jsPDF'));
    });
  }
  
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF('p', 'mm', 'letter');
  const W = pdf.internal.pageSize.getWidth();
  const M = 15;
  const CW = W - M*2;
  let y = M;
  
  const cli = document.getElementById('p-cli').value || '';
  const tel = document.getElementById('p-tel').value || '';
  const rif = document.getElementById('p-rif').value || '';
  const dir = document.getElementById('p-dir').value || '';
  const vend = document.getElementById('p-vend').value || state.userProfile?.nombre || '';
  const cred = document.getElementById('p-cred').value || '';
  const sub = calcCartSub();
  const dAmt = state.disc===40 ? sub*0.35 + (sub*0.65)*0.05 : sub*(state.disc/100);
  const after = sub - dAmt;
  const flete = after * 0.035;
  const total = after + flete;
  
  // HEADER
  pdf.setFillColor(15, 110, 86);
  pdf.rect(0, 0, W, 28, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text('GRUPO DISTRIGAMA 20-22, C.A.', M, 12);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text('RIF: J-50273301-9  |  Materiales ferreteros', M, 19);
  pdf.text('PEDIDO', W - M, 12, { align: 'right' });
  pdf.setFontSize(9);
  pdf.text(FMT_DATE, W - M, 19, { align: 'right' });
  y = 35;
  
  // CLIENT INFO
  pdf.setTextColor(30, 30, 30);
  pdf.setFillColor(244, 242, 236);
  pdf.roundedRect(M, y, CW, 28, 2, 2, 'F');
  pdf.setFontSize(8);
  pdf.setTextColor(107, 107, 107);
  pdf.text('CLIENTE', M+4, y+5);
  pdf.text('TELÉFONO', M + CW/2 + 4, y+5);
  pdf.text('RIF', M+4, y+17);
  pdf.text('DIRECCIÓN', M + CW/2 + 4, y+17);
  pdf.setFontSize(10);
  pdf.setTextColor(30, 30, 30);
  pdf.setFont('helvetica', 'bold');
  pdf.text(cli || '—', M+4, y+11, { maxWidth: CW/2 - 8 });
  pdf.text(tel || '—', M + CW/2 + 4, y+11);
  pdf.text(rif || '—', M+4, y+23);
  pdf.setFont('helvetica', 'normal');
  pdf.text(dir || '—', M + CW/2 + 4, y+23, { maxWidth: CW/2 - 8 });
  y += 33;
  
  // ORDER INFO
  pdf.setFontSize(8);
  pdf.setTextColor(107,107,107);
  pdf.text('VENDEDOR: ', M, y);
  pdf.setTextColor(30,30,30);
  pdf.text(vend, M+22, y);
  pdf.setTextColor(107,107,107);
  pdf.text('CRÉDITO: ', M+CW/3, y);
  pdf.setTextColor(30,30,30);
  pdf.text(cred, M+CW/3+18, y);
  pdf.setTextColor(107,107,107);
  pdf.text('MONEDA: ', M+CW*2/3, y);
  pdf.setTextColor(30,30,30);
  pdf.text(state.moneda, M+CW*2/3+17, y);
  y += 7;
  
  // TABLE HEADER
  const colX = [M+2, M+22, M+CW*0.55, M+CW*0.68, M+CW*0.80, W-M-2];
  pdf.setFillColor(15, 110, 86);
  pdf.rect(M, y, CW, 7, 'F');
  pdf.setTextColor(255,255,255);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.text('CÓDIGO', colX[0], y+5);
  pdf.text('DESCRIPCIÓN', colX[1], y+5);
  pdf.text('CANT.', colX[2], y+5);
  pdf.text('UNIDAD', colX[3], y+5);
  pdf.text('PRECIO', colX[4], y+5);
  pdf.text('TOTAL', colX[5], y+5, { align: 'right' });
  y += 9;
  
  // TABLE ROWS
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(30,30,30);
  pdf.setFontSize(8.5);
  state.cart.forEach((item, idx) => {
    if (y > 240) { pdf.addPage(); y = M; }
    if (idx % 2 === 0) {
      pdf.setFillColor(248,248,245);
      pdf.rect(M, y-3.5, CW, 6.5, 'F');
    }
    pdf.setTextColor(30,30,30);
    pdf.text(item.c, colX[0], y);
    pdf.text(item.n, colX[1], y, { maxWidth: CW*0.32 });
    pdf.text(String(item.qty), colX[2], y);
    pdf.text(item.u||'—', colX[3], y, { maxWidth: 20 });
    pdf.text('$'+item.p.toFixed(3), colX[4], y);
    pdf.text('$'+(item.p*item.qty).toFixed(3), colX[5], y, { align: 'right' });
    y += 6.5;
  });
  
  // TOTALS
  y += 2;
  pdf.setDrawColor(200,200,200);
  pdf.line(M+CW*0.6, y, W-M, y);
  y += 5;
  const tX = M+CW*0.65;
  const tV = W-M-2;
  pdf.setFontSize(9);
  pdf.setTextColor(107,107,107);
  pdf.text('Subtotal:', tX, y);
  pdf.setTextColor(30,30,30);
  pdf.text('$'+sub.toFixed(3), tV, y, {align:'right'});
  y += 5;
  if (state.disc > 0) {
    pdf.setTextColor(163,45,45);
    pdf.text('Descuento '+state.disc+'%:', tX, y);
    pdf.text('-$'+dAmt.toFixed(3), tV, y, {align:'right'});
    y += 5;
  }
  pdf.setTextColor(107,107,107);
  pdf.text('Flete 3.5%:', tX, y);
  pdf.setTextColor(30,30,30);
  pdf.text('$'+flete.toFixed(3), tV, y, {align:'right'});
  y += 7;
  
  // TOTAL BOX
  pdf.setFillColor(15,110,86);
  pdf.roundedRect(tX-3, y-4, W-M-tX+5, 10, 2, 2, 'F');
  pdf.setTextColor(255,255,255);
  pdf.setFontSize(11);
  pdf.setFont('helvetica','bold');
  pdf.text('TOTAL:', tX, y+3);
  pdf.text('$'+total.toFixed(3)+' '+state.moneda, tV, y+3, {align:'right'});
  y += 18;
  
  // FOOTER
  pdf.setFont('helvetica','normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(140,140,140);
  pdf.text('GARANTÍA: 1 año por defecto de fábrica. Nota de crédito o cambio de producto.', M, y);
  y += 4;
  pdf.text('Entrega: 5 a 9 días hábiles desde confirmación del pedido.', M, y);
  y += 4;
  pdf.text('Contacto: distrigamaventas@gmail.com  |  +58 424-6306089', M, y);
  
  // Save / Share PDF
  const filename = 'Pedido_Distrigama_'+(cli||'Cliente').replace(/\s+/g,'_')+'_'+FMT_DATE.replace(/\//g,'-')+'.pdf';
  
  // Web Share API (móvil) — comparte el archivo directamente
  if (navigator.canShare && typeof navigator.canShare === 'function') {
    try {
      const pdfBlob = pdf.output('blob');
      const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });
      if (navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          title: 'Pedido Distrigama',
          text: `Pedido de ${cli} — $${total.toFixed(3)} ${state.moneda}`,
          files: [pdfFile]
        });
        state.cart.length = 0; state.disc = 0;
        renderProds();
        return;
      }
    } catch(e) {
      if (e.name !== 'AbortError') console.warn('Share falló, descargando:', e);
    }
  }
  
  // Fallback: descarga directa
  pdf.save(filename);
  state.cart.length = 0; state.disc = 0;
  renderProds();
  alert('✅ Pedido guardado y PDF descargado');
};

function buildPedTxt(){
  const cli=document.getElementById('p-cli').value||'—';
  const tel=document.getElementById('p-tel').value||'—';
  const rif=document.getElementById('p-rif').value||'—';
  const dir=document.getElementById('p-dir').value||'—';
  const vend=document.getElementById('p-vend').value||state.userProfile?.nombre||'—';
  const cred=document.getElementById('p-cred').value;
  const sub=calcCartSub();
  const dAmt = state.disc===40 ? sub*0.35 + (sub*0.65)*0.05 : sub*(state.disc/100);
  const after=sub-dAmt;
  const flete=after*0.035;
  const total=after+flete;
  const dl=state.disc===35?'Pago en divisa −35%':state.disc===40?'Divisa+pronto pago −35%−5%':'Sin descuento';
  let t=`📦 *PEDIDO DISTRIGAMA · GRAN CARACAS*\n━━━━━━━━━━━━━━━━━━━━\n`;
  t+=`👤 *Cliente:* ${cli}\n📞 *Tel:* ${tel}  |  *RIF:* ${rif}\n📍 *Dir:* ${dir}\n`;
  t+=`🏦 *Crédito:* ${cred}  |  *Moneda:* ${state.moneda}\n👔 *Vendedor:* ${vend}\n━━━━━━━━━━━━━━━━━━━━\n`;
  state.cart.forEach(i=>{t+=`• ${i.c} — ${i.n}\n  ${i.qty} × $${i.p.toFixed(3)} = *$${(i.p*i.qty).toFixed(3)}*\n`;});
  t+=`━━━━━━━━━━━━━━━━━━━━\n💲 Subtotal: $${sub.toFixed(3)}\n`;
  if(state.disc>0) t+=`🏷️ ${dl}: −$${dAmt.toFixed(3)}\n`;
  t+=`🚚 Flete 3.5%: $${flete.toFixed(3)}\n✅ *TOTAL: $${total.toFixed(3)} ${state.moneda}*\n📅 ${FMT_DATE}`;
  return t;
}
window.copyPed=()=>{if(!state.cart.length){alert('El carrito está vacío');return;}navigator.clipboard.writeText(buildPedTxt()).then(()=>alert('✅ Copiado'));};
window.sendWA=()=>{if(!state.cart.length){alert('El carrito está vacío');return;}window.open(`https://wa.me/584246306089?text=${encodeURIComponent(buildPedTxt())}`,'_blank');};
