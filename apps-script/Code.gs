/**
 * Calculadora de Rentabilidad — backend de datos (Google Apps Script)
 *
 * Sheet con dos pestañas:
 *   Clientes:   slug | nombre | fecha_alta | activo
 *   Respuestas: timestamp | slug | periodo | rubro | plataforma | ticket | costoProducto |
 *               costoTotalVenta | fxTotal | margenObjetivo | adSpend | facturacionCamp |
 *               ventasCamp | roasMinimo | roasObjetivo | roasReal | costoCompraReal |
 *               costoCompraMax | gananciaNeta | rentabilidad | diagMsg | diagFinalMsg
 *
 * Proyecto standalone (script.google.com), conectado al Sheet por SHEET_ID
 * en vez de estar atado como script del propio Sheet.
 *
 * La contraseña del panel admin vive en Script Properties (Project Settings ->
 * Script properties -> ADMIN_PASSWORD), nunca hardcodeada en este archivo.
 *
 * Deploy: Deploy > New deployment > Web app
 *   - Execute as: Me
 *   - Who has access: Anyone
 */

var SHEET_ID = '1iRq8jwB8aGg3pxEqlH_dZpmSLH9-37u1wjhnzko5rbw';
var CLIENTES_SHEET = 'Clientes';
var RESPUESTAS_SHEET = 'Respuestas';

function getSpreadsheet_() {
  return SpreadsheetApp.openById(SHEET_ID);
}

function getPassword_() {
  return PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var action = e.parameter.action;

  if (action === 'cliente') {
    return jsonResponse_(getClientePublico_(e.parameter.slug));
  }

  if (action === 'admin') {
    if (!e.parameter.pass || e.parameter.pass !== getPassword_()) {
      return jsonResponse_({ error: 'unauthorized' });
    }
    return jsonResponse_(getAdminData_());
  }

  return jsonResponse_({ error: 'accion invalida' });
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse_({ error: 'body invalido' });
  }

  if (body.action === 'respuesta') {
    return jsonResponse_(addRespuesta_(body));
  }

  if (body.action === 'nuevo_cliente') {
    if (!body.pass || body.pass !== getPassword_()) {
      return jsonResponse_({ error: 'unauthorized' });
    }
    return jsonResponse_(addCliente_(body.nombre));
  }

  return jsonResponse_({ error: 'accion invalida' });
}

// ---------- Lectura ----------

function getClientePublico_(slug) {
  if (!slug) return { error: 'slug requerido' };
  var sheet = getSpreadsheet_().getSheetByName(CLIENTES_SHEET);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === slug) {
      return { nombre: data[i][1], activo: data[i][3] === true };
    }
  }
  return { error: 'cliente no encontrado' };
}

function getAdminData_() {
  var ss = getSpreadsheet_();
  return {
    clientes: sheetToObjects_(ss.getSheetByName(CLIENTES_SHEET)),
    respuestas: sheetToObjects_(ss.getSheetByName(RESPUESTAS_SHEET))
  };
}

function sheetToObjects_(sheet) {
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      var val = data[i][c];
      if (val instanceof Date) val = val.toISOString();
      obj[headers[c]] = val;
    }
    rows.push(obj);
  }
  return rows;
}

// ---------- Escritura ----------

function addRespuesta_(body) {
  var slug = body.slug;
  if (!slug) return { error: 'slug requerido' };

  var clientesSheet = getSpreadsheet_().getSheetByName(CLIENTES_SHEET);
  var clientesData = clientesSheet.getDataRange().getValues();
  var encontrado = false, activo = false;
  for (var i = 1; i < clientesData.length; i++) {
    if (clientesData[i][0] === slug) {
      encontrado = true;
      activo = clientesData[i][3] === true;
      break;
    }
  }
  if (!encontrado) return { error: 'cliente no existe' };
  if (!activo) return { error: 'cliente inactivo' };

  var sheet = getSpreadsheet_().getSheetByName(RESPUESTAS_SHEET);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = headers.map(function (h) {
    if (h === 'timestamp') return new Date();
    if (h === 'slug') return slug;
    return body[h] !== undefined ? body[h] : '';
  });
  sheet.appendRow(row);
  return { ok: true };
}

function addCliente_(nombre) {
  if (!nombre || !nombre.toString().trim()) return { error: 'nombre requerido' };

  var sheet = getSpreadsheet_().getSheetByName(CLIENTES_SHEET);
  var data = sheet.getDataRange().getValues();
  var existentes = [];
  for (var i = 1; i < data.length; i++) existentes.push(data[i][0]);

  var base = slugify_(nombre);
  var slug = base;
  var n = 2;
  while (existentes.indexOf(slug) !== -1) {
    slug = base + '-' + n;
    n++;
  }

  sheet.appendRow([slug, nombre, new Date(), true]);
  return { ok: true, slug: slug };
}

function slugify_(str) {
  return str
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
