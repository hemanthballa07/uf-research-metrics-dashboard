import { Router } from 'express';
import { getMetricsSummaryHandler, getStatusBreakdownHandler, getTimeSeriesHandler, getAwardsBySponsorTypeHandler } from '../controllers/metricsController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/metrics/summary', asyncHandler(getMetricsSummaryHandler));
router.get('/metrics/status-breakdown', asyncHandler(getStatusBreakdownHandler));
router.get('/metrics/timeseries', asyncHandler(getTimeSeriesHandler));
router.get('/metrics/awards-by-sponsor-type', asyncHandler(getAwardsBySponsorTypeHandler));

export default router;

