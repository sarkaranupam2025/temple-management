import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  createBookingSlot,
  getAvailableSlots,
  createBooking,
  getBookings,
  getBookingById,
  updateBookingStatus,
  cancelBooking,
  checkIn,
} from '../controllers/bookingController';

const router = Router();

// ---------------------------------------------------------------------------
// Slot management
// ---------------------------------------------------------------------------

// POST /slots - Create a new booking slot (admin only)
router.post(
  '/slots',
  authenticate,
  authorize('SUPER_ADMIN', 'TEMPLE_ADMIN', 'MANAGER'),
  createBookingSlot
);

// GET /slots - Get available slots for a temple on a date (public / any auth)
router.get('/slots', getAvailableSlots);

// ---------------------------------------------------------------------------
// Booking CRUD
// ---------------------------------------------------------------------------

// POST / - Create a new booking (authenticated users)
router.post('/', authenticate, createBooking);

// GET / - List bookings with filters (authenticated users)
router.get('/', authenticate, getBookings);

// GET /:id - Get a single booking by ID (authenticated users)
router.get('/:id', authenticate, getBookingById);

// ---------------------------------------------------------------------------
// Booking status operations
// ---------------------------------------------------------------------------

// PUT /:id/status - Update booking status (admin only)
router.put(
  '/:id/status',
  authenticate,
  authorize('SUPER_ADMIN', 'TEMPLE_ADMIN', 'MANAGER'),
  updateBookingStatus
);

// PUT /:id/cancel - Cancel a booking (authenticated users)
router.put('/:id/cancel', authenticate, cancelBooking);

// PUT /:id/check-in - Check in a booking (admin only)
router.put(
  '/:id/check-in',
  authenticate,
  authorize('SUPER_ADMIN', 'TEMPLE_ADMIN', 'MANAGER', 'OFFICE_STAFF'),
  checkIn
);

export default router;
