import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@temple.com' },
    update: {},
    create: {
      email: 'admin@temple.com',
      phone: '+919999999999',
      passwordHash: adminPassword,
      firstName: 'Temple',
      lastName: 'Admin',
      role: 'TEMPLE_ADMIN',
      emailVerified: true,
    },
  });
  console.log('Admin user created:', admin.email);

  // Create devotee user
  const devPassword = await bcrypt.hash('devotee123', 12);
  const devotee = await prisma.user.upsert({
    where: { email: 'devotee@example.com' },
    update: {},
    create: {
      email: 'devotee@example.com',
      phone: '+919888888888',
      passwordHash: devPassword,
      firstName: 'Rama',
      lastName: 'Krishna',
      role: 'DEVOTEE',
      emailVerified: true,
    },
  });
  console.log('Devotee user created:', devotee.email);

  // Create a priest user
  const priestPassword = await bcrypt.hash('priest123', 12);
  const priest = await prisma.user.upsert({
    where: { email: 'priest@temple.com' },
    update: {},
    create: {
      email: 'priest@temple.com',
      passwordHash: priestPassword,
      firstName: 'Pandit',
      lastName: 'Sharma',
      role: 'HEAD_PRIEST',
      emailVerified: true,
    },
  });
  console.log('Priest user created:', priest.email);

  // Create temples
  const temple1 = await prisma.temple.create({
    data: {
      name: 'Shri Ganesh Mandir',
      deity: 'Lord Ganesha',
      foundingYear: 1850,
      architecturalStyle: 'Dravidian',
      description: 'A historic temple dedicated to Lord Ganesha, known for its beautiful architecture and serene atmosphere. The temple hosts daily pujas and special festivals throughout the year.',
      address: '123, Temple Street, Near Main Market',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411001',
      phone: '+912012345678',
      email: 'info@ganeshmandir.org',
      parkingCapacity: 200,
      hasWheelchairAccess: true,
      hasMeditationHall: true,
      latitude: 18.5204,
      longitude: 73.8567,
    },
  });

  const temple2 = await prisma.temple.create({
    data: {
      name: 'Shri Lakshmi Narayan Temple',
      deity: 'Lord Vishnu & Goddess Lakshmi',
      foundingYear: 1938,
      architecturalStyle: 'Nagara',
      description: 'A grand temple dedicated to Lord Vishnu and Goddess Lakshmi. Famous for its annual Diwali celebrations and charity work.',
      address: '456, Mandir Marg',
      city: 'New Delhi',
      state: 'Delhi',
      pincode: '110001',
      phone: '+911123456789',
      email: 'info@lakshminarayan.org',
      parkingCapacity: 500,
      hasWheelchairAccess: true,
      hasMeditationHall: false,
    },
  });

  const temple3 = await prisma.temple.create({
    data: {
      name: 'Shri Shiva Shakti Mandir',
      deity: 'Lord Shiva',
      foundingYear: 1720,
      description: 'Ancient Shiva temple located on the banks of the river. Known for Maha Shivaratri celebrations.',
      address: '789, River Bank Road',
      city: 'Varanasi',
      state: 'Uttar Pradesh',
      pincode: '221001',
      parkingCapacity: 100,
      hasWheelchairAccess: false,
      hasMeditationHall: true,
    },
  });
  console.log('3 temples created');

  // Add temple timings
  const daysOfWeek = [0, 1, 2, 3, 4, 5, 6];
  for (const day of daysOfWeek) {
    await prisma.templeTimings.create({
      data: {
        templeId: temple1.id, dayOfWeek: day,
        openTime: '05:00', closeTime: '12:00', label: 'Morning Darshan',
      },
    });
    await prisma.templeTimings.create({
      data: {
        templeId: temple1.id, dayOfWeek: day,
        openTime: '16:00', closeTime: '21:00', label: 'Evening Darshan',
      },
    });
  }
  console.log('Temple timings added');

  // Add staff assignments
  await prisma.templeStaff.create({
    data: { templeId: temple1.id, userId: admin.id, role: 'TEMPLE_ADMIN' },
  });
  await prisma.templeStaff.create({
    data: { templeId: temple1.id, userId: priest.id, role: 'HEAD_PRIEST' },
  });

  // Create rituals
  const ritual1 = await prisma.ritual.create({
    data: {
      templeId: temple1.id, name: 'Ganesh Abhishekam',
      type: 'SPECIAL_ABHISHEKAM', description: 'Special milk and honey abhishekam for Lord Ganesha',
      duration: 45, capacity: 50, price: 501, requiresPriest: true,
    },
  });
  const ritual2 = await prisma.ritual.create({
    data: {
      templeId: temple1.id, name: 'Morning Aarti',
      type: 'DAILY_PUJA', description: 'Daily morning aarti with bhajans',
      duration: 30, capacity: 200, price: 0, isRecurring: true, requiresPriest: true,
    },
  });
  await prisma.ritual.create({
    data: {
      templeId: temple1.id, name: 'Satyanarayan Puja',
      type: 'PERSONAL_RITUAL', description: 'Full Satyanarayan Katha and Puja for families',
      duration: 120, capacity: 30, price: 2100, requiresPriest: true,
    },
  });
  await prisma.ritual.create({
    data: {
      templeId: temple2.id, name: 'Vishnu Sahasranama',
      type: 'DAILY_PUJA', description: 'Daily recitation of Vishnu Sahasranama',
      duration: 60, capacity: 100, price: 0, isRecurring: true,
    },
  });
  console.log('Rituals created');

  // Create events
  await prisma.event.create({
    data: {
      templeId: temple1.id, name: 'Ganesh Chaturthi Mahotsav',
      description: '10-day grand celebration of Ganesh Chaturthi with cultural programs, bhajan sandhya, and community meals.',
      startDate: new Date('2026-08-22'), endDate: new Date('2026-09-01'),
      capacity: 5000, category: 'festival', isPublic: true,
    },
  });
  await prisma.event.create({
    data: {
      templeId: temple1.id, name: 'Weekly Bhajan Sandhya',
      description: 'Community gathering for devotional singing every Saturday evening.',
      startDate: new Date('2026-02-08'), endDate: new Date('2026-02-08'),
      capacity: 200, category: 'spiritual', isPublic: true,
    },
  });
  await prisma.event.create({
    data: {
      templeId: temple2.id, name: 'Diwali Celebration 2026',
      description: 'Grand Diwali celebration with deep utsav, fireworks, and community feast.',
      startDate: new Date('2026-10-20'), endDate: new Date('2026-10-22'),
      capacity: 10000, category: 'festival', isPublic: true,
    },
  });
  console.log('Events created');

  // Create booking slots for tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const slots = [
    { startTime: '06:00', endTime: '07:00', capacity: 100, slotType: 'regular', price: 0 },
    { startTime: '07:00', endTime: '08:00', capacity: 100, slotType: 'regular', price: 0 },
    { startTime: '08:00', endTime: '09:00', capacity: 80, slotType: 'regular', price: 50 },
    { startTime: '09:00', endTime: '10:00', capacity: 80, slotType: 'regular', price: 50 },
    { startTime: '06:00', endTime: '07:00', capacity: 20, slotType: 'senior', price: 0 },
    { startTime: '08:00', endTime: '09:00', capacity: 10, slotType: 'disabled', price: 0 },
    { startTime: '17:00', endTime: '18:00', capacity: 100, slotType: 'regular', price: 0 },
    { startTime: '18:00', endTime: '19:00', capacity: 100, slotType: 'regular', price: 100 },
  ];

  for (const slot of slots) {
    await prisma.bookingSlot.create({
      data: { templeId: temple1.id, date: tomorrow, ...slot },
    });
  }
  console.log('Booking slots created for tomorrow');

  // Create sample bookings
  const slot1 = await prisma.bookingSlot.findFirst({ where: { templeId: temple1.id, startTime: '08:00', slotType: 'regular' } });
  if (slot1) {
    await prisma.booking.create({
      data: {
        bookingNumber: 'BK-DEMO-001',
        userId: devotee.id, templeId: temple1.id, slotId: slot1.id, ritualId: ritual1.id,
        date: tomorrow, numberOfPersons: 2, status: 'CONFIRMED',
        totalAmount: 1102, paymentStatus: 'paid', qrCode: 'demo-qr-001',
      },
    });
    await prisma.bookingSlot.update({ where: { id: slot1.id }, data: { bookedCount: 2 } });
  }
  console.log('Sample booking created');

  // Create sample donations
  const donations = [
    { amount: 5001, category: 'GENERAL_FUND' as const, paymentMethod: 'UPI' as const, paymentStatus: 'COMPLETED' as const },
    { amount: 11000, category: 'ANNADANAM' as const, paymentMethod: 'NET_BANKING' as const, paymentStatus: 'COMPLETED' as const },
    { amount: 2100, category: 'FESTIVAL_SPONSORSHIP' as const, paymentMethod: 'UPI' as const, paymentStatus: 'COMPLETED' as const },
    { amount: 51000, category: 'BUILDING_REPAIR' as const, paymentMethod: 'CHEQUE' as const, paymentStatus: 'COMPLETED' as const },
    { amount: 1100, category: 'SEVA_ACTIVITY' as const, paymentMethod: 'CASH' as const, paymentStatus: 'COMPLETED' as const },
    { amount: 21000, category: 'PRIEST_WELFARE' as const, paymentMethod: 'NET_BANKING' as const, paymentStatus: 'PENDING' as const },
  ];

  for (let i = 0; i < donations.length; i++) {
    await prisma.donation.create({
      data: {
        donationNumber: `DN-DEMO-${String(i + 1).padStart(3, '0')}`,
        userId: devotee.id, templeId: temple1.id,
        ...donations[i], currency: 'INR', is80GEligible: donations[i].amount >= 5000,
        donorName: `${devotee.firstName} ${devotee.lastName}`,
        donorEmail: devotee.email,
      },
    });
  }
  console.log('6 sample donations created');

  // Create prasad items
  const laddu = await prisma.prasadItem.create({
    data: {
      templeId: temple1.id, name: 'Modak (Sweet Dumpling)',
      description: 'Traditional sweet dumpling offering, Lord Ganesha\'s favorite prasad',
      price: 50, isVegetarian: true, maxPerDevotee: 10, allergens: 'Contains: Wheat, Milk, Nuts',
    },
  });
  await prisma.prasadItem.create({
    data: {
      templeId: temple1.id, name: 'Coconut Prasad',
      description: 'Fresh coconut with jaggery and dry fruits',
      price: 30, isVegetarian: true, maxPerDevotee: 5, allergens: 'Contains: Coconut, Nuts',
    },
  });
  await prisma.prasadItem.create({
    data: {
      templeId: temple1.id, name: 'Panchamrit',
      description: 'Sacred mixture of milk, yogurt, honey, ghee, and sugar',
      price: 20, isVegetarian: true, isSugarFree: false, maxPerDevotee: 3,
    },
  });
  await prisma.prasadItem.create({
    data: {
      templeId: temple1.id, name: 'Sugar-Free Laddu',
      description: 'Special laddu made with dates and dry fruits, no added sugar',
      price: 80, isVegetarian: true, isSugarFree: true, maxPerDevotee: 5,
    },
  });
  console.log('Prasad items created');

  // Create a sample prasad order
  await prisma.prasadOrder.create({
    data: {
      prasadId: laddu.id, quantity: 5, totalPrice: 250,
      tokenCode: 'TK-MODAK01', tokenColor: 'orange',
      status: 'ready', validUntil: new Date(Date.now() + 4 * 60 * 60 * 1000),
    },
  });
  console.log('Sample prasad order created');

  // Create volunteer profiles
  const vol = await prisma.volunteerProfile.create({
    data: {
      userId: devotee.id, skills: ['crowd_management', 'first_aid', 'hindi', 'english'],
      certifications: ['Basic First Aid'], availableDays: [0, 5, 6],
      totalHours: 156, totalPoints: 780, tier: 'gold',
    },
  });

  // Create volunteer shifts
  await prisma.volunteerShift.create({
    data: {
      volunteerId: vol.id, date: tomorrow, startTime: '06:00', endTime: '10:00',
      task: 'Queue Management', taskDescription: 'Help manage devotee queues at the main entrance',
      location: 'Main Gate', status: 'scheduled',
    },
  });
  await prisma.volunteerShift.create({
    data: {
      volunteerId: vol.id, date: new Date(), startTime: '16:00', endTime: '20:00',
      task: 'Prasad Distribution', taskDescription: 'Assist with prasad distribution in the main hall',
      location: 'Prasad Hall', status: 'completed', hoursLogged: 4, rating: 5,
    },
  });

  // Award badge
  await prisma.volunteerBadge.create({
    data: { volunteerId: vol.id, badgeName: '100 Hours Club', description: 'Completed 100+ volunteer hours' },
  });
  await prisma.volunteerBadge.create({
    data: { volunteerId: vol.id, badgeName: 'First Aid Hero', description: 'Certified in first aid' },
  });
  console.log('Volunteer profile, shifts, and badges created');

  // Create announcements
  await prisma.announcement.create({
    data: {
      templeId: temple1.id, title: 'Maha Shivaratri Special Schedule',
      content: 'The temple will remain open for 24 hours on Maha Shivaratri (March 1, 2026). Special abhishekam will be performed every 3 hours. Devotees are requested to book their slots in advance.',
      category: 'festival', priority: 'high',
    },
  });
  await prisma.announcement.create({
    data: {
      templeId: temple1.id, title: 'New Parking Facility Opened',
      content: 'We are happy to announce the opening of a new 200-car parking facility adjacent to the temple. Free parking for first 2 hours for all devotees.',
      category: 'general', priority: 'normal',
    },
  });
  await prisma.announcement.create({
    data: {
      templeId: temple1.id, title: 'Annadanam Sponsorship Available',
      content: 'Devotees can now sponsor daily Annadanam (free meals) for ₹11,000. Each sponsorship feeds approximately 500 devotees. Contact the office for details.',
      category: 'general', priority: 'normal',
    },
  });
  console.log('Announcements created');

  // Create spiritual content
  await prisma.spiritualContent.create({
    data: {
      title: 'Ganesh Atharvashirsha', type: 'scripture',
      content: 'Om Namaste Ganapataye...\n\nThe Ganapati Atharvashirsha is a late Upanishad dedicated to the deity Ganesha.',
      author: 'Vedic Scripture', language: 'en', tags: ['ganesh', 'scripture', 'upanishad'],
    },
  });
  await prisma.spiritualContent.create({
    data: {
      title: 'Om Jai Jagdish Hare', type: 'bhajan',
      content: 'Lyrics of the famous aarti sung in temples across India.',
      author: 'Traditional', language: 'hi', tags: ['aarti', 'bhajan', 'devotional'],
    },
  });
  await prisma.spiritualContent.create({
    data: {
      title: 'The Significance of Prasad', type: 'article',
      content: 'Prasad is a material substance of food that is offered to the deity and then distributed to devotees as a blessing...',
      author: 'Temple Knowledge Series', language: 'en', tags: ['prasad', 'tradition', 'knowledge'],
    },
  });
  console.log('Spiritual content created');

  // Create notifications
  await prisma.notification.create({
    data: {
      userId: devotee.id, type: 'TRANSACTIONAL', channel: 'IN_APP',
      title: 'Booking Confirmed', message: 'Your booking BK-DEMO-001 for Ganesh Abhishekam has been confirmed.',
      sentAt: new Date(),
    },
  });
  await prisma.notification.create({
    data: {
      userId: devotee.id, type: 'PROMOTIONAL', channel: 'IN_APP',
      title: 'Maha Shivaratri - Book Now!',
      message: 'Special slots are now available for Maha Shivaratri. Book early to avoid the rush.',
      sentAt: new Date(),
    },
  });
  console.log('Notifications created');

  // Create sample feedback
  await prisma.feedback.create({
    data: {
      userId: devotee.id, templeId: temple1.id, category: 'service', rating: 5,
      comment: 'Wonderful experience during the morning aarti. Very well organized.', status: 'open',
    },
  });
  console.log('Feedback created');

  console.log('\n✅ Database seeded successfully!\n');
  console.log('📋 Login Credentials:');
  console.log('   Admin:   admin@temple.com / admin123');
  console.log('   Devotee: devotee@example.com / devotee123');
  console.log('   Priest:  priest@temple.com / priest123');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
