import { Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AuthRequest, ApiResponse } from '../types';
import { AppError } from '../middleware/errorHandler';
import { getPagination, buildPaginationResponse } from '../utils/helpers';

// ---------------------------------------------------------------------------
// Helper: determine tier from totalPoints
// ---------------------------------------------------------------------------
function getTierFromPoints(totalPoints: number): string {
  if (totalPoints >= 1000) return 'platinum';
  if (totalPoints >= 500) return 'gold';
  if (totalPoints >= 100) return 'silver';
  return 'bronze';
}

// ---------------------------------------------------------------------------
// POST /profile - Create a volunteer profile for the authenticated user
// ---------------------------------------------------------------------------
export const createVolunteerProfile = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const {
      skills,
      certifications,
      availableDays,
      emergencyContact,
      emergencyPhone,
      tshirtSize,
    } = req.body;

    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Check for existing profile
    const existing = await prisma.volunteerProfile.findUnique({ where: { userId } });
    if (existing) {
      throw new AppError('Volunteer profile already exists for this user', 409);
    }

    // Validate availableDays values (0-6)
    if (availableDays && Array.isArray(availableDays)) {
      const invalid = availableDays.some(
        (d: number) => !Number.isInteger(d) || d < 0 || d > 6
      );
      if (invalid) {
        throw new AppError('availableDays must contain integers between 0 and 6', 400);
      }
    }

    const profile = await prisma.volunteerProfile.create({
      data: {
        userId,
        skills: skills ?? [],
        certifications: certifications ?? [],
        availableDays: availableDays ?? [],
        emergencyContact: emergencyContact ?? null,
        emergencyPhone: emergencyPhone ?? null,
        tshirtSize: tshirtSize ?? null,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Volunteer profile created successfully',
      data: profile,
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// GET / - List volunteer profiles with filters and pagination
// ---------------------------------------------------------------------------
export const getVolunteers = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      isActive,
      skills,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const { skip, take } = getPagination(pageNum, limitNum);

    const where: Record<string, unknown> = {};

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    if (skills) {
      // Filter volunteers who have ANY of the requested skills
      const skillList = (skills as string).split(',').map((s) => s.trim());
      where.skills = { hasSome: skillList };
    }

    const [volunteers, total] = await Promise.all([
      prisma.volunteerProfile.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { [sortBy as string]: sortOrder as string },
        skip,
        take,
      }),
      prisma.volunteerProfile.count({ where }),
    ]);

    res.json({
      success: true,
      data: volunteers,
      pagination: buildPaginationResponse(total, pageNum, limitNum),
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// GET /:id - Get a single volunteer profile with shifts, badges, and user info
// ---------------------------------------------------------------------------
export const getVolunteerById = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const volunteer = await prisma.volunteerProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatarUrl: true,
            role: true,
          },
        },
        shifts: {
          orderBy: { date: 'desc' },
        },
        badges: {
          orderBy: { earnedAt: 'desc' },
        },
      },
    });

    if (!volunteer) {
      throw new AppError('Volunteer profile not found', 404);
    }

    res.json({
      success: true,
      data: volunteer,
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// PUT /:id - Update a volunteer profile
// ---------------------------------------------------------------------------
export const updateVolunteerProfile = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      skills,
      certifications,
      availableDays,
      emergencyContact,
      emergencyPhone,
      tshirtSize,
      isActive,
    } = req.body;

    const existing = await prisma.volunteerProfile.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Volunteer profile not found', 404);
    }

    // Validate availableDays values (0-6) if provided
    if (availableDays && Array.isArray(availableDays)) {
      const invalid = availableDays.some(
        (d: number) => !Number.isInteger(d) || d < 0 || d > 6
      );
      if (invalid) {
        throw new AppError('availableDays must contain integers between 0 and 6', 400);
      }
    }

    const updateData: Record<string, unknown> = {};
    if (skills !== undefined) updateData.skills = skills;
    if (certifications !== undefined) updateData.certifications = certifications;
    if (availableDays !== undefined) updateData.availableDays = availableDays;
    if (emergencyContact !== undefined) updateData.emergencyContact = emergencyContact;
    if (emergencyPhone !== undefined) updateData.emergencyPhone = emergencyPhone;
    if (tshirtSize !== undefined) updateData.tshirtSize = tshirtSize;
    if (isActive !== undefined) updateData.isActive = isActive;

    const profile = await prisma.volunteerProfile.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true },
        },
      },
    });

    res.json({
      success: true,
      message: 'Volunteer profile updated successfully',
      data: profile,
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// POST /shifts - Create a volunteer shift
// ---------------------------------------------------------------------------
export const createShift = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      volunteerId,
      date,
      startTime,
      endTime,
      task,
      taskDescription,
      location,
    } = req.body;

    if (!volunteerId) {
      throw new AppError('Volunteer ID is required', 400);
    }

    if (!date || !startTime || !endTime || !task) {
      throw new AppError('date, startTime, endTime, and task are required', 400);
    }

    // Verify volunteer profile exists
    const volunteer = await prisma.volunteerProfile.findUnique({
      where: { id: volunteerId },
    });
    if (!volunteer) {
      throw new AppError('Volunteer profile not found', 404);
    }

    const shift = await prisma.volunteerShift.create({
      data: {
        volunteerId,
        date: new Date(date),
        startTime,
        endTime,
        task,
        taskDescription: taskDescription ?? null,
        location: location ?? null,
      },
      include: {
        volunteer: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Volunteer shift created successfully',
      data: shift,
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// GET /shifts - List shifts with filters and pagination
// ---------------------------------------------------------------------------
export const getShifts = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      volunteerId,
      startDate,
      endDate,
      status,
      page = 1,
      limit = 20,
      sortBy = 'date',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const { skip, take } = getPagination(pageNum, limitNum);

    const where: Record<string, unknown> = {};

    if (volunteerId) {
      where.volunteerId = volunteerId as string;
    }

    if (status) {
      where.status = status as string;
    }

    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {};
      if (startDate) dateFilter.gte = new Date(startDate as string);
      if (endDate) dateFilter.lte = new Date(endDate as string);
      where.date = dateFilter;
    }

    const [shifts, total] = await Promise.all([
      prisma.volunteerShift.findMany({
        where,
        include: {
          volunteer: {
            include: {
              user: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          },
        },
        orderBy: { [sortBy as string]: sortOrder as string },
        skip,
        take,
      }),
      prisma.volunteerShift.count({ where }),
    ]);

    res.json({
      success: true,
      data: shifts,
      pagination: buildPaginationResponse(total, pageNum, limitNum),
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// PUT /shifts/:id/check-in - Record check-in timestamp for a shift
// ---------------------------------------------------------------------------
export const checkInShift = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const shift = await prisma.volunteerShift.findUnique({ where: { id } });
    if (!shift) {
      throw new AppError('Shift not found', 404);
    }

    if (shift.status !== 'scheduled') {
      throw new AppError('Shift can only be checked in from scheduled status', 400);
    }

    if (shift.checkedInAt) {
      throw new AppError('Shift has already been checked in', 400);
    }

    const updatedShift = await prisma.volunteerShift.update({
      where: { id },
      data: {
        checkedInAt: new Date(),
        status: 'checked_in',
      },
      include: {
        volunteer: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
    });

    res.json({
      success: true,
      message: 'Shift checked in successfully',
      data: updatedShift,
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// PUT /shifts/:id/check-out - Record check-out, calculate hours, award points,
//                              update tier
// ---------------------------------------------------------------------------
export const checkOutShift = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { supervisorNote, rating } = req.body;

    // Validate rating if provided
    if (rating !== undefined && rating !== null) {
      const ratingNum = Number(rating);
      if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        throw new AppError('Rating must be an integer between 1 and 5', 400);
      }
    }

    const shift = await prisma.volunteerShift.findUnique({ where: { id } });
    if (!shift) {
      throw new AppError('Shift not found', 404);
    }

    if (shift.status !== 'checked_in') {
      throw new AppError('Shift must be checked in before checking out', 400);
    }

    if (!shift.checkedInAt) {
      throw new AppError('Shift has no check-in timestamp', 400);
    }

    const checkedOutAt = new Date();
    const hoursLogged =
      (checkedOutAt.getTime() - shift.checkedInAt.getTime()) / (1000 * 60 * 60);
    const roundedHours = Math.round(hoursLogged * 100) / 100;

    // Points: 1 point per hour (floored)
    const pointsEarned = Math.floor(hoursLogged);

    const result = await prisma.$transaction(async (tx) => {
      // Update the shift
      const updatedShift = await tx.volunteerShift.update({
        where: { id },
        data: {
          checkedOutAt,
          hoursLogged: roundedHours,
          status: 'completed',
          supervisorNote: supervisorNote ?? null,
          rating: rating !== undefined && rating !== null ? Number(rating) : null,
        },
      });

      // Update volunteer totalHours and totalPoints
      const volunteer = await tx.volunteerProfile.update({
        where: { id: shift.volunteerId },
        data: {
          totalHours: { increment: roundedHours },
          totalPoints: { increment: pointsEarned },
        },
      });

      // Determine and update tier based on new totalPoints
      const newTier = getTierFromPoints(volunteer.totalPoints);
      const updatedVolunteer = await tx.volunteerProfile.update({
        where: { id: shift.volunteerId },
        data: { tier: newTier },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      return { shift: updatedShift, volunteer: updatedVolunteer };
    });

    res.json({
      success: true,
      message: 'Shift checked out successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// POST /:id/badges - Award a badge to a volunteer
// ---------------------------------------------------------------------------
export const awardBadge = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { badgeName, badgeIcon, description } = req.body;

    if (!badgeName) {
      throw new AppError('Badge name is required', 400);
    }

    // Verify volunteer profile exists
    const volunteer = await prisma.volunteerProfile.findUnique({ where: { id } });
    if (!volunteer) {
      throw new AppError('Volunteer profile not found', 404);
    }

    const badge = await prisma.volunteerBadge.create({
      data: {
        volunteerId: id,
        badgeName,
        badgeIcon: badgeIcon ?? null,
        description: description ?? null,
      },
      include: {
        volunteer: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Badge awarded successfully',
      data: badge,
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// GET /leaderboard - Top volunteers by totalPoints with pagination
// ---------------------------------------------------------------------------
export const getLeaderboard = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const { skip, take } = getPagination(pageNum, limitNum);

    const where = { isActive: true };

    const [volunteers, total] = await Promise.all([
      prisma.volunteerProfile.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { totalPoints: 'desc' },
        skip,
        take,
      }),
      prisma.volunteerProfile.count({ where }),
    ]);

    // Add rank to each entry
    const leaderboard = volunteers.map((v, index) => ({
      rank: skip + index + 1,
      ...v,
    }));

    res.json({
      success: true,
      data: leaderboard,
      pagination: buildPaginationResponse(total, pageNum, limitNum),
    });
  } catch (error) {
    next(error);
  }
};
