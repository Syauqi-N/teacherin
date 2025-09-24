# Teacherin

A modern platform for connecting students with teachers for online and offline learning sessions.

## Features

- **Role-based Authentication**: Secure authentication with Student, Teacher, and Admin roles
- **Teacher Profiles**: Detailed teacher profiles with skills, experience, and ratings
- **Smart Search & Filters**: Find teachers by skill, price, rating, and location
- **Booking System**: Schedule and manage learning sessions
- **Payment Integration**: Secure payments with Midtrans
- **Session Management**: Online/offline session handling
- **Review System**: Student ratings and feedback
- **Learning Materials Marketplace**: Buy and sell educational materials
- **Payout System**: Teacher earnings and withdrawal management
- **Admin Dashboard**: Platform oversight and management

## Tech Stack

- **Frontend**: Next.js 15 with App Router, React 19, TypeScript
- **UI**: TailwindCSS, shadcn/ui components
- **Backend**: Next.js Route Handlers, Drizzle ORM
- **Database**: PostgreSQL (with SQLite for development)
- **Authentication**: Better Auth
- **Payments**: Midtrans
- **Deployment**: Docker

## Project Structure

```
├── app/                 # Next.js app router pages
├── components/          # Shared UI components
├── db/                  # Database schema and connection
├── lib/                 # Utility functions and services
├── public/              # Static assets
├── drizzle/             # Database migrations
├── .env                 # Environment variables
├── docker-compose.yaml  # Docker configuration
└── next.config.ts       # Next.js configuration
```

## API Endpoints

### Authentication
- `POST /api/auth/sign-up` - User registration
- `POST /api/auth/sign-in` - User login
- `POST /api/onboarding` - Role selection and profile setup

### Teachers
- `GET /api/teachers` - List teachers with filtering
- `GET /api/teachers/[id]` - Get teacher details
- `POST /api/teachers` - Update teacher profile

### Bookings
- `GET /api/bookings` - List user bookings
- `POST /api/bookings` - Create new booking
- `PUT /api/bookings/[id]/status` - Update booking status

### Payments
- `POST /api/payments` - Initiate payment
- `POST /api/payments/notification` - Midtrans webhook

### Sessions
- `GET /api/sessions` - List sessions
- `POST /api/sessions` - Create/update session
- `PUT /api/sessions/[id]/start` - Start session
- `PUT /api/sessions/[id]/end` - End session

### Reviews
- `GET /api/reviews` - List reviews
- `POST /api/reviews` - Create review
- `PUT /api/reviews/[id]` - Update review
- `DELETE /api/reviews/[id]` - Delete review

### Materials
- `GET /api/materials` - List materials
- `POST /api/materials` - Create material
- `PUT /api/materials/[id]` - Update material
- `DELETE /api/materials/[id]` - Delete material

### Orders
- `GET /api/orders` - List orders
- `POST /api/orders` - Create order
- `GET /api/orders/[id]/download` - Download material

### Payouts
- `GET /api/payouts` - List payouts
- `POST /api/payouts` - Request payout
- `PUT /api/payouts/[id]/status` - Update payout status
- `GET /api/payouts/stats` - Get payout statistics

### Admin
- `GET /api/admin/users` - List users
- `PUT /api/admin/users/[id]/status` - Update user status
- `DELETE /api/admin/users/[id]` - Delete user
- `GET /api/admin/transactions` - List transactions
- `PUT /api/admin/transactions/[id]/status` - Update transaction status
- `GET /api/admin/transactions/stats` - Get transaction statistics
- `GET /api/admin/settings` - Get admin settings
- `PUT /api/admin/settings` - Update admin settings

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables in `.env`
4. Start the development database: `npm run db:dev`
5. Run database migrations: `npm run db:push`
6. Start the development server: `npm run dev`

## Deployment

Use Docker Compose to deploy the application:

```bash
docker-compose up -d
```

## License

MIT