import pinoHttp from 'pino-http';
import logger from '../lib/logger.js';

export const requestLogger = pinoHttp({
  logger,
  customLogLevel(_req, res) {
    if (res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  serializers: {
    req(req) { return { method: req.method, url: req.url, id: req.id }; },
    res(res) { return { statusCode: res.statusCode }; },
  },
});
