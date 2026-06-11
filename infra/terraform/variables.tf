variable "aws_region" {
  type        = string
  default     = "us-east-1"
  description = "AWS region for all resources."
}

variable "env" {
  type        = string
  default     = "demo"
  description = "Environment name (demo/staging/prod) — used in resource names + the Secrets Manager path."
}

variable "name_prefix" {
  type        = string
  default     = "uf-research-metrics"
  description = "Prefix for named resources."
}

variable "vpc_cidr" {
  type    = string
  default = "10.40.0.0/16"
}

variable "eks_version" {
  type    = string
  default = "1.30"
}

variable "node_instance_types" {
  type        = list(string)
  default     = ["t3.large"]
  description = "EKS managed node group instance types."
}

variable "node_desired_size" {
  type    = number
  default = 2
}

variable "node_capacity_type" {
  type        = string
  default     = "SPOT"
  description = "ON_DEMAND or SPOT (SPOT for cheap teardown-first demos)."
}

variable "db_engine_version" {
  type        = string
  default     = "16.4"
  description = "RDS PostgreSQL version (pgvector is available on RDS PG 15.2+/16.x)."
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "db_username" {
  type        = string
  default     = "ufadmin"
  description = "RDS master username (rds_superuser) — used by the migration Job to CREATE EXTENSION vector."
}

variable "db_password" {
  type        = string
  sensitive   = true
  description = "RDS master password. Supplied via TF_VAR_db_password / a tfvars secret, never committed."
}
