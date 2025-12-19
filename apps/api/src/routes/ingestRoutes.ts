import { Router } from 'express';
import { ingestGrantsHandler } from '../controllers/ingestController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

// Accept text/plain for CSV upload
router.post(
  '/ingest/grants',
  asyncHandler(ingestGrantsHandler)
);

export default router;

