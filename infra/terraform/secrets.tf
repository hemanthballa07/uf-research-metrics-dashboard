# App secrets live in AWS Secrets Manager; External Secrets Operator (in-cluster) syncs them
# to a K8s Secret. Only DATABASE_URL is composed here (from RDS + master creds, so the migration
# Job has rds_superuser). The rest are placeholders set out-of-band (never committed).
resource "aws_secretsmanager_secret" "app" {
  name                    = "${var.name_prefix}/${var.env}"
  recovery_window_in_days = 0 # demo: allow immediate delete on teardown
  tags                    = local.tags
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    DATABASE_URL      = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.this.address}:5432/uf_research_metrics?schema=public"
    JWT_SECRET        = "REPLACE_ME"
    ADMIN_PASSWORD    = "REPLACE_ME"
    GRAFANA_PASSWORD  = "REPLACE_ME"
    VOYAGE_API_KEY    = ""
    ANTHROPIC_API_KEY = ""
  })

  lifecycle {
    # Real values are rotated/edited out-of-band in the console/CLI; don't clobber on apply.
    ignore_changes = [secret_string]
  }
}
