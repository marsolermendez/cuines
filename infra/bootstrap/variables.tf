variable "gcp_project_id" {
  description = "ID del proyecto de GCP. Sin valor por defecto a propósito: se pasa con TF_VAR_gcp_project_id (infra/.env)."
  type        = string
}

variable "region" {
  description = "Región por defecto del provider."
  type        = string
  default     = "europe-west1"
}

variable "location" {
  description = "Ubicación del bucket del state (región o multirregión)."
  type        = string
  default     = "EU"
}
