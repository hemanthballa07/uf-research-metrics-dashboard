import { Router } from 'express';
import { ingestGrantsHandler, getIngestJobHandler } from '../controllers/ingestController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();

// Accept text/plain for CSV upload — ADMIN only. Async: returns 202 + jobId.
router.post(
  '/ingest/grants',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(ingestGrantsHandler)
);

// Poll target for the async ingest job — ADMIN only.
router.get(
  '/ingest/jobs/:id',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(getIngestJobHandler)
);

export default router;

