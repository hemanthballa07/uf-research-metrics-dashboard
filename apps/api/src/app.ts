import express from 'express';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import routes from './routes/index.js';

export function createApp(): express.Application {
  const app = express();

  // Middleware
  // Accept text/plain for CSV ingestion endpoint
  app.use(
    '/api/ingest',
    express.text({ type: 'text/plain', limit: '10mb' })
  );
  app.use(express.json());
  app.use(requestLogger);

  // Routes
  app.use(routes);

  // Error handling (must be last)
  app.use(errorHandler);

  return app;
}

