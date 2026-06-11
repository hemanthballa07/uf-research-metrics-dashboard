# ADR-0004: SLO targets derived from measured benchmarks, not aspiration

- **Status:** Accepted
- **Date:** 2026-05-24
- **Deciders:** Project lead

## Context

When introducing SLOs we had to pick concrete targets for:

- API availability (non-5xx ratio)
- Read-mix p95 latency
- Ingest job success rate

The common failure mode for SLO programs is **aspirational targets**:
"99.99% availability!" that the system has never demonstrated, leading to
either constant pager fatigue or operators who stop trusting alerts.
We had two real-world measurement sources to anchor against instead:

1. **k6 read-path load test** (`apps/api/scripts/bench/read-load.js`,
   results in `docs/BENCHMARKS.md`) — daily-profile mix, 20 VUs, 65s,
   80K-grant database. Observed: 0.00% failed requests, p95 = 778 ms
   against an 800 ms threshold.
2. **Live e2e ingest stress** (`apps/api/scripts/bench/e2e-ingest.ts`) —
   20 concurrent 4K-row uploads with one deliberate poison batch. Observed:
   1 DLQ in 80K rows (0.00125% failure rate by design), `upload → completed`
   p95 = 4.4s.

## Decision

**Set each SLO at the level the system has demonstrably hit under realistic
load, with a small margin. Never set a target the system hasn't yet
delivered against in benchmarks.**

| SLI | Target | Source measurement |
|---|---|---|
| API availability | **99.9%** over 28d | k6: 0.00% failure → 99.9% is conservative |
| Read-mix p95 latency | **≤ 1.0s** over 5m | k6 overall p95 = 778 ms; 1.0s allows for production variance |
| Ingest job success | **99.5%** over 7d | E2E: 0.00125% failure → 99.5% is very conservative |
| Ingest E2E p95 latency | **≤ 8s** for jobs ≤ 5K rows | E2E p95 = 4.4s; 8s margin handles bigger jobs |

Burn-rate alerts use the Google SRE-book multi-window convention (5m +
1h for fast, 30m + 6h for slow) so transient blips don't page. Each alert
is additionally gated by a min-traffic guard (`sum(rate(http_requests_total[1h])) > 0.1`)
because UF traffic is 8–15 concurrent users in business hours — single
off-hours errors at <0.05 req/s would otherwise trigger 100% error
ratios that look like outages.

## Consequences

**Positive:**
- Operators can trust alerts. A `AvailabilityBudgetBurnFast` page means
  the system is *actually* worse than it has demonstrably been.
- Re-tuning is mechanical: if the next benchmark run shows 99.95%
  availability under the same workload, the SLO target can move with it.

**Negative:**
- Targets look unimpressive in marketing copy. "99.9% availability" is
  weaker than "five nines" but honest about what the test evidence
  actually supports — the rigor of the methodology matters more than the
  magnitude of the numbers.

**Neutral:**
- The 28d availability window is longer than we have continuous Prometheus
  data for in development. The SLI series is correctly computed but the
  budget bar gauges will read 0% until 28 days of real traffic accumulate.
  Acceptable for a portfolio piece; for a real production deployment,
  shorten to 7d initially and lengthen as data accumulates.
