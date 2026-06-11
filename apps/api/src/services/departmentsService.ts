import { prisma } from '@uf-research-metrics-platform/db';
import { DatabaseError } from '@uf-research-metrics-platform/shared';

export async function getAllDepartments() {
  try {
    const departments = await prisma.department.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return departments.map((dept: any) => ({
      id: dept.id,
      name: dept.name,
    }));
  } catch (error) {
    throw new DatabaseError('Failed to fetch departments', error);
  }
}

