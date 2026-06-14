// ============================================================
// SUPABASE API — reemplaza Google Apps Script en diario.propi
// Casino de Puerto Varas — Fondo Solidario de Propina
// ============================================================

const SUPABASE_URL_REC = 'https://lpulmjzboogixbdxxayo.supabase.co';
const SUPABASE_KEY_REC = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwdWxtanpib29naXhiZHh4YXlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NjY0NzMsImV4cCI6MjA5MTI0MjQ3M30.vjebyQb4Bb62ZQlNaJZveuxdBYDOmtC4bM7uwAilDzY';

const dbRec = supabase.createClient(SUPABASE_URL_REC, SUPABASE_KEY_REC);

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
            divisor: divisoresPorFecha[r.fecha] ? Number(divisoresPorFecha[r.fecha]) : null
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
        const mapped = (data || []).map(n => ({ originalIndex: n.id, fecha: n.created_at, autor: n.autor, mensaje: n.mensaje, pinned: n.pinned || false, reactions: n.reactions || {} }));
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

async function apiAddRecaudacion(fecha, tipo, monto) {
    try {
        const { error } = await dbRec.from('recaudaciones').insert({ id: crypto.randomUUID(), fecha, tipo: tipo || 'Sin Tipo', monto: Number(monto) });
        if (error) throw error;
        _notificarCambio('recaudaciones');
        return recOk('Dato agregado.');
    } catch(e) { return recErr(e.message); }
}

async function apiUpdateRecaudacion(id, fecha, tipo, monto) {
    try {
        const { error } = await dbRec.from('recaudaciones').update({ fecha, tipo, monto: Number(monto) }).eq('id', id);
        if (error) throw error;
        _notificarCambio('recaudaciones');
        return recOk('Dato actualizado.');
    } catch(e) { return recErr(e.message); }
}

async function apiDeleteRecaudacion(id) {
    try {
        const { error } = await dbRec.from('recaudaciones').delete().eq('id', id);
        if (error) throw error;
        _notificarCambio('recaudaciones');
        return recOk('Dato eliminado.');
    } catch(e) { return recErr(e.message); }
}

async function apiUpdateSaldo(fecha, monto) {
    try {
        const { error } = await dbRec.from('saldo_fondo').upsert({ id: 'main', fecha, monto: Number(monto) }, { onConflict: 'id' });
        if (error) throw error;
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

async function apiToggleReaction(id, emoji, add) {
    const { data } = await dbRec.from('notas_recaudacion').select('reactions').eq('id', id).maybeSingle();
    const r = data?.reactions || {};
    if (add) r[emoji] = (r[emoji] || 0) + 1;
    else { r[emoji] = Math.max(0, (r[emoji] || 0) - 1); if (r[emoji] === 0) delete r[emoji]; }
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
            const { error } = await dbRec.from('divisores').upsert({ id: crypto.randomUUID(), fecha, valor: Number(divisor) }, { onConflict: 'fecha' });
            if (error) throw error;
        }
        _notificarCambio('divisores');
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
        case 'toggleReaction': return apiToggleReaction(payload.id, payload.emoji, payload.add);
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
