import { prisma } from '../db/client.js';
import { csvGrantRowSchema } from '@uf-research-metrics-platform/shared';
import { DatabaseError, ValidationError } from '@uf-research-metrics-platform/shared';

export interface IngestionReport {
  totalRows: number;
  inserted: number;
  updated: number;
  errors: Array<{
    row: number;
    error: string;
    data?: Record<string, unknown>;
  }>;
}

interface ParsedCSVRow {
  title: string;
  sponsor_name: string;
  sponsor_type: string;
  pi_name: string;
  pi_email: string;
  department_name: string;
  amount: number;
  status: string;
  submitted_at: Date | null;
  awarded_at: Date | null;
}

function parseCSV(csvText: string): string[][] {
  const lines: string[] = [];
  let currentLine = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentLine += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      lines[lines.length - 1] = lines[lines.length - 1] || [];
      lines[lines.length - 1].push(currentLine.trim());
      currentLine = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (currentLine.trim() || lines.length === 0) {
        lines[lines.length - 1] = lines[lines.length - 1] || [];
        lines[lines.length - 1].push(currentLine.trim());
        currentLine = '';
        lines.push([]);
      }
      if (char === '\r' && nextChar === '\n') {
        i++; // Skip \n after \r
      }
    } else {
      currentLine += char;
    }
  }

  // Add last line
  if (currentLine.trim() || lines.length > 0) {
    lines[lines.length - 1] = lines[lines.length - 1] || [];
    lines[lines.length - 1].push(currentLine.trim());
  }

  // Filter out empty lines
  return lines.filter((line) => line.some((cell) => cell.trim() !== ''));
}

function csvRowsToObjects(rows: string[][]): Array<Record<string, string>> {
  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const dataRows = rows.slice(1);

  return dataRows.map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, index) => {
      obj[header] = row[index]?.trim() || '';
    });
    return obj;
  });
}

export async function ingestGrantsFromCSV(csvText: string): Promise<IngestionReport> {
  try {
    const report: IngestionReport = {
      totalRows: 0,
      inserted: 0,
      updated: 0,
      errors: [],
    };

    // Parse CSV
    const rows = parseCSV(csvText);
    if (rows.length === 0) {
      throw new ValidationError('CSV file is empty');
    }

    const csvObjects = csvRowsToObjects(rows);
    report.totalRows = csvObjects.length;

    // Process each row
    for (let i = 0; i < csvObjects.length; i++) {
      const row = csvObjects[i];
      const rowNumber = i + 2; // +2 because row 1 is header, and arrays are 0-indexed

      try {
        // Validate with Zod schema
        const validationResult = csvGrantRowSchema.safeParse(row);

        if (!validationResult.success) {
          const errorMessages = validationResult.error.errors
            .map((err) => `${err.path.join('.')}: ${err.message}`)
            .join('; ');
          report.errors.push({
            row: rowNumber,
            error: errorMessages,
            data: row,
          });
          continue;
        }

        const validated = validationResult.data;

        // Upsert department
        const department = await prisma.department.upsert({
          where: { name: validated.department_name },
          update: {},
          create: { name: validated.department_name },
        });

        // Upsert faculty
        const faculty = await prisma.faculty.upsert({
          where: { email: validated.pi_email },
          update: {
            name: validated.pi_name,
            departmentId: department.id,
          },
          create: {
            name: validated.pi_name,
            email: validated.pi_email,
            departmentId: department.id,
          },
        });

        // Upsert sponsor
        const sponsor = await prisma.sponsor.upsert({
          where: {
            name_sponsorType: {
              name: validated.sponsor_name,
              sponsorType: validated.sponsor_type,
            },
          },
          update: {},
          create: {
            name: validated.sponsor_name,
            sponsorType: validated.sponsor_type,
          },
        });

        // Upsert grant (match by title and PI to determine if update or insert)
        const existingGrant = await prisma.grant.findFirst({
          where: {
            title: validated.title,
            piId: faculty.id,
          },
        });

        if (existingGrant) {
          // Update existing grant
          await prisma.grant.update({
            where: { id: existingGrant.id },
            data: {
              sponsorId: sponsor.id,
              departmentId: department.id,
              amount: validated.amount,
              status: validated.status,
              submittedAt: validated.submitted_at || null,
              awardedAt: validated.awarded_at || null,
            },
          });
          report.updated++;
        } else {
          // Insert new grant
          await prisma.grant.create({
            data: {
              title: validated.title,
              sponsorId: sponsor.id,
              piId: faculty.id,
              departmentId: department.id,
              amount: validated.amount,
              status: validated.status,
              submittedAt: validated.submitted_at || null,
              awardedAt: validated.awarded_at || null,
            },
          });
          report.inserted++;
        }
      } catch (error) {
        report.errors.push({
          row: rowNumber,
          error: error instanceof Error ? error.message : 'Unknown error',
          data: row,
        });
      }
    }

    return report;
  } catch (error) {
    throw new DatabaseError('Failed to ingest grants from CSV', error);
  }
}

