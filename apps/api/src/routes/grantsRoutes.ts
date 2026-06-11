import { Router } from 'express';
import { getGrantsHandler, getGrantByIdHandler } from '../controllers/grantsController.js';
import { exportGrantsHandler } from '../controllers/exportController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/grants', asyncHandler(getGrantsHandler));
router.get('/grants/export', asyncHandler(exportGrantsHandler));
router.get('/grants/:id', asyncHandler(getGrantByIdHandler));

export default router;

