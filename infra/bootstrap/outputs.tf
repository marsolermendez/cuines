output "tfstate_bucket" {
  description = "Bucket del state de infra/stack (se pasa a `terraform init -backend-config=bucket=...`; infra/tf lo hace solo)."
  value       = google_storage_bucket.tfstate.name
}
