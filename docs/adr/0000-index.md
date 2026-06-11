# Architecture Decision Records

Lightweight records of load-bearing architectural choices. Format inspired by
[MADR](https://adr.github.io/madr/) — one decision per file, dated, and
self-contained so future engineers (or you, six months from now) can re-derive
the *why* without re-reading the entire commit history.

## Index

| ID | Title | Date | Status |
|---|---|---|---|
| [0001](0001-prisma-plus-raw-sql.md) | Hybrid Prisma + raw SQL for analytics queries | 2026-05-04 | Accepted |
| [0002](0002-async-kafka-ingest.md) | Async grant ingestion via Kafka with at-least-once delivery | 2026-05-15 | Accepted |
| [0003](0003-streaming-csv-produce.md) | Stream-produce CSV batches to Kafka for constant-memory uploads | 2026-05-20 | Accepted |
| [0004](0004-slo-targets-from-benchmarks.md) | SLO targets derived from measured benchmarks, not aspiration | 2026-05-24 | Accepted |
| [0005](0005-otel-kafka-context-propagation.md) | Cross-service tracing via OpenTelemetry auto-instrumentation | 2026-05-24 | Accepted |

## Conventions

- One decision per file. Number sequentially. Never renumber after merging.
- Statuses: `Proposed`, `Accepted`, `Superseded by NNNN`, `Deprecated`.
- Keep each ADR to one page where possible. Long rationale belongs in
  `docs/ARCHITECTURE.md` or a design doc.
- When superseding an ADR, leave the original in place and add a note
  pointing forward; never delete.
