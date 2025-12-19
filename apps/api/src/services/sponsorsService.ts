import { prisma } from '../db/client.js';
import { DatabaseError } from '@uf-research-metrics-platform/shared';

export async function getAllSponsors() {
  try {
    const sponsors = await prisma.sponsor.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    return sponsors.map((sponsor) => ({
      id: sponsor.id,
      name: sponsor.name,
      sponsorType: sponsor.sponsorType,
    }));
  } catch (error) {
    throw new DatabaseError('Failed to fetch sponsors', error);
  }
}

