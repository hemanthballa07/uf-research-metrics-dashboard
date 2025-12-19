# Talking Points

## 30-Second Elevator Pitch

The UF Research Metrics Platform is an internal analytics dashboard that gives the University Office of Research real-time visibility into grant activity, faculty productivity, and institutional research metrics. It tracks grant submissions, award rates, and faculty performance rankings, enabling data-driven decision making for research administration. The platform centralizes grant data across departments and sponsors, supports CSV bulk imports, and provides export capabilities for reporting.

## 90-Second Technical Explanation

Built as a TypeScript monorepo with Express.js backend and React frontend, the platform uses PostgreSQL with Prisma ORM for schema management and type safety. For complex analytics requiring window functions—like faculty rankings and median time-to-award calculations—we use raw SQL queries (`RANK() OVER`, `PERCENTILE_CONT`) to ensure correctness and performance.

The architecture follows clean separation: routes handle HTTP, controllers validate requests, services contain business logic, and Prisma manages database access. CSV ingestion accepts text/plain content with custom parsing to handle complex CSV structures, validates with Zod schemas, and provides detailed error reports. Docker Compose enables consistent local development, and GitHub Actions CI ensures code quality through automated linting, type checking, and testing.

## Hardest Technical Challenge: SQL Analytics Correctness

The most challenging aspect was ensuring SQL analytics queries produce correct, consistent results. Specifically:

**Median Time-to-Award Calculation:** Using `PERCENTILE_CONT(0.5)` in PostgreSQL to compute the median efficiently in the database, rather than fetching all rows and calculating in application code. This required understanding PostgreSQL's window function syntax and ensuring proper date filtering.

**Faculty Leaderboard Ranking:** Implementing `RANK() OVER` window function to correctly handle ties (faculty with identical award amounts get the same rank, with next rank skipping appropriately). The query uses CTEs to aggregate totals before ranking, ensuring performance and clarity.

**NULL Handling:** Ensuring faculty with no awards still appear in leaderboards with zero totals using `COALESCE(SUM(...), 0)` and `LEFT JOIN` patterns. This required careful SQL design to avoid excluding faculty members who haven't received grants yet.

**Data Integrity:** Enforcing referential integrity through foreign key constraints (`onDelete: Restrict`) and uniqueness constraints, while ensuring application-level validation complements database constraints for comprehensive data correctness.

## Extension Ideas for Real UF Office of Research Setting

**Integration with External Systems:**
- Connect to UF's existing grant management systems (e.g., UF Research Foundation systems) via APIs
- Automated daily sync jobs to keep data current without manual CSV uploads
- Integration with UF's faculty directory system for automatic faculty/department updates

**Enhanced Analytics:**
- Department-level performance dashboards with trend analysis
- Sponsor-specific metrics (success rates by sponsor type, average award amounts)
- Time-series visualizations showing grant activity over multiple years
- Predictive analytics for grant success probability based on historical patterns

**Workflow Features:**
- Grant lifecycle tracking with status transitions and notifications
- Document management for grant proposals and award letters
- Approval workflows for grant submissions
- Email notifications for grant status changes

**Reporting & Compliance:**
- Automated report generation (monthly, quarterly, annual summaries)
- Export to formats required by UF administration (Excel, PDF)
- Custom report builder for ad-hoc queries
- Audit trail for data changes

**User Management:**
- Role-based access control (department admins, research administrators, read-only viewers)
- Department-specific views showing only relevant grants
- User activity logging for compliance

**Performance Optimization:**
- Caching layer (Redis) for frequently accessed metrics
- Materialized views for complex aggregations
- Background job processing for CSV ingestion and report generation
- Database query optimization and indexing strategy review

