# diario.propi
---

## Historial de Cambios

#### 2026-10-08 — Ícono propio: la ficha «TIPS · APOYO» (SW v68)

Hasta ahora esta app y la de la comisión usaban **el mismo ícono** —la marca del desarrollador—, así que instaladas una al lado de la otra en el teléfono no había cómo distinguirlas.

Ahora Recaudaciones tiene el suyo: la **ficha circular roja con el signo peso, el corazón y la palabra TIPS**, recortada justo en el borde del aro y con todo lo de afuera transparente. Se reemplazaron los cinco tamaños del manifiesto (192, 256, 384, 512 y el *maskable* de 512).

El *maskable* va aparte: la ficha al **80 %** del lienzo sobre el rojo del aro (`#933131`), que es la zona segura de Android. Así, recorte el sistema un círculo, un cuadrado redondeado o una gota, la ficha nunca queda cortada.

Los nombres de archivo (`icono-cpn-*.png`) se dejaron tal cual: cambiarlos obligaba a tocar el manifiesto, el `index.html` y la lista de caché del Service Worker sin ganar nada.

**Archivos:** `icons/icono-cpn-192x192.png`, `-256x256`, `-384x384`, `-512x512`, `-maskable-512`, `sw.js`, `version.js`, `index.html`.

#### 2026-10-05 — Entrar con huella o rostro, en vez del PIN (SW v67)

**Optativo, y el PIN nunca se va.** En la pantalla de ingreso aparece **👆 Entrar como *Nombre*** solo si **ese dispositivo** tiene la huella registrada; el formulario con área, nombre y PIN sigue completo arriba.

**Se activa desde adentro, después de entrar con el PIN.** El interruptor está en la barra lateral, sobre «Cerrar Sesión». Se apaga cuando se quiera, y es por dispositivo.

**Qué se guarda:** el **identificador** de la credencial que crea el dispositivo, más a quién corresponde (id, nombre, área y foto) para poder abrir la sesión igual que el ingreso con PIN. La huella nunca sale del sensor. **El PIN no se guarda en ninguna parte.**

**Qué NO es, y acá importa más que en Horarios:** no hay servidor que verifique la firma — es un **candado local**. Y el PIN de diario.propi **sí se verifica en el servidor** en cada ingreso; entrando con huella ese paso no ocurre. Lo que vale entonces es que el dispositivo reconoció a su dueño y que **antes, en ese mismo dispositivo, alguien entró con el PIN correcto** — sin eso no se puede activar. El ingreso queda en la auditoría como `huella_diario`, distinto de `pin_diario`, para que se note cuál fue.

**Verificación:** 18 comprobaciones con un **sensor biométrico virtual** del navegador — que sin activarla la pantalla de ingreso no cambie; que **sin haber entrado con PIN no deje activarla**; que al registrarla guarde el identificador y **nunca el PIN** (revisando todo el almacenamiento del dispositivo); que al entrar deje la sesión idéntica a la del PIN, foto incluida; que **si la huella no coincide no abra sesión**; apagarla; y que sin sensor ni se ofrezca.

**Archivos:** `biometria.js` (nuevo), `app.js`, `index.html`, `sw.js`, `version.js`.



#### 2026-10-01 — El recuadro de «Contar por denominación» salía blanco (SW v66)

**Síntoma:** con el tema oscuro, el recuadro de la casilla aparecía **blanco** y su texto casi invisible encima.

**Causa, y es mía:** escribí `var(--card-bg, #fff)`. En diario.propi la variable se llama **`--bg-card`**, no `--card-bg`. Al no existir, el navegador usaba el respaldo `#fff` y pintaba el recuadro blanco — mientras el texto, que sí usaba variables correctas, se quedaba claro.

Vino de copiar el patrón desde socios-comicion, donde la variable **sí** se llama `--card-bg`. Las dos apps usan nombres distintos para lo mismo: `--bg-card`/`--text-main` acá, `--card-bg`/`--text-color` allá.

**Arreglado, y de paso todas las de su clase:**

- `--card-bg` → `--bg-card`, con el color de texto puesto **explícito** (`--text-main`) para no depender de lo que herede.
- Los campos del conteo ahora llevan el fondo y el color del tema, como el resto de los campos de la app; sin eso el navegador los pintaba blancos en modo oscuro.
- `#desgPanel` toma el fondo de la tarjeta en vez de quedar transparente.
- El monto, mientras lo calcula el conteo, se apaga con `--bg-card` y opacidad, no con un gris fijo.
- Se quitaron los respaldos de color inventados (`#fff`, `#e2e8f0`, `#cbd5e1`) que tapaban el problema: ahora si una variable falta, se nota.
- Se corrigió además `var(--text-color)` en `.vp-puntos b`, el mismo error en la línea de Pts Planta.

**Verificación:** 16 mediciones de contraste reales, tomadas con los colores que calcula el navegador en los **tres temas**. Todas por encima del mínimo WCAG — lo más justo es 4,47:1 donde se pide 3. El recuadro mide 255,255,255 en claro, 30,41,59 en oscuro y 20,20,20 en negro: ya no hay blanco fijo.

Se revisaron las otras dos apps por el mismo error: socios-comicion usa los nombres correctos y propi.solicitada no usa variables en ese código. El fallo era solo acá.

**Archivos:** `styles.css`, `desglose.js`, `index.html`, `sw.js`, `version.js`.

#### 2026-10-01 — Las notas mostraban las etiquetas en crudo (SW v65)

**Síntoma:** en el Bloc de Notas aparecían los códigos de formato como texto, en vez del texto con formato:

```
<div style="text-align:center"><b>Aviso importante</b></div><div>Turno <u>cambiado</u></div>
```

**Causa:** las notas se escriben en socios-comicion con un editor que permite **negrita, cursiva, subrayado, alineación y listas**, y se guardan como HTML. Acá se pintaban con `escHtml()`, que es justamente lo contrario: convierte las etiquetas en texto visible.

**Arreglo:** se portó el mismo criterio que ya usaba propi.solicitada con estas notas — las que traen formato se pintan **saneadas** y las de texto plano siguen igual que antes.

- Solo sobreviven `b, strong, i, em, u, br, p, div, span, ul, ol, li, a` y los estilos `text-align`, `font-weight`, `font-style`, `text-decoration`. Todo lo demás se convierte en texto.
- **El filtro no es decorativo:** sin él, cualquier cosa pegada en el editor desde otra página entraría tal cual y podría ejecutar código en esta app. Los enlaces solo pasan si son `http`/`https` — `javascript:` y `data:` se descartan, dejando el texto.
- `white-space: pre-wrap` queda **solo en las notas de texto plano**, que lo necesitan para sus saltos de línea. En las que traen formato agregaría líneas en blanco de más, porque el HTML ya trae sus propios párrafos.

**Verificación:** 28 comprobaciones, con las notas entrando por el camino real de la app (`window._diarioReload`), no inyectadas a mano. Que no quede ninguna etiqueta visible; que la negrita pese 700, el subrayado tenga `underline`, la cursiva sea `italic`, el centrado y la alineación a la derecha se apliquen y la lista tenga sus viñetas; que las notas viejas conserven su `pre-wrap`; y que una nota con `<script>`, una imagen con `onerror`, un enlace `javascript:` y un `position:fixed` **no ejecuten nada ni dejen rastro**, pero sí conserven su texto legítimo.

**Archivos:** `app.js`, `index.html`, `sw.js`, `version.js`.

#### 2026-09-29 — La ayuda explicaba la mitad de la app (SW v64)

El Manual de Uso tenía **4 secciones** y se había quedado atrás: nada del conteo por denominación, del ingreso por QR, de la franja de sesión, de los temas ni de las notificaciones. Ahora son **9**.

**Lo que se agregó:**

- **4. Contar por denominación** — que es opcional, que el monto sale de la suma, que Enter salta al siguiente campo, y que lo contado viaja a socios-comicion para prellenar la verificación. Con la advertencia de que **Sala de Juegos son fichas** ($1.000.000 a $500) y que se guardan aparte porque a la bóveda llega efectivo.
- **5. Entrar con el QR** — escanear, elegir app, que sirve una vez en cada una y vence a los 3 días, y qué pasa si ya se usó.
- **6. Quién tiene la sesión abierta** — la franja fija con el nombre, la hora y la foto.
- **7. Valor por punto y puntos de la nómina** — de dónde salen Pts Planta y Total Puntos.
- **8. Temas y notificaciones**.

**En los «?»:** se agregó el del **conteo por denominación**, junto a la casilla, y el de **Categorías** ahora avisa que el tipo decide qué se cuenta — fichas en Sala de Juegos, billetes en los otros tres. Van 6 tips.

**Verificación:** 21 comprobaciones — que el manual tenga las 9 secciones y explique las 11 cosas que faltaban, que los tips abran con contenido, y que el de categorías nombre las fichas. (El de `divisor` vive en una tarjeta del historial y solo existe con datos cargados; eso es así por diseño y la prueba lo distingue.)

**Archivos:** `index.html`, `app.js`, `sw.js`, `version.js`.

#### 2026-09-29 — Registrar contando por denominación (SW v63)

Además de anotar el monto a mano, ahora se puede **cargar el conteo por denominación** al registrar. Es opcional: el formulario de siempre no cambió.

Con el conteo cargado pasan dos cosas: el **monto deja de tipearse** —sale de la suma, así que no puede quedar un número que no cuadre con lo que hay en el sobre— y lo contado **viaja a socios-comicion**, donde la verificación llega con las cantidades ya puestas y el encargado solo revisa y confirma.

**Son dos juegos de denominaciones, no uno:**

| Tipo | Qué se cuenta |
|---|---|
| Sala de Juegos | **Fichas**: 1.000.000 · 500.000 · 200.000 · 100.000 · 50.000 · 20.000 · 10.000 · 5.000 · 1.000 · 500 |
| TarjetaMDA, EfectivoMDA, Bóveda | **Billetes y monedas**: 20.000 · 10.000 · 5.000 · 2.000 · 1.000 · 500 · 100 · 50 · 10 |

La grilla se vuelve a pintar al cambiar el tipo: dejar la anterior haría contar sobre casillas que ya no corresponden.

**Las fichas van en su propio campo** (`fichas_declaradas`), aparte de los billetes (`billetes_declarados`). En Sala de Juegos la noche cuenta fichas pero **a la bóveda llega efectivo**, así que las fichas no deben entrar nunca al arqueo de caja. Teniéndolas separadas en la base, el código del arqueo —que solo lee el conteo verificado— no puede tomarlas por error.

Enter salta a la siguiente denominación, para contar sin soltar el teclado.

**Verificación:** parte de 38 comprobaciones de punta a punta — que la opción arranque apagada y el monto se siga escribiendo como siempre; que en efectivo aparezcan las 9 denominaciones y en Sala de Juegos las 10 fichas; que exista la ficha de $1.000.000 y **no** la de $2.000, que es billete; que el total y el monto se calculen solos; y que lo guardado vaya al campo que corresponde según el tipo.

**Archivos:** `desglose.js` (nuevo), `app.js`, `supabase-api.js`, `index.html`, `styles.css`, `sw.js`, `version.js`, `vercel.json`.

#### 2026-09-28 — Entrar con el QR que emite la administración (SW v62)

El QR que se genera en socios-comicion abre esta app con el **área y el nombre ya elegidos**: al socio solo le queda el PIN. Es el mismo atajo que ya hacía el acceso guardado (`favAplicar`), pero sirve la primera vez, cuando todavía no hay nada guardado.

- **El QR no trae los datos**, trae un código opaco (`?qr=<32 hex>`) que se canjea contra Supabase. Ni el nombre ni el área viajan en la URL.
- **El mismo QR sirve una vez acá y una vez en propi.solicitada.** Al escanearlo, el socio elige a dónde entrar.
- **El QR manda sobre el acceso guardado.** Si trae un código válido deja elegido a *ese* socio; si no hay código o no sirve, se cae al atajo de siempre.
- El área de la ficha puede venir con otra capitalización que la del desplegable (`mesas` vs `Mesas`), así que se busca **sin distinguir mayúsculas**. Si el área no está en la lista, o el socio no aparece en ella, **lo dice y deja elegir a mano** en vez de quedarse a medias.

**Un problema que apareció al probarlo:** en la primera visita el Service Worker se activa de inmediato (`skipWaiting`), toma el control y la página **se recarga sola**. El código ya había salido de la URL, así que la recarga se lo llevaba — y la primera visita es justo la del socio que estrena la app con su QR. Ahora el código se guarda en `sessionStorage` en cuanto se lee y de ahí se recupera tras la recarga; se olvida en cuanto se canjea, para no reintentar uno ya usado.

**Verificación:** 12 comprobaciones — que deje el área y el nombre elegidos con el PIN vacío y el aviso correcto, que el código no quede en la URL, que se canjee marcando esta app, que se olvide después de usarlo, y los tres casos que no deben romper nada: código ya usado, área que no está en la lista, y socio que no aparece en su área.

**Archivos:** `qr-entrada.js` (nuevo), `app.js`, `index.html`, `sw.js`, `version.js`, `vercel.json`.

#### 2026-09-28 — La foto del socio en la franja de la sesión (SW v61)

- Si el socio **tiene foto cargada**, ahora aparece junto a su nombre en la franja de la sesión y en la barra lateral. Si no la tiene, se sigue viendo el monigote 👤 de siempre — que es el caso de la mayoría.
- **Chica, para no estorbar:** 22 px redonda en la franja del celular y 26 px en la barra lateral. La franja sigue midiendo lo mismo (38 px), así que no le come alto a la página.
- **Se puede tocar para verla en grande.** Al pincharla se abre el mismo visor que ya se usaba para las fotos de las notas — no se agregó un visor nuevo. El cursor es `zoom-in` para que se note que se puede tocar.
- **El monigote desaparece cuando hay foto**, con `#ses-foto:not(:empty) + .ses-ico { display: none; }`, para que no queden las dos cosas al lado.
- **De dónde sale la foto:** `diarioGetSociosByArea` ahora también trae `foto_url`; el enlace queda en el `<option>` del socio y se guarda en `sessionStorage` al entrar, igual que el nombre y el área. No hay ninguna consulta extra.
- **Verificación:** 13 comprobaciones, todas correctas — con foto (tamaño, forma redonda, cursor, que el visor abra de verdad y la muestre más grande, que el monigote se oculte), sin foto (que no aparezca nada raro y vuelva el monigote) y en computador (que salga en la barra lateral con el nombre y el área).
- **Archivos:** `index.html`, `styles.css`, `app.js`, `supabase-api.js`, `sw.js`, `version.js`.

#### 2026-09-28 — La sesión queda fija al hacer scroll, igual que el valor por punto (SW v60)

- La franja con el nombre se iba hacia arriba al bajar por la página. Ahora se queda **fija arriba**, igual que el valor por punto: el nombre de quien tiene la sesión está siempre a la vista, que era el punto de mostrarlo.
- **Las dos franjas van dentro de una sola envoltura fija** (`#barraFija`), en vez de fijar cada una por su lado. Así bajan juntas sin tener que calcular a mano la altura de la de arriba para posicionar la de abajo — un número que se rompería en cuanto cambie el contenido de esa franja.
- **Se le puso fondo opaco a la envoltura.** La franja de la sesión es translúcida (verde suave) y, al quedar fija, el contenido de la página se veía pasar por detrás.
- **Verificación:** 8 comprobaciones — tras bajar 526 px, el valor por punto queda a 2 px del borde y la sesión a 45 px, pegadas una bajo la otra; la barra tiene fondo opaco; y en computador toda la envoltura se oculta porque ahí manda la barra lateral, que sigue mostrando la sesión.
- **Archivos:** `index.html`, `styles.css`.

#### 2026-09-28 — Quién tiene la sesión abierta, también en el celular (SW v59)

- **El dato existía pero no se veía donde hacía falta.** «SESIÓN: NOMBRE» estaba en la **barra lateral**, que solo aparece en pantallas de 992 px o más. En el celular —que es donde se registra la recaudación— no había ninguna forma de saber quién había quedado dentro.
- Ahora hay una franja arriba, bajo el valor por punto, con **👤 nombre · área**. El área importa: dos socios pueden llamarse igual, y ya pasó con seis pares de nombres repetidos.
- **Dice desde qué hora está abierta**, y si lleva **3 horas o más** lo avisa («5 h abierta»). Esa es la señal de que alguien se fue sin cerrar. Se refresca sola cada minuto.
- **Un solo lugar escribe los dos indicadores** (`pintarSesionActiva`), así la barra lateral y la franja no pueden decir cosas distintas. La franja se oculta en escritorio para no duplicar, el mismo patrón que ya usa el valor por punto.
- Funciona también al **restaurar** la sesión: si se recarga la página, la hora de entrada se conserva y la cuenta sigue corriendo desde la original.
- **Verificación:** 11 comprobaciones — se ve en celular con nombre, área y hora; se oculta en escritorio mientras la barra lateral sí la muestra; avisa a las 5 horas; y no molesta con el aviso cuando la sesión es reciente.
- **Archivos:** `index.html`, `styles.css`, `app.js`.

#### 2026-09-28 — El navegador pedía actualizar la contraseña en cada acción (SW v58)

- **Síntoma:** el navegador preguntaba «¿Actualizar la contraseña?» en **cada acción** —agregar un billete en el arqueo, abrir un modal, cualquier cosa—, no solo al entrar.
- **Causa:** al entrar bien, el campo del PIN **nunca se vaciaba**. Quedaba en el HTML con el PIN adentro, escondido dentro del overlay del login. El gestor de contraseñas del navegador re-evalúa los campos `type="password"` ante cualquier cambio de la página y, como ya tenía una credencial guardada para el sitio, salía a ofrecer actualizarla una y otra vez. El `autocomplete="off"` que ya tenía no sirve para esto: los gestores lo ignoran para el aviso de guardar.
- **Arreglo:** al entrar, el campo se vacía y deja de ser `type="password"`; al cerrar sesión vuelve a serlo, que es cuando de verdad se usa. **Mientras usas la app no queda ningún campo de contraseña en la página**, así que el navegador no tiene nada que ofrecer.
- **Los otros 7 PIN de la app** —configuración, cambio de clave, firma de certificados, borrar un desglose, clave de recuperación— pasaron a ser texto enmascarado con CSS (`.campo-secreto`). Se ven igual de ocultos, pero el navegador no los confunde con la clave del sitio. El único `type="password"` que queda es el del login, que es el que corresponde.
- **Se revisó la misma falla en las otras apps:** diario.propi y propi.solicitada la tenían igual y quedaron arregladas. Horarios no la tiene, porque usa teclado numérico en vez de un campo.
- **Verificación:** 9 comprobaciones — antes de entrar hay un campo de contraseña, ya dentro hay **cero**, el PIN queda vacío, los 7 campos internos son texto y se ven ocultos, y al cerrar sesión el login vuelve a ser contraseña.

#### 2026-09-25 — El despliegue estaba fallando: una clave inválida en vercel.json

- **La causa de que nada llegara: el despliegue venía fallando.** Al documentar las reglas nuevas de caché metí una clave `"_comentario"` dentro de `vercel.json`. Vercel valida ese archivo contra un esquema estricto y **rechaza el despliegue entero** ante una propiedad desconocida. Los commits se subían bien, pero la app quedaba congelada en la versión anterior.
- **Se confirmó con el historial:** la clave entró en el commit del renombre de íconos, y desde ahí **3 commits seguidos nunca llegaron a publicarse**. Eso explica en cadena todo lo que "no cambiaba": los íconos, el número de versión y el resto.
- **La pista fue que propi.solicitada sí se actualizaba.** Era la única app sin esa clave, porque sus reglas se agregaron por otra vía.
- **Arreglo:** se quitó la clave y se validaron las tres configuraciones — 10 reglas cada una, todas con claves permitidas.
- **Para que no vuelva a pasar** se agregó `revisar-despliegue.py` a cada repositorio: comprueba que `vercel.json` solo use claves que Vercel acepta y que todo archivo local que carga el HTML tenga no-caché o `?v=`. Hay que correrlo antes de publicar.

#### 2026-09-25 — Por qué el número no cambiaba: el archivo nunca llegaba (SW v57)

- **El arreglo de ayer nunca llegó a los teléfonos.** `version.js` **no estaba en la lista de no-caché** de `vercel.json` y además se publicó dos veces con la misma dirección (`?v=1`): el navegador se quedó con la copia del primer día —la que tenía el error de mostrar la versión en espera— y nunca volvió a pedir el archivo. Por eso el número no cambiaba.
- **Dos correcciones, porque hacía falta cada una:** se agregó `version.js` a las reglas de no-caché (la cabecera sola no alcanza, porque no se aplica a una copia que el navegador ya considera fresca) y se cambió la dirección a `?v=3`, que es lo que la obliga a pedirla de nuevo.
- **Auditoría de TODO lo que carga cada app** contra sus reglas de caché. Aparecieron más archivos sin protección, que se agregaron: `manifest2.json`, `index2.html` y `sw2.js` en socios-comicion; `manifest.json`, `version.js`, `/icons/` e `/img/` en propi.solicitada. **Resultado ahora: 53 recursos revisados en las cuatro apps, 0 sin protección.**
- Se comprobó además que los cuatro Service Workers piden a la red **antes** que a su propia caché, así que ninguno puede quedarse sirviendo un archivo viejo estando en línea.

#### 2026-09-25 — La versión, sobre el logotipo — y mostrando la correcta (SW v56)

- **El número va ahora SOBRE el logotipo**, en una chapita justo bajo el dibujo. Primero quedó encima de la esquina y tapaba la «e» de «Interactive»; se bajó para que se lea como parte del logo sin pisarlo.
- **Corregido un error de la versión anterior de este dato.** Leía las cachés desde la página y se quedaba con **la más alta**. En socios-comicion y propi.solicitada la versión nueva se instala pero queda **en espera** hasta que se aprieta «Actualizar», así que conviven dos cachés: el número mostraba la que **todavía no estaba corriendo**. Justo la sensación de «no se actualizó» al revés.
- **Ahora se le pregunta al Service Worker que controla la página** —cada uno responde con su propia caché—, que es el único dato que no se puede confundir.
- **Tres respaldos, en orden:** si el Service Worker es anterior a este cambio y no sabe responder, se usa la caché **más vieja** presente, que es la que manda en ese caso; si no hay ninguna, el número del código. Nunca se muestra un número más alto que el que está corriendo.
- **Verificación:** 11 comprobaciones — las cuatro apps muestran su versión, el número queda sobre el logo, el caso de la versión en espera (muestra la que controla, no la que espera), la primera visita sin Service Worker, y el Service Worker viejo que no responde (muestra la vieja, no miente).
- En esta app el Service Worker sí se activa solo, así que acá el número ya era correcto; el cambio la deja igual que las otras tres.
- **Archivos:** `version.js`, `index.html`, `styles.css`, `sw.js`.

#### 2026-09-25 — La versión, junto a la marca (SW v55)

- **El número no está escrito a mano: se lee de la caché que el Service Worker tiene activa en este dispositivo.** Esa es la diferencia que importa — lo que ves es la versión que *de verdad* estás usando, no la que dice el código. Si el navegador todavía te está sirviendo la anterior, el número te lo dice.
- Va **junto a la marca**, que es donde se busca. El módulo pinta todo elemento con la clase `app-version`, así que agregar el dato en otro lugar es poner un `<span class="app-version">` y nada más.
- **Un solo origen para el número.** Antes estaba escrito a mano en el HTML y además en el nombre de la caché del Service Worker: dos lugares que podían quedar diciendo cosas distintas. Ahora manda el Service Worker.
- **Casos cubiertos:** si todavía no hay Service Worker (primera visita, incógnito) cae al número del código en vez de dejar un hueco; si conviven la caché vieja y la nueva muestra **la más alta**, que es la que va a quedar; y filtra por el prefijo de su propia app, porque `socios-comicion` y `Horarios` comparten dominio y sin eso una mostraría la versión de la otra.
- **Se repinta solo** cuando el Service Worker termina de activarse, sin recargar.
- **Verificación:** 12 comprobaciones — las cuatro apps muestran su propia versión y no la de la vecina, el caso sin Service Worker, y el de dos cachés a la vez. Una falla real encontrada y corregida en el camino: en diario.propi la chapita fija va **después** del script, así que en la primera pasada todavía no existía y se quedaba con el guion; el módulo ahora repinta al terminar de cargar el HTML.
- Aparece en **tres** lugares junto al logotipo —la portada de acceso, la barra lateral y el pie— más la chapita de abajo a la derecha, todos con el mismo número.
- **Archivos:** `version.js` (nuevo), `index.html`, `sw.js`.

#### 2026-09-25 — El ícono nuevo no llegaba: los archivos cambiaron de nombre (SW v54)
- **Síntoma:** después de cambiar el ícono, los teléfonos seguían mostrando el viejo.
- **Causa: el ícono se reemplazó conservando el nombre del archivo.** Todo lo que cachea imágenes lo hace **por URL** —el navegador, el CDN de Vercel y la app ya instalada—, así que `icon-192x192.png` seguía entregando los bytes antiguos aunque el archivo en el repositorio fuera otro. Y `vercel.json` declaraba `no-cache` para el HTML, el JS, el CSS y el manifiesto, **pero no para las imágenes**: eran justamente las que faltaban en esa lista.
- **Arreglo en dos partes:**
  1. Los archivos pasaron a llamarse `icono-cpn-*.png`. Una URL nueva no puede tener una copia vieja en ninguna caché, así que el cambio llega sí o sí.
  2. Se agregaron `/icons/(.*)` y `/img/(.*)` a las reglas de `vercel.json`, para que la próxima vez que se cambie un ícono baste con reemplazarlo.
- **En iPhone igual hay que borrar la app de la pantalla de inicio y volver a agregarla**: iOS lee el ícono una sola vez, al instalar, y ningún cambio de nombre ni de cabecera lo evita.
- **Verificación:** los 5 íconos del manifiesto se descargan (HTTP 200), decodifican como imagen y miden lo declarado; no queda ninguna referencia al nombre viejo en todo el repositorio; `vercel.json` y `manifest.json` son JSON válido.
- **Archivos:** `icons/` (renombrados), `manifest.json`, `index.html`, `sw.js`, `vercel.json`.

#### 2026-09-25 — Ícono nuevo de la app (SW v53)
- El ícono de la pantalla de inicio pasa a ser el **logotipo de la marca sobre placa oscura**, el mismo que en socios-comicion.
- **Los íconos anteriores estaban rotos de dos maneras:**
  - **No medían lo que decían.** `icon-192x192.png` era en realidad **1331×1331 y 866 KB**; `icon-512x512.png` era **2048×2048 y 4,3 MB**. Entre los dos, **5,2 MB** para un par de íconos.
  - **El manifiesto declaraba cuatro tamaños y solo existían dos** (256 y 384 daban 404).
  Ahora los cuatro existen, cada uno mide exactamente lo declarado, y la carpeta entera pesa **1 MB**.
- **Faltaban los enlaces en el HTML:** no había `apple-touch-icon` ni `favicon`. Sin el primero, al agregar la app a la pantalla de inicio en iPhone el sistema inventa un ícono con una captura de la página.
- **Se agregó una versión *maskable* aparte.** Android recorta el ícono a la forma del launcher (círculo, cuadrado redondeado…) y el borde se pierde: con el ícono a sangre, «Interactive» quedaba cortado. La variante maskable lleva el logo al **80% centrado** sobre el gris casi negro de la placa, que se tomó midiendo la franja bajo el texto —no del contorno, porque las esquinas redondeadas del original son claras y daban un marco gris que no pegaba con nada.
- El ícono de las **notificaciones** también pasa a ser este, en vez del logotipo de fondo transparente que se veía raro sobre el aviso.
- **Verificación:** los 5 íconos del manifiesto se descargan (HTTP 200), decodifican como imagen y miden lo que declaran; el manifiesto es JSON válido; y la página tiene manifiesto, apple-touch-icon y favicon. Sin ningún 404.
- **Archivos:** `icons/` (5 archivos), `manifest.json`, `index.html`, `sw.js`.

#### 2026-09-24 — Notificaciones del diario (y avisos al reloj) (SW v52)

- **Qué llega:** cuando alguien registra una **recaudación** o publica una **nota** en el bloc, al resto del turno le llega un aviso al teléfono — con la app cerrada y el teléfono bloqueado.
- **Por qué importa para el reloj:** un reloj inteligente **no tiene navegador** donde abrir la app (watchOS nunca ha traído Safari, y la mayoría de los Wear OS tampoco trae uno). Las notificaciones son la única vía que llega a la muñeca: el reloj espeja las del teléfono. Por eso la respuesta a «¿se puede hacer responsiva para reloj?» es que el camino útil es este, no el CSS.
- **Nadie recibe el aviso de lo que hizo él mismo.** Cada equipo se suscribe con `DIARIO:<socioId>`. El prefijo separa a los usuarios del diario de los del resto del sistema —la tabla `push_subscriptions` es compartida con socios-comicion (`ADMIN`) y con propi.solicitada (el id del socio)— y el sufijo permite que el servidor excluya al autor.
- **El permiso se pide en el primer toque dentro de la app, no al entrar.** Pedirlo apenas abre es lo que hace que la gente lo rechace de reflejo, y un permiso rechazado no se puede volver a pedir.
- **Las notas avisan a los demás turnos, no al admin** — es mensajería interna. Las recaudaciones sí avisan a los dos: al admin como siempre, y ahora también al turno.
- **Cambios fuera del repositorio (Supabase):**
  - Edge Function `push-notify` → **versión 9**. Cambio aditivo: se agregó `pushDiario()` y una rama para `notas_recaudacion`; las ramas de egresos, días PT, recaudación-al-admin y mensajes quedaron **idénticas**. La v8 sigue disponible para volver atrás.
  - Proyecto REC: nuevo disparador `trg_push_nota` sobre `notas_recaudacion`, copia del `trg_push_recaudacion` que ya existía.
- **Verificación, contra la base real:** una recaudación de prueba devolvió `admin {sent:3, total:4}` (el aviso al admin **sigue funcionando igual**) y `diario {total:2}` de 3 suscripciones — **excluyó al autor**. Una nota de prueba devolvió solo `diario {total:2}`, sin tocar al admin. Y al insertar una nota de verdad el disparador se activó solo (petición 227, HTTP 200). Las suscripciones y la nota de prueba se borraron después; quedan 8 notas y 24 recaudaciones, los mismos números de antes.
- **Archivos:** `sw.js` (manejadores `push` y `notificationclick`), `supabase-api.js` (`diarioSuscribirPush`, `diarioPedirPermisoPush`), `app.js`, `index.html`.

#### 2026-09-23 — Tres temas: Claro, Oscuro y Negro (SW v51)
- Se puede cambiar el tema desde el **botón de la paleta** 🎨, abajo a la derecha: **☀️ Claro** (el de siempre, por defecto), **🌙 Oscuro** y **⚫ Negro** (OLED). El tema queda **guardado en ese dispositivo**, así que cada persona puede tener el suyo.
- **Mismos nombres y colores que propi.solicitada**, para que elegir el mismo tema deje las dos apps iguales.
- **El tema oscuro ya existía en el CSS pero era inalcanzable:** había un bloque `body.dark-mode` con sus variables desde antes, y nada en toda la app ponía esa clase. Ahora se usa.
- **Negro no duplica el tema oscuro:** se aplica encima de él (las dos clases juntas) y solo empuja los fondos a negro puro, incluidas la barra lateral y la barra inferior. Un solo juego de colores que mantener.
- **Sin fogonazo blanco al abrir.** Un script en el `<head>` aplica el tema guardado *antes* de pintar nada; si esperara a `app.js`, abrir en oscuro daría un destello blanco. Como en ese momento todavía no existe el `<body>`, las clases se ponen en el `<html>` (`pre-oscuro` / `pre-negro`) y `app.js` las reemplaza apenas arranca. También se actualiza el `theme-color`, para que la barra del navegador no quede blanca.
- **Un arreglo que apareció al probar:** el aviso ámbar del modal de ingreso tiene fondo claro fijo (a propósito, es un destacado), así que en tema oscuro su texto quedaba **blanco sobre crema**, ilegible. Ahora fuerza texto oscuro.
- **Verificación:** 18 comprobaciones — los tres temas dan los colores exactos de fondo, tarjeta y barra del navegador; el selector abre, marca el activo, aplica, guarda y cierra al elegir o al tocar fuera; y al reabrir con tema negro el fondo ya está negro antes de que corra `app.js`. Más una auditoría automática de contraste sobre todos los textos de la app: **0 elementos ilegibles** en Oscuro y en Negro.
- **Archivos:** `index.html`, `styles.css`, `app.js`.

#### 2026-09-23 — Pts Planta y Total Puntos, traídos de socios-comicion (SW v50)
- Se muestran los dos números que en socios-comicion viven en **Gestión de Socios**: **Pts Planta** y **Total Puntos**. Hoy son **804** y **826**.
- **Por qué acá:** son el divisor con el que se calcula el valor por punto. Teniéndolos al lado se ve de inmediato si el divisor que se escribió corresponde a la nómina de hoy — los divisores del período (804, 810, 820, 826) son justamente esos totales.
- **Cuatro lugares**, los tres donde ya aparecía el valor por punto más el historial:
  - barra lateral (escritorio), debajo de «Total Valor por Punto»;
  - franja fija (celular), bajo la etiqueta;
  - tarjeta «Total Valor por Punto», bajo el monto;
  - encabezado del **Historial**, para tenerlos a mano al revisar los días.
- **El cálculo se repite igual que en socios-comicion** (`js/api.js` + `js/socios.js`) para que los dos sistemas muestren lo mismo: solo socios activos con fecha de ingreso; un socio suma recién desde el **día 15** del mes en que empiezan sus puntos; **Gastos Comisión vale 1 punto fijo**; se usa el puntaje guardado y, si viniera en 0, el que corresponde por antigüedad (4 de base, 2 por año, 2 en Bóveda) con el tope de su área.
- **No bloquea la carga:** la lectura va fuera del `Promise.all` de los datos del diario. Si la base de socios no responde, el diario carga igual y solo no se muestran los puntos — el bloque se oculta en vez de dejar un hueco.
- Se aprovecha el cliente `dbSoc` que la app ya tenía para la auditoría y el login por PIN; no hay credenciales nuevas.
- **Verificación:** 12 comprobaciones del cálculo contra los 66 socios reales (826 y 804 exactos, más 8 casos borde de la regla del día 15, Gastos Comisión, topes por área y áreas escritas en minúscula) y 9 comprobaciones de que los cuatro bloques aparecen donde corresponde en escritorio y celular.
- **Archivos:** `supabase-api.js` (`diarioGetPuntosNomina`), `app.js`, `index.html`, `styles.css`.

#### 2026-09-18 — Telegram eliminado por completo
- **Se retira la integración con Telegram.** No queda código que envíe ni reciba datos por esa vía.
- **Lo que se quitó en `Code.gs`:** el token y el chat_id, `telegramRec()`, `probarTelegramRec()`, el resumen diario `resumenDiarioRecaudacion()` (que corría con un activador de tiempo) y los **11 avisos** que se disparaban en cada operación: alta, edición y borrado de recaudación, saldo, alta y borrado de nota, divisor, reinicio de datos, importación y cierre de período.
- **No cambia nada de lo que se ve ni se guarda.** Los avisos eran solo salida hacia el chat; las escrituras a la planilla y a Supabase quedaron intactas.
- **Archivos:** `Code.gs`. No se tocó el front, así que el Service Worker no cambia de versión.

> ⚠️ **ACCIÓN PENDIENTE — revocar el token del bot.** El token estaba escrito a mano en `Code.gs` (y otro casi idéntico en `propi.solicitada/gas/code.gs`). Borrarlos del archivo **no los invalida**: siguen en el historial de git y cualquiera con acceso al repositorio puede recuperarlos y usar el bot. Hay que entrar a **@BotFather → `/mybots` → el bot → API Token → Revoke**, o directamente **`/deletebot`** si ya no se va a usar. Mientras no se revoque, el token sigue vivo.
>
> Además, fuera del repositorio hay que: (1) **pegar estos tres `.gs` ya limpios en los proyectos reales de Google Apps Script** — los del repositorio son solo copias de referencia; (2) **borrar el activador de tiempo** de `resumenDiarioRecaudacion`, que si no fallará cada día al no existir la función; (3) en el proyecto GAS de socios, **borrar las Script Properties** `TELEGRAM_TOKEN` y `TELEGRAM_CHAT_ID`.

#### 2026-09-17 — El logotipo de marca, a un tamaño discreto (SW v49)
- **El logo ocupaba demasiado espacio y resultaba hostil a la vista.** La causa es que `cpn-marca.png` es **casi cuadrado (520×480)**: el ancho se paga casi entero en alto. En el login, 190 px de ancho medían **175 px de alto** y el logo tapaba la tarjeta de acceso.
- **Escala nueva, idéntica en las 3 apps:** login **190 → 96 px** (≈89 de alto), sidebar **150 → 80 px**, pie **130 → 68 px**. El pie lleva además `opacity: .85` para que se lea como firma.
- **Archivos:** `styles.css` (`.marca-logo-login`, `.marca-logo-side`, `.marca-logo-foot`). No cambia el archivo del logo ni sus colores — **solo el tamaño**.

#### 2026-09-15 — Logotipo original recortado y recoloreado (SW v48)
- **Se revierte el redibujo.** El pedido era cambiar el color, no el dibujo. Vuelve **el arte original, con su forma exacta**, y lo único que cambia es el color. Aparece en el **login**, el **sidebar** y el **pie**.
- **Cómo se recortó el fondo.** El archivo de origen es una foto de una maqueta (el escudo sobre metal cepillado con degradado). Lo que funcionó fue un **top-hat**: se estima el fondo como el mínimo local en una ventana más ancha que el trazo más grueso del logo y se conserva lo que sobresale. Tres ajustes hicieron falta: usar **croma absoluto** en vez de saturación relativa (si no, queda un halo gris), bajar el umbral de luminancia porque **el texto plateado no es tan claro como parece** y quedaba semitransparente, y descartar los reflejos pegados al borde exigiendo que todo píxel esté cerca de uno opaco.
- **El color:** mismos tonos del original pero **más saturados y menos claros**, porque el neón se lava sobre fondo blanco. Sobre fondo oscuro —y siempre en el sidebar— se avivan con `filter: brightness(1.45) saturate(1.05)`.
- **Archivos:** `img/marca/cpn-marca.png` (520×480, 219 KB, fondo transparente). Se borran los SVG del intento anterior.
- **Mediana 3×3 sobre el alfa:** el texto plateado sale del JPEG con motas sueltas en el borde y se veía sucio al lado de «Nauto», que es de color. Se probó además un cierre morfológico para rellenar la «C» y **se descartó**: engorda las letras y cierra el ojo de la «a».
- Verificado en navegador sobre la página real, en claro y en oscuro, y a 240/190/120 px.
- `styles.css?v=48`, SW `recaudacion-cache-v48`, versión visible **v48**.
- Archivos: `index.html`, `styles.css`, `sw.js`, `img/marca/`.
#### 2026-09-14 — Acceso directo en el login (SW v44)
- Igual que en la app de Horarios: se puede dejar un usuario **recordado en este dispositivo**. Al abrir, el **área y el nombre quedan puestos** y solo falta escribir el PIN — los tres pasos se reducen a uno.
- **El PIN no se guarda nunca.** Esto acorta el camino hasta el usuario, no la autenticación: un teléfono es personal pero puede prestarse.
- Se marca con el botón **☆ Recordarme en este dispositivo**, que aparece al elegir el nombre y pasa a **★** cuando está activo. Se quita desde ahí o con la **✕** de la tarjeta.
- **Bug encontrado y corregido durante la prueba:** si al abrir la lista de socios **no alcanzaba a cargar** (sin red, Supabase lento), el código concluía *«ese socio ya no está»* y **borraba el acceso directo**. Una falla pasajera no debe destruir la preferencia: ahora solo se limpia cuando la lista **sí cargó** y aun así el socio no aparece. Verificado que tras recargar sin datos el atajo **sobrevive**.
- Las llamadas a `showToast` van protegidas: `favAplicar()` corre al arrancar y puede adelantarse a que esa función exista.
- Probado en navegador en cinco pasos: sin favorito, marcar, que persista al recargar (área y nombre puestos, foco en el PIN y el aviso «Ingresa tu PIN»), que sobreviva a una carga fallida, y el caso del socio que ya no está en el área.
- `app.js?v=25`, SW `recaudacion-cache-v44`, versión visible **v44**.
#### 2026-09-14 — Marca nueva: Carlos P. Nauto Interactive (SW v43)
- Se reemplaza el logotipo (`img/carlospn-logo.png`) por el nuevo y **«CarlosPN Interactive» pasa a «Carlos P. Nauto Interactive»** en sus 4 menciones: el logo del **login**, el del **sidebar**, el del **pie** y la línea de texto del pie.
- El archivo mantiene el **mismo nombre**, así que las tres referencias y el Service Worker siguen sirviendo; cache-bust a `?v=2026`.
- **El logotipo nuevo es transparente** (el anterior tenía fondo blanco). Las reglas de `.marca-logo` —`multiply` en claro, `invert(1) hue-rotate(180deg)` + `screen` en oscuro, y el mismo tratamiento forzado para el sidebar, que siempre es oscuro— **funcionan igual** con un PNG transparente: no hubo que tocar `styles.css`.
- Verificado en navegador en los tres lugares: login claro, sidebar oscuro y pie en modo oscuro.
- SW `recaudacion-cache-v43`.
- Archivos: `index.html`, `sw.js`, `img/carlospn-logo.png`.
#### 2026-09-10 — El Total Valor por Punto queda siempre a la vista (SW v42)
- Estaba solo en la tarjeta de arriba, que **se pierde apenas se baja** por el historial — justo cuando más se necesita para comparar contra los montos del día.
- **En computador** va ahora en el **menú lateral**, bajo el nombre del usuario. Como la barra lateral es fija, queda visible esté donde esté la página y en cualquier panel (Agregar, Historial, Notas, Ayuda).
- **En celular**, donde no hay barra lateral, se agregó una **franja adherida al borde superior** con *Valor por Punto* y el monto. Ocupa una sola línea y acompaña al hacer scroll.
- Cada layout muestra solo lo suyo: la franja no aparece en escritorio ni el bloque del menú en celular, para no repetir el dato dos veces en pantalla.
- Los tres lugares (tarjeta, menú y franja) se actualizan juntos en cada render, así que no pueden quedar descuadrados entre sí.
- Archivos: `index.html` (`#vpMenu`, `#vpSticky`), `app.js` (`render`), `styles.css`. `app.js?v=24`, `styles.css?v=42`, SW `recaudacion-cache-v42`, versión visible **v42**.

#### 2026-09-10 — Historial en vista mosaico (SW v41)
- En computador el historial iba en **una sola columna**, con media pantalla vacía a la derecha y obligando a bajar mucho para comparar los montos de un día contra otro.
- Botón nuevo **▦ Dos columnas** en la barra del Historial, junto al buscador de fecha: los días quedan **uno al lado del otro**. Desde **1700 px** entran tres, porque las columnas se acomodan solas según el ancho real.
- **Encendido por defecto** en pantalla ancha; apagarlo es un clic y la preferencia se guarda. Bajo **1100 px** el botón no aparece y la lista sigue en una columna, que es lo correcto en un celular.
- La vista se re-aplica al final de cada render, porque el contenedor se repuebla entero cada vez que llegan datos o se cambia el orden.
- **Recuerda:** el historial arranca minimizado y muestra solo el día más reciente. Para aprovechar el mosaico hay que presionar **Expandir/Min**.
- Se agregó control de versión a `styles.css` (`?v=41`), que no lo tenía y podía quedar cacheado.
- Archivos: `index.html` (botón), `app.js` (`hist_aplicarVista`, `hist_toggleVista`), `styles.css`. `app.js?v=23`, `styles.css?v=41`, SW `recaudacion-cache-v41`, versión visible **v41**.

#### 2026-09-08 — El aviso nombra el día que falta (SW v40)
- Cuando falta **un solo día**, el título lo dice con nombre y fecha: **«Falta agregar la recaudación del Lunes, 7 de septiembre»**, en vez de solo *«Falta la recaudación de 1 día»*.
- Con varios días muestra el conteo y el detalle en los chips.
- Archivos: `app.js` (`_pintarDiasFaltantes`). `app.js?v=22`, SW `recaudacion-cache-v40`, versión visible **v40**.

#### 2026-09-08 — Se revierte el recorte al período en el aviso de recaudación (SW v39)
- La v38 limitó el aviso al **período actual**. Eso dejaba fuera los días sin recaudación de períodos ya cerrados, que igual hay que saber para poder ingresarlos.
- Vuelve la ventana de **45 días hacia atrás** desde ayer, igual que en las otras dos apps.
- Se conservan las guardas: no avisa mientras no haya datos cargados, y nunca revisa antes del primer día que trajo la consulta.
- Archivos: `app.js` (`_diasSinIngreso`). `app.js?v=21`, SW `recaudacion-cache-v39`, versión visible **v39**.

#### 2026-09-08 — El aviso de recaudación faltante, acotado al período (SW v38)
- El título dice **«Falta la recaudación de 1 día»** (o de N días), igual que en las otras dos apps.
- **Ventana acotada al período actual** (del 15 en adelante) en vez de 45 días hacia atrás, que podía cruzar el corte de mes.
- **Nunca revisa antes del primer día cargado** —esos días pueden tener recaudación sin estar en la consulta— y **no avisa si aún no hay datos**, para que al abrir la app no salga el período entero como faltante.
- Archivos: `app.js` (`_diasSinIngreso`, `_pintarDiasFaltantes`). `app.js?v=20`, SW `recaudacion-cache-v38`, versión visible **v38**.

#### 2026-09-05 — Aviso de días sin recaudación ingresada (SW v37)
- El aviso de días faltantes existía en **socios-comicion** y en **propi.solicitada**, pero **nunca se había agregado acá** — que es justamente donde se ingresa la recaudación, así que es donde más sirve.
- Aparece en **Agregar Dato** (arriba del formulario) y en **Historial**, con los días sin ingresar como chips: *«Faltan ingresar 3 días · Mar 02/09 · Mié 03/09 · Jue 04/09»*.
- Mismo criterio que las otras dos apps: se revisan los días entre el más antiguo con datos y **ayer** —hoy todavía se está trabajando—, como mucho los últimos 45.
- El cálculo usa **todas** las fechas con datos, no las que queden tras aplicar el filtro de la pantalla.
- Archivos: `index.html` (contenedores), `app.js` (`_diasSinIngreso`, `_pintarDiasFaltantes`). `app.js?v=19`, SW `recaudacion-cache-v37`, versión visible **v37**.

#### 2026-08-02 — El login dice "Acceso al Sistema de Recaudaciones" (SW v36)
- El título de la pantalla de ingreso pasó de **"Acceso al Sistema"** a **"Acceso al Sistema de Recaudaciones"**, para que quede claro a qué app se está entrando cuando se tienen las tres instaladas.
- Archivos: `index.html`. SW v36 (visible v36).

#### 2026-08-02 — Fix: el mismo socio aparecía dos veces en la tarjeta (SW v35)
- La misma persona llegaba por el canal en vivo y por la tabla con claves distintas, y se listaba duplicada. Ahora se deduplica por identidad estable (`app + socio_id`). Scripts `?v=21`, SW `recaudacion-cache-v35`, versión visible **v35**.

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
