import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import * as analyticsController from '../controllers/analyticsController';

const router = Router();

const adminRoles = ['SUPER_ADMIN', 'TEMPLE_ADMIN', 'TRUSTEE', 'MANAGER'] as const;

// Dashboard & Analytics
router.get('/dashboard', authenticate, authorize(...adminRoles), analyticsController.getDashboardOverview);
router.get('/visitors', authenticate, authorize(...adminRoles), analyticsController.getVisitorAnalytics);
router.get('/financial', authenticate, authorize(...adminRoles), analyticsController.getFinancialAnalytics);
router.get('/operational', authenticate, authorize(...adminRoles), analyticsController.getOperationalMetrics);
router.get('/trends', authenticate, authorize(...adminRoles), analyticsController.getAnalyticsTrends);
router.post('/record-daily', authenticate, authorize(...adminRoles), analyticsController.recordDailyAnalytics);

// Feedback
router.post('/feedback', authenticate, analyticsController.submitFeedback);
router.get('/feedback', authenticate, authorize(...adminRoles), analyticsController.getFeedback);
router.put('/feedback/:id/respond', authenticate, authorize(...adminRoles), analyticsController.respondToFeedback);

// Audit Log
router.get('/audit-log', authenticate, authorize('SUPER_ADMIN', 'TRUSTEE'), analyticsController.getAuditLog);

export default router;
