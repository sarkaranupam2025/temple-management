import { Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AuthRequest, ApiResponse } from '../types';
import { AppError } from '../middleware/errorHandler';
import { getPagination, buildPaginationResponse } from '../utils/helpers';

// ---------------------------------------------------------------------------
// POST /notifications - Send a notification to a user
// ---------------------------------------------------------------------------
export const sendNotification = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId, type, channel, title, message, data } = req.body;

    if (!userId) {
      throw new AppError('User ID is required', 400);
    }

    if (!type) {
      throw new AppError('Notification type is required', 400);
    }

    const validTypes = ['TRANSACTIONAL', 'PROMOTIONAL', 'OPERATIONAL', 'PERSONALIZED', 'EMERGENCY'];
    if (!validTypes.includes(type)) {
      throw new AppError(
        `Invalid notification type. Must be one of: ${validTypes.join(', ')}`,
        400,
      );
    }

    if (!channel) {
      throw new AppError('Notification channel is required', 400);
    }

    const validChannels = ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'IN_APP'];
    if (!validChannels.includes(channel)) {
      throw new AppError(
        `Invalid notification channel. Must be one of: ${validChannels.join(', ')}`,
        400,
      );
    }

    if (!title || !message) {
      throw new AppError('Title and message are required', 400);
    }

    // Verify the target user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('Target user not found', 404);
    }

    // Validate optional JSON data
    if (data) {
      try {
        if (typeof data === 'string') {
          JSON.parse(data);
        }
      } catch {
        throw new AppError('Invalid JSON in data field', 400);
      }
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        channel,
        title,
        message,
        data: data ? (typeof data === 'string' ? data : JSON.stringify(data)) : null,
        sentAt: new Date(),
      },
    });

    res.status(201).json({
      success: true,
      message: 'Notification sent successfully',
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// GET /notifications - List notifications for the authenticated user
// ---------------------------------------------------------------------------
export const getNotifications = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      type,
      isRead,
      page = 1,
      limit = 20,
    } = req.query;

    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const { skip, take } = getPagination(pageNum, limitNum);

    const where: Record<string, unknown> = { userId };

    if (type) {
      where.type = type as string;
    }

    if (isRead !== undefined) {
      where.isRead = isRead === 'true';
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.notification.count({ where }),
    ]);

    res.json({
      success: true,
      data: notifications,
      pagination: buildPaginationResponse(total, pageNum, limitNum),
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// PUT /notifications/:id/read - Mark a single notification as read
// ---------------------------------------------------------------------------
export const markAsRead = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const notification = await prisma.notification.findUnique({ where: { id } });

    if (!notification) {
      throw new AppError('Notification not found', 404);
    }

    if (notification.userId !== userId) {
      throw new AppError('You can only mark your own notifications as read', 403);
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// PUT /notifications/read-all - Mark all unread notifications as read
// ---------------------------------------------------------------------------
export const markAllRead = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const result = await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: `${result.count} notification(s) marked as read`,
      data: { updatedCount: result.count },
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// POST /announcements - Create a new announcement
// ---------------------------------------------------------------------------
export const createAnnouncement = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      templeId,
      title,
      content,
      category,
      priority,
      imageUrl,
      publishAt,
      expiresAt,
    } = req.body;

    if (!templeId) {
      throw new AppError('Temple ID is required', 400);
    }

    if (!title || !content) {
      throw new AppError('Title and content are required', 400);
    }

    // Verify temple exists
    const temple = await prisma.temple.findUnique({ where: { id: templeId } });
    if (!temple) {
      throw new AppError('Temple not found', 404);
    }

    const announcement = await prisma.announcement.create({
      data: {
        templeId,
        title,
        content,
        category: category ?? null,
        priority: priority ?? 'normal',
        imageUrl: imageUrl ?? null,
        publishAt: publishAt ? new Date(publishAt) : new Date(),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      include: {
        temple: { select: { id: true, name: true } },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      data: announcement,
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// GET /announcements - List announcements for a temple
// ---------------------------------------------------------------------------
export const getAnnouncements = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      templeId,
      category,
      isActive,
      page = 1,
      limit = 20,
    } = req.query;

    if (!templeId) {
      throw new AppError('Temple ID is required as a query parameter', 400);
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const { skip, take } = getPagination(pageNum, limitNum);

    const now = new Date();

    const where: Record<string, unknown> = {
      templeId: templeId as string,
      publishAt: { lte: now },
    };

    if (category) {
      where.category = category as string;
    }

    // By default, only show active & non-expired announcements
    if (isActive === undefined || isActive === 'true') {
      where.isActive = true;
      where.OR = [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ];
    } else if (isActive === 'false') {
      // Allow fetching inactive announcements (admin use case)
      where.isActive = false;
    }

    const [announcements, total] = await Promise.all([
      prisma.announcement.findMany({
        where,
        include: {
          temple: { select: { id: true, name: true } },
        },
        orderBy: [{ priority: 'desc' }, { publishAt: 'desc' }],
        skip,
        take,
      }),
      prisma.announcement.count({ where }),
    ]);

    res.json({
      success: true,
      data: announcements,
      pagination: buildPaginationResponse(total, pageNum, limitNum),
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// POST /content - Create spiritual content
// ---------------------------------------------------------------------------
export const createSpiritualContent = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      title,
      type,
      content,
      mediaUrl,
      author,
      language,
      tags,
    } = req.body;

    if (!title) {
      throw new AppError('Title is required', 400);
    }

    if (!type) {
      throw new AppError('Content type is required', 400);
    }

    const validTypes = ['scripture', 'bhajan', 'video', 'article'];
    if (!validTypes.includes(type)) {
      throw new AppError(
        `Invalid content type. Must be one of: ${validTypes.join(', ')}`,
        400,
      );
    }

    const spiritualContent = await prisma.spiritualContent.create({
      data: {
        title,
        type,
        content: content ?? null,
        mediaUrl: mediaUrl ?? null,
        author: author ?? null,
        language: language ?? 'en',
        tags: Array.isArray(tags) ? tags : [],
        publishedAt: new Date(),
      },
    });

    res.status(201).json({
      success: true,
      message: 'Spiritual content created successfully',
      data: spiritualContent,
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// GET /content - List spiritual content with filters
// ---------------------------------------------------------------------------
export const getSpiritualContent = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      type,
      language,
      tags,
      page = 1,
      limit = 20,
    } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const { skip, take } = getPagination(pageNum, limitNum);

    const where: Record<string, unknown> = {
      isPublished: true,
    };

    if (type) {
      where.type = type as string;
    }

    if (language) {
      where.language = language as string;
    }

    if (tags) {
      // Search for content that has any of the provided tags
      where.tags = { hasSome: (tags as string).split(',').map((t) => t.trim()) };
    }

    const [contentList, total] = await Promise.all([
      prisma.spiritualContent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.spiritualContent.count({ where }),
    ]);

    res.json({
      success: true,
      data: contentList,
      pagination: buildPaginationResponse(total, pageNum, limitNum),
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// GET /content/:id - Get a single spiritual content item & increment viewCount
// ---------------------------------------------------------------------------
export const getSpiritualContentById = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const contentItem = await prisma.spiritualContent.findUnique({
      where: { id },
    });

    if (!contentItem) {
      throw new AppError('Spiritual content not found', 404);
    }

    // Increment view count
    const updated = await prisma.spiritualContent.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// POST /lost-found - Report a lost or found item
// ---------------------------------------------------------------------------
export const reportLostItem = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      templeId,
      type,
      category,
      description,
      imageUrl,
      foundLocation,
      foundTime,
    } = req.body;

    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    if (!templeId) {
      throw new AppError('Temple ID is required', 400);
    }

    if (!type || !['lost', 'found'].includes(type)) {
      throw new AppError('Type must be either "lost" or "found"', 400);
    }

    if (!category) {
      throw new AppError('Category is required', 400);
    }

    if (!description) {
      throw new AppError('Description is required', 400);
    }

    // Verify temple exists
    const temple = await prisma.temple.findUnique({ where: { id: templeId } });
    if (!temple) {
      throw new AppError('Temple not found', 404);
    }

    const item = await prisma.lostFoundItem.create({
      data: {
        templeId,
        reportedBy: userId,
        type,
        status: type === 'found' ? 'FOUND' : 'LOST',
        category,
        description,
        imageUrl: imageUrl ?? null,
        foundLocation: foundLocation ?? null,
        foundTime: foundTime ? new Date(foundTime) : null,
      },
      include: {
        temple: { select: { id: true, name: true } },
        reporter: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.status(201).json({
      success: true,
      message: `${type === 'lost' ? 'Lost' : 'Found'} item reported successfully`,
      data: item,
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// GET /lost-found - List lost & found items with filters
// ---------------------------------------------------------------------------
export const getLostFoundItems = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      templeId,
      type,
      status,
      category,
      page = 1,
      limit = 20,
    } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const { skip, take } = getPagination(pageNum, limitNum);

    const where: Record<string, unknown> = {};

    if (templeId) {
      where.templeId = templeId as string;
    }

    if (type) {
      where.type = type as string;
    }

    if (status) {
      where.status = status as string;
    }

    if (category) {
      where.category = category as string;
    }

    const [items, total] = await Promise.all([
      prisma.lostFoundItem.findMany({
        where,
        include: {
          temple: { select: { id: true, name: true } },
          reporter: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.lostFoundItem.count({ where }),
    ]);

    res.json({
      success: true,
      data: items,
      pagination: buildPaginationResponse(total, pageNum, limitNum),
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// PUT /lost-found/:id/status - Update lost/found item status
// ---------------------------------------------------------------------------
export const updateLostFoundStatus = async (
  req: AuthRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, matchedItemId, storageLocation } = req.body;

    const validStatuses = ['MATCHED', 'CLAIMED', 'DISPOSED'];
    if (!status || !validStatuses.includes(status)) {
      throw new AppError(
        `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        400,
      );
    }

    const item = await prisma.lostFoundItem.findUnique({ where: { id } });

    if (!item) {
      throw new AppError('Lost/found item not found', 404);
    }

    const updateData: Record<string, unknown> = { status };

    if (status === 'MATCHED' && matchedItemId) {
      updateData.matchedItemId = matchedItemId;
    }

    if (status === 'CLAIMED') {
      updateData.claimedAt = new Date();
    }

    if (storageLocation !== undefined) {
      updateData.storageLocation = storageLocation;
    }

    const updated = await prisma.lostFoundItem.update({
      where: { id },
      data: updateData,
      include: {
        temple: { select: { id: true, name: true } },
        reporter: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.json({
      success: true,
      message: `Item status updated to ${status}`,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};
