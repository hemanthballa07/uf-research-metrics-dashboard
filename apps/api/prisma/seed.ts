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
  // Create 250 grants for rich visualizations
  for (let i = 0; i < 250; i++) {
    const monthsBack = Math.floor(Math.random() * 24);
    const submittedDate = monthsAgo(monthsBack);
    const daysAfterSubmission = Math.floor(Math.random() * 180) + 30; // 30-210 days
    const awardedDate = new Date(submittedDate);
    awardedDate.setDate(awardedDate.getDate() + daysAfterSubmission);

    // Weight statuses more realistically: more submitted/awarded, fewer declined
    let status;
    const statusRoll = Math.random();
    if (statusRoll < 0.15) status = 'draft';
    else if (statusRoll < 0.35) status = 'submitted';
    else if (statusRoll < 0.55) status = 'under_review';
    else if (statusRoll < 0.85) status = 'awarded';
    else status = 'declined';

    const faculty = allFaculty[Math.floor(Math.random() * allFaculty.length)];
    const dept = allDepartments[Math.floor(Math.random() * allDepartments.length)];
    const sponsorInfo = allSponsors[Math.floor(Math.random() * allSponsors.length)];
    const title = grantTitles[Math.floor(Math.random() * grantTitles.length)] + ` ${i + 1}`;
    
    // More realistic amounts: federal grants tend to be larger
    let amount;
    if (sponsorInfo.type === 'federal') {
      amount = Math.floor(Math.random() * 3000000) + 200000; // $200K - $3.2M
    } else if (sponsorInfo.type === 'foundation') {
      amount = Math.floor(Math.random() * 1500000) + 150000; // $150K - $1.65M
    } else if (sponsorInfo.type === 'corporate') {
      amount = Math.floor(Math.random() * 1000000) + 100000; // $100K - $1.1M
    } else {
      amount = Math.floor(Math.random() * 800000) + 50000; // $50K - $850K
    }

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

  // Add strategic grants to ensure all departments, sponsors, and statuses are well-represented
  // This ensures filters work properly and charts look good
  const strategicGrants = [
    // Medicine department - high value grants
    { dept: deptMedicine, faculty: faculty2, sponsor: sponsorNIH, amount: 2500000, status: 'awarded', monthsBack: 3 },
    { dept: deptMedicine, faculty: faculty9, sponsor: sponsorNIH, amount: 1800000, status: 'awarded', monthsBack: 6 },
    { dept: deptMedicine, faculty: faculty2, sponsor: sponsorGates, amount: 1200000, status: 'awarded', monthsBack: 9 },
    { dept: deptMedicine, faculty: faculty9, sponsor: sponsorNIH, amount: 900000, status: 'under_review', monthsBack: 2 },
    { dept: deptMedicine, faculty: faculty2, sponsor: sponsorNIH, amount: 750000, status: 'submitted', monthsBack: 1 },
    
    // Engineering department - diverse sponsors
    { dept: deptEngineering, faculty: faculty1, sponsor: sponsorNSF, amount: 2200000, status: 'awarded', monthsBack: 4 },
    { dept: deptEngineering, faculty: faculty5, sponsor: sponsorDOE, amount: 1900000, status: 'awarded', monthsBack: 7 },
    { dept: deptEngineering, faculty: faculty1, sponsor: sponsorCorporate, amount: 800000, status: 'awarded', monthsBack: 5 },
    { dept: deptEngineering, faculty: faculty5, sponsor: sponsorNSF, amount: 1500000, status: 'under_review', monthsBack: 3 },
    { dept: deptEngineering, faculty: faculty1, sponsor: sponsorDOE, amount: 1100000, status: 'submitted', monthsBack: 1 },
    
    // Biology department
    { dept: deptBiology, faculty: faculty3, sponsor: sponsorGates, amount: 1400000, status: 'awarded', monthsBack: 8 },
    { dept: deptBiology, faculty: faculty10, sponsor: sponsorNSF, amount: 950000, status: 'awarded', monthsBack: 12 },
    { dept: deptBiology, faculty: faculty3, sponsor: sponsorFord, amount: 650000, status: 'awarded', monthsBack: 15 },
    { dept: deptBiology, faculty: faculty10, sponsor: sponsorGates, amount: 850000, status: 'under_review', monthsBack: 4 },
    
    // Chemistry department
    { dept: deptChemistry, faculty: faculty4, sponsor: sponsorNSF, amount: 1100000, status: 'awarded', monthsBack: 6 },
    { dept: deptChemistry, faculty: faculty4, sponsor: sponsorDOE, amount: 1300000, status: 'awarded', monthsBack: 10 },
    { dept: deptChemistry, faculty: faculty4, sponsor: sponsorCorporate, amount: 500000, status: 'awarded', monthsBack: 18 },
    
    // Physics department
    { dept: deptPhysics, faculty: faculty6, sponsor: sponsorDOE, amount: 2100000, status: 'awarded', monthsBack: 5 },
    { dept: deptPhysics, faculty: faculty6, sponsor: sponsorNSF, amount: 1600000, status: 'awarded', monthsBack: 11 },
    { dept: deptPhysics, faculty: faculty6, sponsor: sponsorDOE, amount: 1200000, status: 'under_review', monthsBack: 2 },
    
    // Mathematics department
    { dept: deptMathematics, faculty: faculty7, sponsor: sponsorNSF, amount: 700000, status: 'awarded', monthsBack: 7 },
    { dept: deptMathematics, faculty: faculty7, sponsor: sponsorNSF, amount: 550000, status: 'awarded', monthsBack: 14 },
    { dept: deptMathematics, faculty: faculty7, sponsor: sponsorState, amount: 300000, status: 'awarded', monthsBack: 20 },
    
    // Computer Science department
    { dept: deptComputerScience, faculty: faculty8, sponsor: sponsorNSF, amount: 1000000, status: 'awarded', monthsBack: 4 },
    { dept: deptComputerScience, faculty: faculty8, sponsor: sponsorCorporate, amount: 750000, status: 'awarded', monthsBack: 8 },
    { dept: deptComputerScience, faculty: faculty8, sponsor: sponsorNSF, amount: 900000, status: 'under_review', monthsBack: 3 },
    
    // Some declined grants for realism
    { dept: deptMedicine, faculty: faculty2, sponsor: sponsorNIH, amount: 600000, status: 'declined', monthsBack: 8 },
    { dept: deptEngineering, faculty: faculty1, sponsor: sponsorNSF, amount: 450000, status: 'declined', monthsBack: 12 },
    { dept: deptBiology, faculty: faculty3, sponsor: sponsorGates, amount: 350000, status: 'declined', monthsBack: 16 },
    
    // Recent submissions
    { dept: deptMedicine, faculty: faculty9, sponsor: sponsorNIH, amount: 1100000, status: 'submitted', monthsBack: 0 },
    { dept: deptEngineering, faculty: faculty5, sponsor: sponsorDOE, amount: 1300000, status: 'submitted', monthsBack: 0 },
    { dept: deptComputerScience, faculty: faculty8, sponsor: sponsorNSF, amount: 850000, status: 'submitted', monthsBack: 0 },
  ];

  strategicGrants.forEach((grant) => {
    const submittedDate = monthsAgo(grant.monthsBack);
    const daysAfterSubmission = Math.floor(Math.random() * 120) + 60; // 60-180 days
    const awardedDate = new Date(submittedDate);
    awardedDate.setDate(awardedDate.getDate() + daysAfterSubmission);

    grants.push({
      title: `${grant.status} Grant - ${grant.dept.name} Project`,
      sponsorId: grant.sponsor.id,
      piId: grant.faculty.id,
      departmentId: grant.dept.id,
      amount: grant.amount,
      status: grant.status,
      submittedAt: grant.status === 'draft' ? null : submittedDate,
      awardedAt: grant.status === 'awarded' && awardedDate <= now ? awardedDate : null,
    });
  });

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

