import { prisma } from '../db/client.js';
import type { GrantWithRelations, PaginatedResponse } from '@uf-research-metrics-platform/shared';
import { DatabaseError } from '@uf-research-metrics-platform/shared';

export interface GrantsQueryParams {
  department?: number;
  sponsor?: number;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
  page: number;
  pageSize: number;
}

export async function getGrants(
  params: GrantsQueryParams
): Promise<PaginatedResponse<GrantWithRelations>> {
  try {
    const { department, sponsor, status, dateFrom, dateTo, search, page, pageSize } = params;
    const skip = (page - 1) * pageSize;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (department) {
      where.departmentId = department;
    }

    if (sponsor) {
      where.sponsorId = sponsor;
    }

    if (status) {
      where.status = status;
    }

    if (dateFrom || dateTo) {
      where.submittedAt = {};
      if (dateFrom) {
        where.submittedAt.gte = dateFrom;
      }
      if (dateTo) {
        where.submittedAt.lte = dateTo;
      }
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        {
          pi: {
            name: { contains: search, mode: 'insensitive' },
          },
        },
      ];
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
    const items: GrantWithRelations[] = grants.map((grant) => ({
      id: grant.id,
      title: grant.title,
      sponsorId: grant.sponsorId,
      piId: grant.piId,
      departmentId: grant.departmentId,
      amount: Number(grant.amount),
      status: grant.status as GrantWithRelations['status'],
      submittedAt: grant.submittedAt,
      awardedAt: grant.awardedAt,
      createdAt: grant.createdAt,
      updatedAt: grant.updatedAt,
      sponsor: grant.sponsor
        ? {
            id: grant.sponsor.id,
            name: grant.sponsor.name,
            sponsorType: grant.sponsor.sponsorType as GrantWithRelations['sponsor']['sponsorType'],
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
      createdAt: grant.createdAt,
      updatedAt: grant.updatedAt,
      sponsor: grant.sponsor
        ? {
            id: grant.sponsor.id,
            name: grant.sponsor.name,
            sponsorType: grant.sponsor.sponsorType as GrantWithRelations['sponsor']['sponsorType'],
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

