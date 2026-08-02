# diario.propi
---

## Historial de Cambios

#### 2026-08-01 — Fix REAL de presencia: ahora se anuncia en toda la app (SW v29)
- **Causa 1:** solo se marcaba presencia en el panel "Agregar"; al ver Historial/Notas el socio desaparecía de las otras apps. Ahora **estar dentro de diario.propi ya cuenta** como estar en recaudaciones (el tipo se envía solo si está en "Agregar").
- **Causa 2:** `pagehide` borraba la presencia al apagar la pantalla o cambiar de app. Ya no se borra en segundo plano; al volver al frente se re-marca y re-lee. Vigencia ampliada a 3 minutos.
- Etiqueta de versión visible: **v29**. Scripts `?v=15`, SW `recaudacion-cache-v29`.

#### 2026-08-01 — Versión visible (esquina inferior derecha) (SW v28)
- Etiqueta fija "v28" (= versión del SW) en la esquina inferior derecha para verificar de un vistazo si el dispositivo tomó la última versión.

#### 2026-08-01 — Presencia garantizada: respaldo por tabla `rec_presencia` (SW v27)
- Además del canal en vivo, la presencia se escribe en la tabla `rec_presencia` (latido cada 20s) y todas las apps la leen cada 5s → el nombre aparece siempre, sin depender del websocket. Al salir se borra la fila. Scripts `?v=14`, SW `recaudacion-cache-v27`.

#### 2026-08-01 — Presencia: refuerzos anti-pérdida (SW v26)
- Listeners `join`/`leave` además de `sync`, repintado de respaldo cada 4s, render al confirmar suscripción, `window.recPresRender` expuesto. Scripts `?v=13`, SW `recaudacion-cache-v26`.

#### 2026-08-01 — Fix: la presencia no llegaba a las otras apps (track antes de suscribir) (SW v25)
- **Causa:** el `ch.track` se enviaba antes de que el canal `rec-presencia` estuviera suscrito y se perdía en silencio. En diario era sistemático: el panel "Agregar" es el inicial, así que la marca salía justo al entrar (canal aún conectándose) → propi.solicitada nunca veía al socio.
- **Fix:** la presencia pendiente se (re)marca al confirmarse `SUBSCRIBED` (y en cada reconexión). Scripts `?v=12`, SW `recaudacion-cache-v25`.

#### 2026-08-01 — Presencia en recaudación en tiempo real entre apps (SW v24)
- **Qué se hizo:** cuando un socio está en el panel "Agregar" (recaudación) de diario.propi, las otras apps (propi.solicitada y socios-comicion) muestran **🟢 [Nombre] está en recaudaciones · [tipo]**; y al **agregar** un dato aparece un toast **📊 [Nombre] agregó a recaudaciones** en las otras apps (y aquí se ven las de ellas).
- **Cómo:** módulo de **Supabase Realtime Presence** en el canal compartido `rec-presencia` (proyecto REC). Se marca presencia al entrar al panel `agregarPanel` (y al cambiar el tipo), se quita al salir/cerrar sesión, y `apiAddRecaudacion` emite el aviso de "agregó". Banner y toast autocontenidos.
- Archivos: `supabase-api.js` (módulo + aviso al agregar), `app.js` (switchPanel/tipo/login/logout). SW `recaudacion-cache-v24`, scripts `?v=11`.

#### 2026-07-24 — Seguridad Fase 1a: PIN de acceso protegido en el servidor
- Los PIN de `diario.propi` ya **no se leen ni se comparan en el navegador**.
- La tabla `diario_pins` se cerró al rol anon (RLS activo, sin políticas permisivas).
- El login ahora verifica el PIN vía la Edge Function `pin-auth` (service_role):
  `diarioStatus` (¿tiene PIN?), `diarioVerify` (validar), `diarioSet` (crear/cambiar).
- SW `recaudacion-cache-v23`; `supabase-api.js`/`app.js` → `?v=10`.
