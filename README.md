# FX Trading App — Backend API

A scalable backend for an FX Trading platform built with NestJS, TypeORM, PostgreSQL, and Redis. Users can register, verify their email, fund wallets, convert currencies using real-time exchange rates, and trade Naira (NGN) against international currencies.

## Tech Stack

- **Framework:** NestJS (Node.js)
- **ORM:** TypeORM
- **Database:** PostgreSQL
- **Cache:** Redis (ioredis)
- **Auth:** JWT (Passport)
- **Docs:** Swagger (OpenAPI)
- **Mail:** Nodemailer (SMTP)
- **Validation:** class-validator / class-transformer

## Architecture

```
src/
├── common/                 # Shared utilities, guards, decorators, DTOs, enums
│   ├── decorators/         # @CurrentUser, @Roles, @IdempotencyKey
│   ├── dto/                # Pagination, ApiResponse, Swagger schemas
│   ├── entities/           # Base entity with UUID + timestamps
│   ├── enums/              # Currency, TransactionType, TransactionStatus, UserRole
│   ├── filters/            # Global exception filter
│   ├── guards/             # JWT, Roles, VerifiedEmail guards
│   ├── interceptors/       # Logging, Response transform
│   └── utils/              # OTP generator
├── config/                 # Typed config modules (db, jwt, redis, mail, fx)
├── database/               # Seed script
└── modules/
    ├── auth/               # Registration, OTP verification, login
    ├── user/               # User entity, repository, profile endpoint
    ├── wallet/             # Multi-currency wallets, fund/convert/trade/transfer
    ├── fx/                 # Real-time FX rates with Redis caching
    ├── transaction/        # Transaction history with filtering
    ├── admin/              # Admin-only user/transaction management
    ├── mail/               # Email service for OTP delivery
    ├── redis/              # Global Redis service
    └── health/             # Health check with DB + Redis probes
```

### Key Design Decisions

- **Multi-currency wallet model:** Each user has one wallet row per currency (unique constraint on `userId + currency`). Wallets are lazily created on first interaction via `getOrCreate`.
- **Pessimistic locking:** All balance mutations acquire a `FOR UPDATE` row lock within a database transaction to prevent race conditions and double-spending.
- **Idempotency:** Every wallet operation accepts an `idempotencyKey` (via body or `X-Idempotency-Key` header). Duplicate requests return the original transaction instead of processing again.
- **FX rate caching:** Rates are cached in Redis with a 5-minute TTL. A separate stale copy with 24-hour TTL serves as fallback when the external API is unavailable.
- **Transaction atomicity:** Fund, convert, trade, and transfer operations run inside TypeORM transactions. If any step fails, the entire operation rolls back.
- **Role-based access:** Users have `USER` or `ADMIN` roles. Admin endpoints are protected by a `RolesGuard`. Only verified users can access wallet/trading features.
- **Rate limiting:** Global throttling is applied to all endpoints, with tighter limits on login (5/min) and OTP resend (3/min).

## Setup Instructions

### Prerequisites

- Node.js >= 18
- PostgreSQL >= 14
- Redis >= 6

### 1. Clone and install

```bash
git clone <repo-url>
cd fx-trading-app
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your database, Redis, mail, and FX API credentials
```

| Variable | Description |
|----------|-------------|
| `DB_HOST` | PostgreSQL host |
| `DB_PORT` | PostgreSQL port (default: 5432) |
| `DB_USERNAME` | Database user |
| `DB_PASSWORD` | Database password |
| `DB_NAME` | Database name |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `JWT_EXPIRATION` | Token expiry in seconds (default: 3600) |
| `REDIS_HOST` | Redis host |
| `REDIS_PORT` | Redis port (default: 6379) |
| `MAIL_HOST` | SMTP host |
| `MAIL_PORT` | SMTP port |
| `MAIL_USER` | SMTP username |
| `MAIL_PASSWORD` | SMTP password |
| `FX_API_KEY` | API key from exchangerate-api.com |
| `FX_API_URL` | FX API base URL |

### 3. Create database

```bash
createdb fx_trading
```

### 4. Run the application

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

### 5. Seed admin user (optional)

```bash
npm run seed
# Creates: admin@fxtrading.com / Admin@123
```

### 6. Access Swagger docs

Open [http://localhost:3000/api/docs](http://localhost:3000/api/docs)

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register user, sends OTP email |
| POST | `/api/v1/auth/verify` | Verify email with OTP |
| POST | `/api/v1/auth/login` | Login, returns JWT token |
| POST | `/api/v1/auth/resend-otp` | Resend verification OTP |

### User
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/user/profile` | Get authenticated user profile |

### Wallet
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/wallet` | Get all currency balances |
| POST | `/api/v1/wallet/fund` | Fund wallet in any currency |
| POST | `/api/v1/wallet/convert` | Convert between any two currencies |
| POST | `/api/v1/wallet/trade` | Trade NGN against other currencies |
| POST | `/api/v1/wallet/transfer` | Transfer funds to another user |

### FX Rates
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/fx/rates` | Get rates for a base currency |
| GET | `/api/v1/fx/rates/all` | Get full rate matrix |

### Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/transactions` | Filtered, paginated transaction history |

### Admin (requires ADMIN role)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/users` | List all users |
| GET | `/api/v1/admin/users/:id/wallets` | Get user's wallets |
| GET | `/api/v1/admin/transactions` | List all transactions |
| GET | `/api/v1/admin/transactions/summary` | Aggregated transaction stats |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health` | Database and Redis health check |

## Assumptions

- **FX Rates:** Sourced from exchangerate-api.com. Rates are cached for 5 minutes with a 24-hour stale fallback. Conversions use mid-market rates without spread (no buy/sell price differentiation).
- **Funding:** Simulated — `POST /wallet/fund` credits the balance directly. In production, this would be behind a payment gateway callback.
- **Trading constraint:** Trades must have NGN on at least one side (e.g., NGN→USD or EUR→NGN). Conversions have no such restriction.
- **Transfers:** Same-currency only. Cross-currency transfers would require combining transfer + conversion.
- **OTP:** 6-digit numeric code with 10-minute expiry, delivered via SMTP.
- **Wallet precision:** Balances stored as `DECIMAL(18,4)` — supports up to 14 integer digits with 4 decimal places.
- **Idempotency:** Keys are stored as unique columns on transactions. Providing the same key returns the original result.

## Running Tests

```bash
# All tests
npm test

# With coverage
npm run test:cov

# Watch mode
npm run test:watch
```

## Scalability Considerations

- **Horizontal scaling:** Stateless JWT auth allows multiple app instances behind a load balancer.
- **Redis caching:** FX rates and future session data are stored in Redis, which can be clustered.
- **Database connection pooling:** TypeORM manages a connection pool; configure `extra.max` for high-traffic scenarios.
- **Row-level locking:** Pessimistic locks are scoped to individual wallet rows, minimizing contention across users.
- **Pagination:** All list endpoints are paginated to prevent unbounded queries.
- **Rate limiting:** Throttler protects against abuse; can be backed by Redis for distributed rate limiting.

## License

UNLICENSED
