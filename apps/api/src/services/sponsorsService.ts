import { prisma } from '@uf-research-metrics-platform/db';
import { DatabaseError } from '@uf-research-metrics-platform/shared';

export async function getAllSponsors() {
  try {
    const sponsors = await prisma.sponsor.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return sponsors.map((sponsor: any) => ({
      id: sponsor.id,
      name: sponsor.name,
      sponsorType: sponsor.sponsorType,
    }));
  } catch (error) {
    throw new DatabaseError('Failed to fetch sponsors', error);
  }
}

