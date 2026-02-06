import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  sendNotification,
  getNotifications,
  markAsRead,
  markAllRead,
  createAnnouncement,
  getAnnouncements,
  createSpiritualContent,
  getSpiritualContent,
  getSpiritualContentById,
  reportLostItem,
  getLostFoundItems,
  updateLostFoundStatus,
} from '../controllers/communicationController';

const router = Router();

const adminRoles = ['SUPER_ADMIN', 'TEMPLE_ADMIN', 'MANAGER'] as const;

// Notifications
router.get('/notifications', authenticate, getNotifications);
router.put('/notifications/:id/read', authenticate, markAsRead);
router.put('/notifications/read-all', authenticate, markAllRead);
router.post('/notifications/send', authenticate, authorize(...adminRoles), sendNotification);

// Announcements
router.post('/announcements', authenticate, authorize(...adminRoles), createAnnouncement);
router.get('/announcements', getAnnouncements);

// Spiritual Content
router.post('/content', authenticate, authorize('SUPER_ADMIN', 'TEMPLE_ADMIN', 'PRIEST', 'HEAD_PRIEST'), createSpiritualContent);
router.get('/content', getSpiritualContent);
router.get('/content/:id', getSpiritualContentById);

// Lost & Found
router.post('/lost-found', authenticate, reportLostItem);
router.get('/lost-found', getLostFoundItems);
router.put('/lost-found/:id', authenticate, updateLostFoundStatus);

export default router;
