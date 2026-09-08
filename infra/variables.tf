variable "vercel_api_token" {
  description = "Vercel API token used by the vercel provider"
  type        = string
  sensitive   = true
}

variable "neon_api_key" {
  description = "Neon API key used by the neon provider"
  type        = string
  sensitive   = true
}

variable "project_name" {
  description = "Name used for the Vercel project and Neon database project"
  type        = string
  default     = "housemate-split"
}

variable "github_repo" {
  description = "GitHub repository to connect for Vercel auto-deploys (format: owner/repo)"
  type        = string
}

variable "neon_region" {
  description = "Neon deployment region (see https://neon.tech/docs/introduction/regions)"
  type        = string
  default     = "aws-ap-southeast-2"
}

variable "vite_api_url" {
  description = "Public API base URL exposed to the Vite frontend as VITE_API_URL"
  type        = string
  default     = "https://split-tracker-0uxz.onrender.com"
}
