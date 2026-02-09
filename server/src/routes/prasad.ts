import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  createPrasadItem,
  getPrasadItems,
  updatePrasadItem,
  createPrasadOrder,
  getPrasadOrders,
  updateOrderStatus,
  pickupOrder,
  getInventory,
  addInventoryItem,
} from '../controllers/prasadController';

const router = Router();

const adminRoles = ['SUPER_ADMIN', 'TEMPLE_ADMIN', 'MANAGER'] as const;

// Prasad Items
router.post('/items', authenticate, authorize(...adminRoles), createPrasadItem);
router.get('/items', getPrasadItems);
router.put('/items/:id', authenticate, authorize(...adminRoles), updatePrasadItem);

// Prasad Orders
router.post('/orders', authenticate, createPrasadOrder);
router.get('/orders', authenticate, getPrasadOrders);
router.put('/orders/:id/status', authenticate, authorize(...adminRoles, 'OFFICE_STAFF'), updateOrderStatus);
router.put('/orders/:tokenCode/pickup', authenticate, authorize(...adminRoles, 'OFFICE_STAFF'), pickupOrder);

// Inventory
router.get('/inventory', authenticate, authorize(...adminRoles), getInventory);
router.post('/inventory', authenticate, authorize(...adminRoles), addInventoryItem);

export default router;
