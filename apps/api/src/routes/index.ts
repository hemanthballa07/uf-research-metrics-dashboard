import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import authRoutes from './authRoutes.js';
import expiryRoutes from './expiryRoutes.js';
import grantsRoutes from './grantsRoutes.js';
import metricsRoutes from './metricsRoutes.js';
import facultyRoutes from './facultyRoutes.js';
import ingestRoutes from './ingestRoutes.js';
import departmentsRoutes from './departmentsRoutes.js';
import sponsorsRoutes from './sponsorsRoutes.js';
import prometheusRoutes from './prometheusRoutes.js';
import userRoutes from './userRoutes.js';
import aiRoutes from './aiRoutes.js';
import reconciliationRoutes from './reconciliationRoutes.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

// Public — no auth required
router.use('/api', healthRoutes);
router.use('/api', authRoutes);
router.use('/', prometheusRoutes);

// Protected — all routes below require a valid JWT
router.use('/api', authenticate);
router.use('/api', expiryRoutes);
router.use('/api', grantsRoutes);
router.use('/api', metricsRoutes);
router.use('/api', facultyRoutes);
router.use('/api', ingestRoutes);
router.use('/api', departmentsRoutes);
router.use('/api', sponsorsRoutes);
router.use('/api', userRoutes);
router.use('/api', aiRoutes);
router.use('/api', reconciliationRoutes);

export default router;
