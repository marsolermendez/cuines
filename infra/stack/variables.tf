variable "github_owner" {
  description = "Cuenta de GitHub propietaria del repositorio (personal, nunca la de Hike)."
  type        = string
  default     = "marsolermendez"
}

variable "github_repository" {
  description = "Nombre del repositorio."
  type        = string
  default     = "cuines"
}

variable "supabase_organization_id" {
  description = "Slug de la organización PERSONAL de Supabase (Dashboard > Organization settings). TF_VAR_supabase_organization_id."
  type        = string
}

variable "supabase_project_name" {
  description = "Nombre del proyecto de Supabase."
  type        = string
  default     = "cuines"
}

variable "supabase_project_ref" {
  description = "Referencia del proyecto de Supabase creado en el panel (se importa a Terraform). TF_VAR_supabase_project_ref."
  type        = string
}

variable "supabase_region" {
  description = "Región del proyecto de Supabase (la del proyecto creado en el panel)."
  type        = string
  default     = "eu-west-2"
}

variable "google_client_id" {
  description = "ID del cliente OAuth de Google. Vacío en la primera pasada: sin él, el login con Google queda desactivado."
  type        = string
  default     = ""
}

variable "google_client_secret" {
  description = "Secreto del cliente OAuth de Google. TF_VAR_google_client_secret; nunca en un archivo versionado."
  type        = string
  default     = ""
  sensitive   = true
}
