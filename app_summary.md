**Teacherin**.

# 1) High-Level User Flow

1. **Landing & Discovery** → Users browse popular teachers, categories, and use search/filters.
2. **Auth & Onboarding**

   * Sign up/login via email (OAuth optional).
   * Choose role: **Student** or **Teacher**.
   * Teachers complete profile (skills, rate, city, availability).
3. **Search & Evaluate** → Students filter by skill, price, rating, city, and open teacher detail pages.
4. **Booking** → Student picks an available slot, selects **Online** (meeting link) or **Offline** (location), confirms.
5. **Payment** → Create payment (Midtrans), redirect/approve. Webhook confirms → booking status updates.
6. **Session** → Conduct lesson (online link or offline meeting).
7. **Review** → Student rates & reviews the teacher.
8. **Marketplace** (optional) → Buy/download teacher’s learning materials (video/PDF).
9. **Payout** (teacher) → Request withdrawal; admin/disbursement flow processes it.

---

# 2) Core Features

* **Role-based Auth** (Student/Teacher/Admin) with secure sessions.
* **Smart Teacher Search & Filters** (skill, price range, rating, city, availability).
* **Teacher Profiles** (experience, hourly rate, portfolio, reviews, availability calendar).
* **Booking & Scheduling** (slot selection, double-booking prevention).
* **Payments** (Midtrans integration, webhook handling, status sync).
* **Online/Offline Sessions** (meeting link vs. physical location tracking).
* **Reviews & Ratings** (1–5 stars + comments).
* **Learning Materials Marketplace** (upload, publish, purchase, secure delivery via signed URL).
* **Dashboards**

  * Student: upcoming sessions, purchase history, reviews.
  * Teacher: bookings, availability, earnings, materials.
* **Payouts** (request, processing, audit).
* **Admin (optional)**: user moderation, transaction oversight, fee/commission settings.

---

# 3) Frontend Technicals

* **Framework**: Next.js (App Router, RSC, SSR/ISR for SEO & performance).
* **UI**: TailwindCSS + **shadcn/ui** components.
* **State/Data**:

  * Server Actions & route handlers for data mutations.
  * Client components for interactive views (filters, forms, tables).
* **Forms & Validation**: React Hook Form + Zod schemas (shared with API).
* **Auth**: NextAuth (credentials + optional OAuth). httpOnly cookies, CSRF protection.
* **Media/Files**: Direct S3/MinIO upload via pre-signed URLs.
* **UX Highlights**:

  * Filterable teacher list (DataTable), date/time pickers for availability, rating stars, command palette search.
  * Accessible components, responsive layout, skeleton loaders.

---

# 4) Backend Technicals

* **Runtime**: Next.js Route Handlers (`app/api/**`) for REST-style endpoints.
* **Database**: PostgreSQL with **Drizzle ORM** (type-safe queries, migrations).
* **Schema Management**: Drizzle Kit (generate, migrate, seed).
* **Payments**: Midtrans server SDK; HMAC signature verification on webhooks.
* **Storage**: S3-compatible (MinIO for dev, AWS S3 for prod) with signed URLs.
* **Scheduling & Concurrency**:

  * Availability & booking conflict checks (unique constraints + transactional updates).
* **Security**: Argon2id password hashing, role-based authorization, input validation (Zod), rate limiting.
* **Observability**: Structured logs (pino), error tracking (Sentry), health checks.
* **Containers**: Docker Compose (web, Postgres, MinIO, Redis optional, Mailhog for dev email).

---

# 5) Database Schema (Core Entities)

**users**

* `id (uuid, pk)`, `email (unique)`, `hash`, `email_verified_at`, `is_active`, `created_at`

**profiles** (1:1 with users; role & public info)

* `id (uuid, pk)`, `user_id (fk users) unique`, `role (STUDENT|TEACHER|ADMIN)`, `full_name`, `bio`, `avatar_url`, `city`, `created_at`

**teachers** (extends profiles for teacher-specific fields)

* `id (uuid, pk)`, `profile_id (fk profiles) unique`, `experience_years`, `price_per_hour (numeric)`, `avg_rating (numeric)`, `is_verified`, `created_at`
  **Indexes**: `(city, price_per_hour, avg_rating)`

**skills** / **teacher\_skills** (M\:N)

* `skills: id, name (unique)`
* `teacher_skills: teacher_id (fk), skill_id (fk)` **unique**(teacher\_id, skill\_id)

**availability\_slots** (teacher time windows)

* `id`, `teacher_id (fk)`, `start_time`, `end_time`, `is_booked (bool)`
  **Indexes**: `(teacher_id, start_time)`

**bookings**

* `id`, `teacher_id (fk)`, `student_profile_id (fk profiles)`, `start_time`, `end_time`,
  `status (PENDING|PAID|CONFIRMED|COMPLETED|CANCELLED|REFUNDED)`,
  `total_price (numeric)`, `mode (ONLINE|OFFLINE)`, `notes`, `created_at`
  **Constraints**: unique partial index to prevent double-booking per teacher/time range.

**payments**

* `id`, `booking_id (fk)`, `gateway (MIDTRANS|…)`, `gateway_ref`, `amount`,
  `status (PENDING|SUCCESS|FAILED)`, `payload (jsonb)`, `created_at`
  **Flow**: webhook updates `status` and cascades booking state.

**sessions** (lesson execution details)

* `id`, `booking_id (fk unique)`, `meeting_link`, `location`, `started_at`, `ended_at`

**reviews**

* `id`, `booking_id (fk unique)`, `rating (1..5)`, `comment`, `created_at`
  **Aggregation**: trigger/job updates `teachers.avg_rating`.

**materials** (teacher products)

* `id`, `teacher_id (fk)`, `title`, `description`, `price`, `file_key (S3 path)`, `is_published`, `created_at`

**orders** (material purchases)

* `id`, `buyer_profile_id (fk profiles)`, `material_id (fk)`, `amount`, `status (PENDING|PAID|CANCELLED|REFUNDED)`, `created_at`

**favorites** (optional)

* `profile_id (fk)`, `teacher_id (fk)` **unique**(profile\_id, teacher\_id)

**payouts** (teacher withdrawals)

* `id`, `teacher_id (fk)`, `amount`, `status (REQUESTED|PROCESSING|PAID|FAILED)`, `requested_at`, `processed_at`, `notes`

**notifications** (optional)

* `id`, `profile_id (fk)`, `type`, `payload jsonb`, `read_at`, `created_at`

**Key Relationships**

* `users 1–1 profiles 1–0..1 teachers`
* `teachers N–N skills`
* `teachers 1–N availability_slots`
* `bookings` link `teachers` ↔ `profiles (student)`
* `payments 1–N bookings` (usually 1:1 per single session)
* `sessions 1–1 bookings`
* `reviews 1–1 bookings`
* `materials N–1 teachers`, `orders N–1 materials`
* `payouts N–1 teachers`

---

