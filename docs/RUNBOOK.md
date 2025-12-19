# Runbook - Operations Guide

## Common Operations

### Starting the Application

#### Docker (Recommended)
```bash
docker compose up
```

#### Non-Docker
```bash
# Terminal 1: Start API
pnpm --filter api dev

# Terminal 2: Start Web
pnpm --filter web dev
```

### Database Operations

#### Reset Database
```bash
# Docker
docker compose exec api pnpm --filter api exec prisma migrate reset

# Non-Docker
pnpm --filter api exec prisma migrate reset
```

#### Run Migrations
```bash
# Docker
docker compose exec api pnpm --filter api db:migrate

# Non-Docker
pnpm db:migrate
```

#### Seed Database
```bash
# Docker
docker compose exec api pnpm --filter api db:seed

# Non-Docker
pnpm db:seed
```

#### Open Prisma Studio
```bash
# Docker
docker compose exec api pnpm --filter api db:studio

# Non-Docker
pnpm db:studio
```

### Viewing Logs

#### Docker
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
docker compose logs -f web
docker compose logs -f postgres
```

#### Non-Docker
Logs are printed to the console where services are running.

## Troubleshooting

### Database Connection Issues

**Problem**: API can't connect to database

**Solutions**:
1. Check `DATABASE_URL` in `.env` file
2. Verify PostgreSQL is running:
   ```bash
   # Docker
   docker compose ps postgres
   
   # Non-Docker
   psql -U postgres -c "SELECT 1"
   ```
3. Check database credentials match
4. Ensure database exists:
   ```bash
   createdb uf_research_metrics
   ```

### Port Already in Use

**Problem**: Port 3000, 3001, or 5432 already in use

**Solutions**:
1. Find process using port:
   ```bash
   lsof -i :3001  # macOS/Linux
   netstat -ano | findstr :3001  # Windows
   ```
2. Kill the process or change port in `.env`/`docker-compose.yml`

### Prisma Client Not Generated

**Problem**: `PrismaClient` import errors

**Solution**:
```bash
pnpm --filter api exec prisma generate
```

### Migration Issues

**Problem**: Migration fails or database is out of sync

**Solutions**:
1. Check migration status:
   ```bash
   pnpm --filter api exec prisma migrate status
   ```
2. Reset and re-run migrations:
   ```bash
   pnpm --filter api exec prisma migrate reset
   pnpm --filter api exec prisma migrate dev
   ```

### Docker Issues

**Problem**: Containers won't start

**Solutions**:
1. Check Docker is running:
   ```bash
   docker ps
   ```
2. Rebuild containers:
   ```bash
   docker compose down
   docker compose build --no-cache
   docker compose up
   ```
3. Check logs:
   ```bash
   docker compose logs
   ```

### API Not Responding

**Problem**: API returns 503 or connection refused

**Solutions**:
1. Check API is running:
   ```bash
   curl http://localhost:3001/api/health
   ```
2. Check database connection (see Database Connection Issues)
3. Check API logs for errors
4. Verify `API_PORT` in environment matches request

### Web App Not Loading

**Problem**: Web app shows blank page or errors

**Solutions**:
1. Check browser console for errors
2. Verify `VITE_API_URL` matches API server URL
3. Check web server is running:
   ```bash
   curl http://localhost:3000
   ```
4. Clear browser cache

### CSV Ingestion Fails

**Problem**: CSV upload returns errors

**Solutions**:
1. Verify CSV format matches expected schema
2. Check CSV has header row
3. Validate required fields are present
4. Check API logs for specific validation errors
5. Ensure dates are in valid format (YYYY-MM-DD)

## Environment Variables

### Required Variables

**API**:
- `DATABASE_URL` - PostgreSQL connection string
- `API_PORT` - Port for API server (default: 3001)
- `NODE_ENV` - Environment (development/production)

**Web**:
- `VITE_API_URL` - API server URL (default: http://localhost:3001)

**Database** (Docker):
- `POSTGRES_USER` - Database user (default: postgres)
- `POSTGRES_PASSWORD` - Database password (default: postgres)
- `POSTGRES_DB` - Database name (default: uf_research_metrics)

### Setting Up Environment

1. Copy example file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your values (see `.env.example` for detailed comments)

3. For Docker, environment variables are auto-configured via docker-compose.yml
   You can override defaults by setting them in your shell or `.env` file

## Performance Tuning

### Database Performance

1. **Check slow queries**: Enable query logging in Prisma
2. **Add indexes**: Review query patterns and add indexes as needed
3. **Connection pooling**: Configure Prisma connection pool size

### API Performance

1. **Enable caching**: Consider Redis for frequently accessed data
2. **Optimize queries**: Review N+1 query patterns
3. **Add pagination**: Ensure all list endpoints use pagination

## Backup and Recovery

### Database Backup

```bash
# Docker
docker compose exec postgres pg_dump -U postgres uf_research_metrics > backup.sql

# Non-Docker
pg_dump -U postgres uf_research_metrics > backup.sql
```

### Database Restore

```bash
# Docker
docker compose exec -T postgres psql -U postgres uf_research_metrics < backup.sql

# Non-Docker
psql -U postgres uf_research_metrics < backup.sql
```

## Monitoring

### Health Checks

- API: `GET /api/health`
- Database: Check via Prisma Studio or `psql`

### Logs

Monitor application logs for:
- Error rates
- Slow queries
- Failed requests
- Database connection issues

## Common Commands Reference

```bash
# Development
pnpm dev                    # Start all services
pnpm --filter api dev      # Start API only
pnpm --filter web dev      # Start web only

# Database
pnpm db:migrate            # Run migrations
pnpm db:seed               # Seed database
pnpm db:studio             # Open Prisma Studio

# Testing
pnpm test                  # Run all tests
pnpm --filter api test    # Run API tests

# Docker
docker compose up          # Start all services
docker compose down        # Stop all services
docker compose logs -f     # View logs
docker compose exec api <command>  # Run command in API container

# Building
pnpm build                 # Build all apps
pnpm --filter api build   # Build API
pnpm --filter web build   # Build web
```

## Getting Help

1. Check logs for error messages
2. Review this runbook for common issues
3. Check GitHub Issues
4. Review architecture documentation
5. Contact development team

