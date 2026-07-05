document.addEventListener('DOMContentLoaded', () => {

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(() => console.log('Service Worker registrado'))
            .catch(err => console.log('Fallo registro SW:', err));
    }

    let datos = [], notes = [], divisores = {}, editIndex = -1, minimizado = true, sortOrder = 'desc', currentPanel = 'agregarPanel', currentUser = '';

    function escHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }

    // ── Inactividad (15 minutos) ──────────────────────────────────────────────
    const INACTIVIDAD_MS = 15 * 60 * 1000;
    let _inactivTimeout = null;

    function cerrarSesion(porInactividad = false) {
        clearTimeout(_inactivTimeout);
        sessionStorage.clear();
        if (porInactividad) showToast('Sesión cerrada por inactividad (15 min)', 'danger');
        setTimeout(() => location.reload(), porInactividad ? 1500 : 0);
    }

    function resetearInactividad() {
        if (!sessionStorage.getItem('user')) return;
        clearTimeout(_inactivTimeout);
        _inactivTimeout = setTimeout(() => cerrarSesion(true), INACTIVIDAD_MS);
    }

    function iniciarWatchdogInactividad() {
        ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'].forEach(ev =>
            document.addEventListener(ev, resetearInactividad, { passive: true }));
        resetearInactividad();
    }

    // --- TOAST ---
    function showToast(msg, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-circle-xmark'}" style="color:${type === 'success' ? 'var(--secondary)' : 'var(--danger)'}"></i> ${escHtml(msg)}`;
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
            localStorage.setItem('_rec_last_seen', Date.now());
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
            content: `Archiva todos los datos del período actual en Supabase y limpia los registros activos para comenzar el siguiente período en limpio.<br><br>
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

    // --- API: Supabase via callApiRec() ---
    async function api(params) {
        return callApiRec(params.action, params);
    }

    async function post(data) {
        return callApiRec(data.action, data);
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
                    <td style="font-weight:700; color:var(--primary)">${escHtml(d.tipo)}${d.registrado_por_nombre ? `<br><small style="font-size:0.68em;color:#7f8c8d;font-weight:500">👤 ${escHtml(d.registrado_por_nombre)}</small>` : ''}</td>
                    <td><strong>${fNum(d.monto)}</strong></td>
                    <td style="text-align:right">
                        <button onclick="abrirEd('${d.originalIndex}')" class="btn btn-outline btn-sm"><i class="fas fa-pencil"></i></button>
                        <button onclick="borrar('${d.originalIndex}')" class="btn btn-danger btn-sm"><i class="fas fa-trash"></i></button>
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
        const lastSeen = parseInt(localStorage.getItem('_rec_last_seen')) || 0;
        const myRx = JSON.parse(localStorage.getItem('_rec_my_reactions') || '{}');
        const EMOJIS = ['👍','❤️','😂'];
        const sorted = [...notes].sort((a,b) => (b.pinned?1:0)-(a.pinned?1:0) || new Date(b.fecha)-new Date(a.fecha));
        document.getElementById('notesContainer').innerHTML = sorted.map(n => {
            const isNew = lastSeen > 0 && new Date(n.fecha).getTime() > lastSeen;
            const border = n.pinned ? '#f59e0b' : isNew ? '#3b82f6' : 'var(--primary)';
            const bg = n.pinned ? '#fffde7' : isNew ? '#eff6ff' : '';
            const rxBtns = EMOJIS.map(e => {
                const arr = Array.isArray((n.reactions||{})[e]) ? (n.reactions||{})[e] : [];
                const cnt = arr.length;
                const mine = myRx[n.originalIndex]?.[e];
                const names = arr.filter(u => u !== 'Admin').join(', ') || arr.join(', ');
                return `<button onclick="_notaReaccion('${n.originalIndex}','${e}')" title="${names}" style="background:${mine?'#dbeafe':'#f8fafc'};border:1px solid ${mine?'#93c5fd':'#e2e8f0'};border-radius:20px;padding:2px 10px;cursor:pointer;font-size:0.82em;transition:0.15s">${e}${cnt?' '+cnt:''}</button>`;
            }).join('');
            return `
            <div class="card note-card" style="border-left:4px solid ${border};background:${bg};margin-bottom:10px;padding:12px 14px">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px">
                    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:4px">
                        ${n.pinned?'<span style="background:#f59e0b;color:#fff;font-size:0.68em;font-weight:700;padding:1px 7px;border-radius:20px">📌 FIJADA</span>':''}
                        ${isNew?'<span style="background:#3b82f6;color:#fff;font-size:0.68em;font-weight:700;padding:1px 7px;border-radius:20px">NUEVO</span>':''}
                        <span style="font-size:0.75rem;color:var(--text-muted);font-weight:600">Por <b>${escHtml(n.autor||'?')}</b> — ${escHtml(new Date(n.fecha).toLocaleString())}</span>
                    </div>
                    <div style="display:flex;gap:4px;flex-shrink:0">
                        <button onclick="_notaPin('${n.originalIndex}',${!n.pinned})" title="${n.pinned?'Desfijar':'Fijar'}" style="background:none;border:1px solid #e2e8f0;border-radius:6px;padding:2px 7px;cursor:pointer;font-size:0.85em">${n.pinned?'📌':'📍'}</button>
                        <button onclick="borrarNota('${n.originalIndex}')" style="background:none;border:1px solid #fee2e2;color:#ef4444;border-radius:6px;padding:2px 7px;cursor:pointer;font-size:0.85em">🗑️</button>
                    </div>
                </div>
                <div style="font-size:1rem;line-height:1.6;margin-bottom:10px;white-space:pre-wrap">${escHtml(n.mensaje)}</div>
                <div style="display:flex;gap:6px;flex-wrap:wrap">${rxBtns}</div>
            </div>`;
        }).join('') || '<p style="text-align:center;color:var(--text-muted)">Sin notas guardadas.</p>';
    }

    // --- COPY REPORT ---
    window.copyRep = (fecha) => {
        const ds = datos.filter(x => x.fecha === fecha);
        const total = ds.reduce((s, d) => s + d.monto, 0);
        const div = divisores[fecha] || 0;
        const res = div > 0 ? total / div : null;

        let txt = `📊 REPORTE: ${fFec(fecha)}\n--------------------------------\n`;
        ds.forEach(x => txt += `• ${x.tipo}: ${fNum(x.monto)}\n`);
        txt += `--------------------------------\n`;
        txt += `💰 TOTAL DÍA: ${fNum(total)}\n`;
        txt += `✅ RESULTADO NOCHE: ${res !== null ? fNum(res) : '— (sin divisor)'}`;

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

    // --- PIN NOTE ---
    window._notaPin = async (id, pinned) => {
        // Un solo pin a la vez — desfijar el resto primero
        if (pinned) {
            const others = notes.filter(n => n.pinned && n.originalIndex !== id);
            for (const o of others) {
                await post({ action: 'togglePin', id: o.originalIndex, pinned: false });
                o.pinned = false;
            }
        }
        // Respuesta local inmediata
        const nota = notes.find(n => n.originalIndex === id);
        if (nota) nota.pinned = pinned;
        renderNotes();
        await post({ action: 'togglePin', id, pinned });
    };

    // --- REACTION ON NOTE ---
    window._notaReaccion = async (id, emoji) => {
        const myRx = JSON.parse(localStorage.getItem('_rec_my_reactions') || '{}');
        const nota = notes.find(n => n.originalIndex === id);
        if (!nota) return;
        if (!nota.reactions) nota.reactions = {};
        const arr = Array.isArray(nota.reactions[emoji]) ? [...nota.reactions[emoji]] : [];
        const pos = arr.indexOf('Admin');
        const adding = pos === -1;
        if (adding) arr.push('Admin'); else arr.splice(pos, 1);
        if (arr.length === 0) delete nota.reactions[emoji]; else nota.reactions[emoji] = arr;
        // Mantener localStorage para highlight visual
        if (!myRx[id]) myRx[id] = {};
        if (adding) myRx[id][emoji] = true; else delete myRx[id][emoji];
        localStorage.setItem('_rec_my_reactions', JSON.stringify(myRx));
        renderNotes();
        // Persistir en Supabase
        post({ action: 'toggleReaction', id, emoji, user: 'Admin', add: adding }).catch(()=>{});
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
            action: 'update', index: editIndex,
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
            `¿Archivar el período "${periodo}"?\n\nSe guardará en Supabase y se limpiarán los registros activos para comenzar el siguiente período.`
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
    document.getElementById('logoutBtn').onclick = () => cerrarSesion(false);
    document.getElementById('logoutBtnMobile').onclick = () => cerrarSesion(false);

    // --- LOGIN (área → socio → PIN de 4 dígitos guardado en Supabase) ---
    function _diarioEntrarApp(displayName) {
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('mainContent').style.display = 'flex';
        document.body.classList.add('loggedin');
        document.getElementById('activeUserBadge').textContent = 'SESIÓN: ' + String(displayName || '').toUpperCase();
        document.getElementById('fecha').value = new Date().toISOString().split('T')[0];
        cargar();
        iniciarWatchdogInactividad();
    }

    const _selArea = document.getElementById('loginArea');
    const _selUser = document.getElementById('username');
    const _hintEl  = document.getElementById('loginHint');
    function _setHint(msg, color) {
        if (!_hintEl) return;
        _hintEl.textContent = msg || '';
        _hintEl.style.color = color || '#666';
        _hintEl.style.display = msg ? 'block' : 'none';
    }

    // Al elegir el área → cargar los socios de esa área desde socios-comicion
    if (_selArea) _selArea.onchange = async () => {
        _selUser.innerHTML = '<option value="" disabled selected>Cargando...</option>';
        _selUser.disabled = true;
        _setHint('', '');
        document.getElementById('password').value = '';
        const socios = (typeof window.diarioGetSociosByArea === 'function')
            ? await window.diarioGetSociosByArea(_selArea.value) : [];
        if (!socios.length) {
            _selUser.innerHTML = '<option value="" disabled selected>Sin socios en esta área</option>';
            _selUser.disabled = true;
            return;
        }
        _selUser.innerHTML = '<option value="" disabled selected>2. Elegir tu nombre...</option>'
            + socios.map(s => `<option value="${s.id}" data-nombre="${(s.nombre || '').replace(/"/g, '&quot;')}">${s.nombre}</option>`).join('');
        _selUser.disabled = false;
    };

    // Al elegir el socio → indicar si ya tiene PIN o si es su primera vez
    if (_selUser) _selUser.onchange = async () => {
        if (!_selUser.value) return;
        const rec = (typeof window.diarioGetPin === 'function') ? await window.diarioGetPin(_selUser.value) : null;
        if (rec && rec.pin) _setHint('🔒 Ingresa tu PIN de 4 dígitos', '#1a6fa0');
        else _setHint('🆕 Primera vez: crea tu PIN de 4 dígitos (quedará guardado)', '#b45309');
    };

    document.getElementById('loginForm').onsubmit = async (e) => {
        e.preventDefault();
        const area    = _selArea ? _selArea.value : '';
        const socioId = _selUser ? _selUser.value : '';
        const pin     = (document.getElementById('password').value || '').trim();
        const nombre  = (_selUser && _selUser.selectedOptions[0])
            ? (_selUser.selectedOptions[0].dataset.nombre || _selUser.selectedOptions[0].textContent) : '';

        if (!area)    { showToast('Elige el área', 'danger'); return; }
        if (!socioId) { showToast('Elige tu nombre', 'danger'); return; }
        if (!/^\d{4}$/.test(pin)) { showToast('El PIN debe ser de 4 dígitos', 'danger'); return; }

        const rec = (typeof window.diarioGetPin === 'function') ? await window.diarioGetPin(socioId) : null;
        if (rec && rec.pin) {
            if (pin !== rec.pin) { showToast('PIN incorrecto', 'danger'); return; }
        } else {
            // Primera vez: crear el PIN del usuario
            const ok = (typeof window.diarioSetPin === 'function') ? await window.diarioSetPin(socioId, nombre, area, pin) : false;
            if (!ok) { showToast('No se pudo crear el PIN, reintenta', 'danger'); return; }
            showToast('PIN creado ✓', 'success');
        }

        currentUser = nombre || socioId;
        sessionStorage.setItem('user', currentUser);
        sessionStorage.setItem('user_area', area);
        sessionStorage.setItem('user_socioId', socioId);
        _diarioEntrarApp(currentUser);
    };

    // --- TOGGLE PASSWORD ---
    document.getElementById('toggleLoginPassword').onclick = function () {
        const p = document.getElementById('password');
        p.type = p.type === 'password' ? 'text' : 'password';
        this.classList.toggle('fa-eye');
        this.classList.toggle('fa-eye-slash');
    };

    // --- AUTO-LOGIN FROM SESSION ---
    // Si ya inició sesión en esta sesión del navegador, restaurar directo (sin re-pedir PIN).
    const savedUser = sessionStorage.getItem('user');
    if (savedUser && savedUser !== 'mesas' && savedUser !== 'maquinas') {
        currentUser = savedUser;
        _diarioEntrarApp(currentUser);
    } else if (savedUser) {
        // Sesión antigua (esquema viejo) → limpiar para forzar login nuevo con PIN
        sessionStorage.removeItem('user');
    }

    // Exponer cargar globalmente para Supabase Realtime
    window._diarioReload = () => cargar(true);
});
