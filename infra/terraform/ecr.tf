resource "aws_ecr_repository" "app" {
  for_each = toset(["api", "web", "ingest-worker"])

  name                 = "${var.name_prefix}/${each.key}"
  image_tag_mutability = "IMMUTABLE"
  force_delete         = true # demo: allow `terraform destroy` to remove repos with images

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = local.tags
}
