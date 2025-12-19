import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create departments
  const deptEngineering = await prisma.department.upsert({
    where: { name: 'Engineering' },
    update: {},
    create: { name: 'Engineering' },
  });

  const deptMedicine = await prisma.department.upsert({
    where: { name: 'Medicine' },
    update: {},
    create: { name: 'Medicine' },
  });

  const deptBiology = await prisma.department.upsert({
    where: { name: 'Biology' },
    update: {},
    create: { name: 'Biology' },
  });

  const deptChemistry = await prisma.department.upsert({
    where: { name: 'Chemistry' },
    update: {},
    create: { name: 'Chemistry' },
  });

  const deptPhysics = await prisma.department.upsert({
    where: { name: 'Physics' },
    update: {},
    create: { name: 'Physics' },
  });

  const deptMathematics = await prisma.department.upsert({
    where: { name: 'Mathematics' },
    update: {},
    create: { name: 'Mathematics' },
  });

  const deptComputerScience = await prisma.department.upsert({
    where: { name: 'Computer Science' },
    update: {},
    create: { name: 'Computer Science' },
  });

  console.log('Created departments');

  // Create faculty
  const faculty1 = await prisma.faculty.upsert({
    where: { email: 'jane.smith@university.edu' },
    update: {},
    create: {
      name: 'Dr. Jane Smith',
      email: 'jane.smith@university.edu',
      departmentId: deptEngineering.id,
    },
  });

  const faculty2 = await prisma.faculty.upsert({
    where: { email: 'john.doe@university.edu' },
    update: {},
    create: {
      name: 'Dr. John Doe',
      email: 'john.doe@university.edu',
      departmentId: deptMedicine.id,
    },
  });

  const faculty3 = await prisma.faculty.upsert({
    where: { email: 'sarah.johnson@university.edu' },
    update: {},
    create: {
      name: 'Dr. Sarah Johnson',
      email: 'sarah.johnson@university.edu',
      departmentId: deptBiology.id,
    },
  });

  const faculty4 = await prisma.faculty.upsert({
    where: { email: 'michael.chen@university.edu' },
    update: {},
    create: {
      name: 'Dr. Michael Chen',
      email: 'michael.chen@university.edu',
      departmentId: deptChemistry.id,
    },
  });

  const faculty5 = await prisma.faculty.upsert({
    where: { email: 'emily.williams@university.edu' },
    update: {},
    create: {
      name: 'Dr. Emily Williams',
      email: 'emily.williams@university.edu',
      departmentId: deptEngineering.id,
    },
  });

  const faculty6 = await prisma.faculty.upsert({
    where: { email: 'robert.brown@university.edu' },
    update: {},
    create: {
      name: 'Dr. Robert Brown',
      email: 'robert.brown@university.edu',
      departmentId: deptPhysics.id,
    },
  });

  const faculty7 = await prisma.faculty.upsert({
    where: { email: 'lisa.anderson@university.edu' },
    update: {},
    create: {
      name: 'Dr. Lisa Anderson',
      email: 'lisa.anderson@university.edu',
      departmentId: deptMathematics.id,
    },
  });

  const faculty8 = await prisma.faculty.upsert({
    where: { email: 'david.martinez@university.edu' },
    update: {},
    create: {
      name: 'Dr. David Martinez',
      email: 'david.martinez@university.edu',
      departmentId: deptComputerScience.id,
    },
  });

  const faculty9 = await prisma.faculty.upsert({
    where: { email: 'patricia.taylor@university.edu' },
    update: {},
    create: {
      name: 'Dr. Patricia Taylor',
      email: 'patricia.taylor@university.edu',
      departmentId: deptMedicine.id,
    },
  });

  const faculty10 = await prisma.faculty.upsert({
    where: { email: 'james.wilson@university.edu' },
    update: {},
    create: {
      name: 'Dr. James Wilson',
      email: 'james.wilson@university.edu',
      departmentId: deptBiology.id,
    },
  });

  console.log('Created faculty');

  // Create sponsors
  const sponsorNSF = await prisma.sponsor.upsert({
    where: {
      name_sponsorType: {
        name: 'National Science Foundation',
        sponsorType: 'federal',
      },
    },
    update: {},
    create: {
      name: 'National Science Foundation',
      sponsorType: 'federal',
    },
  });

  const sponsorNIH = await prisma.sponsor.upsert({
    where: {
      name_sponsorType: {
        name: 'National Institutes of Health',
        sponsorType: 'federal',
      },
    },
    update: {},
    create: {
      name: 'National Institutes of Health',
      sponsorType: 'federal',
    },
    });

  const sponsorGates = await prisma.sponsor.upsert({
    where: {
      name_sponsorType: {
        name: 'Bill & Melinda Gates Foundation',
        sponsorType: 'foundation',
      },
    },
    update: {},
    create: {
      name: 'Bill & Melinda Gates Foundation',
      sponsorType: 'foundation',
    },
  });

  const sponsorState = await prisma.sponsor.upsert({
    where: {
      name_sponsorType: {
        name: 'State Research Council',
        sponsorType: 'state',
      },
    },
    update: {},
    create: {
      name: 'State Research Council',
      sponsorType: 'state',
    },
  });

  const sponsorCorporate = await prisma.sponsor.upsert({
    where: {
      name_sponsorType: {
        name: 'Tech Innovations Inc.',
        sponsorType: 'corporate',
      },
    },
    update: {},
    create: {
      name: 'Tech Innovations Inc.',
      sponsorType: 'corporate',
    },
  });

  const sponsorOther = await prisma.sponsor.upsert({
    where: {
      name_sponsorType: {
        name: 'International Research Consortium',
        sponsorType: 'other',
      },
    },
    update: {},
    create: {
      name: 'International Research Consortium',
      sponsorType: 'other',
    },
  });

  const sponsorDOE = await prisma.sponsor.upsert({
    where: {
      name_sponsorType: {
        name: 'Department of Energy',
        sponsorType: 'federal',
      },
    },
    update: {},
    create: {
      name: 'Department of Energy',
      sponsorType: 'federal',
    },
  });

  const sponsorFord = await prisma.sponsor.upsert({
    where: {
      name_sponsorType: {
        name: 'Ford Foundation',
        sponsorType: 'foundation',
      },
    },
    update: {},
    create: {
      name: 'Ford Foundation',
      sponsorType: 'foundation',
    },
  });

  console.log('Created sponsors');

  // Create sample grants with diverse data across last 24 months
  const now = new Date();
  const grants = [];

  // Helper to generate dates
  const monthsAgo = (months: number) => {
    const date = new Date(now);
    date.setMonth(date.getMonth() - months);
    return date;
  };

  const daysAgo = (days: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() - days);
    return date;
  };

  const allFaculty = [faculty1, faculty2, faculty3, faculty4, faculty5, faculty6, faculty7, faculty8, faculty9, faculty10];
  const allDepartments = [deptEngineering, deptMedicine, deptBiology, deptChemistry, deptPhysics, deptMathematics, deptComputerScience];
  const allSponsors = [
    { sponsor: sponsorNSF, type: 'federal' },
    { sponsor: sponsorNIH, type: 'federal' },
    { sponsor: sponsorDOE, type: 'federal' },
    { sponsor: sponsorState, type: 'state' },
    { sponsor: sponsorGates, type: 'foundation' },
    { sponsor: sponsorFord, type: 'foundation' },
    { sponsor: sponsorCorporate, type: 'corporate' },
    { sponsor: sponsorOther, type: 'other' },
  ];

  const statuses = ['draft', 'submitted', 'under_review', 'awarded', 'declined'];
  const grantTitles = [
    'Advanced Machine Learning for Medical Diagnostics',
    'Novel Cancer Treatment Protocols',
    'Ecosystem Biodiversity Study',
    'Sustainable Chemical Synthesis Methods',
    'Renewable Energy Storage Systems',
    'Neural Network Optimization Algorithms',
    'Quantum Computing Applications',
    'Climate Change Impact Analysis',
    'Drug Discovery and Development',
    'Artificial Intelligence in Healthcare',
    'Renewable Energy Technologies',
    'Materials Science Innovations',
    'Genomic Research and Analysis',
    'Robotics and Automation',
    'Data Science Methodologies',
    'Biomedical Engineering Solutions',
    'Environmental Sustainability Research',
    'Cybersecurity Protocols',
    'Space Exploration Technologies',
    'Agricultural Innovation Systems',
    'Marine Biology Research',
    'Astrophysics Observations',
    'Mathematical Modeling',
    'Computational Biology',
    'Nanotechnology Applications',
  ];

  // Generate grants across last 24 months with diverse statuses
  for (let i = 0; i < 80; i++) {
    const monthsBack = Math.floor(Math.random() * 24);
    const submittedDate = monthsAgo(monthsBack);
    const daysAfterSubmission = Math.floor(Math.random() * 180) + 30; // 30-210 days
    const awardedDate = new Date(submittedDate);
    awardedDate.setDate(awardedDate.getDate() + daysAfterSubmission);

    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const faculty = allFaculty[Math.floor(Math.random() * allFaculty.length)];
    const dept = allDepartments[Math.floor(Math.random() * allDepartments.length)];
    const sponsorInfo = allSponsors[Math.floor(Math.random() * allSponsors.length)];
    const title = grantTitles[Math.floor(Math.random() * grantTitles.length)] + ` ${i + 1}`;
    const amount = Math.floor(Math.random() * 2000000) + 100000; // $100K - $2M

    grants.push({
      title,
      sponsorId: sponsorInfo.sponsor.id,
      piId: faculty.id,
      departmentId: dept.id,
      amount: amount,
      status,
      submittedAt: status === 'draft' ? null : submittedDate,
      awardedAt: status === 'awarded' && awardedDate <= now ? awardedDate : null,
    });
  }

  // Add some grants with specific statuses to ensure we have data for all filters
  grants.push(
    // Draft grants
    {
      title: 'Draft Grant - Engineering Project',
      sponsorId: sponsorNSF.id,
      piId: faculty1.id,
      departmentId: deptEngineering.id,
      amount: 300000,
      status: 'draft',
      submittedAt: null,
      awardedAt: null,
    },
    {
      title: 'Draft Grant - Medical Research',
      sponsorId: sponsorNIH.id,
      piId: faculty2.id,
      departmentId: deptMedicine.id,
      amount: 500000,
      status: 'draft',
      submittedAt: null,
      awardedAt: null,
    },
    // Submitted grants
    {
      title: 'Submitted Grant - Biology Study',
      sponsorId: sponsorGates.id,
      piId: faculty3.id,
      departmentId: deptBiology.id,
      amount: 400000,
      status: 'submitted',
      submittedAt: daysAgo(15),
      awardedAt: null,
    },
    {
      title: 'Submitted Grant - Chemistry Research',
      sponsorId: sponsorNSF.id,
      piId: faculty4.id,
      departmentId: deptChemistry.id,
      amount: 350000,
      status: 'submitted',
      submittedAt: daysAgo(45),
      awardedAt: null,
    },
    // Under review grants
    {
      title: 'Under Review - Physics Experiment',
      sponsorId: sponsorDOE.id,
      piId: faculty6.id,
      departmentId: deptPhysics.id,
      amount: 600000,
      status: 'under_review',
      submittedAt: monthsAgo(2),
      awardedAt: null,
    },
    {
      title: 'Under Review - Math Theory',
      sponsorId: sponsorNSF.id,
      piId: faculty7.id,
      departmentId: deptMathematics.id,
      amount: 250000,
      status: 'under_review',
      submittedAt: monthsAgo(3),
      awardedAt: null,
    },
    // Declined grants
    {
      title: 'Declined Grant - CS Project',
      sponsorId: sponsorCorporate.id,
      piId: faculty8.id,
      departmentId: deptComputerScience.id,
      amount: 200000,
      status: 'declined',
      submittedAt: monthsAgo(4),
      awardedAt: null,
    },
    {
      title: 'Declined Grant - Medical Trial',
      sponsorId: sponsorNIH.id,
      piId: faculty9.id,
      departmentId: deptMedicine.id,
      amount: 800000,
      status: 'declined',
      submittedAt: monthsAgo(6),
      awardedAt: null,
    }
  );

  await prisma.grant.createMany({
    data: grants,
    skipDuplicates: true,
  });

  console.log('Created sample grants');
  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

