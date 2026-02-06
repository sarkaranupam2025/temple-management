import { Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AuthRequest, ApiResponse } from '../types';
import { AppError } from '../middleware/errorHandler';
import { generateDonationNumber, getPagination, buildPaginationResponse } from '../utils/helpers';

// ---------------------------------------------------------------------------
// POST / - Create a new donation with an associated Payment record
// ---------------------------------------------------------------------------
export const createDonation = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      amount,
      category,
      purpose,
      paymentMethod,
      templeId,
      donorName,
      donorPhone,
      donorEmail,
      donorPan,
      isAnonymous,
      currency,
      notes,
    } = req.body;

    if (!amount || amount <= 0) {
      throw new AppError('Donation amount must be greater than zero', 400);
    }

    if (!templeId) {
      throw new AppError('Temple ID is required', 400);
    }

    if (!paymentMethod) {
      throw new AppError('Payment method is required', 400);
    }

    // Verify temple exists
    const temple = await prisma.temple.findUnique({ where: { id: templeId } });
    if (!temple) {
      throw new AppError('Temple not found', 404);
    }

    const donationNumber = generateDonationNumber();

    // Determine 80G eligibility – requires a valid PAN and a non-anonymous donation
    const is80GEligible = Boolean(donorPan) && !isAnonymous;

    const donation = await prisma.$transaction(async (tx) => {
      // Create the donation record
      const newDonation = await tx.donation.create({
        data: {
          donationNumber,
          userId: req.user?.userId ?? null,
          templeId,
          amount,
          currency: currency ?? 'INR',
          category: category ?? 'GENERAL_FUND',
          purpose: purpose ?? null,
          isAnonymous: isAnonymous ?? false,
          donorName: donorName ?? null,
          donorPhone: donorPhone ?? null,
          donorEmail: donorEmail ?? null,
          donorPan: donorPan ?? null,
          paymentMethod,
          paymentStatus: 'PENDING',
          is80GEligible,
          notes: notes ?? null,
        },
      });

      // Create the associated payment record
      await tx.payment.create({
        data: {
          donationId: newDonation.id,
          amount: newDonation.amount,
          currency: newDonation.currency,
          method: paymentMethod,
          status: 'PENDING',
        },
      });

      // Return the donation with its payment relation populated
      return tx.donation.findUnique({
        where: { id: newDonation.id },
        include: { payment: true, receipt: true },
      });
    });

    res.status(201).json({
      success: true,
      message: 'Donation created successfully',
      data: donation,
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// GET / - List donations with filters and pagination
// ---------------------------------------------------------------------------
export const getDonations = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      templeId,
      category,
      startDate,
      endDate,
      paymentStatus,
      minAmount,
      maxAmount,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const { skip, take } = getPagination(pageNum, limitNum);

    // Build dynamic where clause
    const where: Record<string, unknown> = {};

    if (templeId) {
      where.templeId = templeId as string;
    }

    if (category) {
      where.category = category as string;
    }

    if (paymentStatus) {
      where.paymentStatus = paymentStatus as string;
    }

    if (startDate || endDate) {
      const createdAt: Record<string, Date> = {};
      if (startDate) createdAt.gte = new Date(startDate as string);
      if (endDate) createdAt.lte = new Date(endDate as string);
      where.createdAt = createdAt;
    }

    if (minAmount || maxAmount) {
      const amount: Record<string, number> = {};
      if (minAmount) amount.gte = Number(minAmount);
      if (maxAmount) amount.lte = Number(maxAmount);
      where.amount = amount;
    }

    const [donations, total] = await Promise.all([
      prisma.donation.findMany({
        where,
        include: {
          temple: { select: { id: true, name: true } },
          payment: true,
          receipt: true,
        },
        orderBy: { [sortBy as string]: sortOrder as string },
        skip,
        take,
      }),
      prisma.donation.count({ where }),
    ]);

    res.json({
      success: true,
      data: donations,
      pagination: buildPaginationResponse(total, pageNum, limitNum),
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// GET /:id - Get a single donation with receipt and payment details
// ---------------------------------------------------------------------------
export const getDonationById = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const donation = await prisma.donation.findUnique({
      where: { id },
      include: {
        temple: { select: { id: true, name: true, city: true, state: true } },
        payment: true,
        receipt: true,
        taxCertificate: true,
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (!donation) {
      throw new AppError('Donation not found', 404);
    }

    res.json({
      success: true,
      data: donation,
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// PUT /:id/payment-status - Update payment status and sync donation record
// ---------------------------------------------------------------------------
export const updatePaymentStatus = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, gatewayRef, gatewayResponse } = req.body;

    const validStatuses = ['COMPLETED', 'FAILED', 'REFUNDED'];
    if (!status || !validStatuses.includes(status)) {
      throw new AppError(
        `Invalid payment status. Must be one of: ${validStatuses.join(', ')}`,
        400,
      );
    }

    // Ensure the donation exists
    const donation = await prisma.donation.findUnique({
      where: { id },
      include: { payment: true },
    });

    if (!donation) {
      throw new AppError('Donation not found', 404);
    }

    if (!donation.payment) {
      throw new AppError('No payment record associated with this donation', 404);
    }

    const updatedDonation = await prisma.$transaction(async (tx) => {
      // Update the payment record
      await tx.payment.update({
        where: { id: donation.payment!.id },
        data: {
          status,
          gatewayRef: gatewayRef ?? donation.payment!.gatewayRef,
          gatewayResponse: gatewayResponse ?? donation.payment!.gatewayResponse,
          processedAt: status === 'COMPLETED' ? new Date() : donation.payment!.processedAt,
        },
      });

      // Sync the donation's payment status
      await tx.donation.update({
        where: { id },
        data: {
          paymentStatus: status,
          transactionId: gatewayRef ?? donation.transactionId,
        },
      });

      // If payment is completed, update the fund allocation received amount
      if (status === 'COMPLETED') {
        const now = new Date();
        const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        await tx.fundAllocation.upsert({
          where: {
            templeId_category_period: {
              templeId: donation.templeId,
              category: donation.category,
              period,
            },
          },
          create: {
            templeId: donation.templeId,
            category: donation.category,
            period,
            received: donation.amount,
          },
          update: {
            received: { increment: donation.amount },
          },
        });
      }

      return tx.donation.findUnique({
        where: { id },
        include: { payment: true, receipt: true },
      });
    });

    res.json({
      success: true,
      message: `Payment status updated to ${status}`,
      data: updatedDonation,
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// GET /stats - Aggregated donation statistics for a temple
// ---------------------------------------------------------------------------
export const getDonationStats = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { templeId, startDate, endDate, groupBy = 'day' } = req.query;

    if (!templeId) {
      throw new AppError('Temple ID is required', 400);
    }

    const templeIdStr = templeId as string;

    // Base date filter for completed donations
    const dateFilter: Record<string, unknown> = {
      templeId: templeIdStr,
      paymentStatus: 'COMPLETED',
    };

    if (startDate || endDate) {
      const createdAt: Record<string, Date> = {};
      if (startDate) createdAt.gte = new Date(startDate as string);
      if (endDate) createdAt.lte = new Date(endDate as string);
      dateFilter.createdAt = createdAt;
    }

    // Total amount & count
    const totals = await prisma.donation.aggregate({
      where: dateFilter,
      _sum: { amount: true },
      _count: { id: true },
      _avg: { amount: true },
      _max: { amount: true },
      _min: { amount: true },
    });

    // Breakdown by category
    const byCategory = await prisma.donation.groupBy({
      by: ['category'],
      where: dateFilter,
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: 'desc' } },
    });

    // Breakdown by payment method
    const byPaymentMethod = await prisma.donation.groupBy({
      by: ['paymentMethod'],
      where: dateFilter,
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: 'desc' } },
    });

    // Trends: daily / weekly / monthly
    // Prisma does not natively support date-truncation groupBy, so we use raw SQL
    let trendInterval: string;
    switch (groupBy) {
      case 'week':
        trendInterval = 'week';
        break;
      case 'month':
        trendInterval = 'month';
        break;
      default:
        trendInterval = 'day';
    }

    const trendParams: (string | Date)[] = [templeIdStr];
    let trendDateClause = '';

    if (startDate) {
      trendParams.push(new Date(startDate as string));
      trendDateClause += ` AND "createdAt" >= $${trendParams.length}`;
    }
    if (endDate) {
      trendParams.push(new Date(endDate as string));
      trendDateClause += ` AND "createdAt" <= $${trendParams.length}`;
    }

    const trends = await prisma.$queryRawUnsafe<
      { period: string; total_amount: number; donation_count: bigint }[]
    >(
      `SELECT
         date_trunc('${trendInterval}', "createdAt") AS period,
         SUM(amount) AS total_amount,
         COUNT(id) AS donation_count
       FROM "Donation"
       WHERE "templeId" = $1
         AND "paymentStatus" = 'COMPLETED'
         ${trendDateClause}
       GROUP BY period
       ORDER BY period ASC`,
      ...trendParams,
    );

    // Serialise BigInt values from raw query
    const serialisedTrends = trends.map((t) => ({
      period: t.period,
      totalAmount: Number(t.total_amount),
      donationCount: Number(t.donation_count),
    }));

    res.json({
      success: true,
      data: {
        summary: {
          totalAmount: totals._sum.amount ?? 0,
          totalCount: totals._count.id,
          averageAmount: totals._avg.amount ?? 0,
          maxAmount: totals._max.amount ?? 0,
          minAmount: totals._min.amount ?? 0,
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
// GET /fund-allocations - Get fund allocation breakdown for a temple
// ---------------------------------------------------------------------------
export const getFundAllocations = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { templeId, period, page = 1, limit = 20 } = req.query;

    if (!templeId) {
      throw new AppError('Temple ID is required', 400);
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const { skip, take } = getPagination(pageNum, limitNum);

    const where: Record<string, unknown> = { templeId: templeId as string };

    if (period) {
      where.period = period as string;
    }

    const [allocations, total] = await Promise.all([
      prisma.fundAllocation.findMany({
        where,
        orderBy: [{ period: 'desc' }, { category: 'asc' }],
        skip,
        take,
      }),
      prisma.fundAllocation.count({ where }),
    ]);

    res.json({
      success: true,
      data: allocations,
      pagination: buildPaginationResponse(total, pageNum, limitNum),
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// PUT /fund-allocations - Update budgeted / spent amounts for a category
// ---------------------------------------------------------------------------
export const updateFundAllocation = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { templeId, category, period, budgeted, spent, description } = req.body;

    if (!templeId || !category || !period) {
      throw new AppError('templeId, category and period are required', 400);
    }

    // Verify temple exists
    const temple = await prisma.temple.findUnique({ where: { id: templeId } });
    if (!temple) {
      throw new AppError('Temple not found', 404);
    }

    const updateData: Record<string, unknown> = {};
    if (budgeted !== undefined) updateData.budgeted = Number(budgeted);
    if (spent !== undefined) updateData.spent = Number(spent);
    if (description !== undefined) updateData.description = description;

    const allocation = await prisma.fundAllocation.upsert({
      where: {
        templeId_category_period: {
          templeId,
          category,
          period,
        },
      },
      create: {
        templeId,
        category,
        period,
        budgeted: budgeted !== undefined ? Number(budgeted) : 0,
        spent: spent !== undefined ? Number(spent) : 0,
        received: 0,
        description: description ?? null,
      },
      update: updateData,
    });

    res.json({
      success: true,
      message: 'Fund allocation updated successfully',
      data: allocation,
    });
  } catch (error) {
    next(error);
  }
};
