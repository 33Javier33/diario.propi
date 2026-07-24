# diario.propi
---

## Historial de Cambios

#### 2026-07-24 — Seguridad Fase 1a: PIN de acceso protegido en el servidor
- Los PIN de `diario.propi` ya **no se leen ni se comparan en el navegador**.
- La tabla `diario_pins` se cerró al rol anon (RLS activo, sin políticas permisivas).
- El login ahora verifica el PIN vía la Edge Function `pin-auth` (service_role):
  `diarioStatus` (¿tiene PIN?), `diarioVerify` (validar), `diarioSet` (crear/cambiar).
- SW `recaudacion-cache-v23`; `supabase-api.js`/`app.js` → `?v=10`.
