import { Kafka, logLevel, type Consumer, type Producer } from 'kafkajs';

// Internal compose services set KAFKA_BROKERS=redpanda:9092; host-based `pnpm dev`
// uses the external advertised listener localhost:19092 (see docker-compose).
const brokers = (process.env.KAFKA_BROKERS ?? 'localhost:19092').split(',');

let kafka: Kafka | null = null;
function getKafka(): Kafka {
  if (!kafka) {
    kafka = new Kafka({
      clientId: 'uf-research-metrics',
      brokers,
      logLevel: logLevel.NOTHING,
      retry: { retries: 5 },
    });
  }
  return kafka;
}

let producerPromise: Promise<Producer> | null = null;

/**
 * Lazily-connected singleton producer. The *connect promise* is memoized (not
 * the producer instance) so concurrent first-callers all await the same
 * connection rather than receiving a producer whose `connect()` is still in
 * flight — which throws "The producer is disconnected" on `send`.
 */
export async function getProducer(): Promise<Producer> {
  if (!producerPromise) {
    const p = getKafka().producer({ allowAutoTopicCreation: true });
    producerPromise = p.connect().then(() => p);
    // If the connect rejects, clear the memo so the next call can retry.
    producerPromise.catch(() => {
      producerPromise = null;
    });
  }
  return producerPromise;
}

/** A new consumer bound to `groupId`. Caller manages connect/subscribe/run. */
export function createConsumer(groupId: string): Consumer {
  return getKafka().consumer({ groupId, allowAutoTopicCreation: true });
}

/** Disconnect the singleton producer (graceful shutdown). */
export async function disconnectProducer(): Promise<void> {
  if (producerPromise) {
    const p = await producerPromise.catch(() => null);
    producerPromise = null;
    if (p) await p.disconnect();
  }
}

/**
 * Idempotent topic bootstrap. Returns once the topic exists with at least
 * `numPartitions` partitions; safe to call on every worker startup.
 * kafkajs's `createTopics` returns `false` (not an error) when the topic
 * already exists, so re-runs are no-ops. Connects a short-lived Admin
 * client to keep the broader Admin API surface out of the events package.
 */
export async function ensureTopic(topic: string, numPartitions: number): Promise<void> {
  const admin = getKafka().admin();
  await admin.connect();
  try {
    await admin.createTopics({
      topics: [{ topic, numPartitions }],
      waitForLeaders: true,
    });
  } finally {
    await admin.disconnect();
  }
}
