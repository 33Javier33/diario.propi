// ══════════════════════════════════════════════════════════════════════
// ENTRAR CON HUELLA O ROSTRO  (opcional, además del PIN)
//
// CÓMO FUNCIONA
// Se usa WebAuthn con el sensor del propio dispositivo. Al activarlo, el
// teléfono crea una credencial y acá se guarda SOLO SU IDENTIFICADOR, en
// este dispositivo, junto con a quién corresponde (área, nombre, id). La
// huella en sí nunca sale del teléfono ni la ve la app.
//
// QUÉ NO ES, y hay que decirlo
// No hay servidor que verifique la firma: es un CANDADO LOCAL. Y acá
// importa más que en Horarios, porque el PIN de diario.propi SÍ se
// verifica en el servidor en cada ingreso. Entrando con huella ese paso no
// ocurre: lo que vale es que el dispositivo reconoció a su dueño y que
// ANTES, en este mismo dispositivo, alguien entró con el PIN correcto.
//
// Por eso:
//   · solo se puede activar DESPUÉS de un ingreso con PIN bueno;
//   · el PIN sigue arriba, siempre disponible;
//   · es por dispositivo, y se puede apagar cuando se quiera.
//
// El PIN NO se guarda en ninguna parte. Nunca.
// ══════════════════════════════════════════════════════════════════════
(function () {
    'use strict';
    const BIO_KEY = 'diario_biometria';

    function bioSoportada() {
        return !!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.create);
    }
    async function bioHaySensor() {
        if (!bioSoportada()) return false;
        try { return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); }
        catch (e) { return false; }
    }
    function bioGuardada() {
        try { return JSON.parse(localStorage.getItem(BIO_KEY) || 'null'); } catch (e) { return null; }
    }
    function bioOlvidar() { try { localStorage.removeItem(BIO_KEY); } catch (e) {} }

    const b64uTexto = buf => btoa(String.fromCharCode(...new Uint8Array(buf)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const b64uBuf = s => { const b = atob(String(s).replace(/-/g, '+').replace(/_/g, '/'));
        const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u.buffer; };
    const reto = () => { const u = new Uint8Array(32); crypto.getRandomValues(u); return u.buffer; };

    // Registrar. Se llama solo tras un ingreso con PIN correcto.
    async function bioRegistrar(datos) {
        if (!bioSoportada()) throw new Error('Este dispositivo no admite huella ni rostro');
        const cred = await navigator.credentials.create({ publicKey: {
            challenge: reto(),
            rp: { name: 'Diario de Recaudaciones' },
            user: { id: new TextEncoder().encode(String(datos.socioId)),
                    name: String(datos.nombre || datos.socioId), displayName: String(datos.nombre || datos.socioId) },
            pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
            authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
            timeout: 60000, attestation: 'none'
        }});
        if (!cred) throw new Error('No se pudo registrar');
        try {
            localStorage.setItem(BIO_KEY, JSON.stringify({
                credId: b64uTexto(cred.rawId), socioId: datos.socioId, nombre: datos.nombre,
                area: datos.area, foto: datos.foto || '', desde: Date.now()
            }));
        } catch (e) { throw new Error('No se pudo guardar en este dispositivo'); }
        return true;
    }

    async function bioVerificar() {
        const g = bioGuardada();
        if (!g || !bioSoportada()) return null;
        const as = await navigator.credentials.get({ publicKey: {
            challenge: reto(),
            allowCredentials: [{ type: 'public-key', id: b64uBuf(g.credId) }],
            userVerification: 'required', timeout: 60000
        }});
        return as ? g : null;
    }

    // ── El botón de la pantalla de ingreso ──
    async function bioPintarLogin() {
        const b = document.getElementById('btnHuella');
        if (!b) return;
        const g = bioGuardada();
        if (!g || !bioSoportada() || !(await bioHaySensor())) { b.style.display = 'none'; return; }
        b.style.display = 'flex';
        b.innerHTML = '👆 Entrar como <b style="margin-left:3px">' + String(g.nombre || '').replace(/[<>&]/g, '') + '</b>';
    }

    window.bioEntrar = async function () {
        const b = document.getElementById('btnHuella');
        if (b) { b.disabled = true; b.style.opacity = '0.6'; }
        try {
            const g = await bioVerificar();
            if (!g) throw new Error('No se reconoció');
            if (typeof window.bioAbrirSesion === 'function') window.bioAbrirSesion(g);
        } catch (e) {
            const msg = (e && e.name === 'NotAllowedError') ? 'Se canceló' : 'No se pudo entrar con huella';
            if (typeof showToast === 'function') showToast(msg, 'danger'); else alert(msg);
        } finally {
            if (b) { b.disabled = false; b.style.opacity = '1'; }
        }
    };

    // ── Activarla o apagarla desde adentro ──
    window.bioToggle = async function () {
        if (!bioSoportada()) {
            if (typeof showToast === 'function') showToast('Este dispositivo no admite huella ni rostro', 'danger');
            return;
        }
        if (bioGuardada()) {
            if (!confirm('¿Dejar de entrar con huella o rostro en este dispositivo?\n\nSeguirás entrando con tu PIN.')) return;
            bioOlvidar();
            if (typeof showToast === 'function') showToast('Huella desactivada', 'success');
            window.bioPintarAjuste();
            return;
        }
        if (!(await bioHaySensor())) {
            if (typeof showToast === 'function') showToast('Este dispositivo no tiene huella ni rostro configurados', 'danger');
            return;
        }
        const socioId = sessionStorage.getItem('user_socioId');
        if (!socioId) {
            if (typeof showToast === 'function') showToast('Primero ingresa con tu PIN', 'danger');
            return;
        }
        try {
            await bioRegistrar({ socioId, nombre: sessionStorage.getItem('user') || socioId,
                                 area: sessionStorage.getItem('user_area') || '',
                                 foto: sessionStorage.getItem('user_foto') || '' });
            if (typeof showToast === 'function') showToast('👆 Listo: ya puedes entrar con huella o rostro', 'success');
        } catch (e) {
            const msg = (e && e.name === 'NotAllowedError') ? 'Se canceló' : ('No se pudo activar: ' + ((e && e.message) || ''));
            if (typeof showToast === 'function') showToast(msg, 'danger');
        }
        window.bioPintarAjuste();
    };

    // El interruptor dentro de la app (lo pinta quien tenga dónde ponerlo).
    window.bioPintarAjuste = async function () {
        const b = document.getElementById('btnHuellaAjuste');
        if (!b) return;
        if (!bioSoportada() || !(await bioHaySensor())) { b.style.display = 'none'; return; }
        b.style.display = '';
        const on = !!bioGuardada();
        b.innerHTML = on ? '👆 Huella activada ✓' : '👆 Entrar con huella o rostro';
        b.title = on ? 'Tocar para desactivarla en este dispositivo' : 'Activarla en este dispositivo';
    };

    window.bioSoportada = bioSoportada;
    window.bioHaySensor = bioHaySensor;
    window.bioGuardada = bioGuardada;
    window.bioOlvidar = bioOlvidar;
    window.bioRegistrar = bioRegistrar;
    window.bioVerificar = bioVerificar;
    window.bioPintarLogin = bioPintarLogin;
})();
