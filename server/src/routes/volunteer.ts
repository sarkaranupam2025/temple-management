import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  createVolunteerProfile,
  getVolunteers,
  getVolunteerById,
  updateVolunteerProfile,
  createShift,
  getShifts,
  checkInShift,
  checkOutShift,
  awardBadge,
  getLeaderboard,
} from '../controllers/volunteerController';

const router = Router();

const adminRoles = ['SUPER_ADMIN', 'TEMPLE_ADMIN', 'MANAGER'] as const;

// Authenticated: create own volunteer profile
router.post('/profile', authenticate, createVolunteerProfile);

// Admin-only: list all volunteers
router.get('/', authenticate, authorize(...adminRoles), getVolunteers);

// Public: leaderboard (placed before /:id to avoid route conflicts)
router.get('/leaderboard', getLeaderboard);

// Shift routes (placed before /:id to avoid route conflicts)
router.post('/shifts', authenticate, authorize(...adminRoles), createShift);
router.get('/shifts', authenticate, getShifts);
router.put('/shifts/:id/check-in', authenticate, checkInShift);
router.put('/shifts/:id/check-out', authenticate, authorize(...adminRoles), checkOutShift);

// Authenticated: get single volunteer
router.get('/:id', authenticate, getVolunteerById);

// Authenticated: update volunteer profile
router.put('/:id', authenticate, updateVolunteerProfile);

// Admin-only: award badge
router.post('/:id/badges', authenticate, authorize(...adminRoles), awardBadge);

export default router;
