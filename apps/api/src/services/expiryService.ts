// getExpiringGrants now lives in @uf-research-metrics-platform/db so the API and
// the ingest-worker share one implementation. Re-exported here to preserve the
// existing import path for the controller and tests.
export { getExpiringGrants } from '@uf-research-metrics-platform/db';
