import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  createDonation,
  getDonations,
  getDonationById,
  updatePaymentStatus,
  getDonationStats,
  getFundAllocations,
  updateFundAllocation,
} from '../controllers/donationController';

const router = Router();

const adminRoles = ['SUPER_ADMIN', 'TEMPLE_ADMIN', 'TRUSTEE', 'MANAGER'] as const;

// Authenticated routes
router.post('/', authenticate, createDonation);
router.get('/', authenticate, getDonations);

// Admin-only routes (placed before /:id to avoid route conflicts)
router.get('/stats', authenticate, authorize(...adminRoles), getDonationStats);
router.get('/fund-allocations', authenticate, authorize(...adminRoles), getFundAllocations);
router.put('/fund-allocations', authenticate, authorize(...adminRoles), updateFundAllocation);

// Authenticated routes with :id param
router.get('/:id', authenticate, getDonationById);
router.put('/:id/payment-status', authenticate, authorize(...adminRoles), updatePaymentStatus);

export default router;
