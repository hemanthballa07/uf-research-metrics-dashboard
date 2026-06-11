import { Router } from 'express';
import { getSimilarGrantsHandler, askHandler } from '../controllers/aiController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/grants/:id/similar', asyncHandler(getSimilarGrantsHandler));
router.post('/ask', asyncHandler(askHandler));

export default router;
