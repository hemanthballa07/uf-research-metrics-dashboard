import { Router } from 'express';
import { getMetricsSummaryHandler, getStatusBreakdownHandler } from '../controllers/metricsController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/metrics/summary', asyncHandler(getMetricsSummaryHandler));
router.get('/metrics/status-breakdown', asyncHandler(getStatusBreakdownHandler));

export default router;

