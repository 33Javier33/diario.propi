// ==============================================================================
// SCRIPT RECAUDACIONES
// Casino de Puerto Varas — Fondo Solidario
// ==============================================================================

// ── SUPABASE (recaudaciones) — los datos se leen de aquí, no de Sheets ─────────
const SB_REC_URL = 'https://lpulmjzboogixbdxxayo.supabase.co';
const SB_REC_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwdWxtanpib29naXhiZHh4YXlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NjY0NzMsImV4cCI6MjA5MTI0MjQ3M30.vjebyQb4Bb62ZQlNaJZveuxdBYDOmtC4bM7uwAilDzY';

// GET a la API REST de Supabase (recaudaciones). Devuelve array (o [] si falla).
function sbRecGet(path) {
  try {
    const res = UrlFetchApp.fetch(SB_REC_URL + '/rest/v1/' + path, {
      method: 'get',
      headers: { apikey: SB_REC_KEY, Authorization: 'Bearer ' + SB_REC_KEY },
      muteHttpExceptions: true
    });
    const j = JSON.parse(res.getContentText());
    return Array.isArray(j) ? j : [];
  } catch (e) { Logger.log('sbRecGet error: ' + e); return []; }
}
// ==============================================================================
// CONFIGURACIÓN DE NOMBRES DE HOJAS
// ==============================================================================
const DATA_SHEET_NAME      = "Datos";
const SALDO_SHEET_NAME     = "Saldo";
const NOTES_SHEET_NAME     = "Notas";
const DIVISORES_SHEET_NAME = "Divisores";

// ==============================================================================
// MANEJADORES PRINCIPALES
// ==============================================================================
function doGet(e) {
  const action = e.parameter.action;
  if (!action || action === 'getTotal') {
    return getTotalDataForArqueo();
  }
  switch (action) {
    case 'get':          return getRecordsWithDivisors();
    case 'getSaldo':     return getSaldo();
    case 'getNotes':     return getNotes();
    case 'getDivisores': return getDivisores();
    default:             return createErrorResponse("Acción GET no válida: " + action);
  }
}

function doPost(e) {
  let payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (error) {
    return createErrorResponse("Datos POST no válidos. Se esperaba un JSON.");
  }
  const action = payload.action;
  if (!action) {
    return createErrorResponse("No se especificó una acción en el cuerpo del POST.");
  }
  switch (action) {
    case 'add':           return addRecord(payload);
    case 'update':        return updateRecord(payload);
    case 'delete':        return deleteRecord(payload);
    case 'updateSaldo':   return updateSaldo(payload);
    case 'addNote':       return addNote(payload);
    case 'deleteNote':    return deleteNote(payload);
    case 'updateDivisor': return updateDivisor(payload);
    case 'clearAll':      return clearAllData();
    case 'importAll':     return importAll(payload);
    case 'closePeriod':   return closePeriod();
    default:              return createErrorResponse("Acción POST no válida: " + action);
  }
}

// ==============================================================================
// FUNCIÓN CENTRAL: CÁLCULO Y EXTRACCIÓN DE DATOS PARA ARQUEO (JSON)
// ==============================================================================
function getTotalDataForArqueo() {
  try {
    const recs = sbRecGet('recaudaciones?select=fecha,tipo,monto');
    const divs = sbRecGet('divisores?select=fecha,valor');

    let totalAcumulado = 0;
    const desgloseMap  = {};
    recs.forEach(function(r) {
      const monto = Number(r.monto) || 0;
      const tipo  = r.tipo ? String(r.tipo).trim() : 'Sin Tipo';
      totalAcumulado += monto;
      if (tipo !== 'Sin Tipo') desgloseMap[tipo] = (desgloseMap[tipo] || 0) + monto;
    });

    // Divisor más reciente por fecha (ISO yyyy-mm-dd → orden lexicográfico sirve)
    let lastDivisorValue = 1.0, lastDivisorISO = null, lastDivisorDateString = 'N/A';
    divs.forEach(function(d) {
      if (!d.fecha) return;
      if (!lastDivisorISO || d.fecha > lastDivisorISO) {
        lastDivisorISO = d.fecha;
        lastDivisorValue = Number(d.valor) || 1.0;
      }
    });
    if (lastDivisorISO) {
      const p = String(lastDivisorISO).split('-'); // yyyy-mm-dd
      lastDivisorDateString = p[2] + '-' + p[1] + '-' + p[0]; // dd-mm-yyyy
    }

    let totalLastDivisorDay = 0;
    if (lastDivisorISO) {
      recs.forEach(function(r) { if (r.fecha === lastDivisorISO) totalLastDivisorDay += Number(r.monto) || 0; });
    }

    const desgloseEsperadoArray = Object.keys(desgloseMap).map(function(tipo) {
      return { tipo: tipo, monto: Math.round(desgloseMap[tipo]) * 100 };
    });

    const dataToSend = {
      totalAcumulado:      Math.round(totalAcumulado) * 100,
      lastDivisor:         lastDivisorValue,
      totalLastDivisorDay: Math.round(totalLastDivisorDay) * 100,
      lastDivisorDate:     lastDivisorDateString,
      desgloseEsperado:    desgloseEsperadoArray
    };
    return ContentService.createTextOutput(JSON.stringify(dataToSend))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      error: 'Fallo de ejecución. ' + error.message,
      totalAcumulado: 0, lastDivisor: 1.0, totalLastDivisorDay: 0,
      lastDivisorDate: 'ERROR', desgloseEsperado: []
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ==============================================================================
// FUNCIONES PARA HISTORIAL DETALLADO
// ==============================================================================
function getRecordsWithDivisors() {
  const recs = sbRecGet('recaudaciones?select=id,fecha,tipo,monto&order=fecha.desc');
  const divs = sbRecGet('divisores?select=fecha,valor');
  const divMap = {};
  divs.forEach(function(d) { if (d.fecha) { const v = Number(d.valor); divMap[d.fecha] = (v > 0) ? v : null; } });

  const records = recs.filter(function(r) { return r.fecha; }).map(function(r) {
    return {
      originalIndex: r.id,
      fecha:   r.fecha,
      tipo:    r.tipo,
      monto:   Number(r.monto) || 0,
      divisor: (divMap[r.fecha] !== undefined ? divMap[r.fecha] : null)
    };
  });
  return createSuccessResponse(records);
}

// ==============================================================================
// FUNCIONES AUXILIARES (GESTIÓN DE DATOS)
// ==============================================================================
function getSaldo() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SALDO_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return createSuccessResponse({ fecha: null, monto: null });
  const values = sheet.getRange(2, 1, 1, 2).getValues()[0];
  return createSuccessResponse({
    fecha: values[0] ? Utilities.formatDate(new Date(values[0]), "America/Santiago", "yyyy-MM-dd") : null,
    monto: values[1] || null
  });
}

function getNotes() {
  const notas = sbRecGet('notas_recaudacion?select=id,autor,mensaje,created_at&order=created_at.asc');
  const out = notas.filter(function(n) { return n.mensaje; }).map(function(n) {
    return { originalIndex: n.id, fecha: n.created_at || null, autor: n.autor, mensaje: n.mensaje };
  });
  return createSuccessResponse(out);
}

function getDivisores() {
  const sheet     = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DIVISORES_SHEET_NAME);
  const divisores = getDivisoresInternal(sheet);
  return createSuccessResponse(divisores);
}

function getDivisoresInternal(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return {};
  const values    = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  const divisores = {};
  const timeZone  = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  values.forEach(row => {
    if (row[0] && row[1]) {
      const fecha      = Utilities.formatDate(new Date(row[0]), timeZone, "yyyy-MM-dd");
      divisores[fecha] = row[1];
    }
  });
  return divisores;
}

// ==============================================================================
// ESCRITURA DE DATOS (recaudaciones, saldo, notas, divisores)
// ==============================================================================
function addRecord(data) {
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET_NAME)
    .appendRow([data.fecha, data.tipo, data.monto]);
  return createSuccessResponse("Dato agregado.");
}

function updateRecord(data) {
  var rowIndex = data.index || data.sheetIndex;
  if (!rowIndex) return createErrorResponse("No se proporcionó índice para actualizar.");
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET_NAME)
    .getRange(rowIndex, 1, 1, 3).setValues([[data.fecha, data.tipo, data.monto]]);
  return createSuccessResponse("Dato actualizado.");
}

function deleteRecord(data) {
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET_NAME)
    .deleteRow(data.index);
  return createSuccessResponse("Dato eliminado.");
}

function updateSaldo(data) {
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SALDO_SHEET_NAME)
    .getRange(2, 1, 1, 2).setValues([[data.fecha, data.monto]]);
  return createSuccessResponse("Saldo actualizado.");
}

function addNote(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOTES_SHEET_NAME);
  if (!sheet) return createErrorResponse("Hoja Notas no existe.");
  sheet.appendRow([new Date().toISOString(), data.autor, data.mensaje]);
  return createSuccessResponse("Nota agregada.");
}

function deleteNote(data) {
  const index = data.index;
  if (!index) return createErrorResponse("No se proveyó índice de nota.");
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOTES_SHEET_NAME)
    .deleteRow(parseInt(index));
  return createSuccessResponse("Nota eliminada.");
}

function updateDivisor(data) {
  const sheet     = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DIVISORES_SHEET_NAME);
  const timeZone  = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const fechaCliente = data.fecha;
  if (!fechaCliente) return createErrorResponse("Fecha de divisor inválida.");
  const divisorValor = (data.divisor && parseFloat(data.divisor) > 0) ? parseFloat(data.divisor) : null;

  let filaEncontrada = -1;
  if (sheet.getLastRow() >= 2) {
    const fechas = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    for (let i = 0; i < fechas.length; i++) {
      const fechaHoja = fechas[i][0];
      if (fechaHoja && fechaHoja instanceof Date) {
        const fechaNorm = Utilities.formatDate(fechaHoja, timeZone, "yyyy-MM-dd");
        if (fechaNorm === fechaCliente) { filaEncontrada = i + 2; break; }
      }
    }
  }

  if (filaEncontrada !== -1) {
    if (divisorValor) sheet.getRange(filaEncontrada, 2).setValue(divisorValor);
    else              sheet.deleteRow(filaEncontrada);
  } else if (divisorValor) {
    sheet.appendRow([fechaCliente, divisorValor]);
  }

  return createSuccessResponse("Divisor actualizado.");
}

function clearAllData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  [DATA_SHEET_NAME, DIVISORES_SHEET_NAME, SALDO_SHEET_NAME].forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (sheet && sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
    }
  });
  return createSuccessResponse('Datos reiniciados.');
}

function importAll(payload) {
  const ss       = SpreadsheetApp.getActiveSpreadsheet();
  const imported = payload.data;
  if (!imported) return createErrorResponse("No hay datos para importar.");

  const dataToImport = {
    recaudaciones: imported.recaudaciones || imported.datos || [],
    valorPunto:    imported.valorPunto    || imported.saldoInicialGuardado || {},
    notas:         imported.notas         || imported.notes    || [],
    divisores:     imported.divisores     || {}
  };

  try {
    const dataSheet      = ss.getSheetByName(DATA_SHEET_NAME);
    const notesSheet     = ss.getSheetByName(NOTES_SHEET_NAME);
    const divisoresSheet = ss.getSheetByName(DIVISORES_SHEET_NAME);
    const saldoSheet     = ss.getSheetByName(SALDO_SHEET_NAME);

    [dataSheet, notesSheet, divisoresSheet, saldoSheet].forEach(sheet => {
      if (sheet && sheet.getLastRow() > 1) {
        sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
      }
    });
    if (dataToImport.recaudaciones.length > 0) {
      const datosValues = dataToImport.recaudaciones.map(d => [new Date(d.fecha + 'T12:00:00'), d.tipo, d.monto]);
      dataSheet.getRange(2, 1, datosValues.length, 3).setValues(datosValues);
    }
    if (dataToImport.notas.length > 0) {
      const notesValues = dataToImport.notas.map(n => [new Date(n.fecha), n.autor, n.mensaje]);
      notesSheet.getRange(2, 1, notesValues.length, 3).setValues(notesValues);
    }
    if (Object.keys(dataToImport.divisores).length > 0) {
      const divValues = Object.entries(dataToImport.divisores)
        .map(([fecha, valor]) => [new Date(fecha + 'T12:00:00'), valor]);
      divisoresSheet.getRange(2, 1, divValues.length, 2).setValues(divValues);
    }
    if (dataToImport.valorPunto && dataToImport.valorPunto.fecha && dataToImport.valorPunto.monto) {
      saldoSheet.getRange(2, 1, 1, 2).setValues([[new Date(dataToImport.valorPunto.fecha + 'T12:00:00'), dataToImport.valorPunto.monto]]);
    }
    return createSuccessResponse('Importación exitosa.');
  } catch(e) {
    return createErrorResponse("Error al importar: " + e.message);
  }
}

// ==============================================================================
// CIERRE DE PERÍODO — ARCHIVO MENSUAL (15 al 14)
// ==============================================================================
function closePeriod() {
  const ss       = SpreadsheetApp.getActiveSpreadsheet();
  const timeZone = ss.getSpreadsheetTimeZone();
  const now      = new Date();
  const day      = now.getDate();
  const MESES    = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  let periodoInicio, periodoFin;
  if (day < 15) {
    periodoInicio = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    periodoFin    = new Date(now.getFullYear(), now.getMonth(), 14);
  } else {
    periodoInicio = new Date(now.getFullYear(), now.getMonth(), 15);
    periodoFin    = new Date(now.getFullYear(), now.getMonth() + 1, 14);
  }

  const nombrePeriodo =
    periodoInicio.getDate() + ' ' + MESES[periodoInicio.getMonth()] + ' - ' +
    periodoFin.getDate()    + ' ' + MESES[periodoFin.getMonth()]    + ' ' + periodoFin.getFullYear();

  if (ss.getSheetByName(nombrePeriodo)) {
    return createErrorResponse('Ya existe una pestaña para el período "' + nombrePeriodo + '".');
  }

  const sheetDatos     = ss.getSheetByName(DATA_SHEET_NAME);
  const sheetDivisores = ss.getSheetByName(DIVISORES_SHEET_NAME);
  const sheetSaldo     = ss.getSheetByName(SALDO_SHEET_NAME);
  const sheetNotas     = ss.getSheetByName(NOTES_SHEET_NAME);

  if (!sheetDatos) return createErrorResponse("Hoja '" + DATA_SHEET_NAME + "' no encontrada.");

  const archivo = ss.insertSheet(nombrePeriodo);

  // Encabezado
  archivo.getRange(1, 1, 1, 4).merge()
    .setValue('PERÍODO: ' + nombrePeriodo)
    .setFontSize(13).setFontWeight('bold')
    .setBackground('#4f46e5').setFontColor('#ffffff')
    .setHorizontalAlignment('center');

  let row = 3;

  // ── RECAUDACIONES ──────────────────────────────────────────────
  archivo.getRange(row, 1, 1, 4).merge()
    .setValue('RECAUDACIONES')
    .setFontWeight('bold').setBackground('#e0e7ff').setFontColor('#3730a3');
  row++;
  ['Fecha','Tipo','Monto'].forEach((h, i) =>
    archivo.getRange(row, i + 1).setValue(h).setFontWeight('bold'));
  row++;

  let totalGeneral = 0;
  if (sheetDatos.getLastRow() >= 2) {
    const datos = sheetDatos.getRange(2, 1, sheetDatos.getLastRow() - 1, 3).getValues();
    datos.forEach(r => {
      if (!r[0]) return;
      const monto = parseFloat(r[2]) || 0;
      totalGeneral += monto;
      archivo.getRange(row, 1).setValue(Utilities.formatDate(new Date(r[0]), timeZone, 'dd/MM/yyyy'));
      archivo.getRange(row, 2).setValue(r[1]);
      archivo.getRange(row, 3).setValue(monto);
      row++;
    });
  }
  archivo.getRange(row, 1, 1, 2).merge().setValue('TOTAL').setFontWeight('bold');
  archivo.getRange(row, 3).setValue(totalGeneral).setFontWeight('bold').setBackground('#f0fdf4');
  row += 2;

  // ── DIVISORES ──────────────────────────────────────────────────
  archivo.getRange(row, 1, 1, 4).merge()
    .setValue('DIVISORES (PERSONAS / PUNTOS)')
    .setFontWeight('bold').setBackground('#e0e7ff').setFontColor('#3730a3');
  row++;
  ['Fecha','Divisor'].forEach((h, i) =>
    archivo.getRange(row, i + 1).setValue(h).setFontWeight('bold'));
  row++;
  if (sheetDivisores && sheetDivisores.getLastRow() >= 2) {
    sheetDivisores.getRange(2, 1, sheetDivisores.getLastRow() - 1, 2).getValues().forEach(r => {
      if (!r[0]) return;
      archivo.getRange(row, 1).setValue(Utilities.formatDate(new Date(r[0]), timeZone, 'dd/MM/yyyy'));
      archivo.getRange(row, 2).setValue(r[1]);
      row++;
    });
  }
  row++;

  // ── SALDO INICIAL ──────────────────────────────────────────────
  archivo.getRange(row, 1, 1, 4).merge()
    .setValue('VALOR PUNTO / SALDO INICIAL')
    .setFontWeight('bold').setBackground('#e0e7ff').setFontColor('#3730a3');
  row++;
  if (sheetSaldo && sheetSaldo.getLastRow() >= 2) {
    const saldo = sheetSaldo.getRange(2, 1, 1, 2).getValues()[0];
    if (saldo[0]) {
      archivo.getRange(row, 1).setValue(Utilities.formatDate(new Date(saldo[0]), timeZone, 'dd/MM/yyyy'));
      archivo.getRange(row, 2).setValue('Saldo Inicial');
      archivo.getRange(row, 3).setValue(saldo[1]);
      row++;
    }
  }
  row++;

  // ── NOTAS ──────────────────────────────────────────────────────
  archivo.getRange(row, 1, 1, 4).merge()
    .setValue('NOTAS DEL PERÍODO')
    .setFontWeight('bold').setBackground('#e0e7ff').setFontColor('#3730a3');
  row++;
  ['Fecha','Autor','Mensaje'].forEach((h, i) =>
    archivo.getRange(row, i + 1).setValue(h).setFontWeight('bold'));
  row++;
  if (sheetNotas && sheetNotas.getLastRow() >= 2) {
    sheetNotas.getRange(2, 1, sheetNotas.getLastRow() - 1, 3).getValues().forEach(r => {
      if (!r[2]) return;
      archivo.getRange(row, 1).setValue(Utilities.formatDate(new Date(r[0]), timeZone, 'dd/MM/yyyy HH:mm'));
      archivo.getRange(row, 2).setValue(r[1]);
      archivo.getRange(row, 3).setValue(r[2]);
      row++;
    });
  }

  archivo.autoResizeColumns(1, 4);

  // Limpiar hojas de trabajo
  [sheetDatos, sheetDivisores, sheetNotas].forEach(sheet => {
    if (sheet && sheet.getLastRow() > 1)
      sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  });
  if (sheetSaldo && sheetSaldo.getLastRow() > 1)
    sheetSaldo.getRange(2, 1, sheetSaldo.getLastRow() - 1, sheetSaldo.getLastColumn()).clearContent();


  return createSuccessResponse({ periodo: nombrePeriodo, totalGeneral: totalGeneral });
}

// ==============================================================================
// RESPUESTAS ESTÁNDAR
// ==============================================================================
function createSuccessResponse(data) {
  return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function createErrorResponse(message) {
  return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: message }))
    .setMimeType(ContentService.MimeType.JSON);
}
