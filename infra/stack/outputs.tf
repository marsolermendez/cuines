output "supabase_project_ref" {
  description = "Referencia del proyecto de Supabase (para `supabase link --project-ref`)."
  value       = supabase_project.cuines.id
}

output "supabase_db_password" {
  description = "Contraseña de la base de datos (para `supabase link` / `db push`). Sensible: sale con `-raw`."
  value       = random_password.supabase_db.result
  sensitive   = true
}

output "supabase_url" {
  value = "https://${supabase_project.cuines.id}.supabase.co"
}

output "google_oauth_redirect_uri" {
  description = "URI de redireccionamiento autorizado que hay que añadir al cliente OAuth de Google."
  value       = "https://${supabase_project.cuines.id}.supabase.co/auth/v1/callback"
}

output "site_url" {
  description = "URL pública de la app (GitHub Pages)."
  value       = local.site_url
}
