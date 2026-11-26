# Infraestructura de Cuines (Terraform)

Todo lo que se puede crear por código vive aquí. Dos raíces independientes:

| Carpeta | Qué crea | State |
|---|---|---|
| `bootstrap/` | En GCP: APIs necesarias y el **bucket privado con versionado** donde se guarda el state de `stack/` | Local (`bootstrap/terraform.tfstate`, gitignored; no contiene secretos) |
| `stack/` | **Supabase**: proyecto (creado en el panel e importado) y ajustes de Auth (solo Google, Email desactivado, URLs). **GitHub**: repositorio (importado), Pages y variables del workflow (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) | Bucket de GCS, prefijo `cuines/stack` |

El state contiene secretos (contraseña de la base de datos, secreto de Google). El repo es público: **nunca** se sube `.env`, un state ni un `.tfvars` con valores reales. El ID del proyecto de GCP no está escrito en ningún archivo versionado: sale de `infra/.env`.

## Qué NO está en Terraform

- **El cliente OAuth de Google** (pantalla de consentimiento e ID de cliente web): ni Terraform ni la API de Google permiten crearlo. Se hace a mano en la consola (paso 6) y Terraform recibe el ID y el secreto como variables.
- **El esquema SQL** (`supabase/migrations/`): se sube con la CLI de Supabase (paso 7).
- **El Supabase local** (`supabase/config.jsonc`): es solo para desarrollar en tu máquina.

## Requisitos

`terraform` ≥ 1.6, `gcloud`, `gh` y `python3`. Todo se ejecuta a través de `infra/tf`, que **comprueba que usas tus credenciales personales y no las de Hike**: gcloud aislado en su propia carpeta, login de Google igual a `TF_GOOGLE_ACCOUNT` y cuenta activa de `gh` igual a la dueña del repo. Si algo no cuadra, se niega a ejecutar.

## Pasos (primera vez)

1. Configura el entorno:

   ```bash
   cp infra/.env.example infra/.env
   chmod 600 infra/.env
   ```

   Rellena `TF_VAR_gcp_project_id` y `TF_GOOGLE_ACCOUNT` (la cuenta personal propietaria del proyecto).

2. Login de Google personal, en una carpeta aparte (no toca tu gcloud de trabajo):

   ```bash
   CLOUDSDK_CONFIG="$HOME/.config/gcloud-cuines" gcloud auth application-default login
   ```

3. Bucket del state:

   ```bash
   infra/tf bootstrap init
   infra/tf bootstrap apply
   ```

4. Supabase (a mano, una vez): entra en [supabase.com](https://supabase.com) con tu cuenta **personal**, crea una organización (plan Free) y, dentro, un proyecto vacío (*Data API* activada; *Grant API access to new tables automatically* desactivado; *Enable RLS on new tables automatically* activado). Copia el *slug* de la organización a `TF_VAR_supabase_organization_id` y la *ref* del proyecto (está en su URL) a `TF_VAR_supabase_project_ref`. Crea un token en *Account → Access Tokens* (`SUPABASE_ACCESS_TOKEN`). La región del proyecto tiene que coincidir con `supabase_region` (por defecto `eu-west-2`).

5. Proyecto de Supabase, repo, Pages y variables. Primera pasada, sin Google:

   ```bash
   infra/tf stack init
   infra/tf stack plan
   infra/tf stack apply
   ```

   El `apply` importa el repositorio y Pages que ya existen. Revisa el `plan` antes: si el repo difiere de lo declarado, te lo enseña.

6. Cliente OAuth de Google (a mano, ver [README](../README.md#login-con-google)). Usa como URI de redireccionamiento el output `google_oauth_redirect_uri`:

   ```bash
   infra/tf stack output google_oauth_redirect_uri
   ```

   Pon el ID y el secreto en `infra/.env` (`TF_VAR_google_client_id`, `TF_VAR_google_client_secret`) y vuelve a aplicar para activar el login con Google en Supabase:

   ```bash
   infra/tf stack apply
   ```

7. Esquema en la nube (no es Terraform). Terraform no puede importar la contraseña de la base de datos: la que genera no es la del panel. Fíjala en el proyecto una vez (*Settings → Database → Reset database password*, o por la API de gestión) y después enlaza y sube las migraciones. En la CLI v3 `db push` apunta al Supabase **local** salvo que pases `--remote`:

   ```bash
   export SUPABASE_DB_PASSWORD="$(infra/tf stack output -raw supabase_db_password)"
   npx supabase link --project-ref "$(infra/tf stack output -raw supabase_project_ref)"
   npx supabase db push --remote --dry-run   # ensayo
   npx supabase db push --remote
   ```

8. Un push a `main` despliega la web en GitHub Pages con las variables que puso Terraform.

## Día a día

```bash
infra/tf stack plan    # qué cambiaría
infra/tf stack apply   # aplicarlo
```

El repositorio y el proyecto de Supabase tienen `prevent_destroy`: Terraform se niega a borrarlos por accidente.
