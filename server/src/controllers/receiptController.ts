import { Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AuthRequest, ApiResponse } from '../types';
import { AppError } from '../middleware/errorHandler';
import {
  generateReceiptNumber,
  generateCertificateNumber,
  generateQRCode,
  getFinancialYear,
  getPagination,
  buildPaginationResponse,
} from '../utils/helpers';

// ---------------------------------------------------------------------------
// POST /generate - Generate a receipt for a donation
// ---------------------------------------------------------------------------
export const generateReceipt = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { donationId } = req.body;

    if (!donationId) {
      throw new AppError('Donation ID is required', 400);
    }

    // Fetch the donation with its temple details
    const donation = await prisma.donation.findUnique({
      where: { id: donationId },
      include: {
        temple: { select: { id: true, name: true, address: true, city: true, state: true, pincode: true } },
        receipt: true,
      },
    });

    if (!donation) {
      throw new AppError('Donation not found', 404);
    }

    if (donation.receipt) {
      throw new AppError('Receipt has already been generated for this donation', 409);
    }

    const receiptNumber = generateReceiptNumber();

    // Build donor address from available information
    const donorAddress = donation.donorEmail
      ? donation.donorEmail
      : donation.donorPhone ?? null;

    // Build QR code payload for verification
    const qrPayload = JSON.stringify({
      receiptNumber,
      donationId: donation.id,
      donationNumber: donation.donationNumber,
      amount: donation.amount,
      currency: donation.currency,
      issuedAt: new Date().toISOString(),
    });

    const qrCode = await generateQRCode(qrPayload);

    const receipt = await prisma.$transaction(async (tx) => {
      // Create the receipt record
      const newReceipt = await tx.receipt.create({
        data: {
          receiptNumber,
          donationId: donation.id,
          amount: donation.amount,
          donorName: donation.donorName ?? 'Anonymous',
          donorAddress: donorAddress,
          templeName: donation.temple.name,
          purpose: donation.purpose ?? donation.category,
          paymentMode: donation.paymentMethod,
          qrCode,
        },
      });

      // Mark the donation as receipt generated
      await tx.donation.update({
        where: { id: donation.id },
        data: { receiptGenerated: true },
      });

      return newReceipt;
    });

    res.status(201).json({
      success: true,
      message: 'Receipt generated successfully',
      data: receipt,
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// GET /:id - Get receipt by ID with donation details
// ---------------------------------------------------------------------------
export const getReceipt = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const receipt = await prisma.receipt.findUnique({
      where: { id },
      include: {
        donation: {
          include: {
            temple: { select: { id: true, name: true, city: true, state: true } },
          },
        },
      },
    });

    if (!receipt) {
      throw new AppError('Receipt not found', 404);
    }

    res.json({
      success: true,
      data: receipt,
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// GET /donation/:donationId - Get receipt by donation ID
// ---------------------------------------------------------------------------
export const getReceiptByDonation = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { donationId } = req.params;

    const receipt = await prisma.receipt.findUnique({
      where: { donationId },
      include: {
        donation: {
          include: {
            temple: { select: { id: true, name: true, city: true, state: true } },
          },
        },
      },
    });

    if (!receipt) {
      throw new AppError('Receipt not found for this donation', 404);
    }

    res.json({
      success: true,
      data: receipt,
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// PUT /:id/send - Mark receipt as sent via email and/or SMS
// ---------------------------------------------------------------------------
export const sendReceipt = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { email, sms } = req.body;

    if (!email && !sms) {
      throw new AppError('At least one delivery method (email or sms) must be specified', 400);
    }

    const receipt = await prisma.receipt.findUnique({ where: { id } });

    if (!receipt) {
      throw new AppError('Receipt not found', 404);
    }

    const updateData: Record<string, boolean> = {};
    if (email) updateData.emailSent = true;
    if (sms) updateData.smsSent = true;

    const updatedReceipt = await prisma.receipt.update({
      where: { id },
      data: updateData,
    });

    const methods: string[] = [];
    if (email) methods.push('email');
    if (sms) methods.push('SMS');

    res.json({
      success: true,
      message: `Receipt marked as sent via ${methods.join(' and ')}`,
      data: updatedReceipt,
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// POST /tax-certificate - Generate 80G tax certificate for an eligible donation
// ---------------------------------------------------------------------------
export const generateTaxCertificate = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { donationId, templeRegistration, temple80GNumber } = req.body;

    if (!donationId) {
      throw new AppError('Donation ID is required', 400);
    }

    if (!templeRegistration) {
      throw new AppError('Temple registration number is required', 400);
    }

    if (!temple80GNumber) {
      throw new AppError('Temple 80G number is required', 400);
    }

    // Fetch the donation
    const donation = await prisma.donation.findUnique({
      where: { id: donationId },
      include: {
        temple: { select: { id: true, name: true } },
        taxCertificate: true,
      },
    });

    if (!donation) {
      throw new AppError('Donation not found', 404);
    }

    // Validate donation eligibility
    if (!donation.donorPan) {
      throw new AppError('Donor PAN is required for 80G certificate generation', 400);
    }

    if (donation.paymentStatus !== 'COMPLETED') {
      throw new AppError('Tax certificate can only be generated for completed donations', 400);
    }

    if (!donation.is80GEligible) {
      throw new AppError('This donation is not eligible for 80G certificate', 400);
    }

    if (donation.taxCertificate) {
      throw new AppError('Tax certificate has already been generated for this donation', 409);
    }

    const certificateNumber = generateCertificateNumber();
    const financialYear = getFinancialYear(donation.createdAt);

    const certificate = await prisma.taxCertificate.create({
      data: {
        certificateNumber,
        donationId: donation.id,
        donorName: donation.donorName ?? 'Unknown',
        donorPan: donation.donorPan,
        amount: donation.amount,
        financialYear,
        templeRegistration,
        temple80GNumber,
      },
    });

    res.status(201).json({
      success: true,
      message: '80G tax certificate generated successfully',
      data: certificate,
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// GET /tax-certificates - List tax certificates with filters and pagination
// ---------------------------------------------------------------------------
export const getTaxCertificates = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      financialYear,
      donorPan,
      page = 1,
      limit = 20,
      sortBy = 'issuedAt',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const { skip, take } = getPagination(pageNum, limitNum);

    // Build dynamic where clause
    const where: Record<string, unknown> = {};

    if (financialYear) {
      where.financialYear = financialYear as string;
    }

    if (donorPan) {
      where.donorPan = donorPan as string;
    }

    const [certificates, total] = await Promise.all([
      prisma.taxCertificate.findMany({
        where,
        include: {
          donation: {
            select: {
              id: true,
              donationNumber: true,
              amount: true,
              category: true,
              createdAt: true,
              temple: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { [sortBy as string]: sortOrder as string },
        skip,
        take,
      }),
      prisma.taxCertificate.count({ where }),
    ]);

    res.json({
      success: true,
      data: certificates,
      pagination: buildPaginationResponse(total, pageNum, limitNum),
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// POST /tax-certificates/bulk - Bulk generate certificates for eligible
//   donations in a given financial year that do not yet have a certificate
// ---------------------------------------------------------------------------
export const getBulkCertificates = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { financialYear, templeRegistration, temple80GNumber } = req.body;

    if (!financialYear) {
      throw new AppError('Financial year is required', 400);
    }

    if (!templeRegistration) {
      throw new AppError('Temple registration number is required', 400);
    }

    if (!temple80GNumber) {
      throw new AppError('Temple 80G number is required', 400);
    }

    // Derive the date range from the financial year string (e.g., "2025-26")
    const fyParts = financialYear.split('-');
    const startYear = parseInt(fyParts[0], 10);
    const fyStart = new Date(startYear, 3, 1); // April 1st
    const fyEnd = new Date(startYear + 1, 2, 31, 23, 59, 59, 999); // March 31st

    // Find all eligible donations in the financial year without a certificate
    const eligibleDonations = await prisma.donation.findMany({
      where: {
        is80GEligible: true,
        paymentStatus: 'COMPLETED',
        donorPan: { not: null },
        taxCertificate: null,
        createdAt: {
          gte: fyStart,
          lte: fyEnd,
        },
      },
      include: {
        temple: { select: { id: true, name: true } },
      },
    });

    if (eligibleDonations.length === 0) {
      res.json({
        success: true,
        message: 'No eligible donations found for certificate generation',
        data: { generated: 0, certificates: [] },
      });
      return;
    }

    // Generate certificates in a transaction
    const certificates = await prisma.$transaction(async (tx) => {
      const created = [];

      for (const donation of eligibleDonations) {
        const certificateNumber = generateCertificateNumber();

        const certificate = await tx.taxCertificate.create({
          data: {
            certificateNumber,
            donationId: donation.id,
            donorName: donation.donorName ?? 'Unknown',
            donorPan: donation.donorPan!,
            amount: donation.amount,
            financialYear,
            templeRegistration,
            temple80GNumber,
          },
        });

        created.push(certificate);
      }

      return created;
    });

    res.status(201).json({
      success: true,
      message: `Successfully generated ${certificates.length} tax certificate(s)`,
      data: { generated: certificates.length, certificates },
    });
  } catch (error) {
    next(error);
  }
};
