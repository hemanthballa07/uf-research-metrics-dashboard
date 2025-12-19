# Database Schema Documentation

## Overview

The database uses PostgreSQL with Prisma ORM. The schema is defined in `apps/api/prisma/schema.prisma`.

## Tables

### departments

University departments.

| Column     | Type      | Constraints           | Description              |
|------------|-----------|-----------------------|--------------------------|
| id         | Int       | Primary Key, Auto Inc | Department ID            |
| name       | String    | Unique, Indexed       | Department name          |
| createdAt  | DateTime  | Default: now()         | Creation timestamp       |
| updatedAt  | DateTime  | Auto-updated          | Last update timestamp    |

**Relationships:**
- Has many `faculty`
- Has many `grants`

### faculty

Faculty members (Principal Investigators).

| Column      | Type      | Constraints           | Description              |
|-------------|-----------|-----------------------|--------------------------|
| id          | Int       | Primary Key, Auto Inc | Faculty ID               |
| name        | String    |                       | Faculty name             |
| email       | String    | Unique, Indexed       | Email address            |
| departmentId| Int       | Foreign Key, Indexed  | Department reference     |
| createdAt   | DateTime  | Default: now()         | Creation timestamp       |
| updatedAt   | DateTime  | Auto-updated          | Last update timestamp    |

**Relationships:**
- Belongs to `department`
- Has many `grants` (as Principal Investigator)

**Indexes:**
- `departmentId` - For filtering by department
- `email` - For unique lookup

### sponsors

Grant sponsors (federal agencies, foundations, etc.).

| Column      | Type      | Constraints           | Description              |
|-------------|-----------|-----------------------|--------------------------|
| id          | Int       | Primary Key, Auto Inc | Sponsor ID               |
| name        | String    | Indexed               | Sponsor name             |
| sponsorType | String    | Indexed               | Type (federal, state, etc.) |
| createdAt   | DateTime  | Default: now()         | Creation timestamp       |
| updatedAt   | DateTime  | Auto-updated          | Last update timestamp    |

**Relationships:**
- Has many `grants`

**Constraints:**
- Unique constraint on `(name, sponsorType)` - Same sponsor name can exist with different types

**Indexes:**
- `name` - For searching
- `sponsorType` - For filtering by type

### grants

Grant records.

| Column      | Type      | Constraints           | Description              |
|-------------|-----------|-----------------------|--------------------------|
| id          | Int       | Primary Key, Auto Inc | Grant ID                 |
| title       | String    |                       | Grant title              |
| sponsorId   | Int       | Foreign Key, Indexed  | Sponsor reference        |
| piId        | Int       | Foreign Key, Indexed  | Principal Investigator   |
| departmentId| Int       | Foreign Key, Indexed  | Department reference     |
| amount      | Decimal   |                       | Grant amount             |
| status      | String    | Indexed               | Status (draft, submitted, etc.) |
| submittedAt | DateTime? | Indexed, Nullable     | Submission date          |
| awardedAt   | DateTime? | Indexed, Nullable     | Award date               |
| createdAt   | DateTime  | Default: now()         | Creation timestamp       |
| updatedAt   | DateTime  | Auto-updated          | Last update timestamp    |

**Relationships:**
- Belongs to `sponsor`
- Belongs to `pi` (faculty)
- Belongs to `department`

**Indexes:**
- `sponsorId` - For filtering by sponsor
- `piId` - For filtering by PI
- `departmentId` - For filtering by department
- `status` - For filtering by status
- `submittedAt` - For date range queries
- `awardedAt` - For date range queries

**Status Values:**
- `draft` - Draft grant
- `submitted` - Submitted for review
- `under_review` - Under review
- `awarded` - Awarded
- `declined` - Declined/rejected

## Relationships Diagram

```
Department
  ├── faculty (1:N)
  └── grants (1:N)

Faculty
  ├── department (N:1)
  └── grants (1:N as PI)

Sponsor
  └── grants (1:N)

Grant
  ├── sponsor (N:1)
  ├── pi (N:1)
  └── department (N:1)
```

## Data Types

### Grant Status
- `draft`
- `submitted`
- `under_review`
- `awarded`
- `declined`

### Sponsor Type
- `federal`
- `state`
- `foundation`
- `corporate`
- `other`

## Indexes Summary

All foreign keys are indexed for join performance. Additional indexes:

- `departments.name` - Unique lookup
- `faculty.email` - Unique lookup
- `faculty.departmentId` - Department filtering
- `sponsors.name` - Search
- `sponsors.sponsorType` - Type filtering
- `grants.status` - Status filtering
- `grants.submittedAt` - Date range queries
- `grants.awardedAt` - Date range queries

## Migrations

Migrations are managed by Prisma. To create a new migration:

```bash
pnpm --filter api db:migrate
```

Migration files are stored in `apps/api/prisma/migrations/`.

## Seed Data

Seed script is located at `apps/api/prisma/seed.ts`. Run with:

```bash
pnpm db:seed
```

Seed data includes:
- 4 departments (Engineering, Medicine, Biology, Chemistry)
- 5 faculty members
- 4 sponsors (NSF, NIH, Gates Foundation, State Research Council)
- 6 sample grants

## Data Invariants Enforced

The database schema and application logic enforce the following data correctness guarantees:

### Referential Integrity
- **Foreign Key Constraints**: All foreign keys (`departmentId`, `piId`, `sponsorId`) use `onDelete: Restrict`, preventing orphaned records
- **Cascade Protection**: Deleting a department/faculty/sponsor is blocked if grants reference them

### Uniqueness Constraints
- **Department Names**: Must be unique (prevents duplicates)
- **Faculty Emails**: Must be unique (one email per faculty member)
- **Sponsor Identity**: Unique on `(name, sponsorType)` (allows same name with different types)

### Data Validity
- **Grant Status**: Enforced via Zod schemas in application layer (draft, submitted, under_review, awarded, declined)
- **Date Consistency**: Application logic validates `awardedAt >= submittedAt` for awarded grants
- **Amount Non-Negative**: Decimal type with application-level validation ensures positive amounts

### Temporal Consistency
- **12-Month Windows**: Metrics calculations use consistent 12-month rolling windows from current date
- **Date Filtering**: All date-based queries filter on `submittedAt` or `awardedAt` with proper NULL handling

### SQL Query Correctness
- **Median Calculation**: Uses `PERCENTILE_CONT(0.5)` for accurate median computation in database
- **Ranking**: Uses `RANK() OVER` window function for correct handling of ties
- **Aggregation**: `COALESCE(SUM(...), 0)` ensures faculty with no awards show 0, not NULL
- **Division by Zero**: Award rate calculation includes protection against division by zero

### Data Completeness
- **Required Fields**: All foreign keys and essential fields are non-nullable
- **Optional Dates**: `submittedAt` and `awardedAt` are nullable to support draft grants
- **Default Timestamps**: `createdAt` and `updatedAt` are automatically managed

