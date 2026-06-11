/**
 * Kafka transport for the grant-ingestion pipeline: topic names, Zod message
 * envelopes, and the client factory (producer/consumer). Shared by the API
 * (producer) and the ingest-worker (consumer).
 */
export * from './topics.js';
export * from './envelopes.js';
export { getProducer, createConsumer, disconnectProducer, ensureTopic } from './client.js';
export { createJob, initJob, finalizeJob, getJob, recordBatchResult, type IngestJob } from './jobStore.js';
