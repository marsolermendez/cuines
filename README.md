# Cuines

Diario social de cocina, con la lógica de Polarsteps aplicada a recetas. Cada persona lleva un diario cronológico de lo que cocina (fotos, relato y receta), guarda en **Quiero cocinar** lo que quiere probar y sigue los diarios de otras personas.

Web responsive (móvil y escritorio). El plan completo, con el modelo de datos y las reglas de privacidad, está en [docs/plan.md](docs/plan.md).

## Stack

- **Front:** Vite + React + TypeScript (`strict`), React Router (`HashRouter`), TanStack Query, Tailwind CSS v4, zod.
- **Backend:** Supabase (Postgres con RLS, Auth con Google, Storage). La privacidad se cumple en la base de datos, no en la interfaz.
- **Hosting:** GitHub Pages + Supabase (plan gratuito).

## Requisitos

- Node 20 o superior.
- Docker Desktop en marcha (para el Supabase local).
- Una cuenta de Google (el login es solo con Google).

## Ejecutar en local

```bash
npm install
cp .env.example .env.local
npm run db:start
```

`npm run db:start` imprime la URL y la clave `anon` del Supabase local. Pégalas en `.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) y arranca la app:

```bash
npm run dev
```

La app abre en http://localhost:5173. La clave `anon` es pública por diseño; la `service_role` no se usa nunca en el cliente.

## Login con Google

Cuines solo permite entrar con Google. Hace falta un cliente OAuth (gratis, unos 10 minutos). Créalo con tu cuenta de Google personal:

1. En [Google Cloud Console](https://console.cloud.google.com/) crea un proyecto (por ejemplo `cuines`).
2. *APIs y servicios → Pantalla de consentimiento de OAuth*: tipo **Externo**, nombre de la app `Cuines`, tu correo de contacto. Los permisos por defecto (email, perfil, openid) bastan. Mientras esté en modo *Pruebas*, añade tu cuenta como usuario de prueba; en *Producción* puede entrar cualquiera.
3. *Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web*. En **URI de redireccionamiento autorizados** añade:
   - local: `http://127.0.0.1:54321/auth/v1/callback`
   - producción: `https://<ref-de-tu-proyecto>.supabase.co/auth/v1/callback`
4. Copia `supabase/.env.example` a `supabase/.env` (está en `.gitignore`), pega el *ID de cliente* y el *secreto* y reinicia Supabase:

```bash
npx supabase stop && npm run db:start
```

El secreto de Google nunca va en el repo ni en el código del cliente.

### Producción (Supabase cloud)

El proyecto de producción (Google activado, **Email desactivado** y URLs de redirección) lo aplica Terraform: ver [infra/README.md](infra/README.md). Lo único manual es crear el cliente OAuth y pasar su ID y secreto a `infra/.env`. Como URI de redireccionamiento de producción usa el output `google_oauth_redirect_uri` de Terraform.

**Pantalla de consentimiento en producción.** Mientras esté en modo *Pruebas*, solo entran las cuentas añadidas como usuarios de prueba (máximo 100). Para abrir la app a cualquiera: *Google Auth Platform → Público → Publicar aplicación*. Con los permisos básicos (email, perfil, openid) no hace falta verificación de Google.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Comprueba tipos y genera `dist/` (con base `/cuines/`) |
| `npm run typecheck` | Solo comprueba tipos |
| `npm run db:start` | Arranca Supabase local (Docker) |
| `npm run db:reset` | Recrea la base local con migraciones y `seed.sql` |
| `npm run db:types` | Regenera `src/lib/database.types.ts` desde la base local |
| `npm run db:test` | Ejecuta los tests pgTAP de privacidad (199, con una matriz de actores) |

## Despliegue en GitHub Pages

El repositorio, GitHub Pages y las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` los gestiona Terraform (ver [infra/README.md](infra/README.md)); el repositorio tiene que ser **público** para que Pages sea gratis. Cada push a `main` ejecuta [.github/workflows/deploy.yml](.github/workflows/deploy.yml) y publica en `https://<usuario>.github.io/<repo>/`.

Las rutas llevan `#/` (por ejemplo `/#/e/123`) porque Pages no hace fallback a `index.html`.

### Publicar un cambio

1. `npm run typecheck && npm run db:test` en local.
2. Si hay migraciones nuevas, **antes del push**: ensayo con `npx supabase db push --remote --dry-run` y luego `npx supabase db push --remote` (en la CLI v3 sin `--remote` apunta al Supabase local; la contraseña de la base de datos sale de `infra/tf stack output -raw supabase_db_password`).
3. `git push origin main`: el workflow compila y publica. Una pestaña abierta durante un despliegue puede pedir un archivo con nombre antiguo; la app lo detecta y pide recargar.

### Mantenimiento

- El plan gratuito de Supabase **pausa el proyecto tras ~1 semana sin actividad**: se reactiva desde su panel.
- Los reportes de comentarios se revisan en la tabla `reports` del panel de Supabase (no hay pantalla de moderación).
- El token de acceso de Supabase de `infra/.env` solo hace falta para ejecutar Terraform; conviene que caduque o revocarlo cuando no se use.

## Estructura

```
infra/          Terraform (GCP, Supabase, GitHub)
public/         favicon
src/            app React (router, componentes, features)
src/lib/        cliente de Supabase, tipos generados, utilidades
supabase/       configuración, migraciones, seed y tests pgTAP
docs/           plan del MVP
.github/        workflow de despliegue
```

## Estado

**MVP completo (fases 0 a 6):** login con Google, diario con fotos y relato, línea temporal y calendario, borradores («Quiero cocinar», «Cocinar ahora»), seguir con aprobación, feed, me gusta, comentarios y reportes, recetas con identidad (contadores, recetario, guardar las de otras personas, «Cocinar otra vez») y cocinar con alguien. Plan y decisiones de cada fase en [docs/plan.md](docs/plan.md).

### Límites conocidos

- **Sin vista previa al compartir enlaces** (es una SPA: los rastreadores no ejecutan JS). Se resolvería con una función que sirva etiquetas Open Graph.
- **Sin notificaciones** ni avisos de actividad; las solicitudes se ven en Ajustes.
- **Sin pantalla para editar una receta** ni para reordenar fotos; se edita desde cualquiera de sus entradas.
- **Recetario limitado a 1000 filas** y me gusta como lista de ids por entrada: suficiente para un MVP, a pasar a SQL si crece.
- **Los comentarios no se editan** y un reporte desaparece con su comentario.
- **HEIC en Chrome de escritorio** no se decodifica (Safari y iOS sí): hay que convertir la foto a JPG.
