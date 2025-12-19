import { Router } from 'express';
import { getMetricsSummaryHandler, getStatusBreakdownHandler, getTimeSeriesHandler } from '../controllers/metricsController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/metrics/summary', asyncHandler(getMetricsSummaryHandler));
router.get('/metrics/status-breakdown', asyncHandler(getStatusBreakdownHandler));
router.get('/metrics/timeseries', asyncHandler(getTimeSeriesHandler));

export default router;

