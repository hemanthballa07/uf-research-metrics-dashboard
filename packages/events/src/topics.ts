/** Kafka topic names for the grant-ingestion pipeline. */
export const TOPICS = {
  /** API → worker: a batch of validated grant rows to upsert. */
  GRANT_BATCH_RECEIVED: 'grant.batch.received',
  /** worker → observers: a batch was upserted successfully. */
  GRANT_INGESTED: 'grant.ingested',
  /** worker → observers: a batch failed to process. */
  GRANT_FAILED: 'grant.failed',
  /** worker → DLQ: a batch that exhausted its retries. */
  GRANT_BATCH_DLQ: 'grant.batch.dlq',
  /** worker → DLQ: a message that could not be deserialized/parsed. */
  GRANT_POISON_DLQ: 'grant.poison.dlq',
} as const;

export type TopicName = (typeof TOPICS)[keyof typeof TOPICS];

/** Consumer group for the ingest workers. */
export const INGEST_WORKER_GROUP = 'ingest-workers';
