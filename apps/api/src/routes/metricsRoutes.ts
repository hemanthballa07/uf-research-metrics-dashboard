import { Router } from 'express';
import { getMetricsSummaryHandler, getStatusBreakdownHandler, getTimeSeriesHandler, getAwardsBySponsorTypeHandler } from '../controllers/metricsController.js';
import { getInsightsHandler } from '../controllers/insightsController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { withCache } from '../middleware/cacheMiddleware.js';

const router = Router();

router.get('/metrics/summary', withCache(), asyncHandler(getMetricsSummaryHandler));
router.get('/metrics/status-breakdown', withCache(), asyncHandler(getStatusBreakdownHandler));
router.get('/metrics/timeseries', withCache(), asyncHandler(getTimeSeriesHandler));
router.get('/metrics/awards-by-sponsor-type', withCache(), asyncHandler(getAwardsBySponsorTypeHandler));
router.get('/insights', withCache(), asyncHandler(getInsightsHandler));

export default router;

