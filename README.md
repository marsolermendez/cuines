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

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Comprueba tipos y genera `dist/` (con base `/cuines/`) |
| `npm run typecheck` | Solo comprueba tipos |
| `npm run db:start` | Arranca Supabase local (Docker) |
| `npm run db:reset` | Recrea la base local con migraciones y `seed.sql` |
| `npm run db:types` | Regenera `src/lib/database.types.ts` desde la base local |
| `npm run db:test` | Ejecuta los tests pgTAP de privacidad |

## Despliegue en GitHub Pages

1. Crea un repositorio **público** en GitHub y sube el código a `main`.
2. En *Settings → Pages*, elige *Source: GitHub Actions*.
3. En *Settings → Secrets and variables → Actions → Variables*, crea `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con los valores de tu proyecto de Supabase (son públicos, van como Variables, no como Secrets).
4. Cada push a `main` ejecuta [.github/workflows/deploy.yml](.github/workflows/deploy.yml) y publica en `https://<usuario>.github.io/<repo>/`.

Las rutas llevan `#/` (por ejemplo `/#/e/123`) porque Pages no hace fallback a `index.html`.

## Estructura

```
src/            app React (router, componentes, features)
src/lib/        cliente de Supabase, tipos generados, utilidades
supabase/       configuración, migraciones, seed y tests pgTAP
docs/           plan del MVP
.github/        workflow de despliegue
```

## Estado

Fase 0 (esqueleto) lista. Siguiente: Fase 1, login con Google y perfil. Fases en [docs/plan.md](docs/plan.md#7-fases-cada-una-termina-en-algo-probable).
