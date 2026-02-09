import { UserRole } from '@prisma/client';
import { Request } from 'express';

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface BookingSlotQuery {
  templeId: string;
  date: string;
  slotType?: string;
}

export interface DonationFilters {
  templeId?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
  paymentStatus?: string;
  minAmount?: number;
  maxAmount?: number;
}

export interface AnalyticsQuery {
  templeId: string;
  startDate: string;
  endDate: string;
  groupBy?: 'day' | 'week' | 'month';
}
