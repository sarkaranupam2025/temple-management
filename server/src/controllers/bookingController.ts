import { Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AuthRequest, ApiResponse } from '../types';
import { AppError } from '../middleware/errorHandler';
import { generateBookingNumber, generateQRCode, getPagination, buildPaginationResponse } from '../utils/helpers';
import { BookingStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// createBookingSlot - Create a new time slot for a temple
// ---------------------------------------------------------------------------
export const createBookingSlot = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      templeId,
      date,
      startTime,
      endTime,
      capacity,
      bufferMinutes,
      slotType,
      price,
    } = req.body;

    if (!templeId || !date || !startTime || !endTime || capacity == null) {
      throw new AppError('templeId, date, startTime, endTime, and capacity are required', 400);
    }

    // Verify the temple exists
    const temple = await prisma.temple.findUnique({ where: { id: templeId } });
    if (!temple) {
      throw new AppError('Temple not found', 404);
    }

    // Check for overlapping slots on the same date and temple
    const slotDate = new Date(date);
    const existingSlot = await prisma.bookingSlot.findFirst({
      where: {
        templeId,
        date: slotDate,
        startTime,
        endTime,
        slotType: slotType || 'regular',
      },
    });

    if (existingSlot) {
      throw new AppError('A slot with the same time and type already exists for this date', 409);
    }

    const slot = await prisma.bookingSlot.create({
      data: {
        templeId,
        date: slotDate,
        startTime,
        endTime,
        capacity: Number(capacity),
        bufferMinutes: bufferMinutes != null ? Number(bufferMinutes) : 10,
        slotType: slotType || 'regular',
        price: price != null ? Number(price) : 0,
      },
    });

    res.status(201).json({
      success: true,
      data: slot,
      message: 'Booking slot created successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// getAvailableSlots - Get available slots for a temple on a given date
// ---------------------------------------------------------------------------
export const getAvailableSlots = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { templeId, date, slotType } = req.query;

    if (!templeId || !date) {
      throw new AppError('templeId and date are required query parameters', 400);
    }

    const slotDate = new Date(date as string);

    const where: Record<string, unknown> = {
      templeId: templeId as string,
      date: slotDate,
      isActive: true,
    };

    if (slotType) {
      where.slotType = slotType as string;
    }

    const slots = await prisma.bookingSlot.findMany({
      where,
      orderBy: { startTime: 'asc' },
    });

    // Compute remaining capacity for each slot
    const slotsWithAvailability = slots.map((slot) => ({
      ...slot,
      remainingCapacity: slot.capacity - slot.bookedCount,
      isAvailable: slot.bookedCount < slot.capacity,
    }));

    res.status(200).json({
      success: true,
      data: slotsWithAvailability,
      message: 'Available slots retrieved successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// createBooking - Create a new booking for a devotee
// ---------------------------------------------------------------------------
export const createBooking = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const {
      templeId,
      slotId,
      ritualId,
      date,
      numberOfPersons,
      specialRequests,
    } = req.body;

    if (!templeId || !date) {
      throw new AppError('templeId and date are required', 400);
    }

    const personsCount = numberOfPersons ? Number(numberOfPersons) : 1;

    // If a slotId is provided, validate the slot and capacity
    let totalAmount = 0;

    if (slotId) {
      const slot = await prisma.bookingSlot.findUnique({ where: { id: slotId } });

      if (!slot) {
        throw new AppError('Booking slot not found', 404);
      }

      if (!slot.isActive) {
        throw new AppError('This booking slot is no longer active', 400);
      }

      if (slot.bookedCount + personsCount > slot.capacity) {
        throw new AppError(
          `Insufficient capacity. Only ${slot.capacity - slot.bookedCount} spot(s) remaining`,
          400
        );
      }

      totalAmount = slot.price * personsCount;
    }

    // If a ritualId is provided, validate the ritual
    if (ritualId) {
      const ritual = await prisma.ritual.findUnique({ where: { id: ritualId } });

      if (!ritual) {
        throw new AppError('Ritual not found', 404);
      }

      if (!ritual.isActive) {
        throw new AppError('This ritual is no longer active', 400);
      }

      // Add ritual price to total if there is one
      totalAmount += ritual.price * personsCount;
    }

    // Generate booking number and QR code
    const bookingNumber = generateBookingNumber();
    const qrCode = await generateQRCode(
      JSON.stringify({ bookingNumber, templeId, date, userId })
    );

    // Create booking and increment bookedCount in a transaction
    const booking = await prisma.$transaction(async (tx) => {
      // Increment bookedCount on the slot (re-check capacity inside transaction)
      if (slotId) {
        const freshSlot = await tx.bookingSlot.findUnique({ where: { id: slotId } });

        if (!freshSlot || freshSlot.bookedCount + personsCount > freshSlot.capacity) {
          throw new AppError('Slot capacity exceeded. Please choose another slot.', 400);
        }

        await tx.bookingSlot.update({
          where: { id: slotId },
          data: { bookedCount: { increment: personsCount } },
        });
      }

      const newBooking = await tx.booking.create({
        data: {
          bookingNumber,
          userId,
          templeId,
          slotId: slotId || null,
          ritualId: ritualId || null,
          date: new Date(date),
          numberOfPersons: personsCount,
          specialRequests: specialRequests || null,
          qrCode,
          totalAmount,
          status: BookingStatus.CONFIRMED,
        },
        include: {
          slot: true,
          ritual: true,
        },
      });

      return newBooking;
    });

    res.status(201).json({
      success: true,
      data: booking,
      message: 'Booking created successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// getBookings - List bookings with filters and pagination
// ---------------------------------------------------------------------------
export const getBookings = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      userId,
      templeId,
      startDate,
      endDate,
      status,
      page = '1',
      limit = '20',
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const { skip, take } = getPagination(pageNum, limitNum);

    const where: Record<string, unknown> = {};

    // Non-admin users can only see their own bookings
    if (req.user!.role === 'DEVOTEE') {
      where.userId = req.user!.userId;
    } else if (userId) {
      where.userId = userId as string;
    }

    if (templeId) {
      where.templeId = templeId as string;
    }

    if (status) {
      where.status = status as BookingStatus;
    }

    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {};
      if (startDate) dateFilter.gte = new Date(startDate as string);
      if (endDate) dateFilter.lte = new Date(endDate as string);
      where.date = dateFilter;
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          slot: true,
          ritual: true,
        },
        skip,
        take,
        orderBy: { [sortBy as string]: sortOrder as string },
      }),
      prisma.booking.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: bookings,
      message: 'Bookings retrieved successfully',
      pagination: buildPaginationResponse(total, pageNum, limitNum),
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// getBookingById - Get a single booking with slot and ritual details
// ---------------------------------------------------------------------------
export const getBookingById = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        slot: true,
        ritual: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        payment: true,
        prasadOrders: true,
      },
    });

    if (!booking) {
      throw new AppError('Booking not found', 404);
    }

    // Non-admin users can only view their own bookings
    if (req.user!.role === 'DEVOTEE' && booking.userId !== req.user!.userId) {
      throw new AppError('You do not have permission to view this booking', 403);
    }

    res.status(200).json({
      success: true,
      data: booking,
      message: 'Booking retrieved successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// updateBookingStatus - Update the status of a booking (admin)
// ---------------------------------------------------------------------------
export const updateBookingStatus = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      throw new AppError('status is required', 400);
    }

    const validStatuses: BookingStatus[] = [
      BookingStatus.CONFIRMED,
      BookingStatus.CHECKED_IN,
      BookingStatus.COMPLETED,
      BookingStatus.CANCELLED,
      BookingStatus.NO_SHOW,
    ];

    if (!validStatuses.includes(status as BookingStatus)) {
      throw new AppError(
        `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        400
      );
    }

    const booking = await prisma.booking.findUnique({ where: { id } });

    if (!booking) {
      throw new AppError('Booking not found', 404);
    }

    // Prevent updating an already cancelled or completed booking
    if (
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.COMPLETED
    ) {
      throw new AppError(
        `Cannot update a booking that is already ${booking.status}`,
        400
      );
    }

    const updateData: Record<string, unknown> = { status: status as BookingStatus };

    // If status changes to CHECKED_IN, record the timestamp
    if (status === BookingStatus.CHECKED_IN) {
      updateData.checkedInAt = new Date();
    }

    // If status changes to CANCELLED, record the timestamp and decrement slot count
    if (status === BookingStatus.CANCELLED) {
      updateData.cancelledAt = new Date();

      if (booking.slotId) {
        await prisma.bookingSlot.update({
          where: { id: booking.slotId },
          data: { bookedCount: { decrement: booking.numberOfPersons } },
        });
      }
    }

    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: updateData,
      include: {
        slot: true,
        ritual: true,
      },
    });

    res.status(200).json({
      success: true,
      data: updatedBooking,
      message: `Booking status updated to ${status}`,
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// cancelBooking - Cancel a booking with reason and decrement bookedCount
// ---------------------------------------------------------------------------
export const cancelBooking = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const booking = await prisma.booking.findUnique({ where: { id } });

    if (!booking) {
      throw new AppError('Booking not found', 404);
    }

    // Non-admin users can only cancel their own bookings
    if (req.user!.role === 'DEVOTEE' && booking.userId !== req.user!.userId) {
      throw new AppError('You do not have permission to cancel this booking', 403);
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new AppError('Booking is already cancelled', 400);
    }

    if (booking.status === BookingStatus.COMPLETED) {
      throw new AppError('Cannot cancel a completed booking', 400);
    }

    if (booking.status === BookingStatus.CHECKED_IN) {
      throw new AppError('Cannot cancel a booking that has already been checked in', 400);
    }

    // Cancel booking and decrement slot count in a transaction
    const cancelledBooking = await prisma.$transaction(async (tx) => {
      if (booking.slotId) {
        await tx.bookingSlot.update({
          where: { id: booking.slotId },
          data: { bookedCount: { decrement: booking.numberOfPersons } },
        });
      }

      return tx.booking.update({
        where: { id },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: reason || null,
        },
        include: {
          slot: true,
          ritual: true,
        },
      });
    });

    res.status(200).json({
      success: true,
      data: cancelledBooking,
      message: 'Booking cancelled successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// checkIn - Mark a booking as checked in, validate QR code
// ---------------------------------------------------------------------------
export const checkIn = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { qrCode } = req.body;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        slot: true,
        ritual: true,
      },
    });

    if (!booking) {
      throw new AppError('Booking not found', 404);
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new AppError('Cannot check in a cancelled booking', 400);
    }

    if (booking.status === BookingStatus.COMPLETED) {
      throw new AppError('This booking has already been completed', 400);
    }

    if (booking.status === BookingStatus.CHECKED_IN) {
      throw new AppError('This booking has already been checked in', 400);
    }

    // Validate the QR code matches the booking
    if (qrCode && booking.qrCode !== qrCode) {
      throw new AppError('QR code does not match this booking', 400);
    }

    const checkedInBooking = await prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.CHECKED_IN,
        checkedInAt: new Date(),
      },
      include: {
        slot: true,
        ritual: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      data: checkedInBooking,
      message: 'Booking checked in successfully',
    });
  } catch (error) {
    next(error);
  }
};
