# Cuines — Plan del MVP (web responsive)

## Contexto

**Cuines** (antes "Bitácora de cocina"): diario social de cocina con la lógica de Polarsteps aplicada a recetas, como **web responsive** (no app nativa). El directorio `cuines/` está vacío: proyecto desde cero. Prioridades: privacidad garantizada en la base de datos (un borrador nunca visible para otros), **fotos protagonistas pero con mucho texto** (relatos largos, como los pasos de Polarsteps), hosting a coste cero y un backend que pueda reutilizar una futura app Expo.

## Decisiones ya confirmadas

| Tema | Decisión |
|---|---|
| Framework | Vite + React SPA (sin SSR) |
| Seguir | **Siempre solicitud que aprueba el dueño** (diario público o privado; antes un público aceptaba al instante) |
| Login | **Solo Google** (sin email/contraseña ni Apple) |
| Diarios | Uno por usuario: perfil = diario |
| Cocinar con alguien | Etiquetar participantes («¿Con quién lo cocinaste?»): autor único, solo quien escribe edita; el etiquetado acepta y puede salirse |
| Nombre | **Cuines** |
| Hosting | GitHub Pages en la cuenta **personal `marsolermendez`** (no la de Hike): gratis, URL fea (`marsolermendez.github.io/cuines`), sin dominio propio |
| Tono visual | Fotos protagonistas **y mucho texto** (relatos largos, estilo Polarsteps) |
| Recetas | **Con identidad:** una receta única que se cocina muchos días (cada uno con su relato) y por varias personas, con contadores de veces y personas |

---

## 1. Stack

| Capa | Elección |
|---|---|
| Front | Vite + React 18 + TypeScript `strict`, React Router, TanStack Query, Tailwind CSS, zod |
| Backend | Supabase: Postgres + RLS, Auth (solo Google, flujo PKCE), Storage |
| Local | Supabase CLI (Docker), `supabase gen types typescript`, pgTAP (`supabase test db`) |
| Hosting | **GitHub Pages** (estático, desplegado con GitHub Actions) + Supabase cloud (plan gratuito) |

**Por qué Supabase y no Firebase:** "solo seguidores" exige que la regla de lectura consulte otra tabla (`follows`). En Postgres es una política RLS de una línea; en Firestore las reglas no hacen joins cómodos y habría que desnormalizar por seguidor. El feed, los contadores y el recetario son consultas relacionales. Además Postgres evita lock-in y la futura app Expo usa el mismo backend con las mismas reglas.

**No incluido a propósito:** Redux/Zustand (TanStack Query basta), librería de componentes, librería de formularios, i18n (UI solo en español), e2e. Se añaden cuando duelan.

**Coste de elegir SPA:** los enlaces compartidos no muestran foto/título (los crawlers no ejecutan JS). Aceptado para el MVP; después se resuelve con una función serverless que sirva etiquetas Open Graph (`/e/:id`).

**Hosting gratis en GitHub Pages (URL fea, sin dominio propio):**
- Se publica en `https://<usuario>.github.io/cuines/`. Vite con `base: '/cuines/'` y **`HashRouter`** (rutas tipo `/#/e/123`): Pages no sabe hacer fallback a `index.html`, y con hash las recargas no dan 404.
- El login con Google usa **PKCE** (el código vuelve en `?code=`), que convive con `HashRouter`; el flujo por defecto (token en el hash) chocaría con él.
- Despliegue: GitHub Actions (`npm ci && npm run build` → Pages) en cada push a `main`.
- **El repo tiene que ser público** (Pages es gratis solo así en cuentas gratuitas). No es un problema de seguridad: en el cliente solo van la URL y la clave `anon` de Supabase, pensadas para ser públicas y protegidas por RLS. La `service_role` y el secreto de Google nunca entran en el repo.
- Supabase gratuito pausa el proyecto tras ~1 semana sin actividad (se reactiva a mano desde el panel). Aceptable para un MVP.

**Regla de arquitectura:** el cliente habla directo con Supabase y toda la lógica de negocio vive en SQL (RLS, constraints, triggers, 3 funciones RPC). Nada de API propia: así la app móvil futura no reimplementa nada.

---

## 2. Modelo de datos

### Borrador vs entrada → **una sola tabla `entries` con `status`** (`draft` | `published`)

- **"Cocinar ahora" es un `UPDATE`**, no una copia: conserva `id`, enlace a la receta y fotos sin duplicar filas ni mover archivos de Storage (la alternativa de dos tablas deja fotos huérfanas al convertir).
- **Una única fuente de verdad para privacidad:** una política de lectura, heredada por fotos, comentarios y likes.
- Timeline, recetario, borradores y feed son solo filtros sobre la misma tabla.
- **Riesgo:** que una política olvide mirar `status` y filtre un borrador. Mitigación en tres capas: (1) lectura de no-autores exige `status = 'published'`; (2) `CHECK` que obliga a `draft ⇒ visibility = 'private'`; (3) suite pgTAP que falla si algún usuario distinto del autor lee un borrador.

### Receta con identidad → **tabla `recipes` separada de `entries`**

- Una receta es **una fila**; cada vez que se cocina es **una entrada nueva** que apunta a ella (`entries.recipe_id`): mismo texto de receta, relato distinto cada día. El recetario y la página de receta salen de agrupar por `recipe_id`.
- **Entre personas:** "Guardar para cocinar" y "Cocinar otra vez" **enlazan la misma receta, no la copian**. Por eso se puede contar cuántas veces y cuántas personas la han cocinado (`recipe_stats`).
- **Contadores = lo que *tú* puedes ver.** `recipe_stats` es `SECURITY INVOKER`: pasa por la RLS de `entries`, así que no cuenta borradores, ni entradas privadas, ni de seguidos que no sigues. Nadie puede deducir que alguien cocinó algo en privado.
- **Edición:** solo edita la receta quien la creó; los demás la ven. Cambiar el texto se refleja en todas sus entradas (techo: no hay versiones). La variante personal va en el relato; "hacer mi versión" (copia con `forked_from`) queda fuera del MVP.
- **Borrado:** FK `ON DELETE RESTRICT`: no se borra una receta que tenga entradas o borradores (de quien sea).
- **Sin deduplicación:** si dos personas escriben "tortilla de patatas" por su cuenta, son dos recetas distintas.
- **Coste:** una tabla más y dos inserts al crear una entrada desde cero (receta, luego entrada; si falla la segunda se borra la primera; una receta huérfana solo la ve quien la creó).

### Tablas (Postgres)

**`profiles`** — `id` (= `auth.users.id`), `username` (único, minúsculas, `^[a-z0-9_]{3,20}$`, null hasta el onboarding), `display_name`, `bio`, `avatar_url` (la foto de Google por defecto, o la que subas), `is_private bool default false`, `created_at`. Trigger en `auth.users` que crea la fila y precarga nombre y foto desde los datos de Google.

**`recipes`** — `id`, `owner_id → profiles` (quien la creó; única persona que la edita), `title`, `source_url`, `ingredients text[]`, `steps text[]`, `created_at`, `updated_at`. Que tenga ingredientes y pasos, o `source_url`, se valida con zod en el cliente.

**`entries`** — `id`, `author_id → profiles`, **`recipe_id → recipes NOT NULL ON DELETE RESTRICT`**, `status`, `visibility` (`public|followers|private`), `title`, `body` (relato largo, hasta ~20 000 caracteres), `cooked_on date`, `planned_for date` (recordatorio), `published_at`, `tags text[]` (GIN; etiquetas **personales**, no de la receta), `position float8` (orden manual de borradores), `created_at`, `updated_at`. En un borrador, `body` es la nota (p. ej. "probar con menos sal").
- `CHECK`: `(status='draft' AND cooked_on IS NULL AND visibility='private') OR (status='published' AND cooked_on IS NOT NULL AND title IS NOT NULL AND planned_for IS NULL)`.
- Un solo borrador por receta y persona: `UNIQUE (author_id, recipe_id) WHERE status = 'draft'` (guardar dos veces es idempotente). Cocinar la misma receta otro día = una entrada publicada nueva.
- Índices parciales: `(author_id, published_at desc) WHERE status='published'` y `(author_id, position) WHERE status='draft'`.

**`entry_photos`** — `id`, `entry_id → entries on delete cascade`, `position smallint CHECK (0..9)`, `UNIQUE(entry_id, position)` (= máximo 10 en la BD), `path`, `thumb_path`, `width`, `height`, `placeholder` (miniatura 16 px en base64, ~300 B).

**`entry_participants`** — PK `(entry_id, user_id)`, `status` (`pending|accepted`). Solo sobre entradas `published`. El autor invita y puede quitar; el invitado acepta o se borra a sí mismo.

**`follows`** — PK `(follower_id, followee_id)`, `status` (`pending|accepted`), `CHECK follower <> followee`. Un trigger `BEFORE INSERT` fija `status = 'pending'` (el cliente no puede autoaceptarse); solo el seguido puede actualizar `status` (`GRANT UPDATE (status)`). Hacerse público no aprueba las pendientes.

**`likes`** — PK `(entry_id, user_id)`. **`comments`** — `id`, `entry_id`, `author_id`, `body` (1–1000), `created_at`.

**`reports`** — `id`, `reporter_id`, `comment_id`, `reason`, `status` (`open|resolved`), `UNIQUE(reporter_id, comment_id)`.

**Vista `diary_items`** (`security_invoker = true`) — entradas donde soy autor **o** participante aceptado. Alimenta el timeline; el recetario es esa misma lista agrupada por `recipe_id` en el cliente (veces y última vez).

**RPC (3), todas `SECURITY INVOKER` (la RLS aplica al que llama):**
- `save_as_draft(recipe_id)` — inserta un borrador privado que **enlaza** esa receta (`ON CONFLICT DO NOTHING`); la RLS impide guardar una receta que no ves.
- `recipe_stats(recipe_id)` → `times`, `people`: entradas `published` visibles para ti y autores distintos (los etiquetados no cuentan como personas).
- `feed(before, limit)` — entradas de seguidos aceptados, orden `published_at desc`.

### Reglas de privacidad (RLS en todas las tablas)

Lectura de `entries`:
```sql
author_id = auth.uid()
OR is_participant(id)                       -- autor te etiquetó (pending o accepted)
OR (status = 'published' AND (
     (visibility = 'public'    AND (NOT is_private(author_id) OR is_follower(author_id)))
  OR (visibility = 'followers' AND is_follower(author_id))))
```
- `is_follower`, `is_private`, `is_participant` son funciones `SECURITY DEFINER` con `search_path = ''` (evitan recursión entre políticas).
- Perfil privado: una entrada `public` se comporta como `followers`.
- Escritura: solo `author_id = auth.uid()`; `author_id` inmutable.
- `entry_photos`, `likes`, `comments`: lectura/alta solo si `EXISTS (SELECT 1 FROM entries WHERE id = entry_id)`, que ya pasa por la RLS de `entries`. No se duplica la lógica.
- `comments`: borra el autor del comentario **o** el autor de la entrada. `reports`: cada usuario solo ve los suyos.
- Los borradores no admiten participantes, comentarios ni likes (no son legibles por nadie más).
- `recipes` **lectura:** `owner_id = auth.uid()` o `EXISTS (SELECT 1 FROM entries WHERE recipe_id = recipes.id)` (otra vez decide la RLS de `entries`). Una receta solo existe para los demás si una entrada que ellos pueden ver la usa. **Escritura y borrado:** solo quien la creó.
- `entries` insert/update con `WITH CHECK`: la receta enlazada tiene que ser visible para ti (no se enlaza una receta ajena que no ves).

### Storage
- Bucket `photos` **privado**; ruta `{author_id}/{entry_id}/{photo_id}_{full|thumb}.jpg`. Lectura permitida solo si existe un `entry_photos` visible (RLS) con ese `path`. Escritura solo en tu carpeta. Límite 2 MB, solo `image/jpeg`.
- Se sirve con **signed URLs** en lote (1 h), cacheadas en TanStack Query. Un bucket público con rutas "inadivinables" filtraría fotos de borradores y entradas privadas a quien tenga la URL, lo que incumple el requisito.
- Bucket `avatars` público.

---

## 3. Pantallas y navegación

Móvil: barra inferior con 5 pestañas. Escritorio: misma navegación en barra lateral; contenido centrado (~680 px): ancho cómodo para leer relatos largos y fotos grandes. Las URLs llevan `#/` (ver Hosting).

**Inicio · Quiero cocinar · ＋ Nueva · Mi diario · Ajustes**

| Ruta | Pantalla |
|---|---|
| `/login`, `/onboarding` | Botón "Entrar con Google"; elegir `username` (nombre y foto vienen de Google, editables) y bio |
| `/` | **Inicio**: feed de seguidos (scroll infinito, tarjetas con foto grande, ♥ y comentarios) |
| `/draft` | **Quiero cocinar**: lista privada con buscador, filtro por etiquetas, orden (manual ↑↓, fecha prevista, recientes, A–Z), insignia "Para el sáb 29" |
| `/draft/new`, `/draft/:id` | Crear/editar borrador (receta por escrito o enlace; foto y notas opcionales) |
| `/new`, `/new?from=:draftId`, `/new?recipe=:id` | **Crear entrada**: fotos → título y fecha → relato → receta (nueva o una que ya tengo) → "¿con quién?" → visibilidad → publicar |
| `/e/:id`, `/e/:id/edit` | Entrada: fotos, relato, tarjeta de receta (enlaza a `/r/:id` con "hecha 7 veces · 4 personas"), comentarios, ♥, reportar |
| `/r/:id` | **Receta**: ingredientes y pasos, contadores "hecha N veces · M personas", **tus veces** (cada una con su relato), **otras personas** (solo lo que puedes ver), botones **Cocinar otra vez** y **Guardar para cocinar** |
| `/u/:username` | **Diario**, vista **línea temporal**: vertical por días y meses (propias + las que cocinó con otros) |
| `/u/:username/calendario` | **Diario**, vista **calendario mensual** (`?m=2026-11`): cuadrícula lun–dom, flechas de mes, **días con entradas resaltados** (varias el mismo día = contador); tocar un día lista sus entradas debajo; "hoy" con aro |
| `/u/:username/recetario` | Recetas del diario sin repetir, con "×3" y última vez; búsqueda |
| `/settings` | Perfil, privacidad del diario, solicitudes de seguimiento, invitaciones a "cocinar con" |

**De borrador a entrada:** en `/draft/:id`, botón **Cocinar ahora** → `/new?from=:id` con el formulario precargado (receta enlazada, fecha = hoy editable, fotos de referencia quitables). Nada cambia en la BD hasta pulsar **Publicar**, que hace el `UPDATE` (`status='published'`, `cooked_on`, `title`, `visibility`, `published_at`). Si cancelas, sigue siendo borrador.

**Crear entrada desde cero:** mismo formulario (`EntryForm`) con dos salidas: **Publicar** o **Guardar en Quiero cocinar** (crea borrador solo con la receta). Un único componente para crear, editar, convertir y guardar borrador. La receta se elige con un selector: **Receta nueva** (se crea al guardar) o **Una que ya tengo** (se enlaza y cuenta como otra vez).

**Cocinar otra vez:** en `/r/:id` → `/new?recipe=:id` con la receta ya elegida; crea una entrada publicada nueva con su propio relato.

**Guardar de otros:** botón en `/r/:id` (y en la tarjeta de receta de cada entrada) → RPC `save_as_draft(recipe_id)` → aviso "Guardada en Quiero cocinar" (con deshacer). El borrador **enlaza** la misma receta (no se copia nada) y, cuando la cocines, cuenta en sus contadores. No viajan fotos ni relato.

**Cocinar con alguien:** sección "¿Con quién lo cocinaste?" del formulario, justo debajo del relato (busca `username`); solo la autora edita. El invitado ve la solicitud en `/settings`; al aceptar, la entrada aparece en su diario y recetario como solo lectura con "con @autor". No aparece en el feed de sus seguidores (el feed solo trae entradas por autor).

**Estética y tono "Polarsteps": foto + relato.** Tema oscuro verde pino (fondo `#0C1F19`, tarjetas `#153028`), acento tomate `#FF7A5C`, texto hueso `#F4EFE3`, tipografía Sora y buena medida de lectura (~65 caracteres, interlineado amplio). Logo: olla con tapa y llamas. Tokens de color en variables CSS del tema de Tailwind (los nombres `cream`, `paper` y `clay` se conservan aunque ya no describan el color).
- **Entrada = una historia:** título y fecha, mosaico de fotos a sangre y debajo el relato completo en párrafos, seguido de una tarjeta de receta (enlazada, con sus contadores) y comentarios. Editor de texto que crece solo; el relato es tan importante como la foto.
- **Tarjeta del feed:** foto grande + título + primeras líneas del relato con "Leer más" (no solo foto).
- **Diario con tres vistas (pestañas): Línea temporal · Calendario · Recetario.** Es la misma lista de entradas vista de tres formas.
- **Calendario:** una consulta por mes (`cooked_on` entre el día 1 y el último, sobre `diary_items`), agrupada por día en el cliente con la cadena `YYYY-MM-DD` (nada de `new Date(string)`: `cooked_on` es una fecha sin zona horaria y así se evitan desfases). Sin librería: rejilla CSS de 7 columnas. En el diario de otra persona solo se resaltan los días con entradas **que tú puedes ver** (lo decide la RLS, no el cliente).
- **Timeline del diario:** línea vertical; cada día muestra miniatura, título, extracto del relato y, si repites receta, "3.ª vez".
- **Sin editor de texto enriquecido:** texto plano con párrafos. Techo: no hay fotos intercaladas dentro del relato ni negritas; se añade más adelante si se echa en falta.

---

## 4. Imágenes (sin dependencias, en el navegador)

1. Al elegir archivos (máx. 10): `createImageBitmap(file, { imageOrientation: 'from-image' })`.
2. Canvas → **full** 1600 px (lado largo, JPEG q≈0.82, ~300 KB) + **thumb** 480 px (~30 KB) + **placeholder** 16 px en base64.
3. Subida con concurrencia 3 y barra de progreso; inserta `entry_photos` con `width/height`.
4. Feed: placeholder desenfocado → thumb → full en el detalle. `loading="lazy"`, `decoding="async"` y `aspect-ratio` desde `width/height` (sin saltos de layout).

**Se usa JPEG, no WebP:** Safari no codifica WebP desde canvas (devolvería PNG). Techo conocido: HEIC en Chrome de escritorio no se decodifica (se avisa "conviértela a JPG"); Safari/iOS sí. Si más adelante pesa, se pasa a Image Transformations de Supabase (plan de pago).

Borrado: el cliente elimina los archivos de Storage y luego la fila. Si falla a medias quedan huérfanos; limpieza periódica pospuesta.

---

## 5. Moderación básica

- Reportar un comentario (motivo) → fila en `reports`.
- Borrar: tu comentario, o cualquier comentario en tu entrada.
- Revisión de `reports` desde el panel de Supabase (sin pantalla de admin en el MVP).
- Sin bloqueo de usuarios ni edición de comentarios (pospuesto).

---

## 6. Estructura del repo

```
cuines/
  README.md              # ejecución en local, variables, despliegue
  .env.example           # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (solo clave anon)
  package.json  vite.config.ts  tsconfig.json   # base: '/cuines/', HashRouter
  .github/workflows/deploy.yml   # build + despliegue a GitHub Pages
  docs/mockup.html       # maqueta clicable de las pantallas (Fase 0)
  supabase/
    config.jsonc         # Google OAuth lee GOOGLE_CLIENT_ID/SECRET de supabase/.env (en .gitignore)
    migrations/          # 0001 schema · 0002 rls · 0003 storage · 0004 funciones
    seed.sql             # usuarios y entradas de prueba
    tests/privacy.test.sql   # pgTAP
  src/
    main.tsx  App.tsx    # router + layout con navegación
    lib/                 # supabase.ts, database.types.ts (generado), images.ts, schemas.ts (zod)
    components/          # EntryCard, ProgressiveImage, PhotoPicker, TabBar...
    features/            # auth · diary · drafts · recipes · feed · social · moderation
```
Nunca se usa la `service_role` en el cliente; ningún ID de proyecto va en el código (todo por `.env`).

---

## 7. Fases (cada una termina en algo probable)

| # | Entrega | Cómo se prueba |
|---|---|---|
| **0** | Esqueleto: Vite + TS + Tailwind + HashRouter, Supabase local, tipos generados, README; maqueta aprobada guardada en `docs/mockup.html`; workflow de GitHub Pages | `supabase start` + `npm run dev` abre la app; `npm run typecheck` en verde; un push a `main` publica en `github.io/cuines` |
| **1** | Login solo con Google, onboarding, perfil, avatar, `is_private`; RLS de `profiles` | Entrar con Google (credenciales OAuth propias en `supabase/.env`), elegir username, cambiar avatar; un 2.º usuario no puede editar mi perfil |
| **2** | **Diario**: crear/editar/borrar entradas publicadas con fotos (pipeline completo), **receta nueva** (tabla `recipes` desde el día uno) y visibilidad; timeline por días **y vista calendario mensual**; RLS de `recipes`, `entries`, `entry_photos`, Storage; **suite pgTAP v1** | Publicar entrada con 3 fotos y verla en la línea temporal y como día resaltado en el calendario (tocarlo la lista; dos entradas el mismo día muestran contador; en el diario de otra cuenta no se resalta un día que solo tiene entradas privadas); pesos de red ≤ ~300 KB/foto; otro usuario no accede a una foto privada (ni por URL firmada de otro) |
| **3** | **Borradores**: Quiero cocinar (etiquetas, búsqueda, orden, fecha prevista), **Cocinar ahora**, guardar para después | Un borrador no sale en `/u/:username` ni en consultas de otro usuario (SQL y navegador); la conversión conserva receta y fotos |
| **4** | **Social**: seguir (siempre con aprobación), feed, perfiles públicos, likes, comentarios, reportar y borrar; pgTAP ampliada | Dos navegadores con dos cuentas: solicitud pendiente → aceptada → aparece en el feed; comentario reportado crea fila en `reports` |
| **5** | **Recetas con identidad**: página `/r/:id`, **Cocinar otra vez**, selector "una que ya tengo", contadores (`recipe_stats`), **recetario** agrupado, **guardar de otros como borrador**; y **cocinar con alguien** | Cocino la misma receta 3 días con relatos distintos y sale una sola vez en el recetario con "×3"; B guarda mi receta y la cocina: la receta marca "2 personas"; C no cuenta entradas privadas ni puede guardar una receta que no ve; A etiqueta a B, B acepta y la ve en su diario (solo lectura) y se puede salir |
| **6** | Pulido y despliegue: skeletons, estados vacíos, errores, revisión a 375/768/1280 px, accesibilidad básica (alt, foco), Supabase cloud, repo y Pages con **Terraform** (`infra/`), Google OAuth en producción, deploy a GitHub Pages | URL `github.io` pública; recorrido completo en móvil y escritorio |

---

## 8. Verificación

- **Privacidad (lo crítico):** `supabase test db` ejecuta `privacy.test.sql`. Matriz de actores: autor, seguidor aceptado, seguidor pendiente, no seguidor, participante pending/accepted, `anon`. Casos: borrador invisible para todos salvo el autor; `published` × {public, followers, private}; perfil privado + entrada `public`; fotos/comentarios/likes heredan; no puedo autoaceptar un follow; no puedo comentar lo que no veo; `draft` con visibilidad ≠ `private` rechazado por el `CHECK`; `reports` ajenos ilegibles. Recetas: invisibles para otros mientras solo las usen borradores o entradas privadas; `recipe_stats` ignora borradores y entradas que no veo; solo quien la creó edita una receta; no se puede enlazar una receta que no veo; no se borra una receta con entradas.
- Cada fase: `npm run typecheck` + `supabase test db` + recorrido manual descrito en la tabla.
- Responsive: revisión manual a 375 / 768 / 1280 px en el navegador.

---

## 9. Supuestos a confirmar (se pueden cambiar sin rehacer el plan)

1. **"Público" = cualquier usuario registrado.** No hay acceso anónimo en el MVP (se abre luego con una política para `anon`).
2. **Orden de borradores:** selector + botones subir/bajar, no arrastrar y soltar (la columna `position` ya permite añadirlo).
3. **Búsqueda, filtro por etiquetas y orden de borradores/recetario se hacen en el cliente** (cientos de filas por usuario; sin `tsvector`). Techo: miles de borradores.
4. **Fotos:** 1–10 en entradas publicadas (el mínimo de 1 se valida en la interfaz; el máximo, en la BD). Borradores: 0–10.
5. **Recordatorio de fecha prevista** = insignia visible y orden, sin notificaciones (push queda fuera).
6. **Participantes** ven la entrada aunque sea privada (la has compartido tú con ellos expresamente).
7. Interfaz solo en español (¿catalán más adelante?); sin modo oscuro.
8. **Solo Google:** todos los usuarios necesitan cuenta Google. Email o Apple se añaden después sin tocar el modelo de datos.
9. **Alta única de Google OAuth** (Google Cloud Console → cliente OAuth → pegarlo en Supabase), explicada paso a paso en el README. Necesita unos 10 minutos tuyos.
10. **Repo público** en la cuenta personal `marsolermendez` (necesario para Pages gratis); nunca en la cuenta ni las organizaciones de Hike.
11. **Cada receta tiene quien la creó y solo esa persona la edita.** Los demás la enlazan; su variante la anotan en el relato. "Hacer mi versión" queda fuera del MVP.
12. **Editar una receta cambia el texto en todas sus entradas** (sin versiones). Si pesa, se añade historial.
13. **Contadores = veces y personas que *tú* puedes ver** (autores de entradas publicadas visibles; los etiquetados no cuentan como personas). No hay contador global anónimo para no filtrar actividad privada.
14. **Sin deduplicación:** dos personas que escriben la misma receta por separado crean dos recetas.
15. **Calendario:** la semana empieza en lunes; los meses se cargan bajo demanda. Los borradores con `planned_for` **no** aparecen en el calendario (no son entradas).

## Fuera del MVP (sin bloquearlo)

- **Mapa:** columnas nulas de lugar en `entries` cuando toque.
- **Diarios colaborativos / múltiples:** `entry_participants` ya es el primer paso; añadir tabla `diaries` con migración.
- **Importar desde URL:** `recipe_url` ya existe; función serverless después.
- **Estadísticas del año:** consultas SQL sobre `entries`.
- **Push:** PWA + service worker; `planned_for` ya existe.
- **Borradores compartidos/públicos:** se relaja el `CHECK` y se amplía el enum `visibility`.
- **Previews al compartir enlaces:** función serverless con Open Graph.
- **Variantes y fusión de recetas:** `forked_from_recipe_id` (copia con atribución) y "es la misma receta" para unir duplicados.

## Notas de implementación (desvíos respecto al plan)

**Fase 2**
- **Políticas sin recursión.** `entries` consulta `recipes` al insertar y `recipes` consulta `entries` para saber si una receta es visible: Postgres lo rechaza (*infinite recursion in policy*). La regla de lectura vive en `can_read_entry(...)` y la política de `recipes` usa `recipe_has_readable_entry(...)`, `SECURITY DEFINER`, que lee `entries` sin pasar por su RLS.
- **`is_follower` e `is_participant` son stubs que devuelven `false`** hasta las Fases 4 y 5 (aún no existen `follows` ni `entry_participants`). Lo «solo seguidores» lo ve únicamente su autora: falla cerrado. La Fase 4 y la 5 los sustituyen con `create or replace`.
- **La vista `diary_items` no existe todavía:** sin participantes, el diario es `entries` filtrado por `author_id`. Se crea en la Fase 5.
- **FK `entries.recipe_id` en `NO ACTION`, no `RESTRICT`.** Misma garantía (no se borra una receta con entradas) pero se comprueba al final de la sentencia, así un borrado de cuenta en cascada puede llevarse a la vez las entradas y sus recetas.
- **`entry_photos` exige que la ruta cuelgue de `{autora}/{entrada}/`.** Sin eso, una entrada propia podría apuntar a la foto privada de otra persona y heredar su lectura en Storage (cubierto en `diary.test.sql`).
- **Ids generados en el cliente** (`crypto.randomUUID()`): las fotos se suben antes de crear las filas, y si algo falla no queda una entrada a medias a la vista.
- **Al quitar fotos, primero se borran las filas y luego los archivos** (el plan decía al revés): si falla a medias queda un archivo huérfano que nadie lee, en vez de una foto rota en el diario. Las filas se borran antes de insertar las nuevas porque `(entry_id, position)` es único.
- **La caché de TanStack Query se vacía al cambiar de usuario** (`AuthProvider`): no distingue quién mira y enseñaba datos de la sesión anterior.
- **Sin reordenar fotos ni visor a pantalla completa** (se quitan y se añaden; la miniatura abre la foto completa en otra pestaña). El selector «una que ya tengo» llega en la Fase 5.

**Fase 3**
- **Casi sin cambios de modelo:** la Fase 2 ya dejó listo `status = 'draft'`, el CHECK de privacidad, `tags`, `position` y `planned_for`. Solo se añade un índice para listar borradores en orden manual.
- **«Cocinar ahora» es un `UPDATE` de la misma fila** (conserva id, receta, fotos y etiquetas). Al publicar se pone `planned_for = null`, porque el CHECK lo exige. Nada se escribe hasta pulsar Publicar: si cancelas, sigue siendo borrador.
- **Un borrador necesita decir cómo se hace la receta** (ingredientes, pasos o enlace), como pedía el plan; una entrada publicada solo exige el nombre.
- **«Guardar en Quiero cocinar»** desde el formulario de entrada crea un borrador solo con la receta (sin relato ni fotos).
- **Búsqueda, etiquetas y orden se hacen en el cliente** (sin tildes ni mayúsculas). Reordenar a mano intercambia `position` con la vecina (dos `UPDATE`, no atómicos) y solo se permite viendo la lista entera.
- **Un solo camino de escritura:** `saveEntry` (receta + entrada + fotos, con deshacer si falla) y `deleteEntry` los usan el formulario de entrada, el de borrador, «Guardar en Quiero cocinar» y las dos pantallas de borrado.
- Un borrador abierto como entrada (`/e/:id`) redirige a `/draft/:id`; un borrador no se lee como historia.

**Fase 4**
- **`is_follower` deja de ser un stub:** `create or replace` lo implementa con la tabla `follows` (solo cuentan los seguimientos aceptados). Con eso «solo seguidores» y las entradas públicas de diarios privados funcionan sin tocar `can_read_entry` ni ninguna política de la Fase 2.
- **El estado de un seguimiento lo decide el servidor** (trigger `BEFORE INSERT`): siempre pendiente, sea el diario público o privado. El cliente no puede escribir `status` al insertar. Solo la persona seguida lo cambia, y solo a `accepted`; rechazar o dejar de seguir es borrar la fila. `is_private` solo decide si las entradas `public` las lee cualquiera o solo quien te sigue; hacerse público no aprueba solicitudes pendientes.
- **`follows` solo lo leen las dos partes**, así que no hay contadores de seguidores en el perfil (no se filtra el grafo social). Quien busca personas ve nombre y @usuario de cualquiera, también de diarios privados: es lo que permite solicitar seguirlos.
- **Likes y comentarios heredan la privacidad de la entrada** (la subconsulta pasa por la RLS de `entries`); los borradores no admiten ninguno. Los comentarios no se editan. Borra quien lo escribió o la autora de la entrada.
- **Reportes:** cada persona solo ve los suyos; la revisión se hace desde el panel de Supabase (no hay pantalla de moderación). Si el comentario se borra, su reporte se va con él (`on delete cascade`). No hay bloqueo de usuarios.
- **`feed(p_before, p_limit)` es `SECURITY INVOKER`** y pagina por `published_at`; la RLS sigue decidiendo qué se puede leer de cada entrada.
- **PostgREST y las tablas puente:** al existir `likes`, `comments` y `reports`, `entries ↔ profiles` también es una relación muchos a muchos y `profiles(...)` daba `300 Multiple Choices`. Se nombra la clave foránea (`profiles!entries_author_id_fkey`).
- **Me gusta con `likes(user_id)`:** de ahí salen el recuento y si le di yo (un filtro sobre una relación con alias no funciona en llamadas RPC). Techo: miles de likes en una entrada traerían miles de ids; entonces se pasa a un recuento en SQL.
- **Los tests usan el dominio `@pgtap.test`** para no chocar con cuentas reales de desarrollo.

**Fase 5**
- **Contadores = lo que ves tú.** `recipe_stats` es `SECURITY INVOKER`: pasa por la RLS de `entries`, así que no cuenta borradores, ni entradas privadas, ni de quien no sigues. Las personas etiquetadas no suman como personas (solo las autoras).
- **`save_as_draft` enlaza, no copia,** y es idempotente (devuelve el borrador que ya tuvieras). Como también es invoker, la RLS impide guardar una receta que no ves. En la página de la receta el aviso trae «Deshacer», que borra solo el borrador.
- **Una receta ajena no se edita:** un borrador o una entrada que enlazan la receta de otra persona la muestran de solo lectura (la edita quien la creó). No hay pantalla propia para editar una receta; se edita desde cualquiera de sus entradas o borradores. «Una que ya existe» busca entre las recetas que puedo ver.
- **`diary_items` (vista `security_invoker`)** une las entradas que escribió una persona con aquellas donde está etiquetada y aceptó (`shared`, `author_*`). Alimenta la línea temporal, el calendario y el recetario. Al ser vista, los tipos generados lo marcan todo como nulo: se afinan con `overrideTypes`.
- **Etiquetar = compartir.** `is_participant` ya no es un stub: la persona etiquetada (pendiente o aceptada) lee la entrada aunque sea privada, pero solo mientras esté publicada (`can_read_entry` lo exige). Solo la autora etiqueta, solo en publicadas, no a sí misma, con tope de 10 personas por entrada (sin tope sería una forma barata de enviar una entrada a mucha gente). La persona etiquetada acepta (solo a `accepted`) o se sale; la autora quita. El estado nace `pending`: el cliente no lo escribe.
- **Quien lee ve a quienes aceptaron** («cocinado con…»); las pendientes solo las ven las dos partes. Un tercero no ve etiquetas de entradas que no puede leer.
- **Etiquetar es best-effort tras guardar:** la entrada ya existe, así que si falla se avisa y se puede repetir editándola (no se deshace la entrada).
- **Recetario con techo de 1000 filas** (límite de PostgREST); con más veces cocinadas habría que agrupar en SQL.
- Textos de la interfaz sin género (por ejemplo «Te etiquetaron…», «Te damos la bienvenida…»).

**Fase 6**
- **Bundle por rutas:** cada pantalla es un archivo (`React.lazy`) y las librerías van en tres archivos aparte (`react`, `supabase`, `vendor`) para que el navegador las reutilice tras cada despliegue. De 681 kB a 16 kB de código de la app. Si una pestaña abierta pide un archivo con nombre antiguo tras un despliegue, `ErrorBoundary` lo detecta y pide recargar en vez de dejar la pantalla en blanco.
- **Acciones de GitHub fuera de Node 20** (`checkout@v7`, `setup-node@v7`, `upload-pages-artifact@v5`, `deploy-pages@v5`).
- **Estados:** esqueletos de carga donde irán las tarjetas, errores con «Reintentar», 404 con salida y título de pestaña por pantalla.
- **Accesibilidad:** anillo de foco visible global, borde de campos a 3:1, texto de acento a contraste AA (`clay` en lugar de `clay-soft` para texto), «Saltar al contenido» (un botón, no un enlace `#…`: con `HashRouter` cambiaría la ruta), zonas táctiles de ≥ 40 px y `aria-label` en la navegación.
- **Revisión a 375, 768 y 1280 px:** sin desbordes horizontales en las 14 pantallas a 375 px; la barra lateral aparece desde 768 px y la lectura se queda en 680 px.
- **Endurecimiento de producción:** auditoría directa de la base de datos (RLS en todas las tablas, `anon` sin privilegios, vista `security_invoker`, bucket `photos` privado). Se cierra la función `rls_auto_enable` que crea el panel de Supabase, invocable por `anon`, y se revoca EXECUTE de las funciones de disparador propias.

**Actividad (después de la Fase 6)**
- **Nueva pestaña «Actividad» (`/actividad`, icono de campana, entre Inicio y Quiero cocinar):** lista los me gusta y comentarios de otras personas en mis entradas, de más reciente a más antiguo, con enlace a la entrada. Las pestañas pasan de 5 a 6 (caben a 375 px). Las solicitudes de seguir y las etiquetas siguen en Ajustes.
- **Sin migración ni tabla nueva:** son dos consultas (`likes` y `comments` con `entries!inner` filtrado por mi autoría), mezcladas en el cliente. La RLS de siempre decide qué se lee. Techo: las últimas 30 de cada tipo, sin paginar ni agrupar («A y 3 más»).
- **«Nuevo» = posterior a mi última visita a Actividad**, y la insignia de la barra cuenta esas. La marca se guarda en `localStorage` (por navegador, no por cuenta en la base de datos): en otro dispositivo cada uno tiene su propio «visto». La primera vez arranca en «ahora», así que no avisa de lo que ya había. Si hace falta sincronizarlo, una columna `activity_seen_at` en `profiles`.

**Lista de acceso (después de la Fase 6)**
- **Tabla `allowed_emails` + trigger `BEFORE INSERT` en `auth.users`:** solo los correos de la lista pueden crear cuenta. Es independiente de Google: aunque la pantalla de consentimiento esté publicada, no se abre el registro. La tabla no es accesible desde la API (RLS sin políticas y sin privilegios).
- **El filtro solo afecta a los altas del servicio de Auth** (`session_user = 'supabase_auth_admin'`). Migraciones, tests y SQL del panel pasan sin más; así los tests y el seed no necesitan permiso.
- **La decisión vive en `email_has_access(text)`** (comparación exacta, sin distinguir mayúsculas ni espacios alrededor), que se prueba en pgTAP. El rechazo real lo dispara la conexión del Auth, que los tests no pueden suplantar (`postgres` no puede asumir ese rol): se comprueba contra el Auth local con `curl`, como se describe en el README.
- **No echa a quien ya tiene cuenta.** Para eso, además de quitarlo de la lista, se borra o bloquea en *Authentication → Users*.
- **Los correos reales no van en ninguna migración** (repo público): se cargan aparte. La pantalla de entrada explica el rechazo.
- **Pantalla de consentimiento publicada** (26-nov-2026). Google bloquea «Publicar» sin URL de página principal y de política de privacidad, así que se añadió `public/privacidad.html` (contacto: *Issues* del repo, sin correos reales) y se registró `marsolermendez.github.io` como dominio autorizado. Desde entonces la lista de acceso es la única barrera: queda pendiente probar un rechazo real en producción con una cuenta de Google ajena a la lista.

