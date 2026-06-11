data "aws_caller_identity" "current" {}
data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  name = "${var.name_prefix}-${var.env}"
  azs  = slice(data.aws_availability_zones.available.names, 0, 2)
  tags = {
    Project = "uf-research-metrics"
    Env     = var.env
  }
}
