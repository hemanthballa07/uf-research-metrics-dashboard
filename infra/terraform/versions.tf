terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.31"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.14"
    }
  }

  # State backend — bootstrapped out-of-band (Stage 1): an S3 bucket + DynamoDB lock table.
  # Values are supplied via `terraform init -backend-config=...` so this file stays env-agnostic.
  backend "s3" {
    key            = "uf-research-metrics/terraform.tfstate"
    encrypt        = true
    dynamodb_table = "uf-research-metrics-tflock"
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project   = "uf-research-metrics"
      ManagedBy = "terraform"
      Env       = var.env
    }
  }
}
