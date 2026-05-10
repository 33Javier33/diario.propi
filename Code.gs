// ==============================================================================
// SCRIPT RECAUDACIONES - CON INTEGRACIÓN TELEGRAM (@GestionPtopinaBot)
// Casino de Puerto Varas — Fondo Solidario
// ==============================================================================

// ── CONFIGURACIÓN TELEGRAM ────────────────────────────────────────────────────
const TELEGRAM_TOKEN   = '8318855772:AAEDfwR7BdyF5gL7nMJjaYowvMF9hw6yfCw';
const TELEGRAM_CHAT_ID = '5981473068';

function probarTelegramRec() {
  telegramRec('🔔 Prueba Recaudaciones OK!');
}

function telegramRec(mensaje) {
  try {
    const url = 'https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/sendMessage';
    UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: mensaje,
        parse_mode: 'HTML'
      }),
      muteHttpExceptions: true
    });
  } catch(e) {
    console.log('Telegram REC error: ' + e.toString());
  }
}

// Resumen diario — llamar con activador de tiempo
function resumenDiarioRecaudacion() {
  try {
    const ss           = SpreadsheetApp.getActiveSpreadsheet();
    const sheetDatos   = ss.getSheetByName(DATA_SHEET_NAME);
    const timeZone     = ss.getSpreadsheetTimeZone();
    const hoy          = Utilities.formatDate(new Date(), timeZone, 'yyyy-MM-dd');
    const hoyVis       = Utilities.formatDate(new Date(), timeZone, 'dd/MM/yyyy');

    if (!sheetDatos || sheetDatos.getLastRow() < 2) {
      telegramRec('📊 <b>Resumen del día ' + hoyVis + '</b>\n\nSin registros de recaudación.');
      return;
    }

    const values = sheetDatos.getRange(2, 1, sheetDatos.getLastRow() - 1, 3).getValues();
    const desglose = {};
    let totalDia = 0;

    values.forEach(row => {
      const fecha = row[0];
      if (!fecha || !(fecha instanceof Date)) return;
      const fechaStr = Utilities.formatDate(fecha, timeZone, 'yyyy-MM-dd');
      if (fechaStr !== hoy) return;
      const tipo  = row[1] ? row[1].toString().trim() : 'Sin Tipo';
      const monto = parseFloat(row[2]) || 0;
      totalDia += monto;
      desglose[tipo] = (desglose[tipo] || 0) + monto;
    });

    const divisores  = getDivisoresInternal(ss.getSheetByName(DIVISORES_SHEET_NAME));
    const divisorHoy = divisores[hoy] ? parseFloat(divisores[hoy]) : null;
    const puntoNoche = divisorHoy && divisorHoy > 1
      ? Math.round(totalDia / divisorHoy) : null;

    let lineasDesglose = '';
    Object.keys(desglose).forEach(tipo => {
      lineasDesglose += '\n   · ' + tipo + ': $' + desglose[tipo].toLocaleString('es-CL');
    });

    const mensajeDia =
      '📊 <b>Resumen Recaudación ' + hoyVis + '</b>\n' +
      'Casino de Puerto Varas\n' +
      '─────────────────────\n' +
      '💵 Total del día: $' + totalDia.toLocaleString('es-CL') +
      (lineasDesglose ? '\n\n📋 <b>Desglose:</b>' + lineasDesglose : '') +
      (divisorHoy ? '\n\n➗ Divisor: ' + divisorHoy : '\n\n⚠️ Sin divisor registrado') +
      (puntoNoche ? '\n🎯 Punto noche: $' + puntoNoche.toLocaleString('es-CL') : '') +
      '\n─────────────────────\n' +
      '🕐 ' + new Date().toLocaleString('es-CL');

    telegramRec(mensajeDia);
  } catch(e) {
    console.log('Error resumen diario: ' + e.toString());
  }
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
    const ss             = SpreadsheetApp.getActiveSpreadsheet();
    const sheetDatos     = ss.getSheetByName(DATA_SHEET_NAME);
    const sheetDivisores = ss.getSheetByName(DIVISORES_SHEET_NAME);
    const timeZone       = ss.getSpreadsheetTimeZone();

    if (!sheetDatos) {
      return createErrorResponse("Error: Hoja '" + DATA_SHEET_NAME + "' no encontrada.");
    }

    let totalAcumulado = 0;
    let allData        = [];
    const desgloseMap  = {};

    if (sheetDatos.getLastRow() >= 2) {
      allData = sheetDatos.getRange(2, 1, sheetDatos.getLastRow() - 1, 3).getValues();
      for (let i = 0; i < allData.length; i++) {
        const tipo  = allData[i][1] ? allData[i][1].toString().trim() : 'Sin Tipo';
        let   monto = allData[i][2];
        if (typeof monto === 'string') {
          monto = monto.replace(/\./g, '').replace(/,/g, '.');
          monto = parseFloat(monto) || 0;
        }
        monto = parseFloat(monto) || 0;
        totalAcumulado += monto;
        if (tipo !== 'Sin Tipo') {
          desgloseMap[tipo] = (desgloseMap[tipo] || 0) + monto;
        }
      }
    }

    let lastDivisorValue      = 1.0;
    let lastDivisorDateString = "N/A";
    let lastDate              = new Date(0);

    if (sheetDivisores && sheetDivisores.getLastRow() >= 2) {
      const allDivisors = sheetDivisores.getRange(2, 1, sheetDivisores.getLastRow() - 1, 2).getValues();
      for (let i = 0; i < allDivisors.length; i++) {
        const rowDate    = allDivisors[i][0];
        const rowDivisor = allDivisors[i][1];
        if (rowDate && rowDate instanceof Date && rowDivisor !== null && rowDivisor !== "") {
          if (rowDate.getTime() > lastDate.getTime()) {
            lastDate              = rowDate;
            lastDivisorValue      = parseFloat(rowDivisor) || 1.0;
            lastDivisorDateString = Utilities.formatDate(rowDate, timeZone, "dd-MM-yyyy");
          }
        }
      }
    }

    let totalLastDivisorDay = 0;
    if (lastDivisorDateString !== "N/A" && allData.length > 0) {
      const dateForComparison = Utilities.formatDate(
        Utilities.parseDate(lastDivisorDateString, timeZone, "dd-MM-yyyy"),
        timeZone, "yyyy-MM-dd"
      );
      for (let i = 0; i < allData.length; i++) {
        const fecha = allData[i][0];
        let   monto = allData[i][2];
        if (fecha && fecha instanceof Date) {
          const recordDateString = Utilities.formatDate(fecha, timeZone, "yyyy-MM-dd");
          if (recordDateString === dateForComparison) {
            if (typeof monto === 'string') {
              monto = monto.replace(/\./g, '').replace(/,/g, '.');
              monto = parseFloat(monto) || 0;
            }
            monto = parseFloat(monto) || 0;
            totalLastDivisorDay += monto;
          }
        }
      }
    }

    const desgloseEsperadoArray = Object.keys(desgloseMap).map(tipo => ({
      tipo:  tipo,
      monto: Math.round(desgloseMap[tipo]) * 100
    }));

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
    Logger.log("Error al acceder a Sheets: " + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      error:               "Fallo de ejecución en script. " + error.message,
      totalAcumulado:      0,
      lastDivisor:         1.0,
      totalLastDivisorDay: 0,
      lastDivisorDate:     "ERROR",
      desgloseEsperado:    []
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ==============================================================================
// FUNCIONES PARA HISTORIAL DETALLADO
// ==============================================================================
function getRecordsWithDivisors() {
  const ss             = SpreadsheetApp.getActiveSpreadsheet();
  const sheetDatos     = ss.getSheetByName(DATA_SHEET_NAME);
  const sheetDivisores = ss.getSheetByName(DIVISORES_SHEET_NAME);
  const timeZone       = ss.getSpreadsheetTimeZone();

  if (!sheetDatos) return createErrorResponse("Hoja '" + DATA_SHEET_NAME + "' no encontrada.");
  const divisoresPorFecha = getDivisoresInternal(sheetDivisores);
  if (sheetDatos.getLastRow() < 2) return createSuccessResponse([]);

  const values  = sheetDatos.getRange(2, 1, sheetDatos.getLastRow() - 1, 3).getValues();
  const records = values.map((row, index) => {
    const rawDate = row[0];
    let formattedDate = null;
    let divisor       = null;
    if (rawDate && rawDate instanceof Date) {
      formattedDate = Utilities.formatDate(rawDate, timeZone, "yyyy-MM-dd");
      if (divisoresPorFecha[formattedDate] !== undefined) {
        const parsedDivisor = parseFloat(divisoresPorFecha[formattedDate]);
        divisor = (isNaN(parsedDivisor) || parsedDivisor <= 0) ? null : parsedDivisor;
      }
    }
    return {
      originalIndex: index + 2,
      fecha:         formattedDate,
      tipo:          row[1],
      monto:         parseFloat(row[2]) || 0,
      divisor:       divisor
    };
  }).filter(r => r.fecha);

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
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOTES_SHEET_NAME);
  if (!sheet) return createErrorResponse("Hoja Notas no encontrada");
  if (sheet.getLastRow() < 2) return createSuccessResponse([]);
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues();
  const notes  = values.map((row, index) => ({
    originalIndex: index + 2,
    fecha:         row[0] ? new Date(row[0]).toISOString() : null,
    autor:         row[1],
    mensaje:       row[2]
  })).filter(note => note.mensaje);
  return createSuccessResponse(notes);
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
// FUNCIONES CON NOTIFICACIONES TELEGRAM
// ==============================================================================
function addRecord(data) {
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET_NAME)
    .appendRow([data.fecha, data.tipo, data.monto]);
  telegramRec(
    '📥 <b>Nueva recaudación registrada</b>\n' +
    '📅 Fecha: ' + data.fecha + '\n' +
    '🏷️ Tipo: ' + (data.tipo || 'Sin tipo') + '\n' +
    '💵 Monto: $' + Number(data.monto).toLocaleString('es-CL')
  );
  return createSuccessResponse("Dato agregado.");
}

function updateRecord(data) {
  var rowIndex = data.index || data.sheetIndex;
  if (!rowIndex) return createErrorResponse("No se proporcionó índice para actualizar.");
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET_NAME)
    .getRange(rowIndex, 1, 1, 3).setValues([[data.fecha, data.tipo, data.monto]]);
  telegramRec(
    '✏️ <b>Recaudación editada</b>\n' +
    '📅 Fecha: ' + data.fecha + '\n' +
    '🏷️ Tipo: ' + (data.tipo || 'Sin tipo') + '\n' +
    '💵 Monto nuevo: $' + Number(data.monto).toLocaleString('es-CL')
  );
  return createSuccessResponse("Dato actualizado.");
}

function deleteRecord(data) {
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET_NAME)
    .deleteRow(data.index);
  telegramRec(
    '🗑️ <b>Recaudación eliminada</b>\n' +
    'Fila: ' + data.index
  );
  return createSuccessResponse("Dato eliminado.");
}

function updateSaldo(data) {
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SALDO_SHEET_NAME)
    .getRange(2, 1, 1, 2).setValues([[data.fecha, data.monto]]);
  telegramRec(
    '💰 <b>Saldo actualizado</b>\n' +
    '📅 Fecha: ' + data.fecha + '\n' +
    '💵 Monto: $' + Number(data.monto).toLocaleString('es-CL')
  );
  return createSuccessResponse("Saldo actualizado.");
}

function addNote(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOTES_SHEET_NAME);
  if (!sheet) return createErrorResponse("Hoja Notas no existe.");
  sheet.appendRow([new Date().toISOString(), data.autor, data.mensaje]);
  telegramRec(
    '📝 <b>Nueva nota agregada</b>\n' +
    '👤 Autor: ' + (data.autor || 'Sin autor') + '\n' +
    '💬 ' + (data.mensaje || '')
  );
  return createSuccessResponse("Nota agregada.");
}

function deleteNote(data) {
  const index = data.index;
  if (!index) return createErrorResponse("No se proveyó índice de nota.");
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOTES_SHEET_NAME)
    .deleteRow(parseInt(index));
  telegramRec('🗑️ <b>Nota eliminada</b>');
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

  if (divisorValor) {
    telegramRec(
      '➗ <b>Divisor actualizado</b>\n' +
      '📅 Fecha: ' + fechaCliente + '\n' +
      '🔢 Divisor: ' + divisorValor + '\n' +
      '🎯 (Afecta el cálculo del punto noche)'
    );
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
  telegramRec('🧹 <b>Datos de recaudación reiniciados</b>\nTodos los registros fueron borrados.');
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
    telegramRec(
      '📦 <b>Importación de datos completada</b>\n' +
      '📊 Recaudaciones: ' + dataToImport.recaudaciones.length + '\n' +
      '📝 Notas: ' + dataToImport.notas.length + '\n' +
      '➗ Divisores: ' + Object.keys(dataToImport.divisores).length
    );
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

  telegramRec(
    '📅 <b>Período cerrado: ' + nombrePeriodo + '</b>\n' +
    '💵 Total recaudado: $' + totalGeneral.toLocaleString('es-CL') + '\n' +
    '📊 Datos archivados en nueva pestaña.'
  );

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
