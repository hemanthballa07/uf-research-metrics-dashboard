output "region" {
  value = var.aws_region
}

output "eks_cluster_name" {
  value = module.eks.cluster_name
}

output "ecr_repository_urls" {
  description = "Map of service -> ECR repo URL (for the deploy workflow + Helm image values)."
  value       = { for k, r in aws_ecr_repository.app : k => r.repository_url }
}

output "rds_address" {
  value = aws_db_instance.this.address
}

output "app_secret_arn" {
  value = aws_secretsmanager_secret.app.arn
}

output "app_secret_name" {
  value = aws_secretsmanager_secret.app.name
}

output "alb_controller_role_arn" {
  value = module.alb_controller_irsa.iam_role_arn
}

output "external_secrets_role_arn" {
  value = module.eso_irsa.iam_role_arn
}
