// Shared TypeScript types

export type GrantStatus = 'draft' | 'submitted' | 'under_review' | 'awarded' | 'declined';

export type SponsorType = 'federal' | 'state' | 'foundation' | 'corporate' | 'other';

export interface Department {
  id: number;
  name: string;
}

export interface Faculty {
  id: number;
  name: string;
  email: string;
  departmentId: number;
}

export interface Sponsor {
  id: number;
  name: string;
  sponsorType: SponsorType;
}

export interface Grant {
  id: number;
  title: string;
  sponsorId: number;
  piId: number;
  departmentId: number;
  amount: number;
  status: GrantStatus;
  submittedAt: Date | null;
  awardedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GrantWithRelations extends Grant {
  sponsor?: Sponsor;
  pi?: Faculty;
  department?: Department;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MetricsSummary {
  totalSubmissions: number;
  totalAwardedAmount: number;
  awardRate: number;
  medianTimeToAward: number | null;
}

export interface FacultyLeaderboardEntry {
  facultyId: number;
  facultyName: string;
  departmentName: string;
  totalAwarded: number;
  rank: number;
}

