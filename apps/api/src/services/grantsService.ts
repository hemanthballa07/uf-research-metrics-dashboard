import { prisma } from '@uf-research-metrics-platform/db';
import { GrantStatus } from '@prisma/client';
import type { GrantWithRelations, PaginatedResponse } from '@uf-research-metrics-platform/shared';
import { DatabaseError } from '@uf-research-metrics-platform/shared';
import { buildGrantSearchOr } from './grantSearch.js';

export interface GrantsQueryParams {
  department?: number;
  sponsor?: number;
  status?: GrantStatus;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
  page: number;
  pageSize: number;
  /** When set, overrides any client-supplied department filter (VIEWER dept scoping). */
  scopedDepartmentId?: number;
}

export async function getGrants(
  params: GrantsQueryParams
): Promise<PaginatedResponse<GrantWithRelations>> {
  try {
    const { department, sponsor, status, dateFrom, dateTo, search, page, pageSize, scopedDepartmentId } = params;
    const skip = (page - 1) * pageSize;

    // Build where clause
    const where: Record<string, unknown> = {};

    // scopedDepartmentId takes precedence over the client-supplied department param.
    const effectiveDepartment = scopedDepartmentId ?? department;
    if (effectiveDepartment) {
      where.departmentId = effectiveDepartment;
    }

    if (sponsor) {
      where.sponsorId = sponsor;
    }

    if (status) {
      where.status = status;
    }

    if (dateFrom || dateTo) {
      where.submittedAt = {};
      const submittedAtArgs = where.submittedAt as Record<string, Date>;
      if (dateFrom) {
        submittedAtArgs.gte = dateFrom;
      }
      if (dateTo) {
        submittedAtArgs.lte = dateTo;
      }
    }

    if (search) {
      // Resolve PI matches to a literal `piId IN (...)` so the grants_title_trgm
      // index is usable (a `pi: { name }` relation filter forces a seq scan). See
      // grantSearch.ts / migration 20260609000000_add_grant_search_trigram.
      where.OR = await buildGrantSearchOr(search);
    }

    // Get total count
    const total = await prisma.grant.count({ where });

    // Get grants with relations
    const grants = await prisma.grant.findMany({
      where,
      include: {
        sponsor: true,
        pi: {
          include: {
            department: true,
          },
        },
        department: true,
      },
      orderBy: {
        submittedAt: 'desc',
      },
      skip,
      take: pageSize,
    });

    // Transform to match GrantWithRelations type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: GrantWithRelations[] = grants.map((grant: any) => ({
      id: grant.id,
      title: grant.title,
      sponsorId: grant.sponsorId,
      piId: grant.piId,
      departmentId: grant.departmentId,
      amount: Number(grant.amount),
      status: grant.status as GrantWithRelations['status'],
      submittedAt: grant.submittedAt,
      awardedAt: grant.awardedAt,
      endAt: grant.endAt ?? null,
      createdAt: grant.createdAt,
      updatedAt: grant.updatedAt,
      sponsor: grant.sponsor
        ? {
          id: grant.sponsor.id,
          name: grant.sponsor.name,
          sponsorType: grant.sponsor.sponsorType as NonNullable<GrantWithRelations['sponsor']>['sponsorType'],
        }
        : undefined,
      pi: grant.pi
        ? {
          id: grant.pi.id,
          name: grant.pi.name,
          email: grant.pi.email,
          departmentId: grant.pi.departmentId,
        }
        : undefined,
      department: grant.department
        ? {
          id: grant.department.id,
          name: grant.department.name,
        }
        : undefined,
    }));

    return {
      items,
      total,
      page,
      pageSize,
    };
  } catch (error) {
    throw new DatabaseError('Failed to fetch grants', error);
  }
}

export async function getGrantById(id: number): Promise<GrantWithRelations> {
  try {
    const grant = await prisma.grant.findUnique({
      where: { id },
      include: {
        sponsor: true,
        pi: {
          include: {
            department: true,
          },
        },
        department: true,
      },
    });

    if (!grant) {
      throw new Error('Grant not found');
    }

    return {
      id: grant.id,
      title: grant.title,
      sponsorId: grant.sponsorId,
      piId: grant.piId,
      departmentId: grant.departmentId,
      amount: Number(grant.amount),
      status: grant.status as GrantWithRelations['status'],
      submittedAt: grant.submittedAt,
      awardedAt: grant.awardedAt,
      endAt: grant.endAt ?? null,
      createdAt: grant.createdAt,
      updatedAt: grant.updatedAt,
      sponsor: grant.sponsor
        ? {
          id: grant.sponsor.id,
          name: grant.sponsor.name,
          sponsorType: grant.sponsor.sponsorType as NonNullable<GrantWithRelations['sponsor']>['sponsorType'],
        }
        : undefined,
      pi: grant.pi
        ? {
          id: grant.pi.id,
          name: grant.pi.name,
          email: grant.pi.email,
          departmentId: grant.pi.departmentId,
        }
        : undefined,
      department: grant.department
        ? {
          id: grant.department.id,
          name: grant.department.name,
        }
        : undefined,
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'Grant not found') {
      throw error;
    }
    throw new DatabaseError('Failed to fetch grant', error);
  }
}

