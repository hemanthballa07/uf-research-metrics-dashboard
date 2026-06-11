import { prisma } from '@uf-research-metrics-platform/db';
import { GrantStatus } from '@prisma/client';
import { DatabaseError } from '@uf-research-metrics-platform/shared';
import { buildGrantSearchOr } from './grantSearch.js';

export interface ExportParams {
  department?: number;
  sponsor?: number;
  status?: GrantStatus;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}

function escapeCSVCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowToCSV(cells: unknown[]): string {
  return cells.map(escapeCSVCell).join(',');
}

const CSV_HEADERS = [
  'id', 'title', 'status', 'amount',
  'pi_name', 'pi_email',
  'department', 'sponsor', 'sponsor_type',
  'submitted_at', 'awarded_at',
];

async function queryGrants(params: ExportParams) {
  const where: Record<string, unknown> = {};

  if (params.department) where.departmentId = params.department;
  if (params.sponsor) where.sponsorId = params.sponsor;
  if (params.status) where.status = params.status;

  if (params.dateFrom || params.dateTo) {
    const submittedAt: Record<string, Date> = {};
    if (params.dateFrom) submittedAt.gte = params.dateFrom;
    if (params.dateTo) submittedAt.lte = params.dateTo;
    where.submittedAt = submittedAt;
  }

  if (params.search) {
    // Index-friendly search (resolve PI matches to literal piId IN) — see grantSearch.ts.
    where.OR = await buildGrantSearchOr(params.search);
  }

  return prisma.grant.findMany({
    where,
    include: { sponsor: true, pi: true, department: true },
    orderBy: { submittedAt: 'desc' },
  });
}

export async function exportGrantsJSON(params: ExportParams) {
  try {
    const grants = await queryGrants(params);
    return grants.map((g) => ({
      id: g.id,
      title: g.title,
      status: g.status,
      amount: Number(g.amount),
      pi: { name: g.pi.name, email: g.pi.email },
      department: g.department.name,
      sponsor: { name: g.sponsor.name, type: g.sponsor.sponsorType },
      submittedAt: g.submittedAt?.toISOString() ?? null,
      awardedAt: g.awardedAt?.toISOString() ?? null,
    }));
  } catch (error) {
    throw new DatabaseError('Failed to export grants', error);
  }
}

export async function exportGrantsCSV(params: ExportParams): Promise<string> {
  try {
    const grants = await queryGrants(params);

    const lines: string[] = [rowToCSV(CSV_HEADERS)];

    for (const g of grants) {
      lines.push(rowToCSV([
        g.id,
        g.title,
        g.status,
        Number(g.amount),
        g.pi.name,
        g.pi.email,
        g.department.name,
        g.sponsor.name,
        g.sponsor.sponsorType,
        g.submittedAt?.toISOString() ?? '',
        g.awardedAt?.toISOString() ?? '',
      ]));
    }

    return lines.join('\n');
  } catch (error) {
    throw new DatabaseError('Failed to export grants', error);
  }
}
