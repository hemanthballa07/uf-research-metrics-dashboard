# Infrastructure — AWS / EKS / Helm (Phase 1)

Deploys the platform (api, web, ingest-worker) to **EKS** via **Terraform** + **Helm**.
**Teardown-first:** spin a cluster up for a demo, tear it down after — do not leave it running.

## Layout

- `terraform/` — VPC, EKS, RDS Postgres (pgvector), ECR, IRSA (ALB controller + External Secrets),
  a Secrets Manager secret. State in S3 + DynamoDB lock (bootstrapped out-of-band).
- `helm/uf-research-metrics/` — the **app** chart (api/web/worker Deployments + Services, a
  pre-upgrade **migration Job**, ALB **Ingress**, ConfigMap, **ExternalSecret**, ServiceMonitors).
  Platform charts (redis, redpanda, kube-prometheus-stack, jaeger, ALB controller, External Secrets
  Operator) are installed as **separate releases** (see the `Makefile` `platform` target).

## Architecture decisions

- **Hybrid backing services:** RDS Postgres (managed, has pgvector); **Redis + Redpanda in-cluster**.
- **Observability in-cluster:** kube-prometheus-stack + Jaeger (mirrors docker-compose).
- **Secrets:** AWS Secrets Manager → External Secrets Operator → a K8s Secret (IRSA auth). The one
  secret holds DATABASE_URL (RDS master / `rds_superuser`, so the migration Job can `CREATE EXTENSION
  vector`), JWT_SECRET, ADMIN_PASSWORD, GRAFANA_PASSWORD, VOYAGE_API_KEY, ANTHROPIC_API_KEY.
- **Web → API:** the web image is built with `VITE_API_URL=""` → the SPA calls **same-origin** `/api`,
  path-routed by the single ALB to the api Service (no ALB host baked into the image).
- **Migrations:** a Helm `pre-install`/`pre-upgrade` Job runs `prisma migrate deploy` (api replicas
  don't race); the api container itself just starts.

## Deploy / teardown

Prereqs: `terraform`, `aws` (configured creds), `kubectl`, `helm`. Bootstrap the TF state backend
(S3 bucket + DynamoDB `uf-research-metrics-tflock`) once, then:

```bash
make demo-up   ENV=demo REGION=us-east-1 IMAGE_TAG=$(git rev-parse --short HEAD)
# ... demo ...
make demo-down ENV=demo
```

CI: `terraform plan` runs on PRs touching `infra/**` (read-only role); **apply + image build/push +
helm** run only via **`workflow_dispatch`** against the protected `production` Environment (reviewer
approval) — never auto-applied. Auth is GitHub **OIDC** (no static AWS keys); set repo secrets
`AWS_PLAN_ROLE_ARN` / `AWS_DEPLOY_ROLE_ARN` and variable `AWS_REGION`.

## Cost & teardown

EKS control plane is ~$0.10/hr (~$72/mo) before nodes; with 2× t3.large spot + RDS t4g.micro +
ALB + a single NAT, a running demo is **~$150–200/mo prorated**. `make demo-down` runs
`terraform destroy` (and `helm uninstall`) — in-cluster Redis/Redpanda are ephemeral and their data
does not survive teardown (re-seed/re-ingest after `demo-up`).

> Verify-only locally: `terraform -chdir=terraform validate` and
> `helm lint/template helm/uf-research-metrics` — no AWS credentials or spend required.
