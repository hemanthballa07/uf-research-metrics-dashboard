import 'dotenv/config'; // load apps/api/.env locally; no-op in containers/CI (uses process env)
import { createApp } from './app.js';
import { prisma } from '@uf-research-metrics-platform/db';
import { warmRedis } from './lib/cache.js';
import { startDauCollector } from './middleware/prometheusMetrics.js';

const app = createApp();
const PORT = process.env.API_PORT || 3001;

// Open the Redis connection eagerly so the first /health check is accurate
warmRedis();

// Populate the uf_daily_active_users gauge from audit_logs every 60s
startDauCollector(prisma);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 API server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});
