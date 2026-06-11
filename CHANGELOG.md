# Changelog

All notable changes to this project are recorded here. Format inspired by
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning is by
date-stamped milestones rather than semver — this is an internal portfolio
project, not a published library.

## [2026-05-24] — Production hardening (workstreams A + C + E)

### Added
- **Distributed tracing** across api → Kafka → ingest-worker → Postgres
  via OpenTelemetry. `X-Trace-Id` response header lets operators pivot
  from any failing HTTP response into the full Jaeger trace. Pino logs
  on both services carry `traceId`/`spanId` via the `mixin` callback
  for log-to-trace correlation. `handleBatch` wraps its retry loop in
  `tracer.startActiveSpan` with `uf.jobId`/`uf.batchIndex`/`uf.rows`
  attributes. See [ADR-0005](docs/adr/0005-otel-kafka-context-propagation.md).
- **K8s hardening** in the Helm chart: HPA (api 2→6, worker 1→3 on CPU),
  PodDisruptionBudgets (api always; worker only when `replicas > 1 OR
  autoscaling enabled`), NetworkPolicy with port-only egress to
  Postgres, idempotent topic-partition bootstrap on worker startup,
  `helm-lint` CI job rendering both `values.yaml` and `values-prod.yaml`
  with positive + negative grep assertions.
- **SLOs + multi-window burn-rate alerts.** SLI recording rules in
  `recording.rules.yml` (availability, read-mix p95 latency, ingest
  success). Alerts in `alert.rules.yml` use Google SRE-book convention
  (5m + 1h fast, 30m + 6h slow) with min-traffic guards. Grafana SLO
  dashboard with current SLI + 28d/7d budget gauges + burn-rate timeseries.
  PrometheusRule CR for the K8s path. Targets derived from measured
  benchmarks (k6 + e2e bench), not aspiration — see
  [ADR-0004](docs/adr/0004-slo-targets-from-benchmarks.md).
- **5 Architecture Decision Records** (`docs/adr/0000-index.md`) covering
  the load-bearing choices: hybrid Prisma + raw SQL, async Kafka ingest,
  streaming CSV produce, SLO targets from benchmarks, OTel context
  propagation.
- **Knowledge graph baseline** (`.understand-anything/knowledge-graph.json`)
  — 373 nodes, 526 edges, 10 layers, 13-step guided tour over the
  monorepo for the interactive Understand Anything dashboard.

### Changed
- `apps/api/src/middleware/prometheusMetrics.ts:normalizeRoute` now
  prepends `req.baseUrl` so the `route` Prometheus label includes the
  mount prefix (`/api/ingest/grants` instead of `/grants`). Required for
  the read-mix latency SLI's `route!~"/api/ingest/.*"` regex to actually
  filter ingest endpoints.
- Legacy alerts `HighErrorRate`, `HighLatencyP95`, `IngestErrorSpike`
  demoted to `severity: info` in a `uf-research-metrics-legacy` group
  during a one-week transition. They carry a `superseded_by` label
  pointing at the replacement SLO alerts. Delete the legacy group after
  one clean week of the new alerts.

### Documentation
- `docs/RUNBOOK.md` — new "SLOs and Error Budget" section (targets,
  burn-rate playbook, legacy alert equivalence map) + new "Tracing an
  Incident" section (X-Trace-Id pivot workflow, jobId search, when
  traces don't appear).
- `README.md` — new "Production Readiness" subsection summarising
  streaming ingest, SLOs, tracing, K8s chart posture, and audit logging.

## [2026-05-23] — Streaming CSV ingest (Fix 2)

### Added
- `streamCsvBatches` async generator in `apps/api/src/services/ingestService.ts`
  yields one validated batch at a time. The controller produces each
  batch to Kafka immediately and discards it — peak RSS is O(BATCH_SIZE)
  regardless of file size. See [ADR-0003](docs/adr/0003-streaming-csv-produce.md).
- `initJob` / `finalizeJob` Redis lifecycle in `packages/events/src/jobStore.ts`
  reserves a job slot with sentinel `totalBatches: -1` before the first
  produce, then writes the real count after the last. Prevents premature
  `completed` status when the worker races the producer.
- Test setup performs FK-safe table cleanup so repeated runs don't trip
  `onDelete: Restrict` from `grants`.

### Changed
- `GrantBatchReceived.totalBatches` envelope field is now optional —
  unknown at produce time during streaming.

## [2026-05-20] — Phase 1 infrastructure + Phase 0 diagnosis

### Added
- Terraform (`infra/terraform/`) for AWS: VPC, EKS, RDS (t4g.micro),
  IAM, ECR, OIDC. Helm chart (`infra/helm/uf-research-metrics/`) with
  api/web/worker Deployments + Services, Ingress for ALB, ServiceMonitor,
  ExternalSecret for AWS Secrets Manager, migrate-job pre-install hook.
  GitHub Actions deploy workflow with OIDC role assumption.
- Live e2e ingest stress test (`apps/api/scripts/bench/e2e-ingest.ts`)
  driving 20 concurrent uploads with one deliberate poison batch.
- k6 read-path load test (`apps/api/scripts/bench/read-load.js`),
  daily-profile mix, results captured in `docs/BENCHMARKS.md`.
- Phase 0 read-only diagnosis (`docs/PHASE0_DIAGNOSIS.md`) capturing
  the empirical O(file) memory ceiling before the Fix-2 streaming work.

### Fixed
- **Producer connect race** (`packages/events/src/client.ts`) —
  `getProducer()` previously assigned the singleton ref before
  `connect()` resolved; concurrent first-callers got a not-yet-connected
  producer. Now memoizes the connect *promise* instead.
- **Kafka message-size overrun** (`apps/api/src/controllers/ingestController.ts`)
  — multi-message `send` with the same `jobId` key coalesced all batches
  into one record batch overrunning the broker's 1 MiB
  `max.message.bytes` on large uploads. Fixed by per-batch send.

## [2026-05-19] — Phase 4 OpenTelemetry tracing baseline

### Added
- `packages/telemetry/src/index.ts` constructs a NodeSDK with HTTP,
  Express, ioredis, and kafkajs instrumentations. Opt-in via
  `OTEL_TRACES_ENABLED=true`. Loaded by both api and ingest-worker via
  Node's `--import` flag.

## [2026-05-19] — Phase 2 event-driven ingest

### Added
- Kafka (Redpanda) event bus for the grant-ingest pipeline. Topics:
  `grant.batch.received`, `grant.ingested`, `grant.failed`,
  `grant.batch.dlq`. See [ADR-0002](docs/adr/0002-async-kafka-ingest.md).
- ingest-worker service consuming `grant.batch.received` with bounded
  retries + exponential backoff + DLQ on exhaustion.
- Redis-backed job-status store polled by `GET /api/ingest/jobs/:id`.
