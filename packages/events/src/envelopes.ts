import { z } from 'zod';
import { csvGrantRowSchema } from '@uf-research-metrics-platform/shared';

/**
 * Message envelopes for the ingestion pipeline. Each is a Zod schema so both
 * producer and consumer validate the wire payload. Grant rows reuse
 * `csvGrantRowSchema`; its `z.coerce.date()` fields survive the JSON round-trip
 * (Date → ISO string on serialize → Date on parse).
 */

export const grantBatchReceivedSchema = z.object({
  jobId: z.string(),
  batchIndex: z.number().int().nonnegative(),
  totalBatches: z.number().int().positive().optional(),
  rows: z.array(csvGrantRowSchema),
});
export type GrantBatchReceived = z.infer<typeof grantBatchReceivedSchema>;

export const grantIngestedSchema = z.object({
  jobId: z.string(),
  batchIndex: z.number().int().nonnegative(),
  inserted: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
});
export type GrantIngested = z.infer<typeof grantIngestedSchema>;

export const grantFailedSchema = z.object({
  jobId: z.string(),
  batchIndex: z.number().int().nonnegative(),
  error: z.string(),
  attempts: z.number().int().nonnegative(),
});
export type GrantFailed = z.infer<typeof grantFailedSchema>;

export const grantBatchDlqSchema = grantBatchReceivedSchema.extend({
  error: z.string(),
  attempts: z.number().int().nonnegative(),
});
export type GrantBatchDlq = z.infer<typeof grantBatchDlqSchema>;

/** Envelope for messages that could not be deserialized/schema-validated. */
export const grantPoisonDlqSchema = z.object({
  raw: z.string(),
  error: z.string(),
  topic: z.string(),
  partition: z.number().int().nonnegative().optional(),
  offset: z.string().optional(),
});
export type GrantPoisonDlq = z.infer<typeof grantPoisonDlqSchema>;
