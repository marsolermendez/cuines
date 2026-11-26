# Paso 0: lo mínimo en GCP para poder guardar el state de Terraform (APIs y bucket).
# Su propio state es local (infra/bootstrap/terraform.tfstate, gitignored) y no contiene secretos:
# si se pierde, el bucket se reimporta con `terraform import`.

terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

# Todo sale de variables: nunca se usa el proyecto por defecto de gcloud.
provider "google" {
  project               = var.gcp_project_id
  region                = var.region
  billing_project       = var.gcp_project_id
  user_project_override = true
}

resource "google_project_service" "required" {
  for_each = toset([
    "cloudresourcemanager.googleapis.com",
    "storage.googleapis.com",
  ])

  service            = each.key
  disable_on_destroy = false
}

resource "google_storage_bucket" "tfstate" {
  name                        = "${var.gcp_project_id}-tfstate"
  location                    = var.location
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false

  versioning {
    enabled = true
  }

  # Conserva las 20 versiones anteriores de cada state y borra las más viejas.
  lifecycle_rule {
    condition {
      num_newer_versions = 20
      with_state         = "ARCHIVED"
    }
    action {
      type = "Delete"
    }
  }

  lifecycle {
    prevent_destroy = true
  }

  depends_on = [google_project_service.required]
}
