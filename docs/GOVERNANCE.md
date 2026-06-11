# Governance & Compliance (B13)

The data-governance posture for the platform, built incrementally. This first slice covers
**audit-log retention** and **PII minimization in audit logs**. The deferred items at the bottom
need a policy/stakeholder decision before implementation.

## Audit-log retention

Every privileged action (user create / role-change / delete, password change) writes an `audit_logs`
row (`apps/api/src/services/auditService.ts`). The ingest-worker runs a daily BullMQ job
(`apps/ingest-worker/src/auditLogRetention.ts`) that **hard-deletes** audit_logs older than the
retention window.

- `AUDIT_LOG_RETENTION_DAYS` (default **365**) — days of history to keep.
- `AUDIT_LOG_PRUNE_CRON` (default `0 2 * * *`) · `AUDIT_LOG_PRUNE_TZ` (default `America/New_York`).
- **Safety floor:** the window is clamped to ≥ 2 days in code, so a mis-set small/zero value can never
  delete rows inside the daily-active-users 24h window — the only `audit_logs` reader is the DAU gauge
  in `apps/api/src/middleware/prometheusMetrics.ts`.
- Deletes run in 10k-row batches so the first prune of a long-unpruned table doesn't take one long
  lock. Observability: `audit_log_prune_total{result}` on the worker `/metrics`.

> **Action:** confirm `AUDIT_LOG_RETENTION_DAYS` against UF's actual audit-retention requirement and
> set it in the deployment env. The default 365 is an engineering placeholder, not a policy decision.

## PII minimization in audit logs

Audit `metadata` (JSONB) must not store raw PII; the actor and target are already identified by
`actorId` / `targetId` (the user id). As of B13:

- `USER_CREATED` logs `{ role }` (was `{ email, role }`).
- `USER_DELETED` logs nothing (was `{ email }`).
- `ROLE_CHANGED` / `PASSWORD_CHANGED` were already PII-free.

Locked in by `apps/api/src/tests/integration/audit-pii.test.ts`.

## Deferred (needs a policy/stakeholder decision)

- **FCOI flagging** — Financial-Conflict-of-Interest on awards. Needs the data source: a feed from
  UFIRST/myUFL vs. inference from grant attributes. Blocks the data model + ingestion.
- **Export PII redaction** — `GET /api/grants/export` exposes `pi_email`/`pi_name`; redaction depends
  on whether Research Office ops genuinely need emails in the export.
- **Access-review process** — cadence/owner are org policy; a read-only "recent privileged actions"
  report over `audit_logs` is the likely deliverable once the cadence is defined.
