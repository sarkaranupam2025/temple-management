# Temple Management System (TMS)

A comprehensive digital platform for managing temple operations, devotee services, donations, prasad distribution, volunteer coordination, and analytics.

## Architecture

- **Backend**: Node.js + Express + TypeScript with Prisma ORM
- **Frontend**: React + TypeScript + Vite
- **Database**: PostgreSQL
- **Cache**: Redis (optional)
- **Auth**: JWT with role-based access control (RBAC)

## Modules

| # | Module | Description |
|---|--------|-------------|
| 1 | **Temple & Ritual Management** | Temple profiles, timings, rituals, events, multi-language support |
| 2 | **Smart Queue & Booking** | Time slot management, QR-coded e-tickets, capacity tracking |
| 3 | **Digital Donations** | Multi-channel payment, purpose-driven donations, fund allocation |
| 4 | **Receipting & Tax Compliance** | Auto-generated receipts, 80G tax certificates |
| 5 | **Prasad Management** | Item catalog, token-based ordering, inventory tracking |
| 6 | **Volunteer Management** | Profiles, shift scheduling, badges, leaderboard |
| 7 | **Communication Hub** | Notifications, announcements, spiritual content, lost & found |
| 8 | **Analytics & Reporting** | Dashboard, visitor/financial analytics, feedback, audit log |

## User Roles

`SUPER_ADMIN` | `TEMPLE_ADMIN` | `TRUSTEE` | `MANAGER` | `HEAD_PRIEST` | `PRIEST` | `OFFICE_STAFF` | `VOLUNTEER` | `DEVOTEE`

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### Setup

```bash
# Install dependencies
npm run install:all

# Configure environment
cp server/.env.example server/.env
# Edit server/.env with your database credentials

# Generate Prisma client and run migrations
npm run db:generate
npm run db:migrate

# Start development servers
npm run dev:server   # Backend on :3000
npm run dev:client   # Frontend on :5173
```

### Docker

```bash
docker-compose up -d
```

This starts PostgreSQL, Redis, the API server, and the React client.

## API Endpoints

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | - | Register new user |
| POST | `/api/auth/login` | - | Login |
| GET | `/api/auth/profile` | Yes | Get profile |
| PUT | `/api/auth/profile` | Yes | Update profile |
| PUT | `/api/auth/change-password` | Yes | Change password |

### Temples
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/temples` | Admin | Create temple |
| GET | `/api/temples` | - | List temples |
| GET | `/api/temples/:id` | - | Get temple details |
| PUT | `/api/temples/:id` | Admin | Update temple |
| POST | `/api/temples/:id/timings` | Admin | Set timings |
| POST | `/api/temples/:id/rituals` | Admin | Create ritual |
| GET | `/api/temples/:id/rituals` | - | List rituals |
| POST | `/api/temples/:id/events` | Admin | Create event |
| GET | `/api/temples/:id/events` | - | List events |

### Bookings
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/bookings/slots` | Admin | Create time slot |
| GET | `/api/bookings/slots` | - | Get available slots |
| POST | `/api/bookings` | Yes | Create booking |
| GET | `/api/bookings` | Yes | List bookings |
| GET | `/api/bookings/:id` | Yes | Get booking |
| PUT | `/api/bookings/:id/status` | Admin | Update status |
| PUT | `/api/bookings/:id/cancel` | Yes | Cancel booking |
| PUT | `/api/bookings/:id/check-in` | Admin | Check in |

### Donations
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/donations` | Yes | Make donation |
| GET | `/api/donations` | Yes | List donations |
| GET | `/api/donations/:id` | Yes | Get donation |
| GET | `/api/donations/stats` | Admin | Donation statistics |
| GET | `/api/donations/fund-allocations` | Admin | Fund allocations |
| PUT | `/api/donations/:id/payment-status` | Admin | Update payment |

### Receipts & Tax
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/receipts/generate` | Admin | Generate receipt |
| GET | `/api/receipts/:id` | Yes | Get receipt |
| POST | `/api/receipts/tax-certificate` | Admin | Generate 80G certificate |
| GET | `/api/receipts/tax-certificates` | Admin | List certificates |

### Prasad
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/prasad/items` | Admin | Add prasad item |
| GET | `/api/prasad/items` | - | List items |
| POST | `/api/prasad/orders` | Yes | Place order |
| GET | `/api/prasad/orders` | Yes | My orders |
| PUT | `/api/prasad/orders/:id/status` | Admin | Update order status |
| PUT | `/api/prasad/orders/:token/pickup` | Admin | Pickup by token |

### Volunteers
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/volunteers/profile` | Yes | Create volunteer profile |
| GET | `/api/volunteers` | Admin | List volunteers |
| GET | `/api/volunteers/leaderboard` | - | Leaderboard |
| POST | `/api/volunteers/shifts` | Admin | Create shift |
| GET | `/api/volunteers/shifts` | Yes | List shifts |
| PUT | `/api/volunteers/shifts/:id/check-in` | Yes | Check in to shift |
| PUT | `/api/volunteers/shifts/:id/check-out` | Admin | Check out |
| POST | `/api/volunteers/:id/badges` | Admin | Award badge |

### Communication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/communication/notifications` | Yes | Get notifications |
| PUT | `/api/communication/notifications/:id/read` | Yes | Mark read |
| POST | `/api/communication/notifications/send` | Admin | Send notification |
| POST | `/api/communication/announcements` | Admin | Create announcement |
| GET | `/api/communication/announcements` | - | List announcements |
| POST | `/api/communication/content` | Admin | Add spiritual content |
| GET | `/api/communication/content` | - | Browse content |
| POST | `/api/communication/lost-found` | Yes | Report lost/found item |
| GET | `/api/communication/lost-found` | - | Search items |

### Analytics
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/analytics/dashboard` | Admin | Dashboard overview |
| GET | `/api/analytics/visitors` | Admin | Visitor analytics |
| GET | `/api/analytics/financial` | Admin | Financial analytics |
| GET | `/api/analytics/operational` | Admin | Operational metrics |
| POST | `/api/analytics/feedback` | Yes | Submit feedback |
| GET | `/api/analytics/feedback` | Admin | List feedback |
| PUT | `/api/analytics/feedback/:id/respond` | Admin | Respond to feedback |
| GET | `/api/analytics/audit-log` | Super Admin | Audit trail |
| GET | `/api/analytics/trends` | Admin | Analytics trends |

## Database Schema

The system uses 30+ database models organized across 8 modules, supporting:
- Multi-temple hierarchy (parent-child relationships)
- Multi-language translations
- Complete audit trail
- Financial compliance (80G tax certificates)
- Token-based prasad distribution
- Volunteer gamification (points, badges, tiers)

## Project Structure

```
temple-management/
├── server/
│   ├── prisma/
│   │   └── schema.prisma        # Database schema (30+ models)
│   ├── src/
│   │   ├── config/              # App config, database client
│   │   ├── middleware/          # Auth, validation, error handling
│   │   ├── controllers/        # Route handlers (8 modules)
│   │   ├── routes/             # Express routers
│   │   ├── types/              # TypeScript type definitions
│   │   ├── utils/              # Helper functions
│   │   └── index.ts            # Server entry point
│   ├── Dockerfile
│   └── package.json
├── client/
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── pages/              # Page components (8 pages)
│   │   ├── hooks/              # Custom React hooks
│   │   ├── services/           # API client
│   │   ├── App.tsx             # Root component with routing
│   │   └── main.tsx            # Entry point
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── package.json                 # Root workspace scripts
```
