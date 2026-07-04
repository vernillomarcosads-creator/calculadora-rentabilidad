// Panel admin — junta datos de todos los clientes vía Apps Script.
// El gate de contraseña acá es solo fricción de UX: la protección real
// de los datos está en el servidor (Apps Script exige la misma
// contraseña en ?action=admin, ver apps-script/Code.gs).
(function () {
  var STORAGE_KEY = 'calc_admin_pass';

  var lockScreen = document.getElementById('lock-screen');
  var lockError = document.getElementById('lock-error');
  var passInput = document.getElementById('pass-input');
  var btnEntrar = document.getElementById('btn-entrar');
  var dashboardView = document.getElementById('dashboard-view');
  var detailView = document.getElementById('detail-view');
  var clientGrid = document.getElementById('client-grid');
  var backLink = document.getElementById('back-link');
  var detailTitle = document.getElementById('detail-title');
  var historyBody = document.getElementById('history-body');
  var btnNuevoCliente = document.getElementById('btn-nuevo-cliente');
  var nuevoClienteForm = document.getElementById('nuevo-cliente-form');
  var nuevoClienteNombre = document.getElementById('nuevo-cliente-nombre');
  var nuevoClienteConfirmar = document.getElementById('nuevo-cliente-confirmar');
  var nuevoClienteResult = document.getElementById('nuevo-cliente-result');
  var linkBox = document.getElementById('link-box');

  var state = { pass: null, clientes: [], respuestas: [] };

  function fmtMoney(n) {
    n = Number(n) || 0;
    return '$' + Math.round(n).toLocaleString('es-AR');
  }
  function fmtPct(n) {
    n = Number(n) || 0;
    return (n * 100).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
  }
  function fmtRoas(n) {
    n = Number(n) || 0;
    return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'x';
  }
  function fmtFecha(iso) {
    if (!iso) return '-';
    var d = new Date(iso);
    return d.toLocaleDateString('es-AR') + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }
  function diagIcon(msg) {
    if (!msg) return '⚪';
    if (msg.indexOf('✅') !== -1) return '✅';
    if (msg.indexOf('🔴') !== -1) return '🔴';
    return '⚠️';
  }

  function respuestasDe(slug) {
    return state.respuestas
      .filter(function (r) { return r.slug === slug; })
      .sort(function (a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });
  }

  function login(pass, silent) {
    return CalcAPI.fetchAdmin(pass).then(function (data) {
      if (data.error) {
        if (!silent) {
          lockError.textContent = 'Contraseña incorrecta.';
          lockError.style.display = 'block';
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
        return false;
      }
      state.pass = pass;
      state.clientes = data.clientes || [];
      state.respuestas = data.respuestas || [];
      localStorage.setItem(STORAGE_KEY, pass);
      lockScreen.style.display = 'none';
      dashboardView.style.display = 'block';
      renderDashboard();
      return true;
    }).catch(function () {
      if (!silent) {
        lockError.textContent = 'No se pudo conectar. Probá de nuevo.';
        lockError.style.display = 'block';
      }
      return false;
    });
  }

  btnEntrar.addEventListener('click', function () {
    lockError.style.display = 'none';
    var pass = passInput.value;
    if (!pass) return;
    login(pass, false);
  });
  passInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') btnEntrar.click();
  });

  function renderDashboard() {
    clientGrid.innerHTML = '';
    if (!state.clientes.length) {
      clientGrid.innerHTML = '<div class="empty-state">Todavía no cargaste ningún cliente. Usá "+ Nuevo cliente" para empezar.</div>';
      return;
    }
    state.clientes.forEach(function (cliente) {
      var historial = respuestasDe(cliente.slug);
      var card = document.createElement('div');
      card.className = 'client-card';

      if (!historial.length) {
        card.innerHTML =
          '<h3>' + escapeHtml(cliente.nombre) + '</h3>' +
          '<div class="fecha">Sin cargas todavía</div>';
      } else {
        var ultima = historial[0];
        var anterior = historial[1];
        var trendHtml = '';
        if (anterior) {
          var delta = (ultima.rentabilidad || 0) - (anterior.rentabilidad || 0);
          var cls = delta > 0.0005 ? 'up' : (delta < -0.0005 ? 'down' : 'flat');
          var arrow = delta > 0.0005 ? '▲' : (delta < -0.0005 ? '▼' : '–');
          trendHtml = '<span class="trend ' + cls + '">' + arrow + '</span>';
        }
        card.innerHTML =
          '<h3>' + escapeHtml(cliente.nombre) + '</h3>' +
          '<div class="metric-row"><span class="lbl">Margen</span><span class="val">' + fmtPct(ultima.rentabilidad) + trendHtml + '</span></div>' +
          '<div class="metric-row"><span class="lbl">ROAS real</span><span class="val">' + fmtRoas(ultima.roasReal) + '</span></div>' +
          '<div class="metric-row"><span class="lbl">Diagnóstico</span><span class="val">' + diagIcon(ultima.diagFinalMsg || ultima.diagMsg) + '</span></div>' +
          '<div class="fecha">Última carga: ' + fmtFecha(ultima.timestamp) + '</div>';
      }
      card.addEventListener('click', function () { openDetail(cliente); });
      clientGrid.appendChild(card);
    });
  }

  function openDetail(cliente) {
    dashboardView.style.display = 'none';
    detailView.style.display = 'block';
    detailTitle.textContent = cliente.nombre;
    var historial = respuestasDe(cliente.slug);
    historyBody.innerHTML = '';

    var header = document.createElement('div');
    header.className = 'history-row';
    header.innerHTML = '<div>Período</div><div>Fecha</div><div>Margen</div><div>ROAS real</div><div>Ganancia neta</div>';
    historyBody.appendChild(header);

    if (!historial.length) {
      var empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'Este cliente todavía no cargó ningún período.';
      historyBody.appendChild(empty);
    } else {
      historial.forEach(function (r) {
        var row = document.createElement('div');
        row.className = 'history-row';
        row.innerHTML =
          '<div>' + escapeHtml(r.periodo || '-') + '</div>' +
          '<div>' + fmtFecha(r.timestamp) + '</div>' +
          '<div>' + fmtPct(r.rentabilidad) + '</div>' +
          '<div>' + fmtRoas(r.roasReal) + '</div>' +
          '<div>' + fmtMoney(r.gananciaNeta) + '</div>';
        historyBody.appendChild(row);
      });
    }
  }

  backLink.addEventListener('click', function () {
    detailView.style.display = 'none';
    dashboardView.style.display = 'block';
  });

  btnNuevoCliente.addEventListener('click', function () {
    nuevoClienteForm.style.display = nuevoClienteForm.style.display === 'none' ? 'block' : 'none';
    nuevoClienteResult.style.display = 'none';
    nuevoClienteNombre.value = '';
  });

  nuevoClienteConfirmar.addEventListener('click', function () {
    var nombre = nuevoClienteNombre.value.trim();
    if (!nombre) return;
    nuevoClienteConfirmar.disabled = true;
    CalcAPI.postNuevoCliente(state.pass, nombre).then(function (res) {
      nuevoClienteConfirmar.disabled = false;
      if (res.error) {
        alert('No se pudo crear el cliente: ' + res.error);
        return;
      }
      var base = window.location.href.replace(/admin\.html.*$/, 'index.html');
      var link = base + '?c=' + res.slug;
      linkBox.textContent = link;
      nuevoClienteResult.style.display = 'block';
      nuevoClienteForm.style.display = 'none';
      // refrescar datos para que el nuevo cliente aparezca en el dashboard
      login(state.pass, true).then(function(){ renderDashboard(); });
    }).catch(function () {
      nuevoClienteConfirmar.disabled = false;
      alert('No se pudo conectar con el servidor.');
    });
  });

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }

  // Recordar sesión en este dispositivo (Mac/iPhone) sin volver a tipear la clave
  var saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    login(saved, true);
  }
})();
