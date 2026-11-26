# Infraestructura de Cuines: proyecto de Supabase (con su Auth) y repositorio de GitHub (con Pages y variables).
# Requiere haber aplicado antes infra/bootstrap (bucket del state). Ver infra/README.md.

terraform {
  required_version = ">= 1.6"

  required_providers {
    supabase = {
      source  = "supabase/supabase"
      version = "~> 1.0"
    }
    github = {
      source  = "integrations/github"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }

  # El bucket se pasa en `init` (-backend-config) para no escribir el ID del proyecto en el código.
  backend "gcs" {
    prefix = "cuines/stack"
  }
}

provider "supabase" {
  # Token personal por SUPABASE_ACCESS_TOKEN.
}

provider "github" {
  owner = var.github_owner
  # Token por GITHUB_TOKEN (infra/tf lo toma de `gh auth token` tras comprobar la cuenta).
}

locals {
  site_url = "https://${var.github_owner}.github.io/${var.github_repository}"
}

# ---------------------------------------------------------------- Supabase

resource "random_password" "supabase_db" {
  length  = 32
  special = false
}

# El proyecto se crea en el panel de Supabase (vacío) y se importa aquí. La contraseña de la base de datos no
# se puede importar: random_password genera la de referencia y hay que fijarla en el proyecto (ver infra/README.md).
import {
  to = supabase_project.cuines
  id = var.supabase_project_ref
}

resource "supabase_project" "cuines" {
  organization_id   = var.supabase_organization_id
  name              = var.supabase_project_name
  database_password = random_password.supabase_db.result
  region            = var.supabase_region

  lifecycle {
    prevent_destroy = true
    # La contraseña se genera una vez; cambiarla en Supabase no debe provocar un reemplazo.
    ignore_changes = [database_password]
  }
}

# Auth solo con Google. Email desactivado: la clave anon es pública y, con Email activo,
# cualquiera podría crear cuentas con correo y contraseña llamando a la API.
resource "supabase_settings" "cuines" {
  project_ref = supabase_project.cuines.id

  auth = sensitive(jsonencode({
    site_url                  = local.site_url
    uri_allow_list            = "${local.site_url}/**"
    external_email_enabled    = false
    external_google_enabled   = var.google_client_id != ""
    external_google_client_id = var.google_client_id
    external_google_secret    = var.google_client_secret
  }))
}

data "supabase_apikeys" "cuines" {
  project_ref = supabase_project.cuines.id
}

# ---------------------------------------------------------------- GitHub

# El repositorio ya existía (creado con `gh repo create`): se importa en el primer apply.
import {
  to = github_repository.cuines
  id = var.github_repository
}

resource "github_repository" "cuines" {
  name        = var.github_repository
  description = "Cuines: diario social de cocina con fotos, relato y receta, estilo Polarsteps"
  # GitHub Pages es gratis solo con repositorio público.
  visibility = "public"

  has_issues      = true
  has_projects    = true
  has_wiki        = true
  has_discussions = false

  lifecycle {
    prevent_destroy = true
  }
}

# GitHub Pages desplegado por Actions (el workflow sube dist/). Ya estaba activado: también se importa.
import {
  to = github_repository_pages.cuines
  id = var.github_repository
}

resource "github_repository_pages" "cuines" {
  repository = github_repository.cuines.name
  build_type = "workflow"
}

# Valores públicos (URL y clave anon): variables del repo, no secrets. Los lee .github/workflows/deploy.yml.
resource "github_actions_variable" "supabase_url" {
  repository    = github_repository.cuines.name
  variable_name = "VITE_SUPABASE_URL"
  value         = "https://${supabase_project.cuines.id}.supabase.co"
}

resource "github_actions_variable" "supabase_anon_key" {
  repository    = github_repository.cuines.name
  variable_name = "VITE_SUPABASE_ANON_KEY"
  value         = data.supabase_apikeys.cuines.anon_key
}
