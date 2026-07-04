// Calculadora de Rentabilidad — lógica de cálculo
// La fórmula y los números son los del archivo original, sin modificar.
(function () {

  // ---------- Cliente por slug (?c=slug) ----------
  var params = new URLSearchParams(window.location.search);
  var slug = params.get('c');
  window.__clienteSlug = slug;

  var appEl = document.getElementById('app');
  var errorEl = document.getElementById('error-screen');
  var errorMsgEl = document.getElementById('error-message');

  function showError(msg) {
    appEl.style.display = 'none';
    errorMsgEl.textContent = msg;
    errorEl.style.display = 'block';
  }

  if (!slug) {
    showError('Este link no incluye un cliente válido. Pedile a marcosvernillo.ads que te reenvíe el link completo.');
    return;
  }

  CalcAPI.fetchCliente(slug).then(function (data) {
    if (data.error || !data.activo) {
      showError('No pudimos encontrar tu calculadora. Pedile a marcosvernillo.ads que te reenvíe el link.');
      return;
    }
    var nombreInput = document.getElementById('tienda_nombre');
    nombreInput.value = data.nombre;
    nombreInput.readOnly = true;
    appEl.style.display = 'block';
    initCalculadora();
  }).catch(function () {
    showError('No pudimos cargar tu calculadora. Revisá tu conexión y volvé a intentar.');
  });

  function initCalculadora() {
  // ---------- Tabs ----------
  const tabBtns = document.querySelectorAll('.tab-btn');
  const pages = document.querySelectorAll('.page');
  tabBtns.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      tabBtns.forEach(b=>b.classList.remove('active'));
      pages.forEach(p=>p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('page-'+btn.dataset.tab).classList.add('active');
    });
  });

  // ---------- Product rows ----------
  const defaultProducts = [
    {name:'Zapatilla', pct:50, cost:20000},
    {name:'Borcego', pct:30, cost:45000},
    {name:'Sandalia', pct:20, cost:10000},
    {name:'', pct:'', cost:''},
    {name:'', pct:'', cost:''},
  ];
  const prodRows = document.getElementById('prod-rows');
  function buildProductRows(){
    prodRows.innerHTML = '';
    defaultProducts.forEach((p,i)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="text" id="prod_name_${i}" placeholder="Producto ${i+1}" value="${p.name}"></td>
        <td><div class="input-wrap has-suffix"><input type="number" id="prod_pct_${i}" placeholder="0" value="${p.pct}"><span class="suffix">%</span></div></td>
        <td><div class="input-wrap has-prefix"><span class="prefix">$</span><input type="text" inputmode="numeric" class="input-money" id="prod_cost_${i}" placeholder="0" value="${p.cost}"></div></td>
      `;
      prodRows.appendChild(tr);
    });
    bindAllMoneyInputs();
    formatAllMoneyInputs();
  }
  buildProductRows();

  // ---------- Number parsing / formatting ----------
  function num(id){
    const el = document.getElementById(id);
    if(!el) return 0;
    let raw = el.value;
    if(el.classList.contains('input-money')) raw = raw.replace(/\./g,'');
    const v = parseFloat(raw);
    return isNaN(v) ? 0 : v;
  }

  // ---------- Money inputs ($ prefix, miles con punto) ----------
  function formatMoneyValue(raw){
    if(raw == null) return '';
    const digits = String(raw).replace(/\D/g,'');
    return digits === '' ? '' : Number(digits).toLocaleString('es-AR');
  }
  function bindMoneyInput(el){
    if(!el || el.dataset.moneyBound) return;
    el.dataset.moneyBound = '1';
    el.addEventListener('input', ()=>{ el.value = el.value.replace(/\D/g,''); });
    el.addEventListener('focus', ()=>{ el.value = el.value.replace(/\./g,''); });
    el.addEventListener('blur', ()=>{ el.value = formatMoneyValue(el.value); });
  }
  function bindAllMoneyInputs(){
    document.querySelectorAll('.input-money').forEach(bindMoneyInput);
  }
  function formatAllMoneyInputs(){
    document.querySelectorAll('.input-money').forEach(el=>{ el.value = formatMoneyValue(el.value); });
  }
  function txt(id){
    const el = document.getElementById(id);
    return el ? el.value : '';
  }
  function fmtMoney(n){
    if(!isFinite(n)) n = 0;
    return '$' + Math.round(n).toLocaleString('es-AR');
  }
  function fmtPct(n){
    if(!isFinite(n)) n = 0;
    return (n*100).toLocaleString('es-AR',{minimumFractionDigits:1,maximumFractionDigits:1}) + '%';
  }
  function fmtRoas(n){
    if(!isFinite(n)) n = 0;
    return n.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2}) + 'x';
  }
  function safeDiv(a,b){ return b === 0 ? 0 : a/b; }
  function setField(name, value){
    document.querySelectorAll(`[data-field="${name}"]`).forEach(el=>{
      if(el.tagName === 'SPAN' && el.closest('.stat-sub')){ el.textContent = value; }
      else { el.textContent = value; }
    });
  }
  function setStatus(name, status){
    document.querySelectorAll(`[data-field="${name}"]`).forEach(el=>{
      el.classList.remove('status-good','status-bad');
      if(status) el.classList.add('status-'+status);
    });
  }

  const PROMPT_TEMPLATE = `Sos un analista financiero especializado en e-commerce. Te voy a compartir los números reales de mi negocio del período. Con esa información, necesito que hagas lo siguiente:

1. DIAGNÓSTICO (máximo 4 líneas)
Leé los números. ¿El negocio está en zona de riesgo, equilibrio o ganancia real? ¿Cuál es el problema principal: margen por venta, volumen insuficiente, costos fijos altos, o eficiencia publicitaria?

2. TRES ACCIONES CONCRETAS PARA LOS PRÓXIMOS 30 DÍAS
Basadas exclusivamente en mis números. Cada acción debe incluir: qué hacer, cómo medirlo y qué impacto tendría sobre la ganancia neta o el punto de equilibrio. Sin consejos genéricos.

3. ANÁLISIS DE COSTOS
Revisá todos los costos (fijos, producto, envío, packaging, comisiones, cuotas). Para cada uno con peso relevante:
- Indicá qué % representa sobre el ticket promedio.
- Si el ROAS de equilibrio supera 5x, calculá cuánto tendría que bajar ese costo para que baje a 4x y a 3x. Mostralo como escenarios numéricos concretos.

4. SIMULACIÓN
Si aumentara el ticket promedio un 10% manteniendo el mismo volumen e inversión, ¿cómo cambiaría mi ganancia neta y punto de equilibrio? Mostrá los números antes y después.

5. UNA SOLA PRIORIDAD
Si solo pudiera hacer una cosa esta semana, ¿cuál es? Justificá con números, no con opiniones.

REGLAS: Usá solo los datos que te comparto. No inventes ni promedies con datos externos. Respuesta directa y completa. Sin introducción ni cierre de cortesía.`;

  function recalc(){
    // Products
    let sumPct = 0, sumWeighted = 0;
    for(let i=0;i<5;i++){
      const pct = num('prod_pct_'+i);
      const cost = num('prod_cost_'+i);
      sumPct += pct;
      sumWeighted += pct * cost;
    }
    const weightedCost = safeDiv(sumWeighted, sumPct);
    setField('prodSumPct', fmtPct(sumPct/100));
    setField('prodWeightedCost', fmtMoney(weightedCost));
    const warn = document.getElementById('prod-warn');
    warn.classList.toggle('show', sumPct !== 0 && Math.round(sumPct) !== 100);

    // Fixed costs
    const fxTotal = num('fx_alquiler')+num('fx_servicios')+num('fx_sueldos')+num('fx_honorarios')+num('fx_software')+num('fx_logistica')+num('fx_prolabore')+num('fx_otros');
    setField('fxTotal', fmtMoney(fxTotal));

    // Price & per-sale costs
    const ticket = num('pv_ticket');
    const costoProducto = weightedCost;
    const envio = num('pv_envio');
    const packaging = num('pv_packaging');
    const otrosVar = num('pv_otros');
    const comPlataforma = num('com_plataforma');
    const comMP = num('com_mp');
    const finCuotas = num('fin_cuotas');
    const comisionesFin = ticket * ((comPlataforma+comMP+finCuotas)/100);
    setField('pvCostoProducto', fmtMoney(costoProducto));
    setField('pvComisionesFin', fmtMoney(comisionesFin));

    const costoTotalVenta = costoProducto+envio+packaging+otrosVar+comisionesFin;
    const quedaPorVenta = ticket - costoTotalVenta;
    const pctQuedaVenta = safeDiv(quedaPorVenta, ticket);
    setField('costoTotalVenta', fmtMoney(costoTotalVenta));
    setField('quedaPorVenta', fmtMoney(quedaPorVenta));
    setField('pctQuedaVenta', fmtPct(pctQuedaVenta));

    const margenObjetivo = num('margen_objetivo');

    // Campaign data
    const adSpend = num('camp_inversion');
    const facturacionCamp = num('camp_facturacion');
    const ventasCamp = num('camp_ventas');

    // ROAS clave
    const roasMinimo = safeDiv(safeDiv(fxTotal+adSpend, pctQuedaVenta), adSpend);
    const roasObjetivo = safeDiv(safeDiv(fxTotal+adSpend, pctQuedaVenta - margenObjetivo/100), adSpend);
    const costoCompraMax = quedaPorVenta;
    setField('roasMinimo', fmtRoas(roasMinimo));
    setField('roasObjetivo', fmtRoas(roasObjetivo));
    setField('costoCompraMax', fmtMoney(costoCompraMax));

    // Punto de equilibrio
    const facturacionBreakeven = safeDiv(fxTotal+adSpend, pctQuedaVenta);
    const ventasBreakeven = ticket === 0 ? 0 : Math.ceil(safeDiv(facturacionBreakeven, ticket));
    const facturacionObjetivo = safeDiv(fxTotal+adSpend, pctQuedaVenta - margenObjetivo/100);
    const ventasObjetivo = ticket === 0 ? 0 : Math.ceil(safeDiv(facturacionObjetivo, ticket));

    // Real results
    const roasReal = safeDiv(facturacionCamp, adSpend);
    const costoCompraReal = safeDiv(adSpend, ventasCamp);
    setField('costoCompraReal', fmtMoney(costoCompraReal));

    if(costoCompraReal > 0 && costoCompraMax > 0){
      const deltaPct = safeDiv(costoCompraMax - costoCompraReal, costoCompraMax);
      if(costoCompraReal <= costoCompraMax){
        setField('costoCompraRealSub', `✅ ${fmtPct(Math.abs(deltaPct))} por debajo del máximo`);
        setStatus('costoCompraReal', 'good');
      } else {
        setField('costoCompraRealSub', `🔴 ${fmtPct(Math.abs(deltaPct))} por encima del máximo`);
        setStatus('costoCompraReal', 'bad');
      }
    } else {
      setField('costoCompraRealSub', 'vs. máximo');
      setStatus('costoCompraReal', null);
    }

    const quedoDeVentas = facturacionCamp - costoTotalVenta*ventasCamp;
    const gananciaNeta = quedoDeVentas - adSpend - fxTotal;
    const rentabilidad = safeDiv(gananciaNeta, facturacionCamp);
    setField('gananciaNeta', fmtMoney(gananciaNeta));
    setField('rentabilidadPct', fmtPct(rentabilidad) + ' sobre facturación');
    setStatus('gananciaNeta', gananciaNeta >= 0 ? 'good' : 'bad');

    // Diagnóstico de margen (live banner, calculadora + resumen)
    let diagMsg, diagClass;
    if(rentabilidad > margenObjetivo/100){
      diagMsg = `✅ Vas bien: tu margen real (${fmtPct(rentabilidad)}) supera tu objetivo (${fmtPct(margenObjetivo/100)}).`;
      diagClass = 'ok';
    } else if(rentabilidad > 0){
      diagMsg = `⚠️ Cuidado: tu margen real (${fmtPct(rentabilidad)}) no llega a tu objetivo (${fmtPct(margenObjetivo/100)}).`;
      diagClass = 'warn';
    } else if(rentabilidad === 0){
      diagMsg = `⚠️ Estás en el límite: no perdés pero tampoco ganás.`;
      diagClass = 'warn';
    } else {
      diagMsg = `🔴 Alerta: tu margen es negativo (${fmtPct(rentabilidad)}), revisá costos.`;
      diagClass = 'bad';
    }
    document.querySelectorAll('[data-field="diagBanner"]').forEach(el=>{
      el.textContent = diagMsg;
      el.className = 'diag-banner ' + diagClass;
    });

    // Diagnóstico final (ganancia neta)
    const diagFinalMsg = gananciaNeta > 0
      ? '✅ Muy bien, tu negocio está generando ganancias.'
      : '🔴 Atención: el negocio está operando a pérdida este período.';
    const diagFinalClass = gananciaNeta > 0 ? 'ok' : 'bad';
    document.querySelectorAll('[data-field="diagFinal"]').forEach(el=>{
      el.textContent = diagFinalMsg;
      el.className = 'diag-banner ' + diagFinalClass;
    });

    // Resumen detail table
    setField('periodoLabel', txt('tienda_periodo') || '[completá el período en la Calculadora]');
    setField('detVentas', ventasCamp.toLocaleString('es-AR'));
    setField('detFacturacion', fmtMoney(facturacionCamp));
    setField('detInversion', fmtMoney(adSpend));
    setField('detQuedo', fmtMoney(quedoDeVentas));
    setField('detFijos', fmtMoney(fxTotal));
    setField('detRentabilidad', fmtPct(rentabilidad));

    // Accionable prompt with live data snapshot
    const datosBlock = `DATOS DE MI NEGOCIO (período: ${txt('tienda_periodo')||'-'}):
- Marca / rubro: ${txt('tienda_nombre')||'-'} / ${txt('tienda_rubro')||'-'}
- Ticket promedio: ${fmtMoney(ticket)}
- Costo total por venta: ${fmtMoney(costoTotalVenta)}
- Costos fijos mensuales: ${fmtMoney(fxTotal)}
- Margen objetivo: ${margenObjetivo}%
- ROAS mínimo: ${fmtRoas(roasMinimo)} | ROAS objetivo: ${fmtRoas(roasObjetivo)} | ROAS real: ${fmtRoas(roasReal)}
- Costo por compra máximo: ${fmtMoney(costoCompraMax)} | Costo por compra real: ${fmtMoney(costoCompraReal)}
- Inversión en publicidad: ${fmtMoney(adSpend)} | Facturación de esa inversión: ${fmtMoney(facturacionCamp)} | Ventas: ${ventasCamp}
- Ganancia neta del período: ${fmtMoney(gananciaNeta)} (${fmtPct(rentabilidad)} sobre facturación)
- Punto de equilibrio: facturar ${fmtMoney(facturacionBreakeven)} (${ventasBreakeven} ventas) | Para margen objetivo: ${fmtMoney(facturacionObjetivo)} (${ventasObjetivo} ventas)

`;
    const fullPrompt = datosBlock + PROMPT_TEMPLATE;
    document.getElementById('prompt-text').textContent = fullPrompt;
    window.__fullPrompt = fullPrompt;

    // Snapshot para "Finalizar" (se envía al Sheet y se usa en el reporte descargable)
    window.__snapshot = {
      version: 1,
      timestamp: new Date().toISOString(),
      cliente: txt('tienda_nombre') || 'Sin nombre',
      rubro: txt('tienda_rubro'),
      plataforma: txt('tienda_plataforma'),
      periodo: txt('tienda_periodo'),
      fxTotal, ticket, costoProducto, costoTotalVenta, pctQuedaVenta, margenObjetivo,
      adSpend, facturacionCamp, ventasCamp,
      roasMinimo, roasObjetivo, roasReal, costoCompraReal, costoCompraMax,
      gananciaNeta, rentabilidad,
      diagMsg, diagFinalMsg
    };
  }

  document.addEventListener('input', recalc);
  document.addEventListener('change', recalc);

  // Reset / clear
  document.getElementById('btn-reset').addEventListener('click', ()=>{
    buildProductRows();
    const defaults = {
      fx_alquiler:500000, fx_servicios:100000, fx_sueldos:1200000, fx_honorarios:250000,
      fx_software:50000, fx_logistica:300000, fx_prolabore:500000, fx_otros:100000,
      pv_ticket:80000, pv_envio:3000, pv_packaging:500, pv_otros:0,
      com_plataforma:2, com_mp:6, fin_cuotas:10, margen_objetivo:20,
      camp_inversion:2000000, camp_facturacion:20000000, camp_ventas:250
    };
    Object.keys(defaults).forEach(id=>{ document.getElementById(id).value = defaults[id]; });
    document.getElementById('tienda_rubro').value = 'Calzado';
    document.getElementById('tienda_plataforma').value = 'Tienda Nube';
    document.getElementById('tienda_periodo').value = 'Mayo';
    formatAllMoneyInputs();
    recalc();
  });
  document.getElementById('btn-clear').addEventListener('click', ()=>{
    document.querySelectorAll('#page-calculadora input:not(#tienda_nombre)').forEach(el=>{ el.value = ''; });
    recalc();
  });

  // Copy prompt
  document.getElementById('btn-copy').addEventListener('click', ()=>{
    const text = window.__fullPrompt || '';
    const feedback = document.getElementById('copy-feedback');
    function showFeedback(){
      feedback.classList.add('show');
      setTimeout(()=>feedback.classList.remove('show'), 2000);
    }
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(showFeedback).catch(()=>{
        fallbackCopy(text); showFeedback();
      });
    } else {
      fallbackCopy(text); showFeedback();
    }
  });
  function fallbackCopy(text){
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try{ document.execCommand('copy'); }catch(e){}
    document.body.removeChild(ta);
  }

  function utf8ToB64(str){ return btoa(unescape(encodeURIComponent(str))); }

  function diagStatusClass(msg){
    if(!msg) return 'warn';
    if(msg.includes('✅')) return 'ok';
    if(msg.includes('🔴')) return 'bad';
    return 'warn';
  }

  function buildReportHtml(data){
    const gananciaClass = data.gananciaNeta >= 0 ? 'good' : 'bad';
    const costoClass = data.costoCompraReal <= data.costoCompraMax ? 'good' : 'bad';
    const diagClass = diagStatusClass(data.diagFinalMsg || data.diagMsg);
    const dataB64 = utf8ToB64(JSON.stringify(data));
    return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>Reporte de Rentabilidad — ${escapeHtmlLocal(data.cliente)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  :root{--navy:#0a1628;--navy-mid:#0d1f3c;--navy-light:#112244;--accent:#2d6fff;--cyan:#38bdf8;--white:#ffffff;--white-70:rgba(255,255,255,0.7);--white-50:rgba(255,255,255,0.5);--success:#34d399;--danger:#f87171;--bg:#06101e;}
  *{box-sizing:border-box;} body{margin:0;background:var(--bg);color:var(--white-70);font-family:'Montserrat',sans-serif;padding:32px 20px;}
  .wrap{max-width:640px;margin:0 auto;}
  .brand{font-weight:700;color:var(--white);font-size:13px;margin-bottom:6px;}
  h1{color:var(--white);font-size:24px;margin:0 0 4px;}
  .meta{color:var(--white-50);font-size:13px;margin-bottom:22px;}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px;}
  .card{background:linear-gradient(160deg,var(--navy-light),var(--navy-mid));border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:16px 18px;}
  .card .lbl{font-size:10.5px;text-transform:uppercase;letter-spacing:0.04em;color:var(--white-50);font-weight:700;}
  .card .val{font-size:22px;font-weight:800;color:var(--white);margin-top:6px;}
  .card .val.good{color:var(--success);} .card .val.bad{color:var(--danger);}
  .diag{padding:14px 16px;border-radius:10px;font-size:14px;font-weight:600;margin-bottom:18px;}
  .diag.ok{background:rgba(52,211,153,0.12);color:var(--success);} .diag.warn{background:rgba(251,191,36,0.12);color:#fbbf24;} .diag.bad{background:rgba(248,113,113,0.12);color:var(--danger);}
  table{width:100%;border-collapse:collapse;font-size:14px;margin-bottom:10px;}
  td{padding:9px 4px;border-bottom:1px solid rgba(255,255,255,0.08);}
  td:last-child{text-align:right;font-weight:700;color:var(--white);}
  .foot{color:var(--white-50);font-size:11.5px;margin-top:24px;text-align:center;}
  @media print{ body{background:#fff;color:#111;} .card,.diag{-webkit-print-color-adjust:exact;print-color-adjust:exact;} }
</style></head>
<body><div class="wrap">
  <div class="brand">marcosvernillo.ads</div>
  <h1>Reporte de Rentabilidad — ${escapeHtmlLocal(data.cliente)}</h1>
  <div class="meta">${escapeHtmlLocal(data.rubro||'-')} · Período: ${escapeHtmlLocal(data.periodo||'-')} · ${new Date(data.timestamp).toLocaleDateString('es-AR')}</div>
  <div class="grid">
    <div class="card"><div class="lbl">Ganancia neta</div><div class="val ${gananciaClass}">${fmtMoney(data.gananciaNeta)}</div></div>
    <div class="card"><div class="lbl">ROAS mínimo</div><div class="val">${fmtRoas(data.roasMinimo)}</div></div>
    <div class="card"><div class="lbl">ROAS objetivo</div><div class="val" style="color:var(--cyan);">${fmtRoas(data.roasObjetivo)}</div></div>
    <div class="card"><div class="lbl">Costo por compra real</div><div class="val ${costoClass}">${fmtMoney(data.costoCompraReal)}</div></div>
    <div class="card"><div class="lbl">Costo por compra máximo</div><div class="val">${fmtMoney(data.costoCompraMax)}</div></div>
    <div class="card"><div class="lbl">Rentabilidad</div><div class="val">${fmtPct(data.rentabilidad)}</div></div>
  </div>
  <div class="diag ${diagClass}">${escapeHtmlLocal(data.diagFinalMsg || data.diagMsg || '')}</div>
  <table>
    <tr><td>Ticket promedio</td><td>${fmtMoney(data.ticket)}</td></tr>
    <tr><td>Costos fijos mensuales</td><td>${fmtMoney(data.fxTotal)}</td></tr>
    <tr><td>Inversión en publicidad</td><td>${fmtMoney(data.adSpend)}</td></tr>
    <tr><td>Facturación de esa inversión</td><td>${fmtMoney(data.facturacionCamp)}</td></tr>
    <tr><td>Ventas</td><td>${data.ventasCamp}</td></tr>
    <tr><td>ROAS real</td><td>${fmtRoas(data.roasReal)}</td></tr>
  </table>
  <div class="foot">Generado con la Calculadora de Rentabilidad de marcosvernillo.ads. Podés imprimir esta página o guardarla como PDF (Ctrl/Cmd+P).</div>
</div>
<script type="application/json" id="rentabilidad-data">${dataB64}<\/script>
</body></html>`;
  }

  function escapeHtmlLocal(str){
    return String(str==null?'':str).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  // Finalizar: descarga el reporte prolijo para el cliente y manda el
  // resultado al Google Sheet automáticamente (reemplaza el reenvío manual por mail).
  document.getElementById('btn-finalizar').addEventListener('click', ()=>{
    const data = window.__snapshot || {};
    const slugCliente = (data.cliente||'cliente').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
    const periodoSlug = (data.periodo||'periodo').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');

    // 1) Descargar reporte legible para el cliente
    const reportHtml = buildReportHtml(data);
    const blob = new Blob([reportHtml], {type:'text/html'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rentabilidad-${slugCliente}-${periodoSlug}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // 2) Enviar automáticamente al Google Sheet
    const feedback = document.getElementById('finalizar-feedback');
    CalcAPI.postRespuesta(window.__clienteSlug, data)
      .then(res=>{
        if(res && res.error){
          feedback.textContent = '✅ Se descargó tu reporte. ⚠️ No se pudo registrar automáticamente, avisale a marcosvernillo.ads.';
        } else {
          feedback.textContent = '✅ Se descargó tu reporte y tus resultados quedaron registrados.';
        }
        feedback.classList.add('show');
        setTimeout(()=>feedback.classList.remove('show'), 6000);
      })
      .catch(()=>{
        feedback.textContent = '✅ Se descargó tu reporte. ⚠️ No se pudo registrar automáticamente, avisale a marcosvernillo.ads.';
        feedback.classList.add('show');
        setTimeout(()=>feedback.classList.remove('show'), 6000);
      });
  });

  recalc();
  } // fin initCalculadora
})();
