import { prisma } from '../db/client.js';
import { DatabaseError } from '@uf-research-metrics-platform/shared';

export async function getAllDepartments() {
  try {
    const departments = await prisma.department.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    return departments.map((dept) => ({
      id: dept.id,
      name: dept.name,
    }));
  } catch (error) {
    throw new DatabaseError('Failed to fetch departments', error);
  }
}

