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

  console.log('Created sponsors');

  // Create sample grants
  const now = new Date();
  const sixMonthsAgo = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000);
  const threeMonthsAgo = new Date(now.getTime() - 3 * 30 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  await prisma.grant.createMany({
    data: [
      {
        title: 'Advanced Machine Learning for Medical Diagnostics',
        sponsorId: sponsorNSF.id,
        piId: faculty1.id,
        departmentId: deptEngineering.id,
        amount: 500000.00,
        status: 'awarded',
        submittedAt: sixMonthsAgo,
        awardedAt: threeMonthsAgo,
      },
      {
        title: 'Novel Cancer Treatment Protocols',
        sponsorId: sponsorNIH.id,
        piId: faculty2.id,
        departmentId: deptMedicine.id,
        amount: 1200000.00,
        status: 'awarded',
        submittedAt: sixMonthsAgo,
        awardedAt: oneMonthAgo,
      },
      {
        title: 'Ecosystem Biodiversity Study',
        sponsorId: sponsorGates.id,
        piId: faculty3.id,
        departmentId: deptBiology.id,
        amount: 750000.00,
        status: 'under_review',
        submittedAt: threeMonthsAgo,
        awardedAt: null,
      },
      {
        title: 'Sustainable Chemical Synthesis Methods',
        sponsorId: sponsorNSF.id,
        piId: faculty4.id,
        departmentId: deptChemistry.id,
        amount: 350000.00,
        status: 'submitted',
        submittedAt: oneMonthAgo,
        awardedAt: null,
      },
      {
        title: 'Renewable Energy Storage Systems',
        sponsorId: sponsorState.id,
        piId: faculty5.id,
        departmentId: deptEngineering.id,
        amount: 250000.00,
        status: 'awarded',
        submittedAt: sixMonthsAgo,
        awardedAt: threeMonthsAgo,
      },
      {
        title: 'Neural Network Optimization Algorithms',
        sponsorId: sponsorNSF.id,
        piId: faculty1.id,
        departmentId: deptEngineering.id,
        amount: 400000.00,
        status: 'declined',
        submittedAt: sixMonthsAgo,
        awardedAt: null,
      },
    ],
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

