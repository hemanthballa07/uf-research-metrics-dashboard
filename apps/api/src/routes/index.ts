import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import grantsRoutes from './grantsRoutes.js';
import metricsRoutes from './metricsRoutes.js';

const router = Router();

router.use('/api', healthRoutes);
router.use('/api', grantsRoutes);
router.use('/api', metricsRoutes);

export default router;

