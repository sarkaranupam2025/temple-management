import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  createTemple,
  getTemples,
  getTempleById,
  updateTemple,
  deleteTemple,
  addTempleTimings,
  createRitual,
  getRituals,
  createEvent,
  getEvents,
} from '../controllers/templeController';

const router = Router();

const adminOnly = [authenticate, authorize('SUPER_ADMIN', 'TEMPLE_ADMIN', 'MANAGER')];

// Temple CRUD
router.post('/', ...adminOnly, createTemple);
router.get('/', getTemples);
router.get('/:id', getTempleById);
router.put('/:id', ...adminOnly, updateTemple);
router.delete('/:id', ...adminOnly, deleteTemple);

// Temple Timings
router.post('/:id/timings', ...adminOnly, addTempleTimings);

// Rituals
router.post('/:id/rituals', ...adminOnly, createRitual);
router.get('/:id/rituals', getRituals);

// Events
router.post('/:id/events', ...adminOnly, createEvent);
router.get('/:id/events', getEvents);

export default router;
