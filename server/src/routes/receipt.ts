import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  generateReceipt,
  getReceipt,
  getReceiptByDonation,
  sendReceipt,
  generateTaxCertificate,
  getTaxCertificates,
  getBulkCertificates,
} from '../controllers/receiptController';

const router = Router();

const adminRoles = ['SUPER_ADMIN', 'TEMPLE_ADMIN', 'TRUSTEE', 'MANAGER'] as const;

// Admin-only routes (placed before /:id to avoid route conflicts)
router.post('/generate', authenticate, authorize(...adminRoles), generateReceipt);
router.post('/tax-certificate', authenticate, authorize(...adminRoles), generateTaxCertificate);
router.get('/tax-certificates', authenticate, authorize(...adminRoles), getTaxCertificates);
router.post('/tax-certificates/bulk', authenticate, authorize(...adminRoles), getBulkCertificates);

// Authenticated routes with :donationId param (before /:id to avoid conflicts)
router.get('/donation/:donationId', authenticate, getReceiptByDonation);

// Authenticated routes with :id param
router.get('/:id', authenticate, getReceipt);

// Admin-only route with :id param
router.put('/:id/send', authenticate, authorize(...adminRoles), sendReceipt);

export default router;
