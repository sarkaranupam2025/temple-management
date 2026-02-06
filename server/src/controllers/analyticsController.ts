import { Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AuthRequest, ApiResponse } from '../types';
import { AppError } from '../middleware/errorHandler';
import { getPagination, buildPaginationResponse } from '../utils/helpers';

// ---------------------------------------------------------------------------
// GET /dashboard - Key metrics overview for a temple
// ---------------------------------------------------------------------------
export const getDashboardOverview = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { templeId } = req.query;

    if (!templeId) {
      throw new AppError('Temple ID is required', 400);
    }

    const templeIdStr = templeId as string;

    // Verify temple exists
    const temple = await prisma.temple.findUnique({ where: { id: templeIdStr } });
    if (!temple) {
      throw new AppError('Temple not found', 404);
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(todayStart);

    // ---------- Today's metrics ----------

    const [
      todayVisitors,
      todayBookings,
      todayDonations,
      pendingBookings,
      activeVolunteers,
      openFeedback,
    ] = await Promise.all([
      // Today's visitors (checked-in bookings)
      prisma.booking.count({
        where: {
          templeId: templeIdStr,
          checkedInAt: { gte: todayStart, lt: todayEnd },
        },
      }),

      // Today's bookings
      prisma.booking.count({
        where: {
          templeId: templeIdStr,
          createdAt: { gte: todayStart, lt: todayEnd },
        },
      }),

      // Today's donations (amount + count)
      prisma.donation.aggregate({
        where: {
          templeId: templeIdStr,
          paymentStatus: 'COMPLETED',
          createdAt: { gte: todayStart, lt: todayEnd },
        },
        _sum: { amount: true },
        _count: { id: true },
      }),

      // Pending bookings
      prisma.booking.count({
        where: {
          templeId: templeIdStr,
          status: 'PENDING',
        },
      }),

      // Active volunteers (with shifts today)
      prisma.volunteerShift.count({
        where: {
          date: { gte: todayStart, lt: todayEnd },
          status: { in: ['scheduled', 'checked_in'] },
          volunteer: {
            isActive: true,
          },
        },
      }),

      // Open feedback
      prisma.feedback.count({
        where: {
          templeId: templeIdStr,
          status: { in: ['open', 'in_progress'] },
        },
      }),
    ]);

    // ---------- Yesterday's metrics for trend comparison ----------

    const [
      yesterdayVisitors,
      yesterdayBookings,
      yesterdayDonations,
    ] = await Promise.all([
      prisma.booking.count({
        where: {
          templeId: templeIdStr,
          checkedInAt: { gte: yesterdayStart, lt: yesterdayEnd },
        },
      }),

      prisma.booking.count({
        where: {
          templeId: templeIdStr,
          createdAt: { gte: yesterdayStart, lt: yesterdayEnd },
        },
      }),

      prisma.donation.aggregate({
        where: {
          templeId: templeIdStr,
          paymentStatus: 'COMPLETED',
          createdAt: { gte: yesterdayStart, lt: yesterdayEnd },
        },
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    // ---------- Compute trend indicators ----------

    const computeTrend = (today: number, yesterday: number) => {
      if (yesterday === 0) return today > 0 ? 100 : 0;
      return Math.round(((today - yesterday) / yesterday) * 100);
    };

    const todayDonationAmount = todayDonations._sum.amount ?? 0;
    const yesterdayDonationAmount = yesterdayDonations._sum.amount ?? 0;

    res.json({
      success: true,
      data: {
        today: {
          visitors: todayVisitors,
          bookings: todayBookings,
          donationAmount: todayDonationAmount,
          donationCount: todayDonations._count.id,
          pendingBookings,
          activeVolunteers,
          openFeedback,
        },
        yesterday: {
          visitors: yesterdayVisitors,
          bookings: yesterdayBookings,
          donationAmount: yesterdayDonationAmount,
          donationCount: yesterdayDonations._count.id,
        },
        trends: {
          visitors: computeTrend(todayVisitors, yesterdayVisitors),
          bookings: computeTrend(todayBookings, yesterdayBookings),
          donationAmount: computeTrend(todayDonationAmount, yesterdayDonationAmount),
          donationCount: computeTrend(todayDonations._count.id, yesterdayDonations._count.id),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// GET /visitors - Visitor trends over a date range
// ---------------------------------------------------------------------------
export const getVisitorAnalytics = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { templeId, startDate, endDate, groupBy = 'day' } = req.query;

    if (!templeId) {
      throw new AppError('Temple ID is required', 400);
    }
    if (!startDate || !endDate) {
      throw new AppError('startDate and endDate are required', 400);
    }

    const templeIdStr = templeId as string;
    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    // Validate group-by value
    const validGroupBy = ['day', 'week', 'month'];
    const interval = validGroupBy.includes(groupBy as string) ? (groupBy as string) : 'day';

    // Booking counts grouped by time period
    const bookingParams: (string | Date)[] = [templeIdStr, start, end];
    const bookingTrends = await prisma.$queryRawUnsafe<
      { period: string; booking_count: bigint; checkin_count: bigint; avg_group_size: number }[]
    >(
      `SELECT
         date_trunc('${interval}', "createdAt") AS period,
         COUNT(id) AS booking_count,
         COUNT(CASE WHEN "checkedInAt" IS NOT NULL THEN 1 END) AS checkin_count,
         COALESCE(AVG("numberOfPersons"), 0) AS avg_group_size
       FROM "Booking"
       WHERE "templeId" = $1
         AND "createdAt" >= $2
         AND "createdAt" <= $3
       GROUP BY period
       ORDER BY period ASC`,
      ...bookingParams,
    );

    const serialised = bookingTrends.map((row) => ({
      period: row.period,
      bookingCount: Number(row.booking_count),
      checkInCount: Number(row.checkin_count),
      averageGroupSize: Number(Number(row.avg_group_size).toFixed(2)),
    }));

    // Summary totals
    const totals = await prisma.booking.aggregate({
      where: {
        templeId: templeIdStr,
        createdAt: { gte: start, lte: end },
      },
      _count: { id: true },
      _avg: { numberOfPersons: true },
    });

    const checkInTotal = await prisma.booking.count({
      where: {
        templeId: templeIdStr,
        checkedInAt: { gte: start, lte: end },
      },
    });

    res.json({
      success: true,
      data: {
        summary: {
          totalBookings: totals._count.id,
          totalCheckIns: checkInTotal,
          averageGroupSize: totals._avg.numberOfPersons
            ? Number(totals._avg.numberOfPersons.toFixed(2))
            : 0,
        },
        trends: serialised,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// GET /financial - Financial summary over a date range
// ---------------------------------------------------------------------------
export const getFinancialAnalytics = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { templeId, startDate, endDate, groupBy = 'day' } = req.query;

    if (!templeId) {
      throw new AppError('Temple ID is required', 400);
    }
    if (!startDate || !endDate) {
      throw new AppError('startDate and endDate are required', 400);
    }

    const templeIdStr = templeId as string;
    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    const dateFilter: Record<string, unknown> = {
      templeId: templeIdStr,
      paymentStatus: 'COMPLETED',
      createdAt: { gte: start, lte: end },
    };

    // Total donations aggregate
    const totals = await prisma.donation.aggregate({
      where: dateFilter,
      _sum: { amount: true },
      _count: { id: true },
      _avg: { amount: true },
    });

    // By category
    const byCategory = await prisma.donation.groupBy({
      by: ['category'],
      where: dateFilter,
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: 'desc' } },
    });

    // By payment method
    const byPaymentMethod = await prisma.donation.groupBy({
      by: ['paymentMethod'],
      where: dateFilter,
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: 'desc' } },
    });

    // Time-series trends
    const validGroupBy = ['day', 'week', 'month'];
    const interval = validGroupBy.includes(groupBy as string) ? (groupBy as string) : 'day';

    const trendParams: (string | Date)[] = [templeIdStr, start, end];
    const trends = await prisma.$queryRawUnsafe<
      { period: string; total_amount: number; donation_count: bigint }[]
    >(
      `SELECT
         date_trunc('${interval}', "createdAt") AS period,
         SUM(amount) AS total_amount,
         COUNT(id) AS donation_count
       FROM "Donation"
       WHERE "templeId" = $1
         AND "paymentStatus" = 'COMPLETED'
         AND "createdAt" >= $2
         AND "createdAt" <= $3
       GROUP BY period
       ORDER BY period ASC`,
      ...trendParams,
    );

    const serialisedTrends = trends.map((t) => ({
      period: t.period,
      totalAmount: Number(t.total_amount),
      donationCount: Number(t.donation_count),
    }));

    // ---------- Previous-period comparison ----------
    const periodMs = end.getTime() - start.getTime();
    const prevStart = new Date(start.getTime() - periodMs);
    const prevEnd = new Date(start);

    const prevTotals = await prisma.donation.aggregate({
      where: {
        templeId: templeIdStr,
        paymentStatus: 'COMPLETED',
        createdAt: { gte: prevStart, lte: prevEnd },
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    const currentAmount = totals._sum.amount ?? 0;
    const previousAmount = prevTotals._sum.amount ?? 0;
    const amountChange = previousAmount === 0
      ? (currentAmount > 0 ? 100 : 0)
      : Math.round(((currentAmount - previousAmount) / previousAmount) * 100);

    const currentCount = totals._count.id;
    const previousCount = prevTotals._count.id;
    const countChange = previousCount === 0
      ? (currentCount > 0 ? 100 : 0)
      : Math.round(((currentCount - previousCount) / previousCount) * 100);

    res.json({
      success: true,
      data: {
        summary: {
          totalAmount: currentAmount,
          totalCount: currentCount,
          averageAmount: totals._avg.amount ? Number(totals._avg.amount.toFixed(2)) : 0,
        },
        comparison: {
          previousPeriod: {
            totalAmount: previousAmount,
            totalCount: previousCount,
          },
          amountChangePercent: amountChange,
          countChangePercent: countChange,
        },
        byCategory: byCategory.map((c) => ({
          category: c.category,
          totalAmount: c._sum.amount ?? 0,
          count: c._count.id,
        })),
        byPaymentMethod: byPaymentMethod.map((p) => ({
          paymentMethod: p.paymentMethod,
          totalAmount: p._sum.amount ?? 0,
          count: p._count.id,
        })),
        trends: serialisedTrends,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// GET /operational - Operational metrics (queue times, completion rates, etc.)
// ---------------------------------------------------------------------------
export const getOperationalMetrics = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { templeId, startDate, endDate } = req.query;

    if (!templeId) {
      throw new AppError('Temple ID is required', 400);
    }

    const templeIdStr = templeId as string;

    const dateFilter: Record<string, unknown> = {};
    if (startDate || endDate) {
      const createdAt: Record<string, Date> = {};
      if (startDate) createdAt.gte = new Date(startDate as string);
      if (endDate) createdAt.lte = new Date(endDate as string);
      dateFilter.createdAt = createdAt;
    }

    // ---------- Queue times (booking created -> checked in) ----------

    const checkedInBookings = await prisma.$queryRawUnsafe<
      { avg_queue_minutes: number; min_queue_minutes: number; max_queue_minutes: number; total: bigint }[]
    >(
      `SELECT
         COALESCE(AVG(EXTRACT(EPOCH FROM ("checkedInAt" - "createdAt")) / 60), 0) AS avg_queue_minutes,
         COALESCE(MIN(EXTRACT(EPOCH FROM ("checkedInAt" - "createdAt")) / 60), 0) AS min_queue_minutes,
         COALESCE(MAX(EXTRACT(EPOCH FROM ("checkedInAt" - "createdAt")) / 60), 0) AS max_queue_minutes,
         COUNT(id) AS total
       FROM "Booking"
       WHERE "templeId" = $1
         AND "checkedInAt" IS NOT NULL
         ${startDate ? `AND "createdAt" >= $2` : ''}
         ${startDate && endDate ? `AND "createdAt" <= $3` : endDate ? `AND "createdAt" <= $2` : ''}`,
      ...[
        templeIdStr,
        ...(startDate ? [new Date(startDate as string)] : []),
        ...(endDate ? [new Date(endDate as string)] : []),
      ],
    );

    const queueMetrics = checkedInBookings[0] ?? {
      avg_queue_minutes: 0,
      min_queue_minutes: 0,
      max_queue_minutes: 0,
      total: 0,
    };

    // ---------- Prasad order completion rates ----------

    const prasadStatusCounts = await prisma.prasadOrder.groupBy({
      by: ['status'],
      where: {
        prasad: { templeId: templeIdStr },
        ...dateFilter,
      },
      _count: { id: true },
    });

    const prasadTotal = prasadStatusCounts.reduce((sum, s) => sum + s._count.id, 0);
    const prasadCompleted = prasadStatusCounts
      .filter((s) => s.status === 'picked_up')
      .reduce((sum, s) => sum + s._count.id, 0);
    const prasadReady = prasadStatusCounts
      .filter((s) => s.status === 'ready')
      .reduce((sum, s) => sum + s._count.id, 0);
    const prasadExpired = prasadStatusCounts
      .filter((s) => s.status === 'expired')
      .reduce((sum, s) => sum + s._count.id, 0);

    // ---------- Volunteer shift completion rates ----------

    const shiftStatusCounts = await prisma.volunteerShift.groupBy({
      by: ['status'],
      where: dateFilter,
      _count: { id: true },
    });

    const shiftTotal = shiftStatusCounts.reduce((sum, s) => sum + s._count.id, 0);
    const shiftCompleted = shiftStatusCounts
      .filter((s) => s.status === 'completed')
      .reduce((sum, s) => sum + s._count.id, 0);
    const shiftMissed = shiftStatusCounts
      .filter((s) => s.status === 'missed')
      .reduce((sum, s) => sum + s._count.id, 0);

    // ---------- Feedback resolution rates ----------

    const feedbackStatusCounts = await prisma.feedback.groupBy({
      by: ['status'],
      where: {
        templeId: templeIdStr,
        ...dateFilter,
      },
      _count: { id: true },
    });

    const feedbackTotal = feedbackStatusCounts.reduce((sum, s) => sum + s._count.id, 0);
    const feedbackResolved = feedbackStatusCounts
      .filter((s) => s.status === 'resolved' || s.status === 'closed')
      .reduce((sum, s) => sum + s._count.id, 0);
    const feedbackOpen = feedbackStatusCounts
      .filter((s) => s.status === 'open')
      .reduce((sum, s) => sum + s._count.id, 0);
    const feedbackInProgress = feedbackStatusCounts
      .filter((s) => s.status === 'in_progress')
      .reduce((sum, s) => sum + s._count.id, 0);

    res.json({
      success: true,
      data: {
        queueTimes: {
          averageMinutes: Number(Number(queueMetrics.avg_queue_minutes).toFixed(2)),
          minMinutes: Number(Number(queueMetrics.min_queue_minutes).toFixed(2)),
          maxMinutes: Number(Number(queueMetrics.max_queue_minutes).toFixed(2)),
          totalCheckedIn: Number(queueMetrics.total),
        },
        prasadOrders: {
          total: prasadTotal,
          completed: prasadCompleted,
          ready: prasadReady,
          expired: prasadExpired,
          completionRate: prasadTotal > 0
            ? Number(((prasadCompleted / prasadTotal) * 100).toFixed(2))
            : 0,
        },
        volunteerShifts: {
          total: shiftTotal,
          completed: shiftCompleted,
          missed: shiftMissed,
          completionRate: shiftTotal > 0
            ? Number(((shiftCompleted / shiftTotal) * 100).toFixed(2))
            : 0,
        },
        feedbackResolution: {
          total: feedbackTotal,
          resolved: feedbackResolved,
          open: feedbackOpen,
          inProgress: feedbackInProgress,
          resolutionRate: feedbackTotal > 0
            ? Number(((feedbackResolved / feedbackTotal) * 100).toFixed(2))
            : 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// POST /feedback - Submit feedback
// ---------------------------------------------------------------------------
export const submitFeedback = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { templeId, category, rating, comment } = req.body;

    if (!templeId) {
      throw new AppError('Temple ID is required', 400);
    }

    if (!category) {
      throw new AppError('Category is required', 400);
    }

    const validCategories = ['service', 'facility', 'ritual', 'staff', 'general'];
    if (!validCategories.includes(category)) {
      throw new AppError(
        `Invalid category. Must be one of: ${validCategories.join(', ')}`,
        400,
      );
    }

    if (rating == null || rating < 1 || rating > 5) {
      throw new AppError('Rating must be between 1 and 5', 400);
    }

    // Verify temple exists
    const temple = await prisma.temple.findUnique({ where: { id: templeId } });
    if (!temple) {
      throw new AppError('Temple not found', 404);
    }

    const feedback = await prisma.feedback.create({
      data: {
        userId,
        templeId,
        category,
        rating: Number(rating),
        comment: comment ?? null,
        status: 'open',
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully',
      data: feedback,
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// GET /feedback - List feedback for a temple with filters
// ---------------------------------------------------------------------------
export const getFeedback = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      templeId,
      category,
      status,
      minRating,
      maxRating,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    if (!templeId) {
      throw new AppError('Temple ID is required', 400);
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const { skip, take } = getPagination(pageNum, limitNum);

    const where: Record<string, unknown> = {
      templeId: templeId as string,
    };

    if (category) {
      where.category = category as string;
    }

    if (status) {
      where.status = status as string;
    }

    if (minRating || maxRating) {
      const ratingFilter: Record<string, number> = {};
      if (minRating) ratingFilter.gte = Number(minRating);
      if (maxRating) ratingFilter.lte = Number(maxRating);
      where.rating = ratingFilter;
    }

    const [feedbackList, total] = await Promise.all([
      prisma.feedback.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { [sortBy as string]: sortOrder as string },
        skip,
        take,
      }),
      prisma.feedback.count({ where }),
    ]);

    res.json({
      success: true,
      data: feedbackList,
      pagination: buildPaginationResponse(total, pageNum, limitNum),
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// PUT /feedback/:id/respond - Respond to feedback
// ---------------------------------------------------------------------------
export const respondToFeedback = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { response, status } = req.body;

    if (!response) {
      throw new AppError('Response text is required', 400);
    }

    const feedback = await prisma.feedback.findUnique({ where: { id } });

    if (!feedback) {
      throw new AppError('Feedback not found', 404);
    }

    const validStatuses = ['in_progress', 'resolved', 'closed'];
    const newStatus = status && validStatuses.includes(status) ? status : 'resolved';

    const updatedFeedback = await prisma.feedback.update({
      where: { id },
      data: {
        response,
        respondedAt: new Date(),
        status: newStatus,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    res.json({
      success: true,
      message: 'Feedback response recorded successfully',
      data: updatedFeedback,
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// GET /audit-log - List audit log entries (SUPER_ADMIN, TRUSTEE only)
// ---------------------------------------------------------------------------
export const getAuditLog = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      userId,
      action,
      entity,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const { skip, take } = getPagination(pageNum, limitNum);

    const where: Record<string, unknown> = {};

    if (userId) {
      where.userId = userId as string;
    }

    if (action) {
      where.action = action as string;
    }

    if (entity) {
      where.entity = entity as string;
    }

    if (startDate || endDate) {
      const createdAt: Record<string, Date> = {};
      if (startDate) createdAt.gte = new Date(startDate as string);
      if (endDate) createdAt.lte = new Date(endDate as string);
      where.createdAt = createdAt;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        },
        orderBy: { [sortBy as string]: sortOrder as string },
        skip,
        take,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: buildPaginationResponse(total, pageNum, limitNum),
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// POST /record-daily - Aggregate and store daily analytics for a temple
// ---------------------------------------------------------------------------
export const recordDailyAnalytics = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { templeId, date } = req.body;

    if (!templeId) {
      throw new AppError('Temple ID is required', 400);
    }

    // Verify temple exists
    const temple = await prisma.temple.findUnique({ where: { id: templeId } });
    if (!temple) {
      throw new AppError('Temple not found', 404);
    }

    // Default to yesterday if no date is provided (end-of-day job)
    const targetDate = date ? new Date(date) : new Date();
    if (!date) {
      targetDate.setDate(targetDate.getDate() - 1);
    }
    const dayStart = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
    );
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const templeIdStr = templeId as string;

    // ---------- Aggregate the day's data ----------

    const [
      visitorCount,
      bookingCount,
      donationAgg,
      prasadOrderCount,
      newVolunteers,
      feedbackAgg,
    ] = await Promise.all([
      // Visitors = checked-in bookings
      prisma.booking.count({
        where: {
          templeId: templeIdStr,
          checkedInAt: { gte: dayStart, lt: dayEnd },
        },
      }),

      // Total bookings created
      prisma.booking.count({
        where: {
          templeId: templeIdStr,
          createdAt: { gte: dayStart, lt: dayEnd },
        },
      }),

      // Donations
      prisma.donation.aggregate({
        where: {
          templeId: templeIdStr,
          paymentStatus: 'COMPLETED',
          createdAt: { gte: dayStart, lt: dayEnd },
        },
        _sum: { amount: true },
        _count: { id: true },
      }),

      // Prasad orders
      prisma.prasadOrder.count({
        where: {
          prasad: { templeId: templeIdStr },
          createdAt: { gte: dayStart, lt: dayEnd },
        },
      }),

      // New volunteers
      prisma.volunteerProfile.count({
        where: {
          createdAt: { gte: dayStart, lt: dayEnd },
        },
      }),

      // Feedback
      prisma.feedback.aggregate({
        where: {
          templeId: templeIdStr,
          createdAt: { gte: dayStart, lt: dayEnd },
        },
        _count: { id: true },
        _avg: { rating: true },
      }),
    ]);

    // Average queue time for the day
    const queueTimeResult = await prisma.$queryRawUnsafe<
      { avg_queue_minutes: number }[]
    >(
      `SELECT
         COALESCE(AVG(EXTRACT(EPOCH FROM ("checkedInAt" - "createdAt")) / 60), 0) AS avg_queue_minutes
       FROM "Booking"
       WHERE "templeId" = $1
         AND "checkedInAt" IS NOT NULL
         AND "checkedInAt" >= $2
         AND "checkedInAt" < $3`,
      templeIdStr,
      dayStart,
      dayEnd,
    );

    const avgQueueTime = queueTimeResult[0]
      ? Number(Number(queueTimeResult[0].avg_queue_minutes).toFixed(2))
      : null;

    // Peak hour (hour with most check-ins)
    const peakHourResult = await prisma.$queryRawUnsafe<
      { peak_hour: number; checkin_count: bigint }[]
    >(
      `SELECT
         EXTRACT(HOUR FROM "checkedInAt") AS peak_hour,
         COUNT(id) AS checkin_count
       FROM "Booking"
       WHERE "templeId" = $1
         AND "checkedInAt" IS NOT NULL
         AND "checkedInAt" >= $2
         AND "checkedInAt" < $3
       GROUP BY peak_hour
       ORDER BY checkin_count DESC
       LIMIT 1`,
      templeIdStr,
      dayStart,
      dayEnd,
    );

    const peakHour = peakHourResult.length > 0
      ? `${String(Number(peakHourResult[0].peak_hour)).padStart(2, '0')}:00`
      : null;

    // ---------- Upsert into DailyAnalytics ----------

    const dailyRecord = await prisma.dailyAnalytics.upsert({
      where: {
        templeId_date: {
          templeId: templeIdStr,
          date: dayStart,
        },
      },
      create: {
        templeId: templeIdStr,
        date: dayStart,
        totalVisitors: visitorCount,
        totalBookings: bookingCount,
        totalDonations: donationAgg._sum.amount ?? 0,
        donationCount: donationAgg._count.id,
        avgQueueTime: avgQueueTime,
        prasadOrderCount,
        newVolunteers,
        feedbackCount: feedbackAgg._count.id,
        avgRating: feedbackAgg._avg.rating ? Number(feedbackAgg._avg.rating.toFixed(2)) : null,
        peakHour,
      },
      update: {
        totalVisitors: visitorCount,
        totalBookings: bookingCount,
        totalDonations: donationAgg._sum.amount ?? 0,
        donationCount: donationAgg._count.id,
        avgQueueTime: avgQueueTime,
        prasadOrderCount,
        newVolunteers,
        feedbackCount: feedbackAgg._count.id,
        avgRating: feedbackAgg._avg.rating ? Number(feedbackAgg._avg.rating.toFixed(2)) : null,
        peakHour,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Daily analytics recorded successfully',
      data: dailyRecord,
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// GET /trends - Get DailyAnalytics time-series data for charting
// ---------------------------------------------------------------------------
export const getAnalyticsTrends = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { templeId, startDate, endDate } = req.query;

    if (!templeId) {
      throw new AppError('Temple ID is required', 400);
    }
    if (!startDate || !endDate) {
      throw new AppError('startDate and endDate are required', 400);
    }

    const templeIdStr = templeId as string;
    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    const records = await prisma.dailyAnalytics.findMany({
      where: {
        templeId: templeIdStr,
        date: { gte: start, lte: end },
      },
      orderBy: { date: 'asc' },
    });

    // Compute period-level summaries for convenience
    const totalVisitors = records.reduce((sum, r) => sum + r.totalVisitors, 0);
    const totalBookings = records.reduce((sum, r) => sum + r.totalBookings, 0);
    const totalDonations = records.reduce((sum, r) => sum + r.totalDonations, 0);
    const totalDonationCount = records.reduce((sum, r) => sum + r.donationCount, 0);
    const totalFeedback = records.reduce((sum, r) => sum + r.feedbackCount, 0);

    const ratedRecords = records.filter((r) => r.avgRating !== null);
    const avgRating = ratedRecords.length > 0
      ? Number(
          (ratedRecords.reduce((sum, r) => sum + (r.avgRating ?? 0), 0) / ratedRecords.length).toFixed(2),
        )
      : null;

    const queueRecords = records.filter((r) => r.avgQueueTime !== null);
    const avgQueueTime = queueRecords.length > 0
      ? Number(
          (queueRecords.reduce((sum, r) => sum + (r.avgQueueTime ?? 0), 0) / queueRecords.length).toFixed(2),
        )
      : null;

    res.json({
      success: true,
      data: {
        summary: {
          totalVisitors,
          totalBookings,
          totalDonations,
          totalDonationCount,
          totalFeedback,
          avgRating,
          avgQueueTime,
          daysInRange: records.length,
        },
        timeSeries: records.map((r) => ({
          date: r.date,
          visitors: r.totalVisitors,
          bookings: r.totalBookings,
          donations: r.totalDonations,
          donationCount: r.donationCount,
          avgQueueTime: r.avgQueueTime,
          prasadOrders: r.prasadOrderCount,
          newVolunteers: r.newVolunteers,
          feedbackCount: r.feedbackCount,
          avgRating: r.avgRating,
          peakHour: r.peakHour,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};
