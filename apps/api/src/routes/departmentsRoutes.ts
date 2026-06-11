import { Router } from 'express';
import { getDepartmentsHandler } from '../controllers/departmentsController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/departments', asyncHandler(getDepartmentsHandler));

export default router;

