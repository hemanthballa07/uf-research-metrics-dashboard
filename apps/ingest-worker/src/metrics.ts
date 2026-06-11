import { Registry, collectDefaultMetrics, Counter } from 'prom-client';

// Worker-local registry — the worker is a separate process and cannot share the
// API's in-process counter. Prometheus scrapes this on its own target.
export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const ingestRowsTotal = new Counter({
  name: 'ingest_rows_processed_total',
  help: 'Rows processed by the ingest worker',
  labelNames: ['result'],
  registers: [registry],
});

export const batchesProcessedTotal = new Counter({
  name: 'ingest_batches_processed_total',
  help: 'Batches consumed by the ingest worker',
  labelNames: ['result'],
  registers: [registry],
});

export const expiryScansTotal = new Counter({
  name: 'expiry_scans_total',
  help: 'Nightly expiry scans run by the BullMQ scheduler',
  labelNames: ['result'],
  registers: [registry],
});

export const expiryNotificationsTotal = new Counter({
  name: 'expiry_notifications_total',
  help: 'Per-grant expiry notifications dispatched by the BullMQ worker',
  labelNames: ['result'],
  registers: [registry],
});

export const embeddingsTotal = new Counter({
  name: 'embeddings_total',
  help: 'Grant embeddings written by the worker on ingest',
  labelNames: ['result'],
  registers: [registry],
});

export const auditLogPruneTotal = new Counter({
  name: 'audit_log_prune_total',
  help: 'Audit-log retention prune runs by the BullMQ scheduler',
  labelNames: ['result'],
  registers: [registry],
});
