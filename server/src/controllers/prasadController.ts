import { Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AuthRequest, ApiResponse } from '../types';
import { AppError } from '../middleware/errorHandler';
import { generateTokenCode, getPagination, buildPaginationResponse } from '../utils/helpers';

// Token color mapping based on prasad name keywords
const TOKEN_COLORS: Record<string, string> = {
  laddu: '#FFD700',
  laddoo: '#FFD700',
  prasadam: '#FF8C00',
  sweet: '#FF69B4',
  fruit: '#32CD32',
  flower: '#FF1493',
  milk: '#FFFFF0',
  rice: '#FFFACD',
  panchamrit: '#DEB887',
  kheer: '#FAEBD7',
  halwa: '#D2691E',
  pongal: '#F0E68C',
  puliyogare: '#CD853F',
  curd: '#FFFDD0',
  default: '#4169E1',
};

function resolveTokenColor(prasadName: string): string {
  const lower = prasadName.toLowerCase();
  for (const [keyword, color] of Object.entries(TOKEN_COLORS)) {
    if (keyword !== 'default' && lower.includes(keyword)) {
      return color;
    }
  }
  return TOKEN_COLORS.default;
}

// ---------------------------------------------------------------------------
// createPrasadItem - Create a new prasad item for a temple
// ---------------------------------------------------------------------------
export const createPrasadItem = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      templeId,
      name,
      description,
      price,
      imageUrl,
      nutritionalInfo,
      allergens,
      preparationTime,
      isVegetarian,
      isSugarFree,
      maxPerDevotee,
      sortOrder,
    } = req.body;

    if (!templeId || !name) {
      throw new AppError('templeId and name are required', 400);
    }

    // Verify the temple exists
    const temple = await prisma.temple.findUnique({ where: { id: templeId } });
    if (!temple) {
      throw new AppError('Temple not found', 404);
    }

    const prasadItem = await prisma.prasadItem.create({
      data: {
        templeId,
        name,
        description: description ?? null,
        price: price != null ? Number(price) : 0,
        imageUrl: imageUrl ?? null,
        nutritionalInfo: nutritionalInfo ?? null,
        allergens: allergens ?? null,
        preparationTime: preparationTime != null ? Number(preparationTime) : null,
        isVegetarian: isVegetarian ?? true,
        isSugarFree: isSugarFree ?? false,
        maxPerDevotee: maxPerDevotee != null ? Number(maxPerDevotee) : 5,
        sortOrder: sortOrder != null ? Number(sortOrder) : 0,
      },
    });

    res.status(201).json({
      success: true,
      data: prasadItem,
      message: 'Prasad item created successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// getPrasadItems - List prasad items for a temple with filters and pagination
// ---------------------------------------------------------------------------
export const getPrasadItems = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      templeId,
      isAvailable,
      isVegetarian,
      isSugarFree,
      page = '1',
      limit = '20',
      sortBy = 'sortOrder',
      sortOrder = 'asc',
    } = req.query;

    if (!templeId) {
      throw new AppError('templeId is a required query parameter', 400);
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const { skip, take } = getPagination(pageNum, limitNum);

    const where: Record<string, unknown> = {
      templeId: templeId as string,
    };

    if (isAvailable !== undefined) {
      where.isAvailable = isAvailable === 'true';
    }

    if (isVegetarian !== undefined) {
      where.isVegetarian = isVegetarian === 'true';
    }

    if (isSugarFree !== undefined) {
      where.isSugarFree = isSugarFree === 'true';
    }

    const [items, total] = await Promise.all([
      prisma.prasadItem.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy as string]: sortOrder as string },
      }),
      prisma.prasadItem.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: items,
      message: 'Prasad items retrieved successfully',
      pagination: buildPaginationResponse(total, pageNum, limitNum),
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// updatePrasadItem - Update fields of an existing prasad item
// ---------------------------------------------------------------------------
export const updatePrasadItem = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      price,
      imageUrl,
      nutritionalInfo,
      allergens,
      preparationTime,
      isVegetarian,
      isSugarFree,
      isAvailable,
      maxPerDevotee,
      sortOrder,
    } = req.body;

    const existing = await prisma.prasadItem.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Prasad item not found', 404);
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = Number(price);
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (nutritionalInfo !== undefined) updateData.nutritionalInfo = nutritionalInfo;
    if (allergens !== undefined) updateData.allergens = allergens;
    if (preparationTime !== undefined) updateData.preparationTime = Number(preparationTime);
    if (isVegetarian !== undefined) updateData.isVegetarian = isVegetarian;
    if (isSugarFree !== undefined) updateData.isSugarFree = isSugarFree;
    if (isAvailable !== undefined) updateData.isAvailable = isAvailable;
    if (maxPerDevotee !== undefined) updateData.maxPerDevotee = Number(maxPerDevotee);
    if (sortOrder !== undefined) updateData.sortOrder = Number(sortOrder);

    const updatedItem = await prisma.prasadItem.update({
      where: { id },
      data: updateData,
    });

    res.status(200).json({
      success: true,
      data: updatedItem,
      message: 'Prasad item updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// createPrasadOrder - Create a prasad order with token generation and payment
// ---------------------------------------------------------------------------
export const createPrasadOrder = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { prasadId, quantity, bookingId, paymentMethod } = req.body;

    if (!prasadId || quantity == null) {
      throw new AppError('prasadId and quantity are required', 400);
    }

    const qty = Number(quantity);
    if (qty <= 0) {
      throw new AppError('Quantity must be greater than zero', 400);
    }

    // Verify the prasad item exists and is available
    const prasadItem = await prisma.prasadItem.findUnique({ where: { id: prasadId } });
    if (!prasadItem) {
      throw new AppError('Prasad item not found', 404);
    }

    if (!prasadItem.isAvailable) {
      throw new AppError('This prasad item is currently unavailable', 400);
    }

    // Validate quantity against maxPerDevotee
    if (qty > prasadItem.maxPerDevotee) {
      throw new AppError(
        `Quantity exceeds maximum allowed per devotee (${prasadItem.maxPerDevotee})`,
        400
      );
    }

    // If bookingId is provided, verify the booking exists
    if (bookingId) {
      const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
      if (!booking) {
        throw new AppError('Booking not found', 404);
      }
    }

    // Calculate total price
    const totalPrice = prasadItem.price * qty;

    // Generate unique token code and resolve token color
    const tokenCode = generateTokenCode();
    const tokenColor = resolveTokenColor(prasadItem.name);

    // Set validUntil to 4 hours from now
    const validUntil = new Date();
    validUntil.setHours(validUntil.getHours() + 4);

    // Create order and associated payment in a transaction
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.prasadOrder.create({
        data: {
          prasadId,
          bookingId: bookingId ?? null,
          quantity: qty,
          totalPrice,
          tokenCode,
          tokenColor,
          status: 'ordered',
          validUntil,
        },
        include: {
          prasad: true,
          booking: true,
        },
      });

      // Create associated Payment record
      await tx.payment.create({
        data: {
          prasadOrderId: newOrder.id,
          amount: totalPrice,
          currency: 'INR',
          method: paymentMethod ?? 'CASH',
          status: 'PENDING',
        },
      });

      // Return the order with payment relation populated
      return tx.prasadOrder.findUnique({
        where: { id: newOrder.id },
        include: {
          prasad: true,
          booking: true,
          payment: true,
        },
      });
    });

    res.status(201).json({
      success: true,
      data: order,
      message: 'Prasad order created successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// getPrasadOrders - List prasad orders with filters and pagination
// ---------------------------------------------------------------------------
export const getPrasadOrders = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      status,
      startDate,
      endDate,
      prasadId,
      bookingId,
      page = '1',
      limit = '20',
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const { skip, take } = getPagination(pageNum, limitNum);

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status as string;
    }

    if (prasadId) {
      where.prasadId = prasadId as string;
    }

    if (bookingId) {
      where.bookingId = bookingId as string;
    }

    if (startDate || endDate) {
      const createdAt: Record<string, Date> = {};
      if (startDate) createdAt.gte = new Date(startDate as string);
      if (endDate) createdAt.lte = new Date(endDate as string);
      where.createdAt = createdAt;
    }

    const [orders, total] = await Promise.all([
      prisma.prasadOrder.findMany({
        where,
        include: {
          prasad: true,
          booking: true,
          payment: true,
        },
        skip,
        take,
        orderBy: { [sortBy as string]: sortOrder as string },
      }),
      prisma.prasadOrder.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: orders,
      message: 'Prasad orders retrieved successfully',
      pagination: buildPaginationResponse(total, pageNum, limitNum),
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// updateOrderStatus - Update the status of a prasad order
// ---------------------------------------------------------------------------
export const updateOrderStatus = async (
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

    const validStatuses = ['preparing', 'ready', 'picked_up', 'expired'];
    if (!validStatuses.includes(status)) {
      throw new AppError(
        `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        400
      );
    }

    const order = await prisma.prasadOrder.findUnique({ where: { id } });
    if (!order) {
      throw new AppError('Prasad order not found', 404);
    }

    // Prevent updating an already picked-up or expired order
    if (order.status === 'picked_up' || order.status === 'expired') {
      throw new AppError(
        `Cannot update an order that is already ${order.status}`,
        400
      );
    }

    const updateData: Record<string, unknown> = { status };

    // If marking as picked_up, record the timestamp
    if (status === 'picked_up') {
      updateData.pickedUpAt = new Date();
    }

    const updatedOrder = await prisma.prasadOrder.update({
      where: { id },
      data: updateData,
      include: {
        prasad: true,
        booking: true,
        payment: true,
      },
    });

    res.status(200).json({
      success: true,
      data: updatedOrder,
      message: `Prasad order status updated to ${status}`,
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// pickupOrder - Mark a prasad order as picked up after validating the token
// ---------------------------------------------------------------------------
export const pickupOrder = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { tokenCode } = req.body;

    if (!tokenCode) {
      throw new AppError('tokenCode is required', 400);
    }

    const order = await prisma.prasadOrder.findUnique({
      where: { id },
      include: { prasad: true },
    });

    if (!order) {
      throw new AppError('Prasad order not found', 404);
    }

    // Validate token code matches
    if (order.tokenCode !== tokenCode) {
      throw new AppError('Token code does not match this order', 400);
    }

    // Check if the order is already picked up
    if (order.status === 'picked_up') {
      throw new AppError('This order has already been picked up', 400);
    }

    // Check if the order has expired
    if (order.status === 'expired' || new Date() > order.validUntil) {
      throw new AppError('This order has expired and can no longer be picked up', 400);
    }

    const pickedUpOrder = await prisma.prasadOrder.update({
      where: { id },
      data: {
        status: 'picked_up',
        pickedUpAt: new Date(),
      },
      include: {
        prasad: true,
        booking: true,
        payment: true,
      },
    });

    res.status(200).json({
      success: true,
      data: pickedUpOrder,
      message: 'Prasad order picked up successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// addInventoryItem - Add an inventory entry for a prasad item
// ---------------------------------------------------------------------------
export const addInventoryItem = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      prasadId,
      ingredient,
      quantity,
      unit,
      minLevel,
      expiryDate,
      supplier,
    } = req.body;

    if (!prasadId || !ingredient || quantity == null || !unit) {
      throw new AppError('prasadId, ingredient, quantity, and unit are required', 400);
    }

    // Verify the prasad item exists
    const prasadItem = await prisma.prasadItem.findUnique({ where: { id: prasadId } });
    if (!prasadItem) {
      throw new AppError('Prasad item not found', 404);
    }

    const inventoryItem = await prisma.prasadInventory.create({
      data: {
        prasadId,
        ingredient,
        quantity: Number(quantity),
        unit,
        minLevel: minLevel != null ? Number(minLevel) : 0,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        supplier: supplier ?? null,
      },
      include: {
        prasad: true,
      },
    });

    res.status(201).json({
      success: true,
      data: inventoryItem,
      message: 'Inventory item added successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// getInventory - Get inventory for a prasad item with low-stock / expiry flags
// ---------------------------------------------------------------------------
export const getInventory = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { prasadId } = req.params;

    // Verify the prasad item exists
    const prasadItem = await prisma.prasadItem.findUnique({ where: { id: prasadId } });
    if (!prasadItem) {
      throw new AppError('Prasad item not found', 404);
    }

    const inventory = await prisma.prasadInventory.findMany({
      where: { prasadId },
      include: { prasad: true },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();

    // Annotate each item with low-stock and expired flags
    const annotatedInventory = inventory.map((item) => ({
      ...item,
      isLowStock: item.quantity < item.minLevel,
      isExpired: item.expiryDate ? item.expiryDate < now : false,
    }));

    res.status(200).json({
      success: true,
      data: annotatedInventory,
      message: 'Inventory retrieved successfully',
    });
  } catch (error) {
    next(error);
  }
};
