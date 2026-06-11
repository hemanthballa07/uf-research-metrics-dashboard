import { Router } from 'express';
import { reconcileHandler } from '../controllers/reconciliationController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();

// text/plain — same Content-Type as the ingest endpoint; body is raw CSV stream.
router.post('/reconcile', requireRole('ADMIN'), asyncHandler(reconcileHandler));

export default router;
