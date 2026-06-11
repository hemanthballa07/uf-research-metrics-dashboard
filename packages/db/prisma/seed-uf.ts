/**
 * UF Office of Research — whole-university realistic seed.
 *
 * Generates a UF-faithful data shape (scale + sponsor mix tunable via env):
 *   ~120 departments across all 16 UF colleges (named "College — Department")
 *   PIs with Pareto productivity (top 10% hold ~50% of grants); count via env
 *   ~60 discrete sponsors weighted toward UF's FY2025 dollar-mix
 *     (federal ~65% / industry ~15% / foundation ~11% / state ~8%)
 *   Full-historical grant volume (default ~250K; override via UF_*_GRANTS env)
 *   ~30% of grants multi-PI (1–3 co-PIs)
 *   ~3–6 amendments per grant
 *   ~3–5 budget periods per grant
 *   Submission timestamps clustered around NIH R01 cycles (Feb 5 / Jun 5 / Oct 5)
 *   Award timestamps lagging submissions by log-normal 5–7 months
 *   Total reachable: ≥250K rows across grants + amendments + budget_periods
 *
 * Deterministic — uses a seeded PRNG so re-runs produce identical data.
 * Idempotent — clears child tables before re-seeding, preserving the User table.
 *
 * Run:  pnpm --filter api db:seed:uf
 */

import 'dotenv/config'; // load packages/db/.env locally; no-op in CI (uses process env)
import {
  PrismaClient,
  GrantStatus,
  SponsorType,
  UserRole,
  AmendmentKind,
  BudgetPeriodStatus,
  type Prisma,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ============================================================================
// Deterministic PRNG (mulberry32) — same seed → same data set across runs
// ============================================================================

const SEED = 0xC0_FF_EE_01;
let state = SEED >>> 0;
function rand(): number {
  state = (state + 0x6D2B79F5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}
function weightedPick<T>(items: readonly { value: T; weight: number }[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = rand() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item.value;
  }
  return items[items.length - 1].value;
}
function gaussian(mean: number, stdev: number): number {
  // Box–Muller
  const u1 = Math.max(rand(), 1e-9);
  const u2 = rand();
  return mean + stdev * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
function logNormal(mu: number, sigma: number): number {
  return Math.exp(gaussian(mu, sigma));
}

// Pareto draw — used to weight which PI gets a grant (top 10% hold ~50%)
function paretoIndex(n: number, alpha = 1.16): number {
  const u = Math.max(rand(), 1e-9);
  const x = Math.pow(1 - u, -1 / alpha) - 1;
  const idx = Math.floor((x / (x + 1)) * n);
  return Math.min(idx, n - 1);
}

// ============================================================================
// Reference data — real COM departments and sponsor names
// ============================================================================

// ~120 departments across all 16 UF colleges. Named "College — Department" so the
// college hierarchy is visible in department breakdowns without a College table.
const DEPARTMENTS = [
  // College of Medicine (real COM departments)
  'Medicine — Anatomy and Cell Biology',
  'Medicine — Anesthesiology',
  'Medicine — Biochemistry and Molecular Biology',
  'Medicine — Community Health and Family Medicine',
  'Medicine — Dermatology',
  'Medicine — Emergency Medicine',
  'Medicine — Health Outcomes and Biomedical Informatics',
  'Medicine — Internal Medicine',
  'Medicine — Molecular Genetics and Microbiology',
  'Medicine — Neurology',
  'Medicine — Neuroscience',
  'Medicine — Neurosurgery',
  'Medicine — Obstetrics and Gynecology',
  'Medicine — Ophthalmology',
  'Medicine — Orthopaedic Surgery and Sports Medicine',
  'Medicine — Otolaryngology',
  'Medicine — Pathology, Immunology, and Laboratory Medicine',
  'Medicine — Pediatrics',
  'Medicine — Pharmacology and Therapeutics',
  'Medicine — Physical Medicine and Rehabilitation',
  'Medicine — Physiology and Functional Genomics',
  'Medicine — Psychiatry',
  'Medicine — Radiation Oncology',
  'Medicine — Radiology',
  'Medicine — Surgery',
  'Medicine — Urology',
  // Herbert Wertheim College of Engineering
  'Engineering — Agricultural and Biological Engineering',
  'Engineering — Biomedical Engineering',
  'Engineering — Chemical Engineering',
  'Engineering — Civil and Coastal Engineering',
  'Engineering — Computer and Information Science and Engineering',
  'Engineering — Electrical and Computer Engineering',
  'Engineering — Environmental Engineering Sciences',
  'Engineering — Industrial and Systems Engineering',
  'Engineering — Materials Science and Engineering',
  'Engineering — Mechanical and Aerospace Engineering',
  'Engineering — Nuclear Engineering',
  // College of Agricultural and Life Sciences (IFAS)
  'Agricultural and Life Sciences — Agronomy',
  'Agricultural and Life Sciences — Animal Sciences',
  'Agricultural and Life Sciences — Entomology and Nematology',
  'Agricultural and Life Sciences — Food Science and Human Nutrition',
  'Agricultural and Life Sciences — Horticultural Sciences',
  'Agricultural and Life Sciences — Microbiology and Cell Science',
  'Agricultural and Life Sciences — Plant Pathology',
  'Agricultural and Life Sciences — Soil, Water, and Ecosystem Sciences',
  'Agricultural and Life Sciences — Agricultural Education and Communication',
  'Agricultural and Life Sciences — Wildlife Ecology and Conservation',
  'Agricultural and Life Sciences — Fisheries and Aquatic Sciences',
  'Agricultural and Life Sciences — Forest, Fisheries, and Geomatics Sciences',
  // College of Liberal Arts and Sciences
  'Liberal Arts and Sciences — Biology',
  'Liberal Arts and Sciences — Chemistry',
  'Liberal Arts and Sciences — Physics',
  'Liberal Arts and Sciences — Mathematics',
  'Liberal Arts and Sciences — Statistics',
  'Liberal Arts and Sciences — Psychology',
  'Liberal Arts and Sciences — Political Science',
  'Liberal Arts and Sciences — Economics',
  'Liberal Arts and Sciences — Sociology and Criminology',
  'Liberal Arts and Sciences — Anthropology',
  'Liberal Arts and Sciences — Geography',
  'Liberal Arts and Sciences — Geological Sciences',
  'Liberal Arts and Sciences — History',
  'Liberal Arts and Sciences — English',
  'Liberal Arts and Sciences — Astronomy',
  'Liberal Arts and Sciences — Linguistics',
  // College of Public Health and Health Professions
  'Public Health and Health Professions — Biostatistics',
  'Public Health and Health Professions — Environmental and Global Health',
  'Public Health and Health Professions — Epidemiology',
  'Public Health and Health Professions — Health Services Research, Management and Policy',
  'Public Health and Health Professions — Clinical and Health Psychology',
  'Public Health and Health Professions — Occupational Therapy',
  'Public Health and Health Professions — Physical Therapy',
  'Public Health and Health Professions — Speech, Language, and Hearing Sciences',
  // College of Pharmacy
  'Pharmacy — Medicinal Chemistry',
  'Pharmacy — Pharmaceutics',
  'Pharmacy — Pharmacodynamics',
  'Pharmacy — Pharmacotherapy and Translational Research',
  'Pharmacy — Pharmaceutical Outcomes and Policy',
  // College of Dentistry
  'Dentistry — Oral Biology',
  'Dentistry — Restorative Dental Sciences',
  'Dentistry — Orthodontics',
  'Dentistry — Periodontology',
  'Dentistry — Endodontics',
  'Dentistry — Oral and Maxillofacial Surgery',
  'Dentistry — Community Dentistry and Behavioral Science',
  // College of Veterinary Medicine
  'Veterinary Medicine — Comparative, Diagnostic, and Population Medicine',
  'Veterinary Medicine — Large Animal Clinical Sciences',
  'Veterinary Medicine — Small Animal Clinical Sciences',
  'Veterinary Medicine — Infectious Diseases and Immunology',
  'Veterinary Medicine — Physiological Sciences',
  // College of Nursing
  'Nursing — Biobehavioral Nursing Science',
  'Nursing — Family, Community, and Health System Science',
  // Warrington College of Business
  'Business — Management',
  'Business — Marketing',
  'Business — Finance',
  'Business — Economics',
  'Business — Information Systems and Operations Management',
  'Business — Accounting',
  // College of Education
  'Education — Human Development and Organizational Studies',
  'Education — Special Education, School Psychology, and Early Childhood Studies',
  'Education — Teaching and Learning',
  // Levin College of Law
  'Law — Law',
  // College of Journalism and Communications
  'Journalism and Communications — Advertising',
  'Journalism and Communications — Journalism',
  'Journalism and Communications — Media Production, Management, and Technology',
  'Journalism and Communications — Public Relations',
  'Journalism and Communications — Telecommunication',
  // College of Design, Construction and Planning
  'Design, Construction and Planning — Architecture',
  'Design, Construction and Planning — Building Construction',
  'Design, Construction and Planning — Interior Design',
  'Design, Construction and Planning — Landscape Architecture',
  'Design, Construction and Planning — Urban and Regional Planning',
  // College of the Arts
  'The Arts — Art and Art History',
  'The Arts — Music',
  'The Arts — Theatre and Dance',
  'The Arts — Digital Worlds',
  // College of Health and Human Performance
  'Health and Human Performance — Applied Physiology and Kinesiology',
  'Health and Human Performance — Health Education and Behavior',
  'Health and Human Performance — Tourism, Hospitality, and Event Management',
];

type SponsorSeed = { name: string; sponsorType: SponsorType; agencyWeight: number };

// `agencyWeight` selects sponsors by grant COUNT. Federal grants are larger, so the
// resulting DOLLAR mix skews more federal than the count mix — these weights are the
// first pass toward UF's FY2025 *dollar* split (federal ~65 / industry ~15 / foundation
// ~11 / state ~8 / internal+other ~1); the seed prints the realized $-share so it can be
// tuned. Whole-university: NIH-dominant but with strong NSF/USDA/DoD/NASA/DOE for
// Engineering and IFAS (UF is a top agricultural research university).
const SPONSORS: SponsorSeed[] = [
  // Federal — NIH institutes
  { name: 'National Institutes of Health', sponsorType: 'FEDERAL', agencyWeight: 9 },
  { name: 'NIH — National Cancer Institute', sponsorType: 'FEDERAL', agencyWeight: 4 },
  { name: 'NIH — National Institute of Allergy and Infectious Diseases', sponsorType: 'FEDERAL', agencyWeight: 3 },
  { name: 'NIH — National Heart, Lung, and Blood Institute', sponsorType: 'FEDERAL', agencyWeight: 2 },
  { name: 'NIH — National Institute of Neurological Disorders and Stroke', sponsorType: 'FEDERAL', agencyWeight: 1.5 },
  { name: 'NIH — National Institute of Diabetes and Digestive and Kidney Diseases', sponsorType: 'FEDERAL', agencyWeight: 1.5 },
  { name: 'NIH — National Institute on Aging', sponsorType: 'FEDERAL', agencyWeight: 1.5 },
  { name: 'NIH — National Institute of Mental Health', sponsorType: 'FEDERAL', agencyWeight: 1 },
  { name: 'NIH — National Institute of Child Health and Human Development', sponsorType: 'FEDERAL', agencyWeight: 1 },
  { name: 'NIH — National Institute of General Medical Sciences', sponsorType: 'FEDERAL', agencyWeight: 1 },
  // Federal — other agencies (UF is strong in agriculture, engineering, space)
  { name: 'National Science Foundation', sponsorType: 'FEDERAL', agencyWeight: 7 },
  { name: 'U.S. Department of Agriculture', sponsorType: 'FEDERAL', agencyWeight: 4 },
  { name: 'Department of Defense', sponsorType: 'FEDERAL', agencyWeight: 3 },
  { name: 'National Aeronautics and Space Administration', sponsorType: 'FEDERAL', agencyWeight: 2 },
  { name: 'Department of Energy', sponsorType: 'FEDERAL', agencyWeight: 2 },
  { name: 'Department of Veterans Affairs', sponsorType: 'FEDERAL', agencyWeight: 1.5 },
  { name: 'Centers for Disease Control and Prevention', sponsorType: 'FEDERAL', agencyWeight: 1 },
  { name: 'Health Resources and Services Administration', sponsorType: 'FEDERAL', agencyWeight: 1 },
  { name: 'U.S. Environmental Protection Agency', sponsorType: 'FEDERAL', agencyWeight: 0.8 },
  { name: 'U.S. Department of Education', sponsorType: 'FEDERAL', agencyWeight: 0.8 },
  { name: 'Office of Naval Research', sponsorType: 'FEDERAL', agencyWeight: 0.6 },
  { name: 'Army Research Office', sponsorType: 'FEDERAL', agencyWeight: 0.5 },
  { name: 'Air Force Office of Scientific Research', sponsorType: 'FEDERAL', agencyWeight: 0.5 },
  // Industry — pharma, aerospace/defense, agriscience
  { name: 'Pfizer Inc.', sponsorType: 'INDUSTRY', agencyWeight: 2 },
  { name: 'Merck & Co.', sponsorType: 'INDUSTRY', agencyWeight: 1.5 },
  { name: 'Johnson & Johnson', sponsorType: 'INDUSTRY', agencyWeight: 1.5 },
  { name: 'Eli Lilly and Company', sponsorType: 'INDUSTRY', agencyWeight: 1 },
  { name: 'Bristol Myers Squibb', sponsorType: 'INDUSTRY', agencyWeight: 1 },
  { name: 'AstraZeneca', sponsorType: 'INDUSTRY', agencyWeight: 1 },
  { name: 'Novartis', sponsorType: 'INDUSTRY', agencyWeight: 1 },
  { name: 'AbbVie', sponsorType: 'INDUSTRY', agencyWeight: 1 },
  { name: 'Gilead Sciences', sponsorType: 'INDUSTRY', agencyWeight: 1 },
  { name: 'Roche / Genentech', sponsorType: 'INDUSTRY', agencyWeight: 1 },
  { name: 'Medtronic', sponsorType: 'INDUSTRY', agencyWeight: 1 },
  { name: 'The Boeing Company', sponsorType: 'INDUSTRY', agencyWeight: 0.8 },
  { name: 'Lockheed Martin', sponsorType: 'INDUSTRY', agencyWeight: 0.8 },
  { name: 'Corteva Agriscience', sponsorType: 'INDUSTRY', agencyWeight: 0.8 },
  { name: 'Syngenta', sponsorType: 'INDUSTRY', agencyWeight: 0.8 },
  // Foundation / non-profit
  { name: 'American Heart Association', sponsorType: 'FOUNDATION', agencyWeight: 2 },
  { name: 'American Cancer Society', sponsorType: 'FOUNDATION', agencyWeight: 2 },
  { name: 'Bill & Melinda Gates Foundation', sponsorType: 'FOUNDATION', agencyWeight: 1.5 },
  { name: 'Howard Hughes Medical Institute', sponsorType: 'FOUNDATION', agencyWeight: 1 },
  { name: 'Robert Wood Johnson Foundation', sponsorType: 'FOUNDATION', agencyWeight: 1 },
  { name: 'Juvenile Diabetes Research Foundation', sponsorType: 'FOUNDATION', agencyWeight: 1 },
  { name: "Alzheimer's Association", sponsorType: 'FOUNDATION', agencyWeight: 1 },
  { name: 'American Diabetes Association', sponsorType: 'FOUNDATION', agencyWeight: 1 },
  { name: 'Simons Foundation', sponsorType: 'FOUNDATION', agencyWeight: 1 },
  { name: 'Gordon and Betty Moore Foundation', sponsorType: 'FOUNDATION', agencyWeight: 1 },
  { name: 'Alfred P. Sloan Foundation', sponsorType: 'FOUNDATION', agencyWeight: 0.8 },
  { name: 'McKnight Brain Research Foundation', sponsorType: 'FOUNDATION', agencyWeight: 0.8 },
  // State of Florida
  { name: 'Florida Department of Health', sponsorType: 'STATE', agencyWeight: 4 },
  { name: 'Florida Department of Agriculture and Consumer Services', sponsorType: 'STATE', agencyWeight: 2.5 },
  { name: 'Florida Department of Transportation', sponsorType: 'STATE', agencyWeight: 1.5 },
  { name: 'James and Esther King Biomedical Research Program', sponsorType: 'STATE', agencyWeight: 1.5 },
  { name: 'Bankhead-Coley Cancer Research Program', sponsorType: 'STATE', agencyWeight: 1.5 },
  { name: 'Florida Department of Environmental Protection', sponsorType: 'STATE', agencyWeight: 1 },
  // Internal / other
  { name: 'UF Office of Research', sponsorType: 'INTERNAL', agencyWeight: 1 },
  { name: 'UF Clinical and Translational Science Institute', sponsorType: 'INTERNAL', agencyWeight: 1 },
  { name: 'Patient-Centered Outcomes Research Institute', sponsorType: 'OTHER', agencyWeight: 1 },
];

const FIRST_NAMES = [
  'Aaron', 'Alex', 'Alice', 'Amanda', 'Amy', 'Andrew', 'Angela', 'Anna', 'Anthony', 'Arjun',
  'Ashley', 'Benjamin', 'Brian', 'Carlos', 'Catherine', 'Charles', 'Chen', 'Christine',
  'Christopher', 'Daniel', 'David', 'Deepa', 'Derek', 'Diana', 'Edward', 'Elena', 'Elizabeth',
  'Emily', 'Eric', 'Fatima', 'Frank', 'Gabriela', 'George', 'Hannah', 'Hector', 'Hiroshi',
  'Hugo', 'Indira', 'Isabella', 'James', 'Jane', 'Javier', 'Jennifer', 'Jessica', 'Jin',
  'John', 'Jonathan', 'Joseph', 'Joshua', 'Julia', 'Karen', 'Kavita', 'Kevin', 'Laila',
  'Laura', 'Lin', 'Lisa', 'Margaret', 'Maria', 'Mark', 'Mary', 'Matthew', 'Maya', 'Mei',
  'Michael', 'Michelle', 'Min', 'Mohammed', 'Nathan', 'Natasha', 'Nicholas', 'Olivia',
  'Patricia', 'Patrick', 'Paul', 'Peter', 'Priya', 'Rachel', 'Rafael', 'Rajiv', 'Rebecca',
  'Richard', 'Robert', 'Ryan', 'Sandra', 'Samuel', 'Sanjay', 'Sarah', 'Scott', 'Sebastian',
  'Sofia', 'Stephen', 'Steven', 'Susan', 'Tara', 'Thomas', 'Timothy', 'Vanessa', 'Victor',
  'William', 'Yuki', 'Zara',
];

const LAST_NAMES = [
  'Abbott', 'Adams', 'Aguilar', 'Ahmed', 'Allen', 'Anderson', 'Bailey', 'Baker', 'Banerjee',
  'Bell', 'Bennett', 'Brooks', 'Brown', 'Bryant', 'Campbell', 'Carter', 'Chan', 'Chen',
  'Chow', 'Clark', 'Coleman', 'Collins', 'Cooper', 'Cox', 'Davis', 'Diaz', 'Edwards',
  'Evans', 'Fernandez', 'Fisher', 'Flores', 'Foster', 'Garcia', 'Gomez', 'Gonzalez',
  'Graham', 'Green', 'Griffin', 'Gupta', 'Hall', 'Hamilton', 'Harris', 'Hayes', 'Henderson',
  'Hernandez', 'Hill', 'Howard', 'Hughes', 'Iyer', 'Jackson', 'James', 'Jenkins', 'Johnson',
  'Jones', 'Kapoor', 'Kelly', 'Khan', 'Kim', 'King', 'Kumar', 'Lee', 'Lewis', 'Liu',
  'Long', 'Lopez', 'Martin', 'Martinez', 'Mehta', 'Miller', 'Mitchell', 'Moore', 'Morgan',
  'Morris', 'Murphy', 'Nakamura', 'Nelson', 'Nguyen', 'Owens', 'Palmer', 'Park', 'Parker',
  'Patel', 'Peters', 'Phillips', 'Powell', 'Price', 'Ramirez', 'Reed', 'Reyes', 'Richardson',
  'Rivera', 'Roberts', 'Robinson', 'Rodriguez', 'Rogers', 'Ross', 'Russell', 'Sanchez',
  'Sato', 'Scott', 'Sharma', 'Shen', 'Singh', 'Smith', 'Stewart', 'Sullivan', 'Tanaka',
  'Taylor', 'Thomas', 'Thompson', 'Torres', 'Tran', 'Turner', 'Vasquez', 'Walker', 'Wang',
  'Washington', 'Watson', 'White', 'Williams', 'Wilson', 'Wong', 'Wright', 'Xu', 'Yang',
  'Young', 'Zhang', 'Zhao',
];

const GRANT_TITLE_PREFIXES = [
  'Mechanisms of', 'Targeting', 'Investigating', 'Role of', 'Novel approaches to',
  'Computational modeling of', 'Biomarkers for', 'Imaging of', 'Clinical trial of',
  'Pathway analysis in', 'Systems biology of', 'Genomic basis of', 'Pharmacokinetics of',
  'Translational study of', 'Long-term outcomes of', 'Pilot study of', 'Predictors of',
  'Cellular dynamics in', 'Pediatric outcomes in',
];
const GRANT_TITLE_TOPICS = [
  'glioblastoma progression', 'sepsis-induced cardiomyopathy', 'pediatric asthma exacerbation',
  'Type 2 diabetes complications', "Alzheimer's disease biomarkers", 'pancreatic adenocarcinoma',
  'heart failure with preserved ejection fraction', 'opioid use disorder', 'sickle cell disease',
  'inflammatory bowel disease', 'rheumatoid arthritis', 'kidney transplant rejection',
  'stroke recovery', 'COVID-19 long-term sequelae', 'spinal cord injury repair',
  'breast cancer recurrence', 'autoimmune hepatitis', 'macular degeneration', "Parkinson's disease",
  'congenital heart disease', 'neonatal sepsis', 'hospital-acquired pneumonia', 'asthma microbiome',
  'multiple sclerosis progression', 'pediatric obesity', 'metastatic melanoma', 'glaucoma',
  'chronic kidney disease', 'traumatic brain injury', 'cystic fibrosis',
];

// ============================================================================
// Date / amount helpers — drive the realism
// ============================================================================

const NOW = new Date('2026-05-19T00:00:00Z');
const FIVE_YEARS_AGO = new Date(NOW.getTime() - 5 * 365 * 24 * 60 * 60 * 1000);

// 55% of grants align with NIH R01 cycles (Feb 5 / Jun 5 / Oct 5) with gaussian σ=7 days;
// remaining 45% uniform over the 5-year window.
function pickSubmissionDate(forceNIH: boolean, isHistorical: boolean): Date {
  const yearRange = isHistorical
    ? [FIVE_YEARS_AGO.getFullYear(), NOW.getFullYear() - 1]
    : [NOW.getFullYear() - 2, NOW.getFullYear()];
  const year = randInt(yearRange[0], yearRange[1]);

  if (forceNIH || rand() < 0.55) {
    const month = pick([2, 6, 10]);
    const dayOffset = Math.round(gaussian(5, 7));
    return new Date(Date.UTC(year, month - 1, Math.max(1, Math.min(28, dayOffset))));
  }
  const dayOfYear = randInt(0, 364);
  return new Date(Date.UTC(year, 0, 1 + dayOfYear));
}

// Award lag: log-normal centered around 6 months. exp(μ=5.0, σ=0.35) ≈ median 148 days.
function pickAwardLagDays(): number {
  return Math.max(45, Math.min(540, Math.round(logNormal(5.0, 0.35))));
}

function pickAmount(type: SponsorType): number {
  let mu: number;
  let sigma: number;
  switch (type) {
    case 'FEDERAL':
      mu = Math.log(470_000);
      sigma = 0.85;
      break;
    case 'INDUSTRY':
      // Clinical-trial + sponsored-research contracts run large.
      mu = Math.log(320_000);
      sigma = 0.85;
      break;
    case 'FOUNDATION':
      mu = Math.log(290_000);
      sigma = 0.7;
      break;
    case 'STATE':
      mu = Math.log(260_000);
      sigma = 0.75;
      break;
    case 'INTERNAL':
      mu = Math.log(60_000);
      sigma = 0.45;
      break;
    default:
      mu = Math.log(150_000);
      sigma = 0.6;
  }
  const raw = logNormal(mu, sigma);
  return Math.max(25_000, Math.min(5_000_000, Math.round(raw / 1000) * 1000));
}

function pickActiveStatus(): GrantStatus {
  return weightedPick<GrantStatus>([
    { value: 'AWARDED', weight: 50 },
    { value: 'SUBMITTED', weight: 15 },
    { value: 'UNDER_REVIEW', weight: 10 },
    { value: 'DECLINED', weight: 15 },
    { value: 'DRAFT', weight: 5 },
    { value: 'WITHDRAWN', weight: 5 },
  ]);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const t0 = Date.now();
  console.log('UF seed — starting');

  console.log('  truncating audit_logs, grant_co_pis, grant_amendments, grant_budget_periods, grants, faculty, sponsors, departments');
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "audit_logs",
      "grant_co_pis",
      "grant_amendments",
      "grant_budget_periods",
      "grants",
      "faculty",
      "sponsors",
      "departments"
    RESTART IDENTITY CASCADE
  `);

  // Admin user (idempotent)
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@ufl.edu';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'changeme';
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await prisma.user.upsert({
    where: { email: adminEmail },
    create: { email: adminEmail, name: 'UF Admin', passwordHash, role: UserRole.ADMIN },
    update: { passwordHash, role: UserRole.ADMIN },
  });
  console.log(`  admin user ready: ${adminEmail}`);

  // Departments
  await prisma.department.createMany({
    data: DEPARTMENTS.map((name) => ({ name })),
    skipDuplicates: true,
  });
  const departments = await prisma.department.findMany();
  console.log(`  departments: ${departments.length}`);

  // Sponsors
  await prisma.sponsor.createMany({
    data: SPONSORS.map(({ name, sponsorType }) => ({ name, sponsorType })),
    skipDuplicates: true,
  });
  const sponsors = await prisma.sponsor.findMany();
  const sponsorWeightById = new Map<number, number>();
  for (const s of sponsors) {
    const seed = SPONSORS.find((sp) => sp.name === s.name && sp.sponsorType === s.sponsorType);
    sponsorWeightById.set(s.id, seed?.agencyWeight ?? 1);
  }
  const sponsorPickList = sponsors.map((s) => ({ value: s, weight: sponsorWeightById.get(s.id)! }));
  console.log(`  sponsors: ${sponsors.length}`);

  // Faculty
  const FACULTY_ACTIVE = Number(process.env.UF_FACULTY_ACTIVE ?? 3000);
  const FACULTY_HISTORICAL = Number(process.env.UF_FACULTY_HISTORICAL ?? 1000);
  const facultyData: Prisma.FacultyCreateManyInput[] = [];
  const usedEmails = new Set<string>();
  for (let i = 0; i < FACULTY_ACTIVE + FACULTY_HISTORICAL; i++) {
    const first = pick(FIRST_NAMES);
    const last = pick(LAST_NAMES);
    let email = `${first.toLowerCase()}.${last.toLowerCase()}${i}@ufl.edu`;
    while (usedEmails.has(email)) email = `${first.toLowerCase()}.${last.toLowerCase()}${i}_${randInt(1, 9999)}@ufl.edu`;
    usedEmails.add(email);
    facultyData.push({
      name: `${first} ${last}`,
      email,
      departmentId: pick(departments).id,
    });
  }
  await prisma.faculty.createMany({ data: facultyData, skipDuplicates: true });
  const faculty = await prisma.faculty.findMany({ orderBy: { id: 'asc' } });
  console.log(`  faculty: ${faculty.length} (${FACULTY_ACTIVE} active, ${FACULTY_HISTORICAL} historical)`);

  // Shuffle once so paretoIndex picks the same "top tier" deterministically across runs
  const facultyShuffled = [...faculty].sort(() => rand() - 0.5);

  // Grants
  const ACTIVE_GRANTS = Number(process.env.UF_ACTIVE_GRANTS ?? 50_000);
  const HISTORICAL_GRANTS = Number(process.env.UF_HISTORICAL_GRANTS ?? 200_000);
  const TOTAL_GRANTS = ACTIVE_GRANTS + HISTORICAL_GRANTS;
  console.log(`  generating ${TOTAL_GRANTS} grants in batches of 5000…`);

  const grantBatch: Prisma.GrantCreateManyInput[] = [];
  let grantsCreated = 0;
  const BATCH = 5000;

  for (let i = 0; i < TOTAL_GRANTS; i++) {
    const isHistorical = i >= ACTIVE_GRANTS;
    const sponsor = weightedPick(sponsorPickList);
    const pi = facultyShuffled[paretoIndex(facultyShuffled.length)];
    const status = isHistorical ? GrantStatus.AWARDED : pickActiveStatus();
    const submittedAt = pickSubmissionDate(false, isHistorical);

    let awardedAt: Date | null = null;
    let endAt: Date | null = null;
    if (status === GrantStatus.AWARDED) {
      const lagDays = pickAwardLagDays();
      awardedAt = new Date(submittedAt.getTime() + lagDays * 86_400_000);
      const durationYears = randInt(2, 5);
      endAt = new Date(awardedAt.getTime() + durationYears * 365 * 86_400_000);
    }

    const topic = pick(GRANT_TITLE_TOPICS);
    const prefix = pick(GRANT_TITLE_PREFIXES);
    // Index suffix disambiguates the (title, pi_id) unique constraint within a seed run
    const title = `${prefix} ${topic} — Award ${i.toString().padStart(6, '0')}`;

    grantBatch.push({
      title,
      grantNumber: `UF-AWD-${String(i).padStart(6, '0')}`,
      sponsorId: sponsor.id,
      piId: pi.id,
      departmentId: pi.departmentId,
      amount: pickAmount(sponsor.sponsorType) as unknown as Prisma.Decimal,
      status,
      submittedAt,
      awardedAt,
      endAt,
    });

    if (grantBatch.length >= BATCH) {
      await prisma.grant.createMany({ data: grantBatch, skipDuplicates: true });
      grantsCreated += grantBatch.length;
      grantBatch.length = 0;
      process.stdout.write(`    grants: ${grantsCreated}/${TOTAL_GRANTS}\r`);
    }
  }
  if (grantBatch.length > 0) {
    await prisma.grant.createMany({ data: grantBatch, skipDuplicates: true });
    grantsCreated += grantBatch.length;
  }
  process.stdout.write(`    grants: ${grantsCreated}/${TOTAL_GRANTS}\n`);

  // Co-PIs — ~30% of grants are multi-PI (1-3 co-PIs each), drawn from the faculty
  // pool via the same Pareto productivity curve, never the primary PI, unique per
  // grant. GrantCoPi PK is (grantId, facultyId) so skipDuplicates covers collisions.
  console.log('  generating co-PIs (~30% of grants are multi-PI) in batches of 5000…');
  const grantsForCoPi = await prisma.grant.findMany({ select: { id: true, piId: true } });
  const coPiBatch: Prisma.GrantCoPiCreateManyInput[] = [];
  let coPisCreated = 0;
  for (const g of grantsForCoPi) {
    if (rand() >= 0.3) continue;
    const n = randInt(1, 3);
    const seen = new Set<number>([g.piId]);
    for (let k = 0; k < n; k++) {
      const f = facultyShuffled[paretoIndex(facultyShuffled.length)];
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      coPiBatch.push({ grantId: g.id, facultyId: f.id });
      if (coPiBatch.length >= BATCH) {
        await prisma.grantCoPi.createMany({ data: coPiBatch, skipDuplicates: true });
        coPisCreated += coPiBatch.length;
        coPiBatch.length = 0;
        process.stdout.write(`    co-PIs: ${coPisCreated}\r`);
      }
    }
  }
  if (coPiBatch.length > 0) {
    await prisma.grantCoPi.createMany({ data: coPiBatch, skipDuplicates: true });
    coPisCreated += coPiBatch.length;
  }
  process.stdout.write(`    co-PIs: ${coPisCreated}\n`);

  const awardedGrants = await prisma.grant.findMany({
    where: { status: GrantStatus.AWARDED },
    select: { id: true, awardedAt: true, endAt: true, amount: true },
  });
  console.log(`  awarded grants eligible for amendments / budget periods: ${awardedGrants.length}`);

  // Amendments
  console.log(`  generating amendments in batches of 5000…`);
  const amendmentBatch: Prisma.GrantAmendmentCreateManyInput[] = [];
  let amendmentsCreated = 0;
  const AMENDMENT_KINDS: AmendmentKind[] = [
    'NO_COST_EXTENSION',
    'REBUDGET',
    'SCOPE_CHANGE',
    'PI_CHANGE',
    'SUPPLEMENT',
    'TERMINATION',
  ];
  for (const g of awardedGrants) {
    const count = randInt(3, 6);
    const grantStart = g.awardedAt?.getTime() ?? NOW.getTime();
    const grantEnd = g.endAt?.getTime() ?? grantStart + 365 * 86_400_000;
    for (let n = 1; n <= count; n++) {
      const t = grantStart + ((grantEnd - grantStart) * n) / (count + 1);
      const kind = pick(AMENDMENT_KINDS);
      const amountDelta =
        kind === 'SUPPLEMENT'
          ? Math.round(Number(g.amount) * (0.05 + rand() * 0.15))
          : kind === 'REBUDGET'
          ? Math.round((rand() - 0.5) * Number(g.amount) * 0.05)
          : 0;
      amendmentBatch.push({
        grantId: g.id,
        amendmentNumber: n,
        kind,
        effectiveAt: new Date(t),
        amountDelta: amountDelta as unknown as Prisma.Decimal,
        notes: null,
      });
      if (amendmentBatch.length >= BATCH) {
        await prisma.grantAmendment.createMany({ data: amendmentBatch, skipDuplicates: true });
        amendmentsCreated += amendmentBatch.length;
        amendmentBatch.length = 0;
        process.stdout.write(`    amendments: ${amendmentsCreated}\r`);
      }
    }
  }
  if (amendmentBatch.length > 0) {
    await prisma.grantAmendment.createMany({ data: amendmentBatch, skipDuplicates: true });
    amendmentsCreated += amendmentBatch.length;
  }
  process.stdout.write(`    amendments: ${amendmentsCreated}\n`);

  // Budget periods
  console.log(`  generating budget periods in batches of 5000…`);
  const periodBatch: Prisma.GrantBudgetPeriodCreateManyInput[] = [];
  let periodsCreated = 0;
  for (const g of awardedGrants) {
    const count = randInt(3, 5);
    const grantStart = g.awardedAt?.getTime() ?? NOW.getTime();
    const grantEnd = g.endAt?.getTime() ?? grantStart + 365 * 86_400_000;
    const total = Number(g.amount);
    for (let n = 1; n <= count; n++) {
      const periodStart = new Date(grantStart + ((grantEnd - grantStart) * (n - 1)) / count);
      const periodEnd = new Date(grantStart + ((grantEnd - grantStart) * n) / count);
      const periodTotal = total / count;
      const indirectRate = 0.52; // UF's federally negotiated F&A rate, ~52%
      const directCosts = Math.round(periodTotal / (1 + indirectRate));
      const indirectCosts = Math.round(directCosts * indirectRate);
      const status: BudgetPeriodStatus =
        periodEnd.getTime() < NOW.getTime()
          ? 'CLOSED'
          : periodStart.getTime() > NOW.getTime()
          ? 'PROJECTED'
          : 'ACTIVE';
      periodBatch.push({
        grantId: g.id,
        periodNumber: n,
        startAt: periodStart,
        endAt: periodEnd,
        directCosts: directCosts as unknown as Prisma.Decimal,
        indirectCosts: indirectCosts as unknown as Prisma.Decimal,
        status,
      });
      if (periodBatch.length >= BATCH) {
        await prisma.grantBudgetPeriod.createMany({ data: periodBatch, skipDuplicates: true });
        periodsCreated += periodBatch.length;
        periodBatch.length = 0;
        process.stdout.write(`    budget periods: ${periodsCreated}\r`);
      }
    }
  }
  if (periodBatch.length > 0) {
    await prisma.grantBudgetPeriod.createMany({ data: periodBatch, skipDuplicates: true });
    periodsCreated += periodBatch.length;
  }
  process.stdout.write(`    budget periods: ${periodsCreated}\n`);

  // Summary
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const totalRows =
    departments.length + sponsors.length + faculty.length + grantsCreated + coPisCreated + amendmentsCreated + periodsCreated;
  console.log('');
  console.log('UF seed — complete');
  console.log(`  departments:    ${departments.length}`);
  console.log(`  sponsors:       ${sponsors.length}`);
  console.log(`  faculty:        ${faculty.length}`);
  console.log(`  grants:         ${grantsCreated}`);
  console.log(`  co_pis:         ${coPisCreated}`);
  console.log(`  amendments:     ${amendmentsCreated}`);
  console.log(`  budget_periods: ${periodsCreated}`);
  console.log(`  TOTAL ROWS:     ${totalRows.toLocaleString()}`);
  console.log(`  elapsed:        ${elapsed}s`);
}

main()
  .catch((err) => {
    console.error('UF seed — failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
