# Existing Neon project (imported — do not recreate).
# ID: lingering-violet-22599424
# Matched to console/API: name, region, pg_version, retention, compute, maintenance.
resource "neon_project" "database" {
  name                      = "splitwise_db"
  region_id                 = var.neon_region
  pg_version                = 18
  history_retention_seconds = 21600
  store_password            = "yes"

  primary_compute {
    autoscaling_limit_min_cu = 0.25
    autoscaling_limit_max_cu = 2
    suspend_timeout_seconds  = 0
  }

  maintenance_window {
    weekdays   = [1]
    start_time = "14:00"
    end_time   = "15:00"
  }
}
