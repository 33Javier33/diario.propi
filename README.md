# diario.propi
---

## Historial de Cambios

#### 2026-08-02 — Tarjeta de presencia dentro del contenido, igual que socios-comicion (SW v34)
- La presencia ya no se muestra flotando (antes tapaba la barra inferior, y arriba estorbaba). Ahora es una **tarjeta en el flujo del contenido** (`#recPresenciaCard`, arriba de las estadísticas): se ve en **TODOS los paneles**, empuja el contenido en vez de taparlo y desaparece sola cuando no hay nadie.
- Mismo diseño que socios-comicion: "🟢 EN RECAUDACIONES (n)" + una línea por persona con **nombre** + *en \<app\> · \<tipo\>*.
- Archivos: `index.html` (contenedor), `supabase-api.js`. Scripts `?v=20`, SW `recaudacion-cache-v34`, versión visible **v34**.

#### 2026-08-02 — Tarjeta sutil de presencia arriba (ya no tapa la barra inferior) (SW v33)
- **Problema:** el aviso de presencia salía abajo y **tapaba la barra de navegación** (Agregar / Historial / Notas / Ayuda / Salir).
- **Fix:** ahora es una **tarjeta discreta arriba a la derecha** (zona libre: la barra lateral va a la izquierda y los botones flotantes abajo), con "EN RECAUDACIONES (n)" y una línea por persona: **nombre** + *en \<app\> · \<tipo\>*. Se ve en **todos los paneles** y desaparece sola cuando no queda nadie.
- Archivos: `supabase-api.js`. Scripts `?v=19`, SW `recaudacion-cache-v33`, versión visible **v33**.

#### 2026-08-02 — Fix: volvió a mostrarse el socio de la otra app (SW v32)
- El filtro de "no verse a sí mismo" ocultaba cualquier presencia con el mismo `socio_id`, incluida la de propi.solicitada (misma cuenta en ambas apps). Ahora se oculta **solo la propia línea de esta app**. Scripts `?v=18`, SW `recaudacion-cache-v32`, versión visible **v32**.

#### 2026-08-02 — Presencia: una sola fila por socio (sin duplicados) (SW v31)
- El id de la fila de presencia ahora es **fijo por socio + app**, así al recargar la app se sobreescribe la misma fila en vez de dejar una sesión anterior viva (que hacía que un socio se viera a sí mismo en la otra app). Scripts `?v=17`, SW `recaudacion-cache-v31`, versión visible **v31**.

#### 2026-08-01 — Presencia con `socio_id`: el socio no se ve a sí mismo (SW v30)
- La presencia ahora incluye el `socio_id` del socio en sesión, para que si tiene diario.propi y propi.solicitada abiertas a la vez **no se muestre a sí mismo** en la otra app. Scripts `?v=16`, SW `recaudacion-cache-v30`, versión visible **v30**.

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
