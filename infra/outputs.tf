output "vercel_project_url" {
  description = "Default Vercel production URL for the frontend project"
  value       = "https://${vercel_project.frontend.name}.vercel.app"
}

output "neon_connection_string" {
  description = "Neon default database connection URI (contains credentials)"
  value       = neon_project.database.connection_uri
  sensitive   = true
}
