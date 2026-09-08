terraform {
  required_version = ">= 1.5.0"

  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 5.0"
    }
    neon = {
      # Latest stable on the Terraform Registry is 0.17.0 (as of writing).
      # ~> 0.17 allows patch updates within the current minor line.
      source  = "kislerdm/neon"
      version = "~> 0.17"
    }
  }
}

provider "vercel" {
  api_token = var.vercel_api_token
}

provider "neon" {
  api_key = var.neon_api_key
}
