resource "vercel_project" "frontend" {
  name           = var.project_name
  framework      = "vite"
  root_directory = "client"

  git_repository = {
    type = "github"
    repo = var.github_repo
  }
}

# Points at the manually deployed Render backend.
resource "vercel_project_environment_variable" "vite_api_url" {
  project_id = vercel_project.frontend.id
  key        = "VITE_API_URL"
  value      = var.vite_api_url
  target     = ["production", "preview", "development"]
  sensitive  = false
  comment    = "Backend API base URL (Render) for the Housemate Split client"
}
