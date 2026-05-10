document.addEventListener('DOMContentLoaded', () => {

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(() => console.log('Service Worker registrado'))
            .catch(err => console.log('Fallo registro SW:', err));
    }

    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz_kCb4aEe437zHGbRqnjCibw1NtAqfCbTNmsVPn9jaZOPBFaZ6-FwmiTLqVxq39X1P/exec';
    let datos = [], notes = [], divisores = {}, editIndex = -1, minimizado = true, sortOrder = 'desc', currentPanel = 'agregarPanel', currentUser = '';

    // --- TOAST ---
    function showToast(msg, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-circle-xmark'}" style="color:${type === 'success' ? 'var(--secondary)' : 'var(--danger)'}"></i> ${msg}`;
        container.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 400); }, 3000);
    }

    // --- CONFIRM MODAL ---
    function customConfirm(title, msg) {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirmModal');
            document.getElementById('confirmTitle').textContent = title;
            document.getElementById('confirmMsg').textContent = msg;
            modal.style.display = 'flex';
            document.getElementById('confirmBtnYes').onclick = () => { modal.style.display = 'none'; resolve(true); };
            document.getElementById('confirmBtnNo').onclick  = () => { modal.style.display = 'none'; resolve(false); };
        });
    }

    // --- PANEL SWITCHING ---
    function switchPanel(targetId) {
        currentPanel = targetId;
        document.querySelectorAll('.content-panel').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.menu-link, .bottom-nav-link').forEach(l => l.classList.remove('active-link'));
        document.getElementById(targetId).classList.add('active');
        document.querySelectorAll(`[data-target="${targetId}"]`).forEach(l => l.classList.add('active-link'));
        if (targetId === 'notasPanel') {
            localStorage.setItem('lastNote', Date.now());
            checkNotesInd();
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    document.querySelectorAll('.menu-link, .bottom-nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchPanel(link.dataset.target);
        });
    });

    // --- FAB BUTTONS ---
    const btnUp = document.getElementById('btnScrollUp');
    const btnNotesFab = document.getElementById('btnNotesFab');
    window.onscroll = () => { btnUp.style.display = (window.scrollY > 400) ? 'flex' : 'none'; };
    btnUp.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
    btnNotesFab.onclick = () => switchPanel('notasPanel');

    // --- CONTEXTUAL HELP TIPS ---
    const HELP_TIPS = {
        valorPunto: {
            title: 'Total Valor por Punto',
            content: `Es la suma acumulada de todos los <strong>Resultados de Noche</strong> del historial.<br><br>
                Cada resultado se obtiene dividiendo el <em>Total Noche</em> de un día entre la cantidad de personas o puntos que ingresaste para ese día.`
        },
        categorias: {
            title: 'Categorías de Recaudación',
            content: `Selecciona el tipo de ingreso que estás registrando:<br><br>
                <strong>TarjetaMDA</strong> — Ingresos por pago con tarjeta.<br>
                <strong>EfectivoMDA</strong> — Ingresos en efectivo.<br>
                <strong>SalaDeJuegos</strong> — Recaudación de la sala de juegos.<br>
                <strong>Boveda</strong> — Fondos de bóveda o caja fuerte.`
        },
        divisor: {
            title: 'Cantidad de Personas / Puntos',
            content: `Ingresa cuántas personas o puntos participan en la distribución de esa noche.<br><br>
                El sistema divide el <strong>Total Noche</strong> entre este número y muestra el resultado en <strong>Resultado Noche</strong>.<br><br>
                El valor que ingresas aquí se guarda automáticamente en la nube.`
        },
        vaciarTodo: {
            title: '⚠️ Acción Irreversible',
            content: `Este botón elimina <strong>absolutamente todos los datos</strong> del sistema: registros, notas y divisores guardados.<br><br>
                Antes de continuar, asegúrate de haber descargado un <strong>Backup</strong> con el botón "Exportar Backup" para conservar una copia de seguridad.`
        },
        cerrarPeriodo: {
            title: 'Guardar Período',
            content: `Archiva todos los datos del período actual en una <strong>nueva pestaña de Google Sheets</strong> con el nombre del período (ej: <em>15 Abr - 14 May 2026</em>).<br><br>
                Luego <strong>borra los registros</strong> de trabajo (datos, divisores, saldo) para comenzar el siguiente período en limpio.<br><br>
                Los períodos van del <strong>día 15 de un mes al 14 del siguiente</strong>. Usa este botón cuando termines el ciclo.`
        }
    };

    window.showHelpTip = (key) => {
        const tip = HELP_TIPS[key];
        document.getElementById('helpTipTitle').textContent = tip.title;
        document.getElementById('helpTipContent').innerHTML = tip.content;
        document.getElementById('helpTipModal').style.display = 'flex';
    };

    // --- LOADER ---
    const showLoad = (s, msg = 'Sincronizando...') => {
        document.getElementById('loaderMsg').textContent = msg;
        document.getElementById('globalLoader').style.display = s ? 'flex' : 'none';
    };

    // --- FORMATTERS ---
    const formatearMonto = (input) => {
        let v = input.value.replace(/\D/g, '');
        input.value = v ? parseInt(v).toLocaleString('es-ES') : '';
    };
    window.formatearMonto = formatearMonto;

    const fNum = (n) => `$${Math.round(n || 0).toLocaleString('es-ES')}`;
    const fFec = (f) => {
        const d = new Date(f + 'T12:00:00');
        return d.toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    // --- API ---
    async function api(params) {
        const url = new URL(SCRIPT_URL);
        Object.keys(params).forEach(k => url.searchParams.append(k, params[k]));
        return fetch(url).then(r => r.json());
    }

    async function post(data) {
        return fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(data) }).then(r => r.json());
    }

    async function cargar(loader = true) {
        if (loader) showLoad(true);
        try {
            const [d, n, div] = await Promise.all([
                api({ action: 'get' }),
                api({ action: 'getNotes' }),
                api({ action: 'getDivisores' })
            ]);
            datos = d.data || [];
            notes = n.data || [];
            divisores = div.data || {};
            render();
            checkNotesInd();
        } finally {
            if (loader) showLoad(false);
        }
    }

    // --- AUTO-SYNC NOTES (every 30s) ---
    setInterval(async () => {
        if (document.visibilityState === 'visible' && currentUser) {
            const nRes = await api({ action: 'getNotes' });
            if (nRes.status === 'success') {
                const oldLen = notes.length;
                notes = nRes.data;
                if (notes.length > oldLen && currentPanel !== 'notasPanel') {
                    showToast('Mensaje nuevo de ' + (notes[0].autor || 'Sistema'));
                }
                checkNotesInd();
                if (currentPanel === 'notasPanel') renderNotes();
            }
        }
    }, 30000);

    // --- NOTE INDICATORS ---
    function checkNotesInd() {
        const last = parseInt(localStorage.getItem('lastNote')) || 0;
        const hasNew = notes.some(n => new Date(n.fecha).getTime() > last);
        document.getElementById('ind-notas').style.display = hasNew ? 'block' : 'none';
        document.getElementById('ind-notas-bottom').style.display = hasNew ? 'block' : 'none';
        document.getElementById('btnNotesFab').style.display = (hasNew && currentPanel !== 'notasPanel') ? 'flex' : 'none';
    }

    // --- RENDER HISTORIAL ---
    function render() {
        const totalRec = datos.reduce((s, d) => s + d.monto, 0);
        document.getElementById('tot-rec').textContent = fNum(totalRec);

        const grouped = datos.reduce((acc, d) => {
            (acc[d.fecha] = acc[d.fecha] || []).push(d);
            return acc;
        }, {});
        const sorted = Object.keys(grouped).sort((a, b) =>
            sortOrder === 'desc' ? new Date(b) - new Date(a) : new Date(a) - new Date(b)
        );

        let totDiv = 0;
        const container = document.getElementById('tablaContainer');
        container.innerHTML = '';

        sorted.forEach((fecha, i) => {
            const diaTot = grouped[fecha].reduce((s, d) => s + d.monto, 0);
            const divVal = divisores[fecha] || 0;
            const resDiv = divVal > 0 ? diaTot / divVal : 0;
            totDiv += resDiv;

            const filtroVal = document.getElementById('filtro').value;
            if (filtroVal && !fecha.includes(filtroVal)) return;
            if (minimizado && i > 0 && !filtroVal) return;

            const rows = grouped[fecha].map(d => `
                <tr>
                    <td style="font-weight:700; color:var(--primary)">${d.tipo}</td>
                    <td><strong>${fNum(d.monto)}</strong></td>
                    <td style="text-align:right">
                        <button onclick="abrirEd(${d.originalIndex})" class="btn btn-outline btn-sm"><i class="fas fa-pencil"></i></button>
                        <button onclick="borrar(${d.originalIndex})" class="btn btn-danger btn-sm"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`).join('');

            container.innerHTML += `
                <div class="day-group">
                    <div class="day-header">
                        <strong>${fFec(fecha)}</strong>
                        <button onclick="copyRep('${fecha}')" class="btn btn-outline btn-sm"><i class="fas fa-copy"></i> Copiar</button>
                    </div>
                    <div class="table-res"><table><tbody>${rows}</tbody></table></div>
                    <div class="day-footer">
                        <div class="footer-row">
                            <div>
                                <span style="font-size:0.75rem; color:var(--text-muted); font-weight:800;">TOTAL NOCHE</span>
                                <br><strong>${fNum(diaTot)}</strong>
                            </div>
                            <div class="divisor-box">
                                <span style="font-size:0.8rem; font-weight:700; display:flex; align-items:center; gap:5px;">
                                    Cant. Pers. Ptos.
                                    <button class="help-tip-btn" onclick="showHelpTip('divisor')">?</button>
                                </span>
                                <input type="number" class="divisor-input" value="${divVal || ''}" onchange="updDiv('${fecha}', this.value)">
                            </div>
                            <div style="text-align:right">
                                <span style="font-size:0.75rem; color:var(--secondary); font-weight:800;">RESULTADO NOCHE</span>
                                <br><strong style="color:var(--secondary); font-size:1.2rem">${fNum(resDiv)}</strong>
                            </div>
                        </div>
                    </div>
                </div>`;
        });

        document.getElementById('tot-div').textContent = fNum(totDiv);
        renderNotes();
    }

    // --- RENDER NOTES ---
    function renderNotes() {
        const last = parseInt(localStorage.getItem('lastNote')) || 0;
        const sortedNotes = [...notes].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        document.getElementById('notesContainer').innerHTML = sortedNotes.map(n => `
            <div class="card note-card" style="border-left-color:${new Date(n.fecha).getTime() > last ? 'var(--warning)' : 'var(--primary)'}">
                <button onclick="borrarNota(${n.originalIndex})" class="note-btn-del"><i class="fas fa-trash"></i></button>
                <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.6rem; font-weight:600;">
                    Por <span class="note-author">${n.autor || 'Desconocido'}</span> — ${new Date(n.fecha).toLocaleString()}
                </div>
                <div style="font-size:1rem; line-height:1.6;">${n.mensaje}</div>
            </div>`).join('') || '<p style="text-align:center; color:var(--text-muted);">Sin notas guardadas.</p>';
    }

    // --- COPY REPORT ---
    window.copyRep = (fecha) => {
        const ds = datos.filter(x => x.fecha === fecha);
        const total = ds.reduce((s, d) => s + d.monto, 0);
        const div = divisores[fecha] || 0;
        const res = div > 0 ? total / div : 0;

        let txt = `📊 REPORTE: ${fFec(fecha)}\n--------------------------------\n`;
        ds.forEach(x => txt += `• ${x.tipo}: ${fNum(x.monto)}\n`);
        txt += `--------------------------------\n`;
        txt += `💰 TOTAL DÍA: ${fNum(total)}\n`;
        txt += `✅ RESULTADO NOCHE: ${fNum(res)}`;

        navigator.clipboard.writeText(txt).then(() => showToast('Reporte copiado'));
    };

    // --- DELETE NOTE ---
    window.borrarNota = async (idx) => {
        if (await customConfirm('¿Eliminar nota?', '¿Borrar este mensaje para siempre?')) {
            showLoad(true, 'Borrando...');
            await post({ action: 'deleteNote', index: idx });
            showToast('Nota eliminada');
            await cargar();
        }
    };

    // --- UPDATE DIVISOR ---
    window.updDiv = async (fecha, val) => {
        divisores[fecha] = val;
        render();
        await post({ action: 'updateDivisor', fecha, divisor: val });
    };

    // --- HISTORIAL CONTROLS ---
    document.getElementById('btnSortDesc').onclick = () => { sortOrder = 'desc'; render(); };
    document.getElementById('btnSortAsc').onclick  = () => { sortOrder = 'asc';  render(); };
    document.getElementById('btnMin').onclick      = () => { minimizado = !minimizado; render(); };
    document.getElementById('filtro').oninput      = render;

    // --- NEW NOTE ---
    document.getElementById('btnNota').onclick = async () => {
        const msg = document.getElementById('notaMsg').value.trim();
        if (!msg) return;
        showLoad(true, 'Enviando...');
        await post({ action: 'addNote', autor: currentUser, mensaje: msg });
        document.getElementById('notaMsg').value = '';
        showToast('Mensaje publicado');
        await cargar();
    };

    // --- ADD RECORD ---
    document.getElementById('agregarForm').onsubmit = async (e) => {
        e.preventDefault();
        showLoad(true, 'Guardando...');
        const tipo = document.querySelector('input[name="tipo"]:checked').value;
        await post({
            action: 'add', tipo,
            fecha: document.getElementById('fecha').value,
            monto: parseInt(document.getElementById('monto').value.replace(/\./g, ''))
        });
        document.getElementById('agregarForm').reset();
        document.getElementById('fecha').value = new Date().toISOString().split('T')[0];
        showToast('Dato registrado');
        await cargar();
    };

    // --- EDIT RECORD ---
    window.abrirEd = (idx) => {
        editIndex = idx;
        const d = datos.find(x => x.originalIndex === idx);
        document.getElementById('edTipo').value  = d.tipo;
        document.getElementById('edFecha').value = d.fecha;
        document.getElementById('edMonto').value = d.monto.toLocaleString('es-ES');
        document.getElementById('editModal').style.display = 'flex';
    };

    document.getElementById('btnSaveEd').onclick = async () => {
        showLoad(true, 'Actualizando...');
        await post({
            action: 'update', sheetIndex: editIndex,
            tipo:  document.getElementById('edTipo').value,
            fecha: document.getElementById('edFecha').value,
            monto: parseInt(document.getElementById('edMonto').value.replace(/\./g, ''))
        });
        document.getElementById('editModal').style.display = 'none';
        showToast('Actualizado con éxito');
        await cargar();
    };

    // --- DELETE RECORD ---
    window.borrar = async (idx) => {
        if (await customConfirm('¿Eliminar registro?', 'Esta acción no se puede deshacer.')) {
            showLoad(true, 'Borrando...');
            await post({ action: 'delete', index: idx });
            showToast('Borrado');
            await cargar();
        }
    };

    // --- EXPORT BACKUP ---
    document.getElementById('btnExport').onclick = () => {
        const blob = new Blob([JSON.stringify({ datos, notes, divisores }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_${currentUser}_${new Date().toLocaleDateString()}.json`;
        a.click();
        showToast('Backup generado');
    };

    // --- IMPORT JSON BACKUP ---
    document.getElementById('btnImportTrigger').onclick = () => document.getElementById('jsonInput').click();
    document.getElementById('jsonInput').onchange = (e) => {
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const content = JSON.parse(ev.target.result);
            if (await customConfirm('¿Restaurar backup?', 'Se reemplazarán todos los datos actuales con los del backup.')) {
                showLoad(true, 'Restaurando...');
                await post({ action: 'importAll', data: content });
                showToast('Restauración completa');
                await cargar();
            }
        };
        reader.readAsText(e.target.files[0]);
    };

    // --- CLEAR ALL ---
    document.getElementById('btnLimpiar').onclick = async () => {
        if (await customConfirm('⚠️ Vaciar Todo', '¿Eliminar TODOS los datos del sistema? Esta acción no se puede deshacer.')) {
            showLoad(true, 'Vaciando...');
            await post({ action: 'clearAll' });
            showToast('Todos los datos fueron eliminados');
            await cargar();
        }
    };

    // --- CLOSE PERIOD ---
    function getPeriodo() {
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
        return `${ini.getDate()} ${MESES[ini.getMonth()]} - ${fin.getDate()} ${MESES[fin.getMonth()]} ${fin.getFullYear()}`;
    }

    document.getElementById('btnCerrarPeriodo').onclick = async () => {
        const periodo = getPeriodo();
        if (await customConfirm(
            'Guardar Período',
            `¿Archivar el período "${periodo}"?\n\nSe creará una pestaña en Google Sheets con todos los datos actuales y se borrarán los registros para comenzar el siguiente período.`
        )) {
            showLoad(true, 'Archivando período...');
            try {
                const res = await post({ action: 'closePeriod' });
                if (res.status === 'success') {
                    showToast(`Período "${res.data.periodo}" archivado con éxito`);
                    await cargar();
                } else {
                    showLoad(false);
                    showToast(res.message || 'Error al cerrar período', 'danger');
                }
            } catch (e) {
                showLoad(false);
                showToast('Error de conexión', 'danger');
            }
        }
    };

    // --- LOGOUT ---
    document.getElementById('logoutBtn').onclick = () => {
        sessionStorage.clear();
        location.reload();
    };

    // --- LOGIN ---
    document.getElementById('loginForm').onsubmit = (e) => {
        e.preventDefault();
        const user = document.getElementById('username').value;
        const pass = document.getElementById('password').value;
        if (!user) { showToast('Elija un usuario', 'danger'); return; }
        if ((user === 'mesas' || user === 'maquinas') && pass === '1234') {
            currentUser = user;
            sessionStorage.setItem('user', user);
            document.getElementById('loginOverlay').style.display = 'none';
            document.getElementById('mainContent').style.display = 'flex';
            document.body.classList.add('loggedin');
            document.getElementById('activeUserBadge').textContent = 'SESIÓN: ' + user.toUpperCase();
            document.getElementById('fecha').value = new Date().toISOString().split('T')[0];
            cargar();
        } else {
            showToast('Clave incorrecta', 'danger');
        }
    };

    // --- TOGGLE PASSWORD ---
    document.getElementById('toggleLoginPassword').onclick = function () {
        const p = document.getElementById('password');
        p.type = p.type === 'password' ? 'text' : 'password';
        this.classList.toggle('fa-eye');
        this.classList.toggle('fa-eye-slash');
    };

    // --- AUTO-LOGIN FROM SESSION ---
    const savedUser = sessionStorage.getItem('user');
    if (savedUser) {
        currentUser = savedUser;
        document.getElementById('username').value = savedUser;
        document.getElementById('password').value = '1234';
        document.getElementById('loginForm').dispatchEvent(new Event('submit'));
    }
});
