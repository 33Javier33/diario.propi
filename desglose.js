// ============================================================
// REGISTRAR CON DESGLOSE
//
// Además de anotar el monto a mano, se puede cargar el conteo por
// denominación, como se hace al verificar en socios-comicion. Con eso:
//
//   · el monto deja de tipearse: sale de la suma, así que no puede quedar
//     un número que no cuadre con lo que hay en el sobre;
//   · lo declarado viaja a socios-comicion y allá la verificación llega con
//     las cantidades ya puestas: el encargado revisa y confirma.
//
// Son DOS juegos de denominaciones, no uno:
//
//   Sala de Juegos → FICHAS, de $1.000.000 a $500.
//   El resto       → billetes y monedas chilenas.
//
// Y se guardan en campos distintos. En Sala de Juegos la noche cuenta fichas
// pero a la bóveda llega efectivo, así que las fichas no deben entrar nunca
// al arqueo de caja. Manteniéndolas separadas, no hay forma de que se cuelen.
//
// Es opcional: el formulario de siempre sigue funcionando igual.
// ============================================================

const DESG_BILLETES = [20000, 10000, 5000, 2000, 1000, 500, 100, 50, 10];
const DESG_FICHAS   = [1000000, 500000, 200000, 100000, 50000, 20000, 10000, 5000, 1000, 500];

function desg_esFichas(tipo) { return tipo === 'SalaDeJuegos'; }
function desg_denoms(tipo)   { return desg_esFichas(tipo) ? DESG_FICHAS : DESG_BILLETES; }

function _desgFmt(n) {
    return '$' + Math.round(Number(n) || 0).toLocaleString('es-CL');
}

function desg_tipoActual() {
    const r = document.querySelector('input[name="tipo"]:checked');
    return r ? r.value : 'TarjetaMDA';
}

// Se vuelve a pintar cuando cambia el tipo: las fichas y los billetes no son
// la misma lista, y dejar la grilla anterior haría contar sobre casillas que
// ya no corresponden.
function desg_pintarGrilla() {
    const cont = document.getElementById('desgGrilla');
    if (!cont) return;
    const tipo = desg_tipoActual();
    const fichas = desg_esFichas(tipo);
    const cabecera = document.getElementById('desgCabecera');
    if (cabecera) {
        cabecera.textContent = fichas
            ? '🎰 Fichas de Sala de Juegos'
            : '💵 Billetes y monedas';
    }
    cont.innerHTML = desg_denoms(tipo).map(v => `
        <div class="desg-fila">
            <span class="desg-den">${_desgFmt(v)}</span>
            <button type="button" class="desg-btn desg-menos" onclick="desg_ajustar(${v},-1)">−</button>
            <input type="number" id="desg-${v}" min="0" placeholder="0" inputmode="numeric"
                   oninput="desg_recalcular()" onkeydown="desg_enter(event,${v})">
            <button type="button" class="desg-btn desg-mas" onclick="desg_ajustar(${v},1)">+</button>
            <span class="desg-sub" id="desg-sub-${v}">$0</span>
        </div>`).join('');
    desg_recalcular();
}

function desg_ajustar(v, paso) {
    const el = document.getElementById('desg-' + v);
    if (!el) return;
    const n = Math.max(0, (parseInt(el.value) || 0) + paso);
    el.value = n === 0 ? '' : n;
    desg_recalcular();
}

// Enter salta a la siguiente denominación, para contar sin soltar el teclado.
function desg_enter(ev, v) {
    if (ev.key !== 'Enter') return;
    ev.preventDefault();
    const lista = desg_denoms(desg_tipoActual());
    const i = lista.indexOf(v);
    const sig = document.getElementById('desg-' + lista[i + 1]);
    if (sig) { sig.focus(); sig.select(); }
}

function desg_leer() {
    const out = {};
    desg_denoms(desg_tipoActual()).forEach(v => {
        const el = document.getElementById('desg-' + v);
        const n = el ? (parseInt(el.value) || 0) : 0;
        if (n > 0) out[v] = n;
    });
    return out;
}

function desg_total() {
    return Object.entries(desg_leer()).reduce((s, [d, n]) => s + Number(d) * Number(n), 0);
}

function desg_recalcular() {
    const tipo = desg_tipoActual();
    desg_denoms(tipo).forEach(v => {
        const el = document.getElementById('desg-' + v);
        const sub = document.getElementById('desg-sub-' + v);
        if (sub) {
            const n = el ? (parseInt(el.value) || 0) : 0;
            sub.textContent = _desgFmt(v * n);
            sub.style.color = n > 0 ? 'var(--primary)' : '';
        }
    });
    const total = desg_total();
    const elTotal = document.getElementById('desgTotal');
    if (elTotal) elTotal.textContent = _desgFmt(total);
    // El monto del formulario pasa a salir de la suma: es el punto de contar.
    const monto = document.getElementById('monto');
    if (monto && desg_activo()) {
        monto.value = total === 0 ? '' : total.toLocaleString('es-CL');
    }
}

function desg_activo() {
    const chk = document.getElementById('desgUsar');
    return !!(chk && chk.checked);
}

function desg_alternar() {
    const panel = document.getElementById('desgPanel');
    const monto = document.getElementById('monto');
    const usar = desg_activo();
    if (panel) panel.style.display = usar ? 'block' : 'none';
    if (monto) {
        monto.readOnly = usar;
        monto.style.background = usar ? 'var(--bg-muted, #f1f5f9)' : '';
        if (usar) { desg_pintarGrilla(); }
        else { monto.value = ''; }
    }
    const nota = document.getElementById('desgNotaMonto');
    if (nota) nota.style.display = usar ? 'block' : 'none';
}

function desg_limpiar() {
    desg_denoms(desg_tipoActual()).forEach(v => {
        const el = document.getElementById('desg-' + v);
        if (el) el.value = '';
    });
    desg_recalcular();
}

// Lo que se manda al guardar. null si no se usó el desglose.
function desg_paraGuardar() {
    if (!desg_activo()) return null;
    const cuentas = desg_leer();
    if (!Object.keys(cuentas).length) return null;
    return desg_esFichas(desg_tipoActual())
        ? { fichas: cuentas }
        : { billetes: cuentas };
}

function desg_enganchar() {
    const chk = document.getElementById('desgUsar');
    if (chk) chk.addEventListener('change', desg_alternar);
    document.querySelectorAll('input[name="tipo"]').forEach(r => {
        r.addEventListener('change', () => { if (desg_activo()) desg_pintarGrilla(); });
    });
}
