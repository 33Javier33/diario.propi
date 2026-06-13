// ==============================================================================
// SCRIPT DE MIGRACIÓN: Google Sheets → Supabase
// Sistema: diario.propi (Recaudaciones)
// Ejecutar UNA SOLA VEZ desde el editor de Google Apps Script
// ==============================================================================

var SUPABASE_URL = 'https://lpulmjzboogixbdxxayo.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwdWxtanpib29naXhiZHh4YXlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NjY0NzMsImV4cCI6MjA5MTI0MjQ3M30.vjebyQb4Bb62ZQlNaJZveuxdBYDOmtC4bM7uwAilDzY';

function supabaseInsert(tabla, filas) {
  if (!filas || filas.length === 0) {
    Logger.log('[SKIP] ' + tabla + ': sin datos');
    return;
  }
  var url = SUPABASE_URL + '/rest/v1/' + tabla;
  var opts = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Prefer': 'return=minimal,resolution=ignore-duplicates'
    },
    payload: JSON.stringify(filas),
    muteHttpExceptions: true
  };
  var res = UrlFetchApp.fetch(url, opts);
  var code = res.getResponseCode();
  if (code >= 200 && code < 300) {
    Logger.log('[OK] ' + tabla + ': ' + filas.length + ' filas insertadas');
  } else {
    Logger.log('[ERROR] ' + tabla + ' (HTTP ' + code + '): ' + res.getContentText().substring(0, 300));
  }
}

function supabaseUpsert(tabla, filas) {
  if (!filas || filas.length === 0) { Logger.log('[SKIP] ' + tabla + ': sin datos'); return; }
  var url = SUPABASE_URL + '/rest/v1/' + tabla;
  var opts = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Prefer': 'resolution=merge-duplicates,return=minimal'
    },
    payload: JSON.stringify(filas),
    muteHttpExceptions: true
  };
  var res = UrlFetchApp.fetch(url, opts);
  Logger.log('[UPSERT] ' + tabla + ' HTTP ' + res.getResponseCode());
}

function formatFecha(val) {
  if (!val) return null;
  if (val instanceof Date) return Utilities.formatDate(val, 'UTC', 'yyyy-MM-dd');
  return String(val).trim() || null;
}

function formatFechaHora(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  return String(val).trim() || null;
}

function toNum(val) {
  if (val === null || val === undefined || val === '') return 0;
  var n = parseFloat(String(val).replace(/\./g, '').replace(/,/g, '.'));
  return isNaN(n) ? 0 : n;
}

function toStr(val) {
  if (val === null || val === undefined) return null;
  var s = String(val).trim();
  return s === '' ? null : s;
}

// ── 1. RECAUDACIONES (hoja Datos) ─────────────────────────────────────────────
function migrarRecaudaciones() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Datos');
  if (!sheet || sheet.getLastRow() < 2) { Logger.log('[SKIP] Datos: vacía'); return; }
  
  var data  = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues();
  var BATCH = 500;
  var filas = [];
  
  data.forEach(function(row) {
    var fecha = formatFecha(row[0]);
    var tipo  = toStr(row[1]);
    var monto = toNum(row[2]);
    if (!fecha || monto === 0) return;
    filas.push({
      id: Utilities.getUuid(),
      fecha: fecha,
      tipo: tipo || 'Sin Tipo',
      monto: monto
    });
  });
  
  // Insertar en lotes
  for (var i = 0; i < filas.length; i += BATCH) {
    supabaseInsert('recaudaciones', filas.slice(i, i + BATCH));
    Utilities.sleep(300);
  }
}

// ── 2. DIVISORES ──────────────────────────────────────────────────────────────
function migrarDivisores() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Divisores');
  if (!sheet || sheet.getLastRow() < 2) { Logger.log('[SKIP] Divisores: vacía'); return; }
  
  var timeZone = ss.getSpreadsheetTimeZone();
  var data     = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  var filas    = [];
  
  data.forEach(function(row) {
    var fecha = row[0];
    var valor = parseFloat(row[1]);
    if (!fecha || isNaN(valor)) return;
    var fechaStr = (fecha instanceof Date)
      ? Utilities.formatDate(fecha, timeZone, 'yyyy-MM-dd')
      : String(fecha).trim();
    filas.push({
      id: Utilities.getUuid(),
      fecha: fechaStr,
      valor: valor
    });
  });
  supabaseInsert('divisores', filas);
}

// ── 3. SALDO / VALOR PUNTO ────────────────────────────────────────────────────
function migrarSaldo() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Saldo');
  if (!sheet || sheet.getLastRow() < 2) { Logger.log('[SKIP] Saldo: vacía'); return; }
  
  var row   = sheet.getRange(2, 1, 1, 2).getValues()[0];
  var fecha = formatFecha(row[0]);
  var monto = toNum(row[1]);
  if (!fecha && monto === 0) { Logger.log('[SKIP] Saldo: sin datos'); return; }
  
  supabaseUpsert('saldo_fondo', [{ id: 'main', fecha: fecha, monto: monto }]);
}

// ── 4. NOTAS ──────────────────────────────────────────────────────────────────
function migrarNotas() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Notas');
  if (!sheet || sheet.getLastRow() < 2) { Logger.log('[SKIP] Notas: vacía'); return; }
  
  var data  = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues();
  var filas = [];
  
  data.forEach(function(row) {
    var mensaje = toStr(row[2]);
    if (!mensaje) return;
    filas.push({
      id: Utilities.getUuid(),
      created_at: formatFechaHora(row[0]),
      autor: toStr(row[1]) || 'Sistema',
      mensaje: mensaje
    });
  });
  supabaseInsert('notas_recaudacion', filas);
}

// ── FUNCIÓN PRINCIPAL ─────────────────────────────────────────────────────────
function migrarTodo() {
  Logger.log('=== INICIO MIGRACIÓN DIARIO.PROPI → SUPABASE ===');
  Logger.log('Proyecto: lpulmjzboogixbdxxayo');
  Logger.log('Fecha: ' + new Date().toISOString());
  Logger.log('');

  migrarRecaudaciones(); Utilities.sleep(1000);
  migrarDivisores();     Utilities.sleep(500);
  migrarSaldo();         Utilities.sleep(500);
  migrarNotas();

  Logger.log('');
  Logger.log('=== MIGRACIÓN COMPLETADA ===');
  Logger.log('Verifica en: https://supabase.com/dashboard/project/lpulmjzboogixbdxxayo/editor');
}
