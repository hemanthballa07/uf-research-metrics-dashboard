import { Router } from 'express';
import { getMetricsSummaryHandler } from '../controllers/metricsController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/metrics/summary', asyncHandler(getMetricsSummaryHandler));

export default router;

