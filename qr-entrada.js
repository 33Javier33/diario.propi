// ============================================================
// ENTRADA POR QR
//
// El QR que emite la administración trae un código opaco, no los datos del
// socio: `?qr=<32 hex>`. Acá se canjea contra Supabase y con lo que vuelve se
// dejan puestos el área y el nombre, igual que hace el atajo guardado
// (favAplicar): al socio solo le queda el PIN.
//
// El código sale de la barra de direcciones en cuanto se lee. Si quedara ahí
// se iría al historial del navegador y a cualquier captura de pantalla.
//
// El mismo código sirve una vez en esta app y una vez en propi.solicitada.
// ============================================================

// El código se guarda en sessionStorage en cuanto se lee, y solo entonces sale
// de la URL.
//
// Acá es todavía más necesario que en propi.solicitada: este Service Worker se
// activa de inmediato (skipWaiting), así que en la primera visita toma el
// control y la página se recarga sola. Sin guardar el código, esa recarga se lo
// lleva y el QR no sirve.
//
// sessionStorage sobrevive la recarga y muere al cerrar la pestaña.
const QR_GUARDADO = 'qr_token_pendiente';

function _qrTomarToken() {
    let t = '';
    try { t = new URLSearchParams(location.search).get('qr') || ''; } catch (e) { t = ''; }
    if (t) {
        try { sessionStorage.setItem(QR_GUARDADO, t); } catch (e) {}
        try {
            const limpia = location.pathname + location.hash;
            history.replaceState(null, '', limpia || '/');
        } catch (e) {}
    } else {
        try { t = sessionStorage.getItem(QR_GUARDADO) || ''; } catch (e) { t = ''; }
    }
    return /^[a-f0-9]{16,64}$/i.test(t) ? t : '';
}

function _qrOlvidarToken() {
    try { sessionStorage.removeItem(QR_GUARDADO); } catch (e) {}
}

function _qrMensajeDeError(motivo) {
    return ({
        no_existe:      'Ese código no existe. Pide uno nuevo en la administración.',
        revocado:       'Ese código fue reemplazado por uno más nuevo. Pide el último.',
        vencido:        'Ese código ya venció. Pide uno nuevo en la administración.',
        ya_usado:       'Ese código ya se usó para entrar acá. Pide uno nuevo si lo necesitas.',
        socio_inactivo: 'Tu cuenta está marcada como inactiva. Habla con la administración.',
        socio_no_existe:'Ese socio ya no está en la base.'
    })[motivo] || 'Tu código no es válido.';
}

// Lo llama el arranque del login. No devuelve nada: si algo falla, el socio
// entra como siempre eligiendo área y nombre a mano.
async function qrIntentarEntradaDiario() {
    const token = _qrTomarToken();
    if (!token) return false;

    const hint = document.getElementById('loginHint');
    const avisar = (msg, color) => {
        if (!hint) return;
        hint.textContent = msg;
        hint.style.color = color;
        hint.style.display = msg ? 'block' : 'none';
    };
    avisar('Leyendo tu código...', '#1a6fa0');

    let res = null;
    try {
        const { data, error } = await dbSoc.rpc('rpc_canjear_vinculo_qr',
            { p_token: token, p_app: 'diario' });
        if (error) throw new Error(error.message);
        res = data;
    } catch (e) {
        // Falla de red: el código NO se olvida, para poder reintentar al recargar.
        avisar('No se pudo leer tu código. Entra eligiendo tu área y tu nombre.', '#b45309');
        return false;
    }
    _qrOlvidarToken();   // ya se canjeó: no se reintenta en la próxima recarga

    if (!res || res.ok !== true) {
        avisar(_qrMensajeDeError(res && res.motivo), '#b45309');
        return false;
    }

    const s = res.socio;
    const selA = document.getElementById('loginArea');
    const selU = document.getElementById('username');
    if (!selA || !selU) return false;

    // El área guardada en la ficha puede venir con otra capitalización que la
    // del select ("mesas" vs "Mesas"), así que se busca sin distinguir.
    const areaFicha = String(s.area || '').trim().toLowerCase();
    const opcionArea = [...selA.options].find(o => String(o.value).trim().toLowerCase() === areaFicha);
    if (!opcionArea) {
        avisar('Tu área (' + (s.area || '—') + ') no está en la lista. Elígela a mano.', '#b45309');
        return false;
    }
    selA.value = opcionArea.value;
    if (selA.onchange) await selA.onchange();      // carga los socios del área

    const opciones = [...selU.options].filter(o => o.value);
    if (!opciones.length) {
        avisar('No se pudo cargar la lista de tu área. Vuelve a intentar.', '#b45309');
        return false;
    }
    if (!opciones.some(o => o.value === s.id)) {
        avisar('No apareces en tu área. Habla con la administración.', '#b45309');
        return false;
    }
    selU.value = s.id;
    if (selU.onchange) await selU.onchange();      // deja el aviso de PIN que corresponda

    const pin = document.getElementById('password');
    if (pin) { pin.value = ''; setTimeout(() => pin.focus(), 120); }
    return true;
}
