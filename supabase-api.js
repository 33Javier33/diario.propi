// ============================================================
// SUPABASE API — reemplaza Google Apps Script en diario.propi
// Casino de Puerto Varas — Fondo Solidario de Propina
// ============================================================

const SUPABASE_URL_REC = 'https://lpulmjzboogixbdxxayo.supabase.co';
const SUPABASE_KEY_REC = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwdWxtanpib29naXhiZHh4YXlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NjY0NzMsImV4cCI6MjA5MTI0MjQ3M30.vjebyQb4Bb62ZQlNaJZveuxdBYDOmtC4bM7uwAilDzY';

const dbRec = supabase.createClient(SUPABASE_URL_REC, SUPABASE_KEY_REC);

// Cliente a la base de socios (donde vive la auditoría de socios-comicion).
// Permite registrar en su historial quién hizo cada cambio desde diario.propi.
const SUPABASE_URL_SOC = 'https://teemahksasdougehrcly.supabase.co';
const SUPABASE_KEY_SOC = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlZW1haGtzYXNkb3VnZWhyY2x5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyOTkwNjIsImV4cCI6MjA5Njg3NTA2Mn0.EIQ7gRcwf3zYgvGESKw3s5lnZMABN_EuNWsrJK3L1zk';
const dbSoc = supabase.createClient(SUPABASE_URL_SOC, SUPABASE_KEY_SOC);

// Registra un evento en la auditoría de socios-comicion (no bloqueante).
function _audit(accion, detalle, datos) {
    try {
        const user = sessionStorage.getItem('user') || '';
        const usuario = user ? ('Diario · ' + user) : 'Diario';
        dbSoc.from('auditoria').insert({
            usuario,
            accion,
            folio: null,
            datos_extra: Object.assign(
                { detalle: detalle || '', id_afectado: '', origen: 'diario.propi' },
                datos || {}
            )
        }).then(({ error }) => { if (error) console.warn('[supabase-api] auditoria error:', error.message); })
          .catch(() => {});
    } catch(e) {}
}

// ── Usuarios diario.propi: socios (por área) + PIN de 4 dígitos en Supabase ──
function _normArea(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }

// Devuelve los socios de socios-comicion que pertenecen al área elegida (filtro tolerante)
window.diarioGetSociosByArea = async function(areaSel) {
    const target = _normArea(areaSel);
    try {
        const { data, error } = await dbSoc.from('socios').select('id, nombre, apellido, area').order('nombre', { ascending: true });
        if (error || !data) return [];
        return data.filter(s => {
            const a = _normArea(s.area);
            if (target === 'cambistas') return a.includes('cambist');
            if (target === 'mesas')     return a.includes('mesa') && !a.includes('cambist');
            if (target === 'maquinas')  return a.includes('maquina');
            if (target === 'tecnicos')  return a.includes('tecnic');
            return a === target;
        }).map(s => ({ id: s.id, nombre: ((s.nombre || '') + ' ' + (s.apellido || '')).trim(), area: s.area }));
    } catch(e) { return []; }
};

// Lee el PIN guardado de un socio (o null si aún no tiene)
window.diarioGetPin = async function(socioId) {
    try {
        const { data } = await dbSoc.from('diario_pins').select('pin, nombre, area').eq('socio_id', socioId).maybeSingle();
        return data || null;
    } catch(e) { return null; }
};

// Crea o actualiza el PIN de un socio
window.diarioSetPin = async function(socioId, nombre, area, pin) {
    try {
        const { error } = await dbSoc.from('diario_pins').upsert(
            { socio_id: socioId, nombre: nombre || '', area: area || '', pin: String(pin), updated_at: new Date().toISOString() },
            { onConflict: 'socio_id' }
        );
        return !error;
    } catch(e) { return false; }
};

// Canal compartido para notificar cambios a todas las apps en tiempo real
const _recBroadcast = dbRec.channel('rec-data-sync');

function recOk(data)  { return { status: 'success', data }; }
function recErr(msg)  { return { status: 'error', message: String(msg) }; }

// Emite evento broadcast para que todas las apps recarguen
function _notificarCambio(tabla = 'recaudaciones') {
    _recBroadcast.send({ type: 'broadcast', event: 'changed', payload: { tabla } }).catch(() => {});
}

async function apiGetRecaudaciones() {
    try {
        const [recRes, divRes] = await Promise.all([
            dbRec.from('recaudaciones').select('*').order('fecha', { ascending: false }),
            dbRec.from('divisores').select('*')
        ]);
        if (recRes.error) throw recRes.error;
        if (divRes.error) throw divRes.error;
        const divisoresPorFecha = {};
        (divRes.data || []).forEach(d => { divisoresPorFecha[d.fecha] = d.valor; });
        const records = (recRes.data || []).map(r => ({
            originalIndex: r.id,
            fecha:  r.fecha,
            tipo:   r.tipo,
            monto:  Number(r.monto),
            divisor: divisoresPorFecha[r.fecha] ? Number(divisoresPorFecha[r.fecha]) : null,
            registrado_por_nombre: r.registrado_por_nombre || null
        }));
        return recOk(records);
    } catch(e) { return recErr(e.message); }
}

async function apiGetTotalArqueo() {
    try {
        const [recRes, divRes] = await Promise.all([
            dbRec.from('recaudaciones').select('fecha, tipo, monto'),
            dbRec.from('divisores').select('fecha, valor').order('fecha', { ascending: false })
        ]);
        if (recRes.error) throw recRes.error;
        if (divRes.error) throw divRes.error;
        const datos = recRes.data || [];
        let totalAcumulado = 0;
        const desgloseMap = {};
        datos.forEach(r => {
            const monto = Number(r.monto) || 0;
            totalAcumulado += monto;
            const tipo = r.tipo || 'Sin Tipo';
            if (tipo !== 'Sin Tipo') desgloseMap[tipo] = (desgloseMap[tipo] || 0) + monto;
        });
        const divisores = divRes.data || [];
        let lastDivisorValue = 1.0, lastDivisorDateString = 'N/A', lastDate = new Date(0);
        divisores.forEach(d => {
            const fechaD = new Date(d.fecha);
            if (fechaD > lastDate) { lastDate = fechaD; lastDivisorValue = Number(d.valor) || 1.0; lastDivisorDateString = d.fecha.split('-').reverse().join('-'); }
        });
        let totalLastDivisorDay = 0;
        if (lastDivisorDateString !== 'N/A') {
            const targetFecha = lastDivisorDateString.split('-').reverse().join('-');
            datos.filter(r => r.fecha === targetFecha).forEach(r => { totalLastDivisorDay += Number(r.monto) || 0; });
        }
        const desgloseEsperadoArray = Object.keys(desgloseMap).map(tipo => ({ tipo, monto: Math.round(desgloseMap[tipo]) * 100 }));
        return { totalAcumulado: Math.round(totalAcumulado) * 100, lastDivisor: lastDivisorValue, totalLastDivisorDay: Math.round(totalLastDivisorDay) * 100, lastDivisorDate: lastDivisorDateString, desgloseEsperado: desgloseEsperadoArray };
    } catch(e) { console.error('apiGetTotalArqueo:', e); return { totalAcumulado: 0, lastDivisor: 1.0, totalLastDivisorDay: 0, lastDivisorDate: 'ERROR', desgloseEsperado: [] }; }
}

async function apiGetSaldo() {
    try {
        const { data, error } = await dbRec.from('saldo_fondo').select('*').eq('id', 'main').maybeSingle();
        if (error) throw error;
        return recOk({ fecha: data ? data.fecha : null, monto: data ? data.monto : null });
    } catch(e) { return recErr(e.message); }
}

async function apiGetNotas() {
    try {
        const { data, error } = await dbRec.from('notas_recaudacion').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        const mapped = (data || []).map(n => ({ originalIndex: n.id, fecha: n.created_at, autor: n.autor, mensaje: n.mensaje, pinned: n.pinned || false, reactions: n.reactions || {}, foto_url: n.foto_url || '' }));
        mapped.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
        return recOk(mapped);
    } catch(e) { return recErr(e.message); }
}

async function apiGetDivisores() {
    try {
        const { data, error } = await dbRec.from('divisores').select('fecha, valor').order('fecha', { ascending: false });
        if (error) throw error;
        const map = {};
        (data || []).forEach(d => { map[d.fecha] = d.valor; });
        return recOk(map);
    } catch(e) { return recErr(e.message); }
}

function _fmtM(v) { return '$' + (Number(v) || 0).toLocaleString('es-CL'); }

async function apiAddRecaudacion(fecha, tipo, monto) {
    try {
        // Quién agrega el dato (login nuevo: nombre + área)
        const _nombre  = sessionStorage.getItem('user') || '';
        const _area    = sessionStorage.getItem('user_area') || '';
        const _socioId = sessionStorage.getItem('user_socioId') || '';
        const _porNombre = _nombre ? (_area ? _nombre + ' (' + _area + ')' : _nombre) : null;

        const id = crypto.randomUUID();
        let { error } = await dbRec.from('recaudaciones').insert({
            id, fecha, tipo: tipo || 'Sin Tipo', monto: Number(monto),
            registrado_por_id: _socioId || null,
            registrado_por_nombre: _porNombre
        });
        // Si las columnas registrado_por_* no existieran, reintentar sin ellas
        if (error && error.message && error.message.includes('registrado_por')) {
            ({ error } = await dbRec.from('recaudaciones').insert({ id, fecha, tipo: tipo || 'Sin Tipo', monto: Number(monto) }));
        }
        if (error) throw error;
        _notificarCambio('recaudaciones');
        _audit('Registrar Recaudación',
            'Fecha: ' + (fecha || '') + ' | Tipo: ' + (tipo || 'Sin Tipo') + ' | Monto: ' + _fmtM(monto)
                + (_porNombre ? ' | Por: ' + _porNombre : ''),
            { tipo: tipo || 'Sin Tipo', fecha: fecha || '', monto: Number(monto) || 0,
              registrado_por_nombre: _nombre, registrado_por_area: _area, registrado_por_id: _socioId });
        return recOk('Dato agregado.');
    } catch(e) { return recErr(e.message); }
}

async function apiUpdateRecaudacion(id, fecha, tipo, monto) {
    try {
        const { error } = await dbRec.from('recaudaciones').update({ fecha, tipo, monto: Number(monto) }).eq('id', id);
        if (error) throw error;
        _notificarCambio('recaudaciones');
        _audit('Actualizar Recaudación',
            'Fecha: ' + (fecha || '') + ' | Tipo: ' + (tipo || '') + ' | Monto: ' + _fmtM(monto) + ' | ID: ' + String(id).slice(0, 8),
            { id, tipo, fecha: fecha || '', monto: Number(monto) || 0 });
        return recOk('Dato actualizado.');
    } catch(e) { return recErr(e.message); }
}

async function apiDeleteRecaudacion(id) {
    try {
        // Capturar detalles antes de borrar para dejarlos en la auditoría
        let prev = null;
        try { const r = await dbRec.from('recaudaciones').select('fecha, tipo, monto').eq('id', id).maybeSingle(); prev = r.data; } catch(e) {}
        const { error } = await dbRec.from('recaudaciones').delete().eq('id', id);
        if (error) throw error;
        _notificarCambio('recaudaciones');
        _audit('Eliminar Recaudación',
            prev ? ('Fecha: ' + (prev.fecha || '') + ' | Tipo: ' + (prev.tipo || '') + ' | Monto: ' + _fmtM(prev.monto)) : ('ID: ' + String(id).slice(0, 8)),
            { id, tipo: prev?.tipo || '', fecha: prev?.fecha || '', monto: Number(prev?.monto) || 0 });
        return recOk('Dato eliminado.');
    } catch(e) { return recErr(e.message); }
}

async function apiUpdateSaldo(fecha, monto) {
    try {
        const { error } = await dbRec.from('saldo_fondo').upsert({ id: 'main', fecha, monto: Number(monto) }, { onConflict: 'id' });
        if (error) throw error;
        _audit('Registrar Saldo Fondo',
            'Fecha: ' + (fecha || '') + ' | Monto: ' + _fmtM(monto),
            { fecha: fecha || '', monto: Number(monto) || 0 });
        return recOk('Saldo actualizado.');
    } catch(e) { return recErr(e.message); }
}

async function apiAddNota(autor, mensaje) {
    try {
        const { error } = await dbRec.from('notas_recaudacion').insert({ id: crypto.randomUUID(), autor: autor || 'Sistema', mensaje });
        if (error) throw error;
        _notificarCambio('notas');
        return recOk('Nota agregada.');
    } catch(e) { return recErr(e.message); }
}

async function apiDeleteNota(id) {
    try {
        const { error } = await dbRec.from('notas_recaudacion').delete().eq('id', id);
        if (error) throw error;
        _notificarCambio('notas');
        return recOk('Nota eliminada.');
    } catch(e) { return recErr(e.message); }
}

async function apiTogglePin(id, pinned) {
    const { error } = await dbRec.from('notas_recaudacion').update({ pinned }).eq('id', id);
    if (error) throw error;
    _notificarCambio('notas');
    return recOk('ok');
}

async function apiToggleReaction(id, emoji, add, user = 'Admin') {
    const { data } = await dbRec.from('notas_recaudacion').select('reactions').eq('id', id).maybeSingle();
    const r = data?.reactions || {};
    const arr = Array.isArray(r[emoji]) ? [...r[emoji]] : [];
    const pos = arr.indexOf(user);
    if (add && pos === -1) arr.push(user);
    else if (!add && pos !== -1) arr.splice(pos, 1);
    if (arr.length === 0) delete r[emoji]; else r[emoji] = arr;
    const { error } = await dbRec.from('notas_recaudacion').update({ reactions: r }).eq('id', id);
    if (error) throw error;
    _notificarCambio('notas');
    return recOk(r);
}

async function apiUpdateDivisor(fecha, divisor) {
    try {
        if (!divisor || Number(divisor) <= 0) {
            const { error } = await dbRec.from('divisores').delete().eq('fecha', fecha);
            if (error) throw error;
        } else {
            // Upsert por fecha: si la fecha ya existe, sobrescribe el valor y conserva el id
            // de la fila (no se pasa id → en INSERT lo genera el default; en UPDATE no cambia).
            const { error } = await dbRec.from('divisores').upsert({ fecha, valor: Number(divisor) }, { onConflict: 'fecha' });
            if (error) throw error;
        }
        _notificarCambio('divisores');
        const _divN = Number(divisor) || 0;
        _audit('Actualizar Divisor',
            'Fecha: ' + (fecha || '') + (_divN > 0 ? ' | Divisor: ' + _divN : ' | Divisor eliminado'),
            { fecha: fecha || '', divisor: _divN });
        return recOk('Divisor actualizado.');
    } catch(e) { return recErr(e.message); }
}

async function apiImportAll(importData) {
    try {
        const recs = importData.recaudaciones || importData.datos || [];
        const notas = importData.notas || importData.notes || [];
        const divisores = importData.divisores || {};
        const valorPunto = importData.valorPunto || importData.saldoInicialGuardado || {};
        await Promise.all([
            dbRec.from('recaudaciones').delete().neq('id', '__never__'),
            dbRec.from('divisores').delete().neq('id', '__never__'),
            dbRec.from('notas_recaudacion').delete().neq('id', '__never__')
        ]);
        const ops = [];
        if (recs.length > 0) ops.push(dbRec.from('recaudaciones').insert(recs.map(d => ({ id: crypto.randomUUID(), fecha: d.fecha, tipo: d.tipo, monto: Number(d.monto) }))));
        if (notas.length > 0) ops.push(dbRec.from('notas_recaudacion').insert(notas.map(n => ({ id: crypto.randomUUID(), created_at: n.fecha, autor: n.autor, mensaje: n.mensaje }))));
        const divEntries = Object.entries(divisores);
        if (divEntries.length > 0) ops.push(dbRec.from('divisores').insert(divEntries.map(([f, v]) => ({ id: crypto.randomUUID(), fecha: f, valor: Number(v) }))));
        if (valorPunto && valorPunto.fecha && valorPunto.monto) ops.push(dbRec.from('saldo_fondo').upsert({ id: 'main', fecha: valorPunto.fecha, monto: Number(valorPunto.monto) }, { onConflict: 'id' }));
        await Promise.all(ops);
        return recOk('Importación exitosa.');
    } catch(e) { return recErr(e.message); }
}

async function apiClearAll() {
    try {
        await Promise.all([
            dbRec.from('recaudaciones').delete().neq('id', '__never__'),
            dbRec.from('divisores').delete().neq('id', '__never__'),
            dbRec.from('notas_recaudacion').delete().neq('id', '__never__'),
            dbRec.from('saldo_fondo').upsert({ id: 'main', fecha: null, monto: null }, { onConflict: 'id' })
        ]);
        return recOk('Datos reiniciados.');
    } catch(e) { return recErr(e.message); }
}

async function apiClosePeriod() {
    try {
        const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const now = new Date();
        const day = now.getDate();
        let ini, fin;
        if (day < 15) {
            ini = new Date(now.getFullYear(), now.getMonth() - 1, 15);
            fin = new Date(now.getFullYear(), now.getMonth(), 14);
        } else {
            ini = new Date(now.getFullYear(), now.getMonth(), 15);
            fin = new Date(now.getFullYear(), now.getMonth() + 1, 14);
        }
        const nombrePeriodo = `${ini.getDate()} ${MESES[ini.getMonth()]} - ${fin.getDate()} ${MESES[fin.getMonth()]} ${fin.getFullYear()}`;
        const [recRes, divRes, saldoRes, notasRes] = await Promise.all([
            dbRec.from('recaudaciones').select('*').order('fecha'),
            dbRec.from('divisores').select('*'),
            dbRec.from('saldo_fondo').select('*').eq('id', 'main').maybeSingle(),
            dbRec.from('notas_recaudacion').select('*').order('created_at')
        ]);
        const totalGeneral = (recRes.data || []).reduce((s, r) => s + Number(r.monto), 0);
        const snapshot = { recaudaciones: recRes.data || [], divisores: divRes.data || [], saldo: saldoRes.data || null, notas: notasRes.data || [] };
        const { error: archErr } = await dbRec.from('periodos_archivados_rec')
            .upsert({ id: crypto.randomUUID(), nombre: nombrePeriodo, fecha_inicio: ini.toISOString().split('T')[0], fecha_fin: fin.toISOString().split('T')[0], total_rec: totalGeneral, datos: snapshot }, { onConflict: 'nombre' });
        if (archErr) throw archErr;
        await Promise.all([
            dbRec.from('recaudaciones').delete().neq('id', '__never__'),
            dbRec.from('divisores').delete().neq('id', '__never__'),
            dbRec.from('notas_recaudacion').delete().neq('id', '__never__'),
            dbRec.from('saldo_fondo').upsert({ id: 'main', fecha: null, monto: null }, { onConflict: 'id' })
        ]);
        return recOk({ periodo: nombrePeriodo, totalGeneral });
    } catch(e) { return recErr(e.message); }
}

async function callApiRec(action, payload) {
    switch (action) {
        case 'get':           return apiGetRecaudaciones();
        case 'getTotal':      return apiGetTotalArqueo();
        case 'getSaldo':      return apiGetSaldo();
        case 'getNotes':      return apiGetNotas();
        case 'getDivisores':  return apiGetDivisores();
        case 'add':           return apiAddRecaudacion(payload.fecha, payload.tipo, payload.monto);
        case 'update':        return apiUpdateRecaudacion(payload.index || payload.id, payload.fecha, payload.tipo, payload.monto);
        case 'delete':        return apiDeleteRecaudacion(payload.index || payload.id);
        case 'updateSaldo':   return apiUpdateSaldo(payload.fecha, payload.monto);
        case 'addNote':       return apiAddNota(payload.autor, payload.mensaje);
        case 'deleteNote':    return apiDeleteNota(payload.index || payload.id);
        case 'togglePin':     return apiTogglePin(payload.id, payload.pinned);
        case 'toggleReaction': return apiToggleReaction(payload.id, payload.emoji, payload.add, payload.user || 'Admin');
        case 'updateDivisor': return apiUpdateDivisor(payload.fecha, payload.divisor);
        case 'importAll':     return apiImportAll(payload.data || payload);
        case 'clearAll':      return apiClearAll();
        case 'closePeriod':   return apiClosePeriod();
        default:
            console.warn('callApiRec: acción desconocida:', action);
            return recErr('Acción no implementada: ' + action);
    }
}

// ── Realtime broadcast: recargar UI cuando otra app cambia datos ───────────────
window.addEventListener('load', () => {
    let _rt = null;
    const _reload = () => { clearTimeout(_rt); _rt = setTimeout(() => { if (typeof window._diarioReload === 'function') window._diarioReload(); }, 500); };

    _recBroadcast
        .on('broadcast', { event: 'changed' }, _reload)
        .subscribe();
});
