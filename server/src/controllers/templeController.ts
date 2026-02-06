import { Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AuthRequest, ApiResponse } from '../types';
import { AppError } from '../middleware/errorHandler';
import { getPagination, buildPaginationResponse } from '../utils/helpers';

// ============================================================
// Temple CRUD
// ============================================================

export const createTemple = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      name,
      deity,
      foundingYear,
      architecturalStyle,
      description,
      address,
      city,
      state,
      pincode,
      country,
      phone,
      email,
      emergencyContact,
      latitude,
      longitude,
      parkingCapacity,
      hasWheelchairAccess,
      hasMeditationHall,
      virtualTourUrl,
      websiteUrl,
      parentTempleId,
    } = req.body;

    if (!name || !deity || !address || !city || !state || !pincode) {
      throw new AppError('Name, deity, address, city, state, and pincode are required', 400);
    }

    if (parentTempleId) {
      const parentTemple = await prisma.temple.findUnique({
        where: { id: parentTempleId },
      });
      if (!parentTemple) {
        throw new AppError('Parent temple not found', 404);
      }
    }

    const temple = await prisma.temple.create({
      data: {
        name,
        deity,
        foundingYear: foundingYear ? parseInt(foundingYear, 10) : undefined,
        architecturalStyle,
        description,
        address,
        city,
        state,
        pincode,
        country,
        phone,
        email,
        emergencyContact,
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined,
        parkingCapacity: parkingCapacity ? parseInt(parkingCapacity, 10) : 0,
        hasWheelchairAccess: hasWheelchairAccess ?? false,
        hasMeditationHall: hasMeditationHall ?? false,
        virtualTourUrl,
        websiteUrl,
        parentTempleId,
      },
    });

    res.status(201).json({
      success: true,
      data: temple,
      message: 'Temple created successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const getTemples = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      city,
      state,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const { skip, take } = getPagination(pageNum, limitNum);

    const where: Record<string, unknown> = {};

    // Search by name, city, or state
    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { city: { contains: String(search), mode: 'insensitive' } },
        { state: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    // Filter by specific city
    if (city) {
      where.city = { contains: String(city), mode: 'insensitive' };
    }

    // Filter by specific state
    if (state) {
      where.state = { contains: String(state), mode: 'insensitive' };
    }

    // Filter by active status
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const [temples, total] = await Promise.all([
      prisma.temple.findMany({
        where,
        skip,
        take,
        orderBy: { [String(sortBy)]: String(sortOrder) },
        include: {
          timings: {
            where: { isActive: true },
          },
          _count: {
            select: {
              rituals: true,
              events: true,
              staff: true,
            },
          },
        },
      }),
      prisma.temple.count({ where }),
    ]);

    res.json({
      success: true,
      data: temples,
      pagination: buildPaginationResponse(total, pageNum, limitNum),
    });
  } catch (error) {
    next(error);
  }
};

export const getTempleById = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const temple = await prisma.temple.findUnique({
      where: { id },
      include: {
        timings: {
          where: { isActive: true },
          orderBy: [{ dayOfWeek: 'asc' }, { openTime: 'asc' }],
        },
        facilities: true,
        mediaGallery: {
          orderBy: { sortOrder: 'asc' },
        },
        translations: true,
        parentTemple: {
          select: { id: true, name: true, city: true },
        },
        childTemples: {
          where: { isActive: true },
          select: { id: true, name: true, city: true },
        },
        _count: {
          select: {
            rituals: true,
            events: true,
            staff: true,
            bookingSlots: true,
            donations: true,
          },
        },
      },
    });

    if (!temple) {
      throw new AppError('Temple not found', 404);
    }

    res.json({
      success: true,
      data: temple,
    });
  } catch (error) {
    next(error);
  }
};

export const updateTemple = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await prisma.temple.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Temple not found', 404);
    }

    const {
      name,
      deity,
      foundingYear,
      architecturalStyle,
      description,
      address,
      city,
      state,
      pincode,
      country,
      phone,
      email,
      emergencyContact,
      latitude,
      longitude,
      parkingCapacity,
      hasWheelchairAccess,
      hasMeditationHall,
      virtualTourUrl,
      websiteUrl,
      parentTempleId,
    } = req.body;

    if (parentTempleId) {
      if (parentTempleId === id) {
        throw new AppError('A temple cannot be its own parent', 400);
      }
      const parentTemple = await prisma.temple.findUnique({
        where: { id: parentTempleId },
      });
      if (!parentTemple) {
        throw new AppError('Parent temple not found', 404);
      }
    }

    const temple = await prisma.temple.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(deity !== undefined && { deity }),
        ...(foundingYear !== undefined && { foundingYear: foundingYear ? parseInt(foundingYear, 10) : null }),
        ...(architecturalStyle !== undefined && { architecturalStyle }),
        ...(description !== undefined && { description }),
        ...(address !== undefined && { address }),
        ...(city !== undefined && { city }),
        ...(state !== undefined && { state }),
        ...(pincode !== undefined && { pincode }),
        ...(country !== undefined && { country }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(emergencyContact !== undefined && { emergencyContact }),
        ...(latitude !== undefined && { latitude: latitude ? parseFloat(latitude) : null }),
        ...(longitude !== undefined && { longitude: longitude ? parseFloat(longitude) : null }),
        ...(parkingCapacity !== undefined && { parkingCapacity: parseInt(parkingCapacity, 10) }),
        ...(hasWheelchairAccess !== undefined && { hasWheelchairAccess }),
        ...(hasMeditationHall !== undefined && { hasMeditationHall }),
        ...(virtualTourUrl !== undefined && { virtualTourUrl }),
        ...(websiteUrl !== undefined && { websiteUrl }),
        ...(parentTempleId !== undefined && { parentTempleId }),
      },
    });

    res.json({
      success: true,
      data: temple,
      message: 'Temple updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const deleteTemple = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await prisma.temple.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Temple not found', 404);
    }

    if (!existing.isActive) {
      throw new AppError('Temple is already deactivated', 400);
    }

    await prisma.temple.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({
      success: true,
      message: 'Temple deactivated successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Temple Timings
// ============================================================

export const addTempleTimings = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { dayOfWeek, openTime, closeTime, label, isSpecial, specialDate } = req.body;

    const temple = await prisma.temple.findUnique({ where: { id } });
    if (!temple) {
      throw new AppError('Temple not found', 404);
    }

    if (dayOfWeek === undefined || !openTime || !closeTime) {
      throw new AppError('dayOfWeek, openTime, and closeTime are required', 400);
    }

    if (dayOfWeek < 0 || dayOfWeek > 6) {
      throw new AppError('dayOfWeek must be between 0 (Sunday) and 6 (Saturday)', 400);
    }

    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!timeRegex.test(openTime) || !timeRegex.test(closeTime)) {
      throw new AppError('openTime and closeTime must be in HH:mm format', 400);
    }

    const timing = await prisma.templeTimings.create({
      data: {
        templeId: id,
        dayOfWeek: parseInt(dayOfWeek, 10),
        openTime,
        closeTime,
        label,
        isSpecial: isSpecial ?? false,
        specialDate: specialDate ? new Date(specialDate) : undefined,
      },
    });

    res.status(201).json({
      success: true,
      data: timing,
      message: 'Temple timing added successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Rituals
// ============================================================

export const createRitual = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      name,
      type,
      description,
      duration,
      capacity,
      price,
      isRecurring,
      recurringRule,
      requiresPriest,
    } = req.body;

    const temple = await prisma.temple.findUnique({ where: { id } });
    if (!temple) {
      throw new AppError('Temple not found', 404);
    }

    if (!name || !type || !duration) {
      throw new AppError('Name, type, and duration are required', 400);
    }

    const validTypes = ['DAILY_PUJA', 'SPECIAL_ABHISHEKAM', 'FESTIVAL_EVENT', 'PERSONAL_RITUAL'];
    if (!validTypes.includes(type)) {
      throw new AppError(
        `Invalid ritual type. Must be one of: ${validTypes.join(', ')}`,
        400
      );
    }

    const ritual = await prisma.ritual.create({
      data: {
        templeId: id,
        name,
        type,
        description,
        duration: parseInt(duration, 10),
        capacity: capacity ? parseInt(capacity, 10) : undefined,
        price: price ? parseFloat(price) : 0,
        isRecurring: isRecurring ?? false,
        recurringRule,
        requiresPriest: requiresPriest ?? true,
      },
    });

    res.status(201).json({
      success: true,
      data: ritual,
      message: 'Ritual created successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const getRituals = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      page = 1,
      limit = 20,
      type,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const temple = await prisma.temple.findUnique({ where: { id } });
    if (!temple) {
      throw new AppError('Temple not found', 404);
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const { skip, take } = getPagination(pageNum, limitNum);

    const where: Record<string, unknown> = { templeId: id };

    if (type) {
      where.type = String(type);
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const [rituals, total] = await Promise.all([
      prisma.ritual.findMany({
        where,
        skip,
        take,
        orderBy: { [String(sortBy)]: String(sortOrder) },
        include: {
          translations: true,
          _count: {
            select: {
              schedules: true,
              bookings: true,
            },
          },
        },
      }),
      prisma.ritual.count({ where }),
    ]);

    res.json({
      success: true,
      data: rituals,
      pagination: buildPaginationResponse(total, pageNum, limitNum),
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Events
// ============================================================

export const createEvent = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      startDate,
      endDate,
      isPublic,
      capacity,
      location,
      category,
      imageUrl,
    } = req.body;

    const temple = await prisma.temple.findUnique({ where: { id } });
    if (!temple) {
      throw new AppError('Temple not found', 404);
    }

    if (!name || !startDate || !endDate) {
      throw new AppError('Name, startDate, and endDate are required', 400);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new AppError('Invalid date format for startDate or endDate', 400);
    }

    if (end <= start) {
      throw new AppError('endDate must be after startDate', 400);
    }

    const event = await prisma.event.create({
      data: {
        templeId: id,
        name,
        description,
        startDate: start,
        endDate: end,
        isPublic: isPublic ?? true,
        capacity: capacity ? parseInt(capacity, 10) : undefined,
        location,
        category,
        imageUrl,
      },
    });

    res.status(201).json({
      success: true,
      data: event,
      message: 'Event created successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const getEvents = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      page = 1,
      limit = 20,
      startDate,
      endDate,
      category,
      isActive,
      sortBy = 'startDate',
      sortOrder = 'asc',
    } = req.query;

    const temple = await prisma.temple.findUnique({ where: { id } });
    if (!temple) {
      throw new AppError('Temple not found', 404);
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const { skip, take } = getPagination(pageNum, limitNum);

    const where: Record<string, unknown> = { templeId: id };

    // Date range filter
    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {};
      if (startDate) {
        dateFilter.gte = new Date(String(startDate));
      }
      if (endDate) {
        dateFilter.lte = new Date(String(endDate));
      }
      where.startDate = dateFilter;
    }

    if (category) {
      where.category = String(category);
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        skip,
        take,
        orderBy: { [String(sortBy)]: String(sortOrder) },
      }),
      prisma.event.count({ where }),
    ]);

    res.json({
      success: true,
      data: events,
      pagination: buildPaginationResponse(total, pageNum, limitNum),
    });
  } catch (error) {
    next(error);
  }
};
