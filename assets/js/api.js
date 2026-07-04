// Calculadora de Rentabilidad — capa de datos (Apps Script Web App)
// Único lugar del proyecto que sabe cómo hablar con el backend.
window.CalcAPI = (function () {
  var BASE_URL = window.APPS_SCRIPT_URL;

  function getJson(url) {
    return fetch(url).then(function (res) { return res.json(); });
  }

  // Apps Script no maneja bien el preflight CORS de POST con
  // Content-Type: application/json. Se manda como text/plain (simple
  // request, sin preflight) y se parsea el JSON del lado del servidor.
  function postJson(body) {
    return fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    }).then(function (res) { return res.json(); });
  }

  function fetchCliente(slug) {
    var url = BASE_URL + '?action=cliente&slug=' + encodeURIComponent(slug);
    return getJson(url);
  }

  function fetchAdmin(pass) {
    var url = BASE_URL + '?action=admin&pass=' + encodeURIComponent(pass);
    return getJson(url);
  }

  function postRespuesta(slug, snapshot) {
    var body = Object.assign({ action: 'respuesta', slug: slug }, snapshot);
    return postJson(body);
  }

  function postNuevoCliente(pass, nombre) {
    return postJson({ action: 'nuevo_cliente', pass: pass, nombre: nombre });
  }

  return {
    fetchCliente: fetchCliente,
    fetchAdmin: fetchAdmin,
    postRespuesta: postRespuesta,
    postNuevoCliente: postNuevoCliente
  };
})();
